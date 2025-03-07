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
let currentVideoStream = null;
let lastOrientation = window.innerWidth > window.innerHeight ? 'landscape' : 'portrait';

// Set up the camera and adjust canvas sizes
async function setupCamera() {
  try {
    statusDiv.innerText = "Status: Setting up camera...";
    
    // Close any existing streams
    if (currentVideoStream) {
      currentVideoStream.getTracks().forEach(track => track.stop());
    }
    
    // Get device pixel ratio to handle high DPI displays
    const pixelRatio = window.devicePixelRatio || 1;
    
    // Get the ideal resolution based on screen size
    const idealWidth = window.innerWidth * pixelRatio;
    const idealHeight = window.innerHeight * pixelRatio;
    
    // Request the camera with appropriate constraints
    const constraints = {
      video: {
        facingMode: "environment", 
        width: { ideal: Math.max(idealWidth, idealHeight) },
        height: { ideal: Math.min(idealWidth, idealHeight) }
      }
    };
    
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    currentVideoStream = stream;
    video.srcObject = stream;
    
    return new Promise((resolve) => {
      video.onloadedmetadata = () => {
        updateCanvasSize();
        resolve();
      };
    });
  } catch (error) {
    alert("Error accessing camera: " + error.message);
    statusDiv.innerText = "Status: Camera error - " + error.message;
  }
}

// Update canvas size to match video/container dimensions
function updateCanvasSize() {
  // Get the container dimensions
  const containerWidth = container.clientWidth;
  const containerHeight = container.clientHeight;
  
  // Set canvas dimensions to match the container
  overlayCanvas.width = containerWidth;
  overlayCanvas.height = containerHeight;
  
  // Get video dimensions
  const videoWidth = video.videoWidth || containerWidth;
  const videoHeight = video.videoHeight || containerHeight;
  
  if (videoWidth && videoHeight) {
    // Calculate aspect ratios
    const containerAspect = containerWidth / containerHeight;
    const videoAspect = videoWidth / videoHeight;
    
    // Determine scale and offset to maintain aspect ratio
    let scale, offsetX = 0, offsetY = 0;
    
    if (containerAspect > videoAspect) {
      // Container is wider than video
      scale = containerHeight / videoHeight;
      offsetX = (containerWidth - (videoWidth * scale)) / 2;
    } else {
      // Container is taller than video
      scale = containerWidth / videoWidth;
      offsetY = (containerHeight - (videoHeight * scale)) / 2;
    }
    
    // Apply transformation matrix for drawing
    ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY);
  }
}

// Handle window resize events
function setupResizeHandler() {
  const debouncedResize = debounce(() => {
    updateCanvasSize();
    
    // Check if orientation has changed
    const newOrientation = window.innerWidth > window.innerHeight ? 'landscape' : 'portrait';
    if (newOrientation !== lastOrientation) {
      lastOrientation = newOrientation;
      // Restart camera with new orientation if the app is running
      if (isDetectionRunning) {
        setupCamera();
      }
    }
  }, 250);
  
  window.addEventListener('resize', debouncedResize);
  
  // Handle orientation changes explicitly
  window.addEventListener('orientationchange', () => {
    // Use a longer delay for orientation changes
    setTimeout(debouncedResize, 300);
  });
}

// Simple debounce function to prevent excessive resize handling
function debounce(func, wait) {
  let timeout;
  return function() {
    const context = this;
    const args = arguments;
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      func.apply(context, args);
    }, wait);
  };
}

// Load the COCO-SSD object detection model
async function loadObjectDetectionModel() {
  statusDiv.innerText = "Status: Downloading object detection model...";
  try {
    objectDetectionModel = await cocoSsd.load();
    statusDiv.innerText = "Status: Object detection model loaded.";
    return true;
  } catch (error) {
    statusDiv.innerText = "Status: Error loading object detection model.";
    console.error("Error loading COCO-SSD model:", error);
    return false;
  }
}

// Load the MobileNet model for context classification
async function loadMobileNetModel() {
  statusDiv.innerText = "Status: Downloading context classifier model...";
  try {
    mobilenetModel = await mobilenet.load();
    statusDiv.innerText = "Status: All models loaded. Running detection...";
    return true;
  } catch (error) {
    statusDiv.innerText = "Status: Error loading context model.";
    console.error("Error loading MobileNet model:", error);
    return false;
  }
}

// Object detection loop: detect objects and draw bounding boxes on the overlay canvas
async function detectFrame() {
  if (!isDetectionRunning) return;
  
  try {
    const predictions = await objectDetectionModel.detect(video);
    
    // Clear the entire canvas using the current transform
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    ctx.restore();
    
    // Draw the bounding boxes using our scale-aware transform
    predictions.forEach((prediction) => {
      const [x, y, width, height] = prediction.bbox;
      
      // Draw box
      ctx.strokeStyle = "#00FFFF";
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, width, height);
      
      // Scale font size based on container width and prediction box size
      const fontSize = Math.max(10, Math.min(16, width / 10));
      ctx.font = `${fontSize}px Arial`;
      
      const text = `${prediction.class} (${(prediction.score * 100).toFixed(1)}%)`;
      const textWidth = ctx.measureText(text).width;
      
      // Draw text background
      ctx.fillStyle = "#00FFFF";
      ctx.fillRect(x, y - fontSize - 2, textWidth + 4, fontSize + 4);
      
      // Draw text
      ctx.fillStyle = "#000000";
      ctx.fillText(text, x + 2, y - 2);
    });
    
    // Format the detection data for better display
    const formattedDetections = predictions
      .map(p => `${p.class}: ${(p.score * 100).toFixed(1)}%`)
      .join('\n');
    
    detectionDataDiv.innerText = formattedDetections || "No objects detected";
    
    // Continue the detection loop
    requestAnimationFrame(detectFrame);
  } catch (error) {
    console.error("Detection error:", error);
    statusDiv.innerText = "Status: Detection error";
    // Try to recover by continuing the loop
    requestAnimationFrame(detectFrame);
  }
}

// Context classification using MobileNet (aggregated over a 10-second window)
async function classifyFrame() {
  if (!isDetectionRunning || !mobilenetModel) return;
  
  try {
    const results = await mobilenetModel.classify(video);
    if (results && results.length > 0) {
      const prediction = results[0];
      const now = Date.now();
      
      contextResults.push({
        label: prediction.className,
        confidence: prediction.probability,
        timestamp: now
      });
      
      // Keep only results from the last 10 seconds
      contextResults = contextResults.filter(item => now - item.timestamp < 10000);
      
      // Count occurrences of each label
      const counts = {};
      contextResults.forEach(item => {
        counts[item.label] = (counts[item.label] || 0) + 1;
      });
      
      // Find the most common label
      const aggregatedLabel = Object.keys(counts).reduce((a, b) =>
        counts[a] > counts[b] ? a : b,
        "N/A"
      );
      
      contextResultDiv.innerText = "Context: " + aggregatedLabel;
    }
  } catch (error) {
    console.error("Classification error:", error);
    // Continue silently - classification is not critical
  }
}

// Start periodic context classification (every 2 seconds)
function startClassificationInterval() {
  return setInterval(classifyFrame, 2000);
}

// Start the full application
startButton.addEventListener("click", async () => {
  startButton.disabled = true;
  startButton.innerText = "Loading...";
  
  await setupCamera();
  setupResizeHandler();
  
  // Load models in parallel
  const [objectModelSuccess, contextModelSuccess] = await Promise.all([
    loadObjectDetectionModel(),
    loadMobileNetModel()
  ]);
  
  if (!objectModelSuccess) {
    alert("Failed to load object detection model. Please check your internet connection and try again.");
    startButton.disabled = false;
    startButton.innerText = "Try Again";
    return;
  }
  
  // Turn off the status overlay so that downloading info doesn't overlap real-time data
  if (objectModelSuccess) {
    statusDiv.parentElement.style.opacity = "0";
    setTimeout(() => {
      statusDiv.parentElement.style.display = "none";
    }, 300);
  }
  
  isDetectionRunning = true;
  startButton.innerText = "Running...";
  
  // Start detection
  detectFrame();
  
  // Start classification if available
  if (contextModelSuccess) {
    startClassificationInterval();
  } else {
    contextResultDiv.innerText = "Context: Unavailable";
  }
});

// Initial setup
document.addEventListener('DOMContentLoaded', () => {
  updateCanvasSize();
  
  // Set initial inner height for mobile browsers
  document.documentElement.style.setProperty(
    '--vh', 
    `${window.innerHeight * 0.01}px`
  );
});
