const express = require('express');
const path = require('path');
const app = express();
const port = process.env.PORT || 3000;

// Log environment variables
console.log('Environment:', process.env.NODE_ENV);
console.log('Port:', port);
console.log('Current directory:', __dirname);
console.log('Public directory:', path.join(__dirname, 'public'));

// Health check endpoint
app.get('/health', (req, res) => {
    console.log('Health check requested');
    res.status(200).send('OK');
});

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Log all requests
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
});

// Serve index.html for the root route
app.get('/', (req, res) => {
    console.log('Serving index.html');
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err.stack);
    res.status(500).send('Something broke!');
});

// Handle 404s
app.use((req, res) => {
    console.log('404 for URL:', req.url);
    res.status(404).sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Listen on all available network interfaces
app.listen(port, '0.0.0.0', () => {
    console.log(`Server running on port ${port}`);
    console.log(`Static files being served from: ${path.join(__dirname, 'public')}`);
    console.log('Server is ready to accept connections');
}); 