import './style.css';

// Grab the canvas
const canvas = document.querySelector("canvas");
document.createElement("canvas");
const ctx = canvas!.getContext("2d");

console.log("Success")

// Create an off-screen canvas
const offscreenCanvas = document.createElement("canvas");
const offscreenCtx = offscreenCanvas.getContext("2d");

// Resize both canvases dynamically
function resizeCanvas() {
    const size = Math.min(window.innerWidth, window.innerHeight) * 0.90;
    canvas!.width = size;
    canvas!.height = size;
    offscreenCanvas.width = size;
    offscreenCanvas.height = size;

    drawGrid(); // Redraw grid on resize
}

// Generate a 64x64 grid with random colors
function drawGrid() {
    const gridSize = 64;
    const squareSize = offscreenCanvas.width / gridSize;

    for (let row = 0; row < gridSize; row++) {
        for (let col = 0; col < gridSize; col++) {
            offscreenCtx!.fillStyle = `rgb(${rand(255)}, ${rand(255)}, ${rand(255)})`;
            offscreenCtx!.fillRect(col * squareSize, row * squareSize, squareSize, squareSize);
        }
    }
}

// Random number generator for colors
function rand(max: number) {
    return Math.floor(Math.random() * (max + 1));
}

// Render offscreen canvas to the main canvas
function renderToMainCanvas() {
    ctx!.clearRect(0, 0, canvas!.width, canvas!.height);
    ctx!.drawImage(offscreenCanvas, 0, 0);
}

// Animation loop to refresh grid every 100ms
function animationLoop() {
    drawGrid(); // Update the grid with new colors
    renderToMainCanvas();
    setTimeout(animationLoop, 100); // Run every 100ms instead of using requestAnimationFrame
}

// Resize and start animation loop
resizeCanvas();
window.addEventListener("resize", resizeCanvas);
animationLoop();
