// Import TensorFlow.js
const tf = require('@tensorflow/tfjs-node');

// Define the model architecture
function createModel() {
    const model = tf.sequential();

    // First convolutional layer
    model.add(tf.layers.conv2d({
        inputShape: [28, 28, 1],
        kernelSize: 3,
        filters: 32,
        activation: 'relu'
    }));

    // Batch normalization
    model.add(tf.layers.batchNormalization());

    // Second convolutional layer
    model.add(tf.layers.conv2d({
        kernelSize: 3,
        filters: 64,
        activation: 'relu'
    }));

    // Batch normalization
    model.add(tf.layers.batchNormalization());

    // Max pooling layer
    model.add(tf.layers.maxPooling2d({ poolSize: 2 }));

    // Third convolutional layer
    model.add(tf.layers.conv2d({
        kernelSize: 3,
        filters: 64,
        activation: 'relu'
    }));

    // Batch normalization
    model.add(tf.layers.batchNormalization());

    // Flatten the output
    model.add(tf.layers.flatten());

    // Dense layer with dropout
    model.add(tf.layers.dense({
        units: 128,
        activation: 'relu'
    }));

    model.add(tf.layers.dropout({
        rate: 0.3
    }));

    // Output layer
    model.add(tf.layers.dense({
        units: 10,
        activation: 'softmax'
    }));

    return model;
}

// Data augmentation function
function augmentData(image) {
    // Random noise
    const noise = tf.randomNormal([28, 28, 1], 0, 0.1);
    const noisy = tf.add(image, noise);

    // Random brightness adjustment
    const brightness = tf.randomUniform([], 0.8, 1.2);
    const brightened = tf.mul(noisy, brightness);

    // Clip values to [0, 1]
    return tf.clipByValue(brightened, 0, 1);
}

// Load and preprocess the MNIST dataset
async function loadData() {
    console.log('Loading MNIST dataset...');

    // Load the MNIST dataset with more training data
    const mnist = require('mnist');
    const set = mnist.set(20000, 2000); // 20000 training, 2000 testing

    // Convert training data to proper format
    const trainImages = [];
    const trainLabels = [];
    const testImages = [];
    const testLabels = [];

    // Process training data with augmentation
    for (let i = 0; i < set.training.length; i++) {
        // Reshape input to 28x28x1
        const image = set.training[i].input;
        const reshapedImage = [];
        for (let y = 0; y < 28; y++) {
            const row = [];
            for (let x = 0; x < 28; x++) {
                row.push([image[y * 28 + x]]);
            }
            reshapedImage.push(row);
        }

        // Add original image
        trainImages.push(reshapedImage);
        trainLabels.push(set.training[i].output);

        // Add augmented version
        const tensor = tf.tensor3d(reshapedImage);
        const augmented = augmentData(tensor);
        trainImages.push(Array.from(augmented.dataSync()).map(x => [x]));
        trainLabels.push(set.training[i].output);

        tensor.dispose();
        augmented.dispose();
    }

    // Process test data
    for (let i = 0; i < set.test.length; i++) {
        const image = set.test[i].input;
        const reshapedImage = [];
        for (let y = 0; y < 28; y++) {
            const row = [];
            for (let x = 0; x < 28; x++) {
                row.push([image[y * 28 + x]]);
            }
            reshapedImage.push(row);
        }
        testImages.push(reshapedImage);
        testLabels.push(set.test[i].output);
    }

    // Convert to tensors
    const trainImagesTensor = tf.tensor4d(trainImages);
    const trainLabelsTensor = tf.tensor2d(trainLabels);
    const testImagesTensor = tf.tensor4d(testImages);
    const testLabelsTensor = tf.tensor2d(testLabels);

    return {
        trainImages: trainImagesTensor,
        trainLabels: trainLabelsTensor,
        testImages: testImagesTensor,
        testLabels: testLabelsTensor
    };
}

// Train the model
async function trainModel() {
    try {
        // Create and compile the model
        const model = createModel();
        model.compile({
            optimizer: tf.train.adam(0.001),
            loss: 'categoricalCrossentropy',
            metrics: ['accuracy']
        });

        console.log('Model created and compiled');

        // Load the data
        const { trainImages, trainLabels, testImages, testLabels } = await loadData();

        console.log('Starting model training...');

        // Train the model with early stopping
        const history = await model.fit(trainImages, trainLabels, {
            epochs: 5,
            batchSize: 64,
            validationSplit: 0.2,
            callbacks: {
                onEpochEnd: (epoch, logs) => {
                    console.log(`Epoch ${epoch + 1} of 20`);
                    console.log(`Loss: ${logs.loss.toFixed(4)}, Accuracy: ${logs.acc.toFixed(4)}`);
                },
                onTrainEnd: () => {
                    console.log('Training completed!');
                }
            }
        });

        // Evaluate the model
        const evaluation = await model.evaluate(testImages, testLabels);
        console.log('\nTest accuracy:', evaluation[1]);

        // Save the model
        await model.save('file://./mnist_model');
        console.log('\nModel saved successfully!');

        // Clean up tensors
        tf.dispose([trainImages, trainLabels, testImages, testLabels]);

    } catch (error) {
        console.error('Error during training:', error);
    }
}

// Run the training
trainModel(); 