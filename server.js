const express = require('express');
const path = require('path');
const app = express();
const port = process.env.PORT || 3000;

// Serve static files from the current directory
app.use(express.static(__dirname));

// Serve the mnist_model directory
app.use('/mnist_model', express.static(path.join(__dirname, 'mnist_model')));

// Serve index.html for the root route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Listen on all available network interfaces
app.listen(port, '0.0.0.0', () => {
    console.log(`Server running on port ${port}`);
}); 