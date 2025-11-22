const express = require('express');
const path = require('path');
const fs = require('fs');
const http = require('http');
const app = express();
const port = process.env.PORT || 3000;

// Load environment variables
// Try loading from webdisplay/.env first, then root .env
const webdisplayEnvPath = path.join(__dirname, 'webdisplay', '.env');
if (fs.existsSync(webdisplayEnvPath)) {
    require('dotenv').config({ path: webdisplayEnvPath });
} else {
    require('dotenv').config();
}

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

// Create HTTP server first (needed for Socket.IO)
const server = http.createServer(app);

// Integrate webdisplay backend BEFORE static file middleware and logging
let webdisplayBackend = null;
try {
    console.log('Attempting to load webdisplay backend...');
    const { initWebdisplayBackend } = require('./webdisplay/backend/webdisplayServer');
    console.log('Webdisplay backend module loaded, initializing...');
    webdisplayBackend = initWebdisplayBackend(server);
    
    if (!webdisplayBackend || !webdisplayBackend.app) {
        throw new Error('Webdisplay backend initialization returned invalid object');
    }
    
    // Mount webdisplay routes on /webdisplay path (must be before static middleware)
    app.use('/webdisplay', webdisplayBackend.app);
    console.log('✓ Webdisplay routes mounted at /webdisplay');
    
    // Also mount API routes at root level for backward compatibility
    // This allows frontend to use /api/init instead of /webdisplay/api/init
    if (webdisplayBackend.apiRouter) {
        app.use('/api', webdisplayBackend.apiRouter);
        console.log('✓ Webdisplay API routes mounted at /api');
    }
    
    console.log('✓ Webdisplay backend integrated successfully');
} catch (error) {
    console.error('❌ ERROR: Webdisplay backend failed to load:');
    console.error('  Error message:', error.message);
    console.error('  Stack trace:', error.stack);
    console.error('  The webdisplay will not be functional without the backend');
    
    // Add a fallback route for /webdisplay to show a helpful error message
    app.use('/webdisplay', (req, res) => {
        res.status(503).send(`
            <html>
                <head><title>Webdisplay Unavailable</title></head>
                <body>
                    <h1>Webdisplay Backend Unavailable</h1>
                    <p>The webdisplay backend failed to initialize. Please check the server logs for details.</p>
                    <p>Error: ${error.message}</p>
                </body>
            </html>
        `);
    });
}

// Log all requests after webdisplay routes (so we can see what's being matched)
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// Serve static files from the public directory with detailed logging
// Skip /webdisplay and /api paths - they're handled by their own routers
app.use((req, res, next) => {
    // Don't serve static files for webdisplay or API routes
    if (req.path.startsWith('/webdisplay') || req.path.startsWith('/api')) {
        return next();
    }
    express.static(publicDir, {
        setHeaders: (res, filePath) => {
            console.log(`Attempting to serve static file: ${filePath}`);
            res.set('Cache-Control', 'no-cache');
        },
        fallthrough: false
    })(req, res, next);
});

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
server.listen(port, '0.0.0.0', () => {
    console.log(`Server running on port ${port}`);
    console.log(`Static files being served from: ${publicDir}`);
    if (webdisplayBackend) {
        console.log('✓ Webdisplay backend is active');
    }
    console.log('Server is ready to accept connections');
    console.log(`Try accessing the health check at: http://localhost:${port}/health`);
    console.log(`Webdisplay available at: http://localhost:${port}/webdisplay`);
}); 