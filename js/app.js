// DOM Elements
const video = document.getElementById("video");
const overlayCanvas = document.getElementById("overlayCanvas");
const ctx = overlayCanvas.getContext("2d");
const statusDiv = document.getElementById("status");
const contextResultDiv = document.getElementById("contextResult");
const detectionDataDiv = document.getElementById("detectionData");
const startButton = document.getElementById("startButton");

let objectDetectionModel;
let mobilenetModel;
let contextResults = [];

// Set up the camera and adjust canvas sizes
async function setupCamera() {
  try {
    statusDiv.innerText = "Status: Setting up camera...";
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" }
    });
    video.srcObject = stream;
    return new Promise((resolve) => {
      video.onloadedmetadata = () => {
        overlayCanvas.width = video.videoWidth;
        overlayCanvas.height = video.videoHeight;
        resolve();
      };
    });
  } catch (error) {
    alert("Error accessing camera: " + error.message);
  }
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
  const predictions = await objectDetectionModel.detect(video);
  ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
  predictions.forEach((prediction) => {
    const [x, y, width, height] = prediction.bbox;
    ctx.strokeStyle = "#00FFFF";
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, width, height);
    ctx.fillStyle = "#00FFFF";
    ctx.font = "16px Arial";
    const text = `${prediction.class} (${(prediction.score * 100).toFixed(1)}%)`;
    const textWidth = ctx.measureText(text).width;
    ctx.fillRect(x, y - 16, textWidth + 4, 16);
    ctx.fillStyle = "#000000";
    ctx.fillText(text, x + 2, y - 2);
  });
  detectionDataDiv.innerText = "Detection: " + JSON.stringify(predictions, null, 2);
  requestAnimationFrame(detectFrame);
}

// Context classification using MobileNet (aggregated over a 10-second window)
async function classifyFrame() {
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
  await loadObjectDetectionModel();
  await loadMobileNetModel();
  // Turn off the status overlay so that downloading info doesn't overlap real-time data.
  statusDiv.style.display = "none";
  detectFrame();
  startClassificationInterval();
});
