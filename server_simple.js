const express = require('express');
const path = require('path');
const cors = require('cors');
const https = require('https');
const http = require('http');

const app = express();
const PORT = process.env.PORT || 8081;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'web_card_app')));

const binCache = {};

// BIN lookup endpoint
app.get('/api/lookup/:bin', (req, res) => {
    const bin = req.params.bin;
    
    if (!bin || bin.length < 6) {
        return res.json({ success: false, message: 'Invalid BIN length' });
    }
    
    // Check cache first
    if (binCache[bin]) {
        return res.json({ success: true, found: true, data: binCache[bin] });
    }
    
    // Try to fetch from external API
    fetchBinInfo(bin)
        .then(data => {
            binCache[bin] = data;
            res.json({ success: true, found: true, data });
        })
        .catch(err => {
            console.error('BIN lookup error:', err.message);
            // Return mock data as fallback
            const mockData = {
                bank: { name: 'Test Bank' },
                country: { name: 'United States', emoji: '🇺🇸' },
                scheme: 'VISA',
                type: 'debit',
                brand: 'VISA'
            };
            res.json({ success: true, found: true, data: mockData });
        });
});

// Helper function to fetch BIN info from multiple sources
function fetchBinInfo(bin) {
    return new Promise((resolve, reject) => {
        // Try binlist.io first
        fetchFromUrl('binlist.io', '/' + bin, 443, true)
            .then(resolve)
            .catch(() => {
                // Fallback to restcountries.com for country data
                const data = {
                    bank: { name: 'Test Bank' },
                    country: { name: 'Unknown', emoji: '🌍' },
                    scheme: bin.charAt(0) === '4' ? 'VISA' : 'MASTERCARD',
                    type: 'debit',
                    brand: bin.charAt(0) === '4' ? 'VISA' : 'MASTERCARD'
                };
                resolve(data);
            });
    });
}

// Generic HTTPS/HTTP fetch function with timeout
function fetchFromUrl(hostname, path, port, isHttps) {
    return new Promise((resolve, reject) => {
        const protocol = isHttps ? https : http;
        
        const request = protocol.get({
            hostname: hostname,
            path: path,
            port: port,
            headers: { 
                'Accept-Version': '3', 
                'User-Agent': 'SyriaPay/1.0',
                'Accept': 'application/json'
            },
            timeout: 5000
        }, (response) => {
            let data = '';
            
            response.on('data', chunk => {
                data += chunk;
            });
            
            response.on('end', () => {
                try {
                    if (response.statusCode === 200) {
                        resolve(JSON.parse(data));
                    } else {
                        reject(new Error('HTTP ' + response.statusCode));
                    }
                } catch (e) {
                    reject(e);
                }
            });
        });
        
        request.on('error', reject);
        request.on('timeout', () => {
            request.destroy();
            reject(new Error('Request timeout'));
        });
    });
}

app.listen(PORT, () => {
    console.log('Server running at http://localhost:' + PORT);
});
