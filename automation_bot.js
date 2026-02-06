const puppeteer = require('puppeteer');

/**
 * AUTOMATION BOT FOR PAYMENT PAGES
 * --------------------------------
 * This script automates the process of visiting a payment URL and filling in card details.
 * 
 * USAGE:
 * 1. Open this file and update the CONFIG object below with your target URL and Selectors.
 * 2. Run: node automation_bot.js
 */

const CONFIG = {
    // [REQUIRED] The URL of the payment page
    url: 'https://example.com/checkout', 

    // [REQUIRED] CSS Selectors for the input fields
    // You can find these by right-clicking the element in Chrome -> Inspect -> Copy -> Copy Selector
    selectors: {
        cardNumber: '#card-number', // Example: input[name="cardNumber"]
        expiry: '#expiry-date',     // Example: input[name="exp"]
        cvc: '#cvc',                // Example: input[name="cvc"]
        submitBtn: '#submit-button' // Example: button[type="submit"]
    },

    // [OPTIONAL] Delays to mimic human behavior (in milliseconds)
    typingDelay: 100,
    actionDelay: 1000
};

// Test Card Data (Will be replaced by dynamic data later)
const TEST_CARD = {
    number: '4000123456789010',
    exp: '12/26',
    cvc: '123'
};

async function runBot() {
    console.log('🤖 Starting Payment Bot...');
    console.log(`Target: ${CONFIG.url}`);

    const browser = await puppeteer.launch({
        headless: false, // Set to true to run in background (invisible)
        defaultViewport: null,
        args: ['--start-maximized'] // Open browser full width
    });

    const page = await browser.newPage();

    try {
        // 1. Navigate to URL
        console.log('Navigating to page...');
        await page.goto(CONFIG.url, { waitUntil: 'networkidle2' });
        
        // 2. Wait for Card Number Field
        console.log('Waiting for input fields...');
        await page.waitForSelector(CONFIG.selectors.cardNumber, { timeout: 10000 });

        // 3. Type Card Details
        console.log(`Filling Card: ${TEST_CARD.number} | ${TEST_CARD.exp} | ${TEST_CARD.cvc}`);
        
        // Type Number
        await page.type(CONFIG.selectors.cardNumber, TEST_CARD.number, { delay: CONFIG.typingDelay });
        await new Promise(r => setTimeout(r, 500)); // Small pause

        // Type Expiry
        await page.type(CONFIG.selectors.expiry, TEST_CARD.exp, { delay: CONFIG.typingDelay });
        await new Promise(r => setTimeout(r, 500));

        // Type CVC
        await page.type(CONFIG.selectors.cvc, TEST_CARD.cvc, { delay: CONFIG.typingDelay });
        
        // 4. Click Submit
        console.log('Submitting payment...');
        await new Promise(r => setTimeout(r, CONFIG.actionDelay)); // Wait before clicking
        
        await page.click(CONFIG.selectors.submitBtn);

        // 5. Wait for Result (Optional - customize based on success message)
        // await page.waitForSelector('.success-message', { timeout: 15000 });
        console.log('✅ Payment Submitted! Check browser for result.');

    } catch (error) {
        console.error('❌ Error:', error.message);
        console.log('Tip: Check if the selectors in CONFIG match the actual website HTML.');
    } finally {
        // Uncomment to close browser automatically
        // await browser.close();
    }
}

runBot();
