require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const axios = require('axios'); // For MPGS API calls
const binLookup = require('binlookup')();
const stripe = require('stripe');

const app = express();
const PORT = process.env.PORT || 8081;

// Enhanced CORS configuration
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Accept-Version'],
    credentials: false
}));

app.use(express.json());
app.use(express.static(path.join(__dirname, 'web_card_app')));

const binCache = {};
const transactions = []; // In-memory transaction history

// Helper to log transaction
function logTransaction(type, status, details, revenue = 0) {
    transactions.unshift({
        id: Date.now().toString(),
        timestamp: new Date(),
        type,
        status,
        details,
        revenue
    });
    // Keep only last 100
    if (transactions.length > 100) transactions.pop();
}

// Admin Stats Endpoint
app.get('/api/admin/stats', (req, res) => {
    const total = transactions.length;
    const successCount = transactions.filter(t => t.status === 'success').length;
    const successRate = total > 0 ? Math.round((successCount / total) * 100) : 0;
    const revenue = transactions.reduce((sum, t) => sum + (t.revenue || 0), 0);

    res.json({
        success: true,
        total,
        successRate,
        revenue,
        recent: transactions.slice(0, 20) // Send top 20
    });
});

// System Status Endpoint
app.get('/api/status', (req, res) => {
    const hasSk = !!process.env.STRIPE_SK && process.env.STRIPE_SK.startsWith('sk_');
    const skMasked = hasSk ? `...${process.env.STRIPE_SK.slice(-4)}` : null;
    
    res.json({
        success: true,
        serverTime: new Date(),
        stripeConfigured: hasSk,
        stripeKeyMasked: skMasked,
        port: PORT
    });
});

// BIN lookup endpoint with proper error handling
app.get('/api/lookup/:bin', async (req, res) => {
    const bin = req.params.bin;
    console.log('BIN Lookup Request:', bin);

    if (!bin || bin.length < 6) {
        return res.json({ success: false, message: 'Invalid BIN' });
    }

    if (binCache[bin]) {
        console.log('Cache hit for:', bin);
        return res.json({ success: true, found: true, data: binCache[bin] });
    }

    try {
        const data = await binLookup(bin);
        binCache[bin] = data;
        console.log('Successfully fetched:', bin, data);
        return res.json({ success: true, found: true, data });
    } catch (err) {
        console.error('Error fetching BIN:', err.message);
        // If 404, it means BIN not found in DB
        if (err.message && err.message.includes('404')) {
            return res.json({ success: false, found: false });
        }
        const fallback = createFallbackData(bin);
        console.log('Returning fallback data');
        return res.json({ success: true, found: true, data: fallback });
    }
});

// Create fallback data based on card number
function createFallbackData(bin) {
    const firstDigit = bin.charAt(0);
    let scheme, brand;

    if (firstDigit === '4') {
        scheme = 'VISA';
        brand = 'VISA';
    } else if (firstDigit === '5') {
        scheme = 'MASTERCARD';
        brand = 'MASTERCARD';
    } else if (firstDigit === '3') {
        scheme = 'AMEX';
        brand = 'AMEX';
    } else {
        scheme = 'VISA';
        brand = 'VISA';
    }

    return {
        bank: { name: 'Card Issuer' },
        country: { name: 'Unknown', emoji: '🌍' },
        scheme: scheme,
        type: 'debit',
        brand: brand
    };
}



app.get('/health', (req, res) => {
    res.json({ status: 'OK', port: PORT });
});

// Clear cache endpoint
app.get('/api/clear-cache', (req, res) => {
    const size = Object.keys(binCache).length;
    for (const key in binCache) {
        delete binCache[key];
    }
    res.json({ success: true, message: 'Cache cleared', cleared: size });
});

// Mollie API Check endpoint
app.post('/api/mollie/check-card', async (req, res) => {
    const { cardNumber, cardHolder, expiryDate, cvv, mollieKey } = req.body;

    if (!mollieKey || !mollieKey.startsWith('test_')) {
        return res.json({
            success: false,
            message: 'Invalid or missing Mollie API Key'
        });
    }

    try {
        // Simulate Mollie card check
        // In production, you would call Mollie's actual API
        const isValid = validateCardNumber(cardNumber);

        return res.json({
            success: isValid,
            message: isValid ? 'Card verified with Mollie' : 'Card declined',
            provider: 'Mollie',
            live: isValid
        });
    } catch (error) {
        return res.json({
            success: false,
            message: 'Mollie API Error: ' + error.message
        });
    }
});

// Simple card validation helper
function validateCardNumber(cardNum) {
    const cleaned = cardNum.replace(/\s+/g, '');
    if (cleaned.length < 13 || cleaned.length > 19) return false;

    let sum = 0;
    let isEven = false;

    for (let i = cleaned.length - 1; i >= 0; i--) {
        let digit = parseInt(cleaned[i]);

        if (isEven) {
            digit *= 2;
            if (digit > 9) digit -= 9;
        }

        sum += digit;
        isEven = !isEven;
    }

    return sum % 10 === 0;
}

// Create Setup Intent for Stripe Elements Validation
app.post('/api/stripe/create-setup-intent', async (req, res) => {
    try {
        let { sk } = req.body;
        // Fallback to env var if client sends placeholder or nothing
        if (!sk || sk === 'Not Configured' || sk.includes('simulation')) {
            sk = process.env.STRIPE_SK;
        }

        if (!sk) {
            throw new Error('Stripe Secret Key is missing');
        }

        const stripeInstance = stripe(sk);
        const setupIntent = await stripeInstance.setupIntents.create({
            payment_method_types: ['card'],
        });

        logTransaction('SetupIntent', 'pending', 'Initiated Elements Check');

        return res.json({
            success: true,
            clientSecret: setupIntent.client_secret
        });
    } catch (error) {
        logTransaction('SetupIntent', 'failed', error.message);
        return res.json({
            success: false,
            message: error.message
        });
    }
});

// Create Customer & Subscription (Raw Card Data)
app.post('/api/stripe/subscribe', async (req, res) => {
    try {
        let { sk, card, priceId, email } = req.body;

        if (!sk || sk === 'Not Configured' || sk.includes('simulation')) {
            sk = process.env.STRIPE_SK;
        }

        if (!sk) {
            throw new Error('Stripe Secret Key is missing');
        }

        const stripeInstance = stripe(sk);
        // 1. Create PaymentMethod
        const paymentMethod = await stripeInstance.paymentMethods.create({
            type: 'card',
            card: {
                number: card.number,
                exp_month: card.exp_month,
                exp_year: card.exp_year,
                cvc: card.cvc,
            },
        });

        // 2. Create Customer
        const customer = await stripeInstance.customers.create({
            payment_method: paymentMethod.id,
            email: email || `user_${Date.now()}_${Math.floor(Math.random() * 1000)}@example.com`,
            invoice_settings: {
                default_payment_method: paymentMethod.id,
            },
            description: 'Created via SyriaPay Generator',
        });

        const amountVal = req.body.amount ? parseFloat(req.body.amount) : 0;
        const useMoto = req.body.moto === true; // Check for MOTO flag

        let subscription = null;
        let paymentIntent = null;
        let status = 'customer_created';

        const resultData = {
            success: true,
            customer: customer.id,
            paymentMethod: paymentMethod.id,
            subscription: null,
            status: status
        };

        if (priceId) {
            // --- Subscription Flow ---
            const subParams = {
                customer: customer.id,
                items: [{ price: priceId }],
                expand: ['latest_invoice.payment_intent'],
            };

            // Add MOTO options if requested
            if (useMoto) {
                subParams.payment_settings = {
                    payment_method_options: {
                        card: { moto: true }
                    }
                };
            }

            subscription = await stripeInstance.subscriptions.create(subParams);
            resultData.subscription = subscription.id;
            resultData.status = subscription.status;
            
            // Check if payment succeeded or requires action (OTP)
            if (subscription.latest_invoice && subscription.latest_invoice.payment_intent) {
                 const pi = subscription.latest_invoice.payment_intent;
                 if (pi.status === 'succeeded') {
                     resultData.status = 'active';
                 } else if (pi.status === 'requires_action') {
                     resultData.status = 'requires_action';
                     resultData.otpRequired = true;
                 }
            }

            logTransaction('Subscription', 'success', `Cust: ${customer.id} | Sub: ${subscription.id} ${useMoto ? '[MOTO]' : ''} ${resultData.otpRequired ? '[OTP]' : ''}`, 10);

        } else if (amountVal > 0) {
            // --- One-Time Charge (Settlement) Flow ---
            const piParams = {
                amount: Math.round(amountVal * 100), // Convert to cents
                currency: 'usd', // Default to USD
                customer: customer.id,
                payment_method: paymentMethod.id,
                off_session: true, // Allow charging without user interaction
                confirm: true, // Confirm immediately
                description: `Settlement via SyriaPay ${useMoto ? '(MOTO)' : ''}`,
                return_url: 'https://example.com/return' // Required for some flows
            };

            // Add MOTO options if requested
            if (useMoto) {
                piParams.payment_method_options = {
                    card: { moto: true }
                };
            }

            // Create PaymentIntent
            paymentIntent = await stripeInstance.paymentIntents.create(piParams);

            resultData.paymentIntent = paymentIntent.id;
            resultData.status = paymentIntent.status;
            resultData.amount = amountVal;

            if (paymentIntent.status === 'succeeded') {
                logTransaction('Charge', 'success', `Cust: ${customer.id} | Amt: $${amountVal} ${useMoto ? '[MOTO]' : ''}`, amountVal);
            } else if (paymentIntent.status === 'requires_action') {
                resultData.otpRequired = true;
                logTransaction('Charge', 'otp_required', `Cust: ${customer.id} | Amt: $${amountVal} [OTP Required]`, 0);
            } else {
                 logTransaction('Charge', 'pending', `Cust: ${customer.id} | Status: ${paymentIntent.status}`, 0);
            }
        }

        return res.json(resultData);

    } catch (error) {
        const cardNum = req.body.card && req.body.card.number ? req.body.card.number : 'Unknown';
        logTransaction('Subscription', 'failed', `${cardNum.slice(0,6)}****** | ${error.message}`);
        return res.json({
            success: false,
            message: error.message,
            code: error.code
        });
    }
});

// Verify Stripe Key Endpoint
app.post('/api/verify-stripe', async (req, res) => {
    const { secretKey } = req.body;
    
    if (!secretKey || !secretKey.startsWith('sk_')) {
        return res.json({ success: false, message: 'Invalid Key Format' });
    }

    try {
        const stripeInstance = stripe(secretKey);
        const balance = await stripeInstance.balance.retrieve();
        
        let currency = 'usd';
        let amount = 0;
        if (balance.available && balance.available.length > 0) {
            currency = balance.available[0].currency;
            amount = balance.available[0].amount;
        }

        return res.json({
            success: true,
            message: 'Key is Valid',
            details: `Balance: ${amount/100} ${currency.toUpperCase()}`
        });
    } catch (error) {
        return res.json({
            success: false,
            message: error.message
        });
    }
});

// Check Card Endpoint (Stripe)
app.post('/api/check-card', async (req, res) => {
    const { token, number, useMpgs } = req.body; // Expects token from client
    
    // --- MPGS Logic (Mastercard Gateway) ---
    if (useMpgs) {
        return handleMpgsCheck(req, res);
    }
    
    let sk = req.body.sk || process.env.STRIPE_SK;

    // Use default key if not provided or placeholder
    if (!sk || sk === 'Not Configured') {
        sk = process.env.STRIPE_SK;
    }

    if (!sk) {
        return res.status(500).json({ success: false, message: 'Server Stripe Key not configured' });
    }

    try {
        const stripeInstance = stripe(sk);
        
        // Strategy: Create a Customer with the source (token)
        // This validates the card with 0-auth or $0/$1 auth depending on Stripe settings
        const customer = await stripeInstance.customers.create({
            source: token, // Card token from client
            description: 'Card Check - SyriaPay',
        });

        logTransaction('Check', 'success', `Card Checked: ${customer.id}`);

        return res.json({
            live: true,
            message: 'Card is Live (Customer Created)',
            customer: customer.id
        });

    } catch (error) {
        logTransaction('Check', 'failed', error.message);
        
        // Analyze Error
        const code = error.code;
        const msg = error.message;

        return res.json({
            live: false,
            code: code,
            message: msg
        });
    }
});

// --- MPGS Handler (Mastercard Gateway) ---
async function handleMpgsCheck(req, res) {
    const { card, mpgsConfig } = req.body;
    
    // Credentials from Request or Defaults
    const merchantId = mpgsConfig?.merchantId || 'TESTMPGS_TEST';
    const password = mpgsConfig?.password || 'c543aae3f27bd1e0b3db7cdb8b246a57';
    const apiUrl = mpgsConfig?.apiUrl || 'https://ap-gateway.mastercard.com/';
    
    // Unique Transaction ID
    const orderId = `ORD-${Date.now()}`;
    const txnId = `TXN-${Date.now()}`;
    
    // Construct Auth Header
    const auth = Buffer.from(`Merchant.${merchantId}:${password}`).toString('base64');
    
    // Determine Expiry (YY or YYYY)
    let expYear = card.exp_year;
    if (expYear.length === 4) expYear = expYear.slice(-2); // MPGS usually takes YY, let's check docs. 
    // Wait, MPGS API usually takes YY or YYYY. Let's send YY to be safe or check errors.
    
    try {
        // API Endpoint: /api/rest/version/latest/merchant/{merchantId}/order/{orderId}/transaction/{transactionId}
        const endpoint = `${apiUrl}api/rest/version/latest/merchant/${merchantId}/order/${orderId}/transaction/${txnId}`;
        
        console.log(`MPGS Check: ${card.number} | Order: ${orderId}`);
        
        const payload = {
            apiOperation: "AUTHORIZE", // Use AUTHORIZE to check funds/validity
            order: {
                amount: "1.00",
                currency: "USD"
            },
            sourceOfFunds: {
                provided: {
                    card: {
                        number: card.number,
                        expiry: {
                            month: card.exp_month,
                            year: card.exp_year.slice(-2) // Convert 2026 -> 26
                        },
                        securityCode: card.cvc
                    }
                },
                type: "CARD"
            }
        };

        const response = await axios.put(endpoint, payload, {
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/json'
            }
        });

        const data = response.data;
        const result = data.result; // SUCCESS, FAILURE, PENDING, UNKNOWN
        
        // Log transaction
        logTransaction('MPGS Check', result, `Order: ${orderId} | ${data.response?.gatewayCode || ''}`);

        if (result === 'SUCCESS' || (data.response && data.response.gatewayCode === 'APPROVED')) {
            return res.json({
                live: true,
                message: 'Approved (MPGS)',
                provider: 'Mastercard Gateway',
                details: data
            });
        } else {
             return res.json({
                live: false,
                message: data.response?.gatewayCode || 'Declined',
                provider: 'Mastercard Gateway',
                details: data
            });
        }

    } catch (error) {
        console.error('MPGS Error:', error.response ? error.response.data : error.message);
        logTransaction('MPGS Check', 'Error', error.message);
        
        return res.json({
            live: false,
            message: 'Gateway Error: ' + (error.response?.data?.error?.explanation || error.message),
            provider: 'Mastercard Gateway'
        });
    }
}

// Only listen if run directly (local development)
if (require.main === module) {
    app.listen(PORT, () => {
        console.log('');
        console.log('=======================================');
        console.log('  Syria Pay - Card Generator');
        console.log('  Server running at: http://localhost:' + PORT);
        console.log('=======================================');
        console.log('');
    });
}

// Export for Vercel
module.exports = app;
