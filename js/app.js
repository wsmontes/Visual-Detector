// DOM Elements
const video = document.getElementById("video");
const overlayCanvas = document.getElementById("overlayCanvas");
const ctx = overlayCanvas.getContext("2d");
const statusDiv = document.getElementById("status");
const contextResultDiv = document.getElementById("contextResult");
const detectionDataDiv = document.getElementById("detectionData");
const startButton = document.getElementById("startButton");
const container = document.getElementById("container");

let objectDetectionModel;
let mobilenetModel;
let contextResults = [];
let isDetectionRunning = false;

// Set up the camera and adjust canvas sizes
async function setupCamera() {
  try {
    statusDiv.innerText = "Status: Setting up camera...";
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { 
        facingMode: "environment",
        width: { ideal: 1280 },
        height: { ideal: 720 }
      }
    });
    video.srcObject = stream;
    return new Promise((resolve) => {
      video.onloadedmetadata = () => {
        updateCanvasSize();
        resolve();
      };
    });
  } catch (error) {
    alert("Error accessing camera: " + error.message);
  }
}

// Update canvas size to match video/container dimensions
function updateCanvasSize() {
  // Get the container dimensions
  const containerWidth = container.clientWidth;
  const containerHeight = container.clientHeight;
  
  // Get video dimensions
  const videoWidth = video.videoWidth;
  const videoHeight = video.videoHeight;
  
  // Calculate aspect ratios
  const containerAspect = containerWidth / containerHeight;
  const videoAspect = videoWidth / videoHeight;
  
  // Set canvas dimensions to match the container
  overlayCanvas.width = containerWidth;
  overlayCanvas.height = containerHeight;
  
  // Adjust drawing scale to maintain proportions
  if (containerAspect > videoAspect) {
    // Container is wider than video
    const scale = containerHeight / videoHeight;
    const scaledWidth = videoWidth * scale;
    const offsetX = (containerWidth - scaledWidth) / 2;
    ctx.setTransform(scale, 0, 0, scale, offsetX, 0);
  } else {
    // Container is taller than video
    const scale = containerWidth / videoWidth;
    const scaledHeight = videoHeight * scale;
    const offsetY = (containerHeight - scaledHeight) / 2;
    ctx.setTransform(scale, 0, 0, scale, 0, offsetY);
  }
}

// Handle window resize events
function setupResizeHandler() {
  window.addEventListener('resize', () => {
    updateCanvasSize();
  });
  
  // Also handle orientation changes explicitly
  window.addEventListener('orientationchange', () => {
    // Small delay to ensure dimensions have updated
    setTimeout(updateCanvasSize, 200);
  });
}

// Load the COCO-SSD object detection model
async function loadObjectDetectionModel() {
  statusDiv.innerText = "Status: Downloading object detection model...";
  objectDetectionModel = await cocoSsd.load();
  statusDiv.innerText = "Status: Object detection model loaded.";
}

// Load the MobileNet model for context classification
async function loadMobileNetModel() {
  statusDiv.innerText = "Status: Downloading context classifier model...";
  mobilenetModel = await mobilenet.load();
  statusDiv.innerText = "Status: All models loaded. Running detection...";
}

// Object detection loop: detect objects and draw bounding boxes on the overlay canvas
async function detectFrame() {
  if (!isDetectionRunning) return;
  
  const predictions = await objectDetectionModel.detect(video);
  ctx.save();
  
  // Reset transform to clear the entire canvas in absolute coordinates
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
  
  // Restore the transform for drawing bounding boxes
  ctx.restore();
  
  predictions.forEach((prediction) => {
    const [x, y, width, height] = prediction.bbox;
    ctx.strokeStyle = "#00FFFF";
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, width, height);
    ctx.fillStyle = "#00FFFF";
    
    // Scale font size based on container width
    const fontSize = Math.max(12, Math.min(16, container.clientWidth / 40));
    ctx.font = `${fontSize}px Arial`;
    
    const text = `${prediction.class} (${(prediction.score * 100).toFixed(1)}%)`;
    const textWidth = ctx.measureText(text).width;
    ctx.fillRect(x, y - fontSize, textWidth + 4, fontSize);
    ctx.fillStyle = "#000000";
    ctx.fillText(text, x + 2, y - 2);
  });
  
  // Format the detection data for better display
  const formattedDetections = predictions.map(p => 
    `${p.class}: ${(p.score * 100).toFixed(1)}%`
  ).join('\n');
  
  detectionDataDiv.innerText = formattedDetections || "No objects detected";
  
  requestAnimationFrame(detectFrame);
}

// Context classification using MobileNet (aggregated over a 10-second window)
async function classifyFrame() {
  if (!isDetectionRunning) return;
  
  const results = await mobilenetModel.classify(video);
  const prediction = results[0];
  const now = Date.now();
  contextResults.push({
    label: prediction.className,
    confidence: prediction.probability,
    timestamp: now
  });
  // Keep only results from the last 10 seconds
  contextResults = contextResults.filter(item => now - item.timestamp < 10000);
  const counts = {};
  contextResults.forEach(item => {
    counts[item.label] = (counts[item.label] || 0) + 1;
  });
  const aggregatedLabel = Object.keys(counts).reduce((a, b) =>
    counts[a] > counts[b] ? a : b,
    "N/A"
  );
  contextResultDiv.innerText = "Context: " + aggregatedLabel;
}

// Start periodic context classification (every 2 seconds)
function startClassificationInterval() {
  setInterval(classifyFrame, 2000);
}

// Start the full application
startButton.addEventListener("click", async () => {
  startButton.disabled = true;
  await setupCamera();
  setupResizeHandler();
  await loadObjectDetectionModel();
  await loadMobileNetModel();
  
  // Turn off the status overlay so that downloading info doesn't overlap real-time data.
  statusDiv.style.display = "none";
  isDetectionRunning = true;
  detectFrame();
  startClassificationInterval();
});

// Initial setup
document.addEventListener('DOMContentLoaded', () => {
  updateCanvasSize();
});
