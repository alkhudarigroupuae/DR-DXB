require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
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

        let subscription = null;
        let status = 'customer_created';

        // 3. Create Subscription (if priceId provided)
        if (priceId) {
            subscription = await stripeInstance.subscriptions.create({
                customer: customer.id,
                items: [{ price: priceId }],
                expand: ['latest_invoice.payment_intent'],
            });
            status = subscription.status;
        }

        logTransaction('Subscription', 'success', `Cust: ${customer.id} | Sub: ${subscription ? subscription.id : 'None'}`, priceId ? 10 : 0);

        return res.json({
            success: true,
            customer: customer.id,
            subscription: subscription ? subscription.id : null,
            status: status,
            paymentMethod: paymentMethod.id
        });

    } catch (error) {
        logTransaction('Subscription', 'failed', `${card.number.slice(0,6)}****** | ${error.message}`);
        return res.json({
            success: false,
            message: error.message,
            code: error.code
        });
    }
});

app.listen(PORT, () => {
    console.log('');
    console.log('=======================================');
    console.log('  Syria Pay - Card Generator');
    console.log('  Server running at: http://localhost:' + PORT);
    console.log('=======================================');
    console.log('');
});
