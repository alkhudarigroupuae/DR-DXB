const express = require('express');
const stripeLib = require('stripe');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const binLookup = require('binlookup')(); // Initialize binlookup

const app = express();
const PORT = process.env.PORT || 8081;

// In-memory cache for BIN lookups
const binCache = {};

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'web_card_app')));

// Route to check card
app.post('/api/check-card', async (req, res) => {
    let { paymentMethodId, token, secretKey } = req.body;

    // Use environment variable if secretKey is not provided
    if (!secretKey) {
        secretKey = process.env.STRIPE_SECRET_KEY;
    }

    if (!secretKey || !secretKey.startsWith('sk_')) {
        return res.status(400).json({
            success: false,
            message: "Invalid or missing Stripe Secret Key. Please configure it in Settings or Server Env."
        });
    }

    try {
        const stripe = stripeLib(secretKey);

        // Handle Legacy Token Flow
        if (token) {
            const customer = await stripe.customers.create({
                source: token, // This attaches the card and validates it
                description: `Customer from Token`,
                metadata: {
                    source: 'Debit Card Generator App'
                }
            });

            return res.json({
                success: true,
                message: `Live & Saved (Cust: ${customer.id})`,
                live: true
            });
        }

        // Handle PaymentMethod Flow
        // 1. Retrieve the PaymentMethod created on the client side
        const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);

        // 2. Create Customer & Attach PaymentMethod (Settlement/Saving)
        const customer = await stripe.customers.create({
            description: `Customer ${paymentMethod.card.last4}`,
            metadata: {
                source: 'Debit Card Generator App'
            }
        });

        await stripe.paymentMethods.attach(paymentMethod.id, {
            customer: customer.id,
        });

        // 3. Create a SetupIntent to verify the card (0 auth)
        // Using confirm: true to get immediate status
        const setupIntent = await stripe.setupIntents.create({
            customer: customer.id, // Link to customer for saving
            payment_method: paymentMethod.id,
            usage: 'off_session',
            confirm: true,
            payment_method_options: {
                card: {
                    request_three_d_secure: 'automatic'
                }
            }
        });

        if (setupIntent.status === 'succeeded') {
            return res.json({
                success: true,
                message: `Live & Saved (Cust: ${customer.id})`,
                live: true
            });
        } else if (setupIntent.status === 'requires_action' || setupIntent.status === 'requires_payment_method') {
            // Card is valid but needs 3DS. Considered Live for checking purposes.
            return res.json({
                success: true,
                message: `Live - 3DS Required (${setupIntent.status})`,
                live: true
            });
        } else {
            return res.json({
                success: false,
                message: `Failed: ${setupIntent.status}`,
                live: false
            });
        }

    } catch (error) {
        // Stripe Error Handling
        let reason = error.message;
        if (error.code) {
            reason = `${error.code}: ${error.message}`;
        }
        return res.json({
            success: false,
            message: `Declined: ${reason}`,
            code: error.code || 'unknown_error',
            live: false
        });
    }
});

// Route to verify Stripe API Key
app.post('/api/verify-stripe', async (req, res) => {
    const { secretKey } = req.body;

    if (!secretKey || !secretKey.startsWith('sk_')) {
        return res.json({ success: false, message: "Invalid Key Format" });
    }

    try {
        const stripe = stripeLib(secretKey);
        // Retrieve balance to check if key is valid and has permissions
        const balance = await stripe.balance.retrieve();
        return res.json({
            success: true,
            message: "Key is Live & Valid",
            details: `Available: ${balance.available[0].amount / 100} ${balance.available[0].currency.toUpperCase()}`
        });
    } catch (error) {
        return res.json({
            success: false,
            message: error.message
        });
    }
});

// Proxy Route for BIN Lookup (binlist.net)
app.get('/api/lookup/:bin', async (req, res) => {
    const bin = req.params.bin;
    if (!bin || bin.length < 6) {
        return res.status(400).json({ success: false, message: "Invalid BIN length" });
    }

    // Check Cache
    if (binCache[bin]) {
        return res.json({ success: true, found: true, data: binCache[bin] });
    }

    try {
        // Use binlookup library
        const data = await binLookup(bin);

        if (data) {
            binCache[bin] = data; // Cache result
            return res.json({ success: true, found: true, data });
        } else {
            return res.json({ success: false, found: false });
        }

    } catch (error) {
        // binlookup might throw or return error on 404
        // If it's a 404, it means not found
        if (error.message && error.message.includes('404')) {
            return res.json({ success: false, found: false });
        }
        return res.json({ success: false, message: error.message || 'Unknown Error' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log(`Open http://localhost:${PORT} to use the app.`);
});
