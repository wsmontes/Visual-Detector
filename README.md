# Visual Detector

A real-time object detection and classification web application that uses TensorFlow.js and computer vision models to identify objects and provide contextual information from the camera feed.

## Live Demo

Try the application now: [Visual Detector Demo](https://wsmontes.github.io/Visual-Detector/)

## Features

- Real-time object detection using COCO-SSD model
- Scene classification using MobileNet
- Multiple information overlays displaying detection and classification results
- Works directly in the browser with no backend requirements
- Mobile-friendly design

## Technologies Used

- TensorFlow.js
- COCO-SSD model for object detection
- MobileNet model for image classification
- HTML5 Canvas for visualization
- HTML5 Media Capture API

## Getting Started

### Prerequisites

- A modern web browser (Chrome, Firefox, Safari, Edge)
- A device with a camera
- Internet connection (for initial model download)

### Installation

1. **Option 1: Access the live demo**
   
   Visit [https://wsmontes.github.io/Visual-Detector/](https://wsmontes.github.io/Visual-Detector/)

2. **Option 2: Run locally**

   Clone this repository:
   ```
   git clone https://github.com/yourusername/Visual-Detector.git
   ```

   Navigate to the project directory:
   ```
   cd Visual-Detector
   ```

   Open `index.html` in your browser or use a local development server:
   ```
   # Using Python's built-in server
   python -m http.server
   ```

   Click the "Start App" button to begin detection.

## Usage

1. Allow camera access when prompted
2. Wait for the models to download (this may take a few seconds)
3. The application will automatically begin detecting objects and classifying the scene
4. View detection results in the overlays:
   - Top-right: Scene context
   - Bottom-left: Detailed detection information

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- TensorFlow.js team for providing the models and framework
- COCO dataset for object detection training data
