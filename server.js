const express = require('express');
const stripeLib = require('stripe');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8081;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'web_card_app')));

// Route to check card
app.post('/api/check-card', async (req, res) => {
    const { cardNumber, expMonth, expYear, cvv, secretKey } = req.body;

    if (!secretKey || !secretKey.startsWith('sk_')) {
        return res.status(400).json({
            success: false,
            message: "Invalid or missing Stripe Secret Key. Please configure it in Settings."
        });
    }

    try {
        const stripe = stripeLib(secretKey);

        // 1. Create a PaymentMethod
        const paymentMethod = await stripe.paymentMethods.create({
            type: 'card',
            card: {
                number: cardNumber,
                exp_month: parseInt(expMonth),
                exp_year: parseInt(expYear),
                cvc: cvv,
            },
        });

        // 2. Create a SetupIntent to verify the card (0 auth)
        // Using confirm: true to get immediate status
        const setupIntent = await stripe.setupIntents.create({
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
                message: "SetupIntent Succeeded (Live & Active)",
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

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log(`Open http://localhost:${PORT} to use the app.`);
});
