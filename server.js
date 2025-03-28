const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();
const port = process.env.PORT || 3000;

// Log environment variables
console.log('Environment:', process.env.NODE_ENV);
console.log('Port:', port);
console.log('Current directory:', __dirname);
console.log('Public directory:', path.join(__dirname, 'public'));

// Check if public directory exists
const publicDir = path.join(__dirname, 'public');
if (!fs.existsSync(publicDir)) {
    console.error('Public directory not found:', publicDir);
    process.exit(1);
}

// Check if index.html exists
const indexPath = path.join(publicDir, 'index.html');
if (!fs.existsSync(indexPath)) {
    console.error('index.html not found:', indexPath);
    process.exit(1);
}

console.log('index.html found at:', indexPath);

// Log all files in public directory
console.log('Files in public directory:');
fs.readdirSync(publicDir).forEach(file => {
    console.log(`- ${file}`);
});

// Health check endpoint
app.get('/health', (req, res) => {
    console.log('Health check requested');
    res.status(200).send('OK');
});

// Log all requests before any other middleware
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    console.log('Headers:', req.headers);
    next();
});

// Serve static files from the public directory with detailed logging
app.use(express.static(publicDir, {
    setHeaders: (res, filePath) => {
        console.log(`Attempting to serve static file: ${filePath}`);
        res.set('Cache-Control', 'no-cache');
    },
    fallthrough: false // This will cause Express to send 404s instead of falling through
}));

// Serve index.html for the root route
app.get('/', (req, res) => {
    console.log('Root route requested, serving index.html');
    res.sendFile(indexPath, (err) => {
        if (err) {
            console.error('Error serving index.html:', err);
            res.status(500).send('Error loading page');
        } else {
            console.log('Successfully served index.html');
        }
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error occurred:', err);
    console.error('Stack trace:', err.stack);
    res.status(500).send('Something broke!');
});

// Handle 404s
app.use((req, res) => {
    console.log('404 for URL:', req.url);
    res.status(404).sendFile(indexPath, (err) => {
        if (err) {
            console.error('Error serving 404 page:', err);
            res.status(500).send('Error loading page');
        }
    });
});

// Listen on all available network interfaces
app.listen(port, '0.0.0.0', () => {
    console.log(`Server running on port ${port}`);
    console.log(`Static files being served from: ${publicDir}`);
    console.log('Server is ready to accept connections');
    console.log(`Try accessing the health check at: http://localhost:${port}/health`);
}); 