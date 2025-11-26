// ============================================
// SERVER STARTUP - LOG IMMEDIATELY
// ============================================
console.log('========================================');
console.log('SERVER STARTING...');
console.log('========================================');
console.log('Timestamp:', new Date().toISOString());
console.log('Node version:', process.version);
console.log('Platform:', process.platform);

const express = require('express');
const path = require('path');
const fs = require('fs');
const http = require('http');
const app = express();
const port = process.env.PORT || 3000;

// Enable compression for all responses (with error handling)
try {
    const compression = require('compression');
    app.use(compression({
        level: 6,
        threshold: 1024, // Only compress responses > 1KB
    }));
    console.log('✓ Compression middleware enabled');
} catch (error) {
    console.warn('⚠ Compression middleware not available:', error.message);
    console.warn('  Server will continue without compression');
}

console.log('Express loaded');
console.log('Port configured:', port);

// Load environment variables
// Try loading from flight-display/.env first, then root .env
const webdisplayEnvPath = path.join(__dirname, 'flight-display', '.env');
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

// Health check endpoint - will check webdisplayBackend at runtime
app.get('/health', (req, res) => {
    console.log('[HEALTH] Health check requested');
    res.status(200).json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        webdisplayAvailable: typeof webdisplayBackend !== 'undefined' && webdisplayBackend !== null
    });
});

// Test endpoint to verify server is running
app.get('/test', (req, res) => {
    console.log('[TEST] Test endpoint called');
    res.status(200).json({
        message: 'Server is running!',
        timestamp: new Date().toISOString(),
        port: port,
        webdisplayBackend: (typeof webdisplayBackend !== 'undefined' && webdisplayBackend) ? 'loaded' : 'not loaded'
    });
});

// Declare webdisplayBackend early so it can be referenced in routes
let webdisplayBackend = null;

// Create HTTP server first (needed for Socket.IO)
const server = http.createServer(app);

// Integrate webdisplay backend BEFORE static file middleware and logging
console.log('========================================');
console.log('LOADING WEBDISPLAY BACKEND...');
console.log('========================================');
try {
    console.log('Attempting to load webdisplay backend...');
    const { initWebdisplayBackend } = require('./flight-display/server/webdisplayServer');
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
    
    // Wrap static middleware to catch errors
    const staticMiddleware = express.static(publicDir, {
        setHeaders: (res, filePath) => {
            try {
                // Only log in development to avoid noise
                if (process.env.NODE_ENV !== 'production') {
                    console.log(`[Main Static] Serving file: ${filePath}`);
                }
                // Set appropriate cache headers based on file type
                const ext = path.extname(filePath).toLowerCase();
                if (ext === '.wasm' || ext === '.pck' || ext === '.png' || ext === '.jpg' ||
                    ext === '.jpeg' || ext === '.ico' || ext === '.woff' || ext === '.woff2') {
                    res.set('Cache-Control', 'public, max-age=31536000, immutable');
                } else if (ext === '.js' || ext === '.css') {
                    res.set('Cache-Control', 'public, max-age=86400, must-revalidate');
                } else if (ext === '.html') {
                    res.set('Cache-Control', 'public, max-age=300, must-revalidate');
                } else {
                    res.set('Cache-Control', 'no-cache');
                }
            } catch (error) {
                // Silently handle errors in setHeaders
                console.warn(`[Main Static] Error in setHeaders for ${filePath}:`, error.message);
            }
        },
        fallthrough: false
    });
    
    // Call static middleware with error handling
    staticMiddleware(req, res, (err) => {
        if (err) {
            // Log error but don't let it propagate - just continue to next middleware
            console.warn(`[Main Static] File not found: ${req.path} (this is normal for non-existent files)`);
            return next();
        }
        next();
    });
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
    console.error('Error message:', err.message);
    console.error('Request path:', req.path);
    console.error('Request URL:', req.url);
    console.error('Request baseUrl:', req.baseUrl);
    console.error('Stack trace:', err.stack);
    
    // If it's a file not found error, return 404 instead of 500
    if (err.code === 'ENOENT') {
        console.error('File not found error - returning 404');
        return res.status(404).json({
            error: 'File not found',
            path: err.path || req.path,
            message: err.message
        });
    }
    
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
console.log('========================================');
console.log('ATTEMPTING TO START SERVER...');
console.log('========================================');

server.listen(port, '0.0.0.0', () => {
    console.log('========================================');
    console.log('✓ SERVER STARTED SUCCESSFULLY');
    console.log('========================================');
    console.log(`Port: ${port}`);
    console.log(`Static files: ${publicDir}`);
    console.log(`Webdisplay backend: ${webdisplayBackend ? '✓ ACTIVE' : '✗ NOT LOADED'}`);
    console.log('========================================');
    console.log('Available endpoints:');
    console.log(`  - Health check: http://localhost:${port}/health`);
    console.log(`  - Test endpoint: http://localhost:${port}/test`);
    console.log(`  - Main site: http://localhost:${port}/`);
    console.log(`  - Webdisplay: http://localhost:${port}/webdisplay`);
    console.log('========================================');
});

// Handle server errors
server.on('error', (err) => {
    console.error('========================================');
    console.error('❌ SERVER ERROR');
    console.error('========================================');
    console.error('Error:', err.message);
    console.error('Stack:', err.stack);
    console.error('========================================');
    process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
    console.error('========================================');
    console.error('❌ UNCAUGHT EXCEPTION');
    console.error('========================================');
    console.error('Error:', err.message);
    console.error('Stack:', err.stack);
    console.error('========================================');
    process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('========================================');
    console.error('❌ UNHANDLED REJECTION');
    console.error('========================================');
    console.error('Reason:', reason);
    console.error('Promise:', promise);
    console.error('========================================');
}); 