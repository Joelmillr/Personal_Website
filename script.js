// Smooth scrolling for navigation links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// Navbar background change on scroll
const navbar = document.querySelector('.navbar');
window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
        navbar.style.background = 'rgba(255, 255, 255, 0.98)';
        navbar.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.1)';
    } else {
        navbar.style.background = 'rgba(255, 255, 255, 0.95)';
        navbar.style.boxShadow = 'none';
    }
});

// Add animation to project cards on scroll
const observerOptions = {
    threshold: 0.1
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, observerOptions);

document.querySelectorAll('.project-card').forEach(card => {
    card.style.opacity = '0';
    card.style.transform = 'translateY(20px)';
    card.style.transition = 'all 0.5s ease-out';
    observer.observe(card);
});

// Drawing Canvas Setup
const canvas = document.getElementById('drawingCanvas');
const ctx = canvas.getContext('2d');
const clearBtn = document.getElementById('clearBtn');
const predictBtn = document.getElementById('predictBtn');
const predictionNumber = document.querySelector('.prediction-number');

let isDrawing = false;
let lastX = 0;
let lastY = 0;

// Set up canvas
ctx.strokeStyle = '#000';
ctx.lineWidth = 20;
ctx.lineCap = 'round';
ctx.lineJoin = 'round';

// Drawing event listeners
canvas.addEventListener('mousedown', startDrawing);
canvas.addEventListener('mousemove', draw);
canvas.addEventListener('mouseup', stopDrawing);
canvas.addEventListener('mouseout', stopDrawing);

// Touch events for mobile
canvas.addEventListener('touchstart', (e) => {
    e.preventDefault(); // Prevent scrolling while drawing
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    lastX = touch.clientX - rect.left;
    lastY = touch.clientY - rect.top;
    isDrawing = true;
});

canvas.addEventListener('touchmove', (e) => {
    e.preventDefault(); // Prevent scrolling while drawing
    if (!isDrawing) return;
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    const currentX = touch.clientX - rect.left;
    const currentY = touch.clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(currentX, currentY);
    ctx.stroke();

    lastX = currentX;
    lastY = currentY;
});

canvas.addEventListener('touchend', stopDrawing);

function startDrawing(e) {
    isDrawing = true;
    [lastX, lastY] = getCoordinates(e);
}

function draw(e) {
    if (!isDrawing) return;
    const [currentX, currentY] = getCoordinates(e);

    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(currentX, currentY);
    ctx.stroke();

    [lastX, lastY] = [currentX, currentY];
}

function stopDrawing() {
    isDrawing = false;
}

function getCoordinates(e) {
    const rect = canvas.getBoundingClientRect();
    return [
        e.clientX - rect.left,
        e.clientY - rect.top
    ];
}

// Clear canvas
clearBtn.addEventListener('click', () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    predictionNumber.textContent = '-';
});

// Neural Network Setup
let model;

async function loadModel() {
    try {
        predictionNumber.textContent = 'Loading model...';
        console.log('Loading model from:', '/mnist_model/model.json');

        // Load our locally trained model
        model = await tf.loadLayersModel('/mnist_model/model.json');
        console.log('Model loaded successfully');
        predictionNumber.textContent = 'Ready!';
    } catch (error) {
        console.error('Error loading model:', error);
        predictionNumber.textContent = 'Error loading model. Check console for details.';

        // Log more details about the error
        if (error.message) {
            console.error('Error message:', error.message);
        }
        if (error.stack) {
            console.error('Stack trace:', error.stack);
        }
    }
}

// Preprocess the drawing for prediction
function preprocessDrawing() {
    // Create a temporary canvas to resize the drawing
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = 28;
    tempCanvas.height = 28;
    const tempCtx = tempCanvas.getContext('2d');

    // Fill with white background
    tempCtx.fillStyle = 'white';
    tempCtx.fillRect(0, 0, 28, 28);

    // Get the bounding box of the drawing
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imageData.data;

    let minX = canvas.width, minY = canvas.height;
    let maxX = 0, maxY = 0;

    // Find the bounds of the drawing
    for (let y = 0; y < canvas.height; y++) {
        for (let x = 0; x < canvas.width; x++) {
            const idx = (y * canvas.width + x) * 4;
            if (pixels[idx + 3] > 0) { // If pixel is not transparent
                minX = Math.min(minX, x);
                minY = Math.min(minY, y);
                maxX = Math.max(maxX, x);
                maxY = Math.max(maxY, y);
            }
        }
    }

    // Add padding around the digit
    const padding = 4;
    minX = Math.max(0, minX - padding);
    minY = Math.max(0, minY - padding);
    maxX = Math.min(canvas.width - 1, maxX + padding);
    maxY = Math.min(canvas.height - 1, maxY + padding);

    // Calculate the scale to fit the digit
    const digitWidth = maxX - minX;
    const digitHeight = maxY - minY;
    const scale = Math.min(20 / digitWidth, 20 / digitHeight);

    // Calculate the position to center the digit
    const scaledWidth = digitWidth * scale;
    const scaledHeight = digitHeight * scale;
    const xOffset = (28 - scaledWidth) / 2;
    const yOffset = (28 - scaledHeight) / 2;

    // Draw the scaled and centered digit
    tempCtx.save();
    tempCtx.translate(xOffset, yOffset);
    tempCtx.scale(scale, scale);
    tempCtx.drawImage(canvas, minX, minY, digitWidth, digitHeight, 0, 0, digitWidth, digitHeight);
    tempCtx.restore();

    // Get the processed image data
    const processedImageData = tempCtx.getImageData(0, 0, 28, 28);
    const processedPixels = processedImageData.data;

    // Convert to grayscale and normalize (MNIST format: 0 = white, 1 = black)
    const input = new Float32Array(28 * 28);
    for (let i = 0; i < processedPixels.length; i += 4) {
        const gray = (processedPixels[i] + processedPixels[i + 1] + processedPixels[i + 2]) / 3;
        input[i / 4] = 1 - (gray / 255.0); // Invert colors to match MNIST format
    }

    return input;
}

// Make prediction
async function predict() {
    if (!model) {
        predictionNumber.textContent = 'Model not loaded';
        return;
    }

    const input = preprocessDrawing();
    // Reshape the input to match the model's expected shape (28x28x1)
    const tensor = tf.tensor3d(input, [28, 28, 1]).expandDims(0);

    try {
        const prediction = await model.predict(tensor).data();
        const maxIndex = Array.from(prediction).indexOf(Math.max(...prediction));
        const confidence = (prediction[maxIndex] * 100).toFixed(1);

        // Update the prediction display with confidence
        predictionNumber.innerHTML = `${maxIndex}<br><span class="confidence">${confidence}% confident</span>`;
    } catch (error) {
        console.error('Prediction error:', error);
        predictionNumber.textContent = 'Error';
    } finally {
        tensor.dispose();
    }
}

// Predict button click handler
predictBtn.addEventListener('click', predict);

// Load the model when the page loads
loadModel(); 