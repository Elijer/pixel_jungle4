import './style.css';
import { io } from "socket.io-client";

const herokuUrl = 'set the url for whatever service you are using'
let socketAddress = window.location.hostname === "localhost" ? "ws://localhost:3000" : herokuUrl
const socket = io(socketAddress)

socket.on("connect", ()=> {
  console.log("server -> client socket connection")

  socket.emit("client-confirm", "connected")
  
  socket.on("init", (msg)=>{
    console.log(`setup data: ${msg}`)
  })

  socket.on("bin", (bin)=>{
    console.log(`Should be some binary data:`, bin)
  })

})

// Grab the canvas
const canvas = document.querySelector("canvas");
document.createElement("canvas");
const ctx = canvas!.getContext("2d");

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
    // const gridSize = 64;
    // const squareSize = offscreenCanvas.width / gridSize;

    // for (let row = 0; row < gridSize; row++) {
    //     for (let col = 0; col < gridSize; col++) {
    //         offscreenCtx!.fillStyle = `rgb(${rand(255)}, ${rand(255)}, ${rand(255)})`;
    //         offscreenCtx!.fillRect(col * squareSize, row * squareSize, squareSize, squareSize);
    //     }
    // }
}

// Random number generator for colors
// function rand(max: number) {
//     return Math.floor(Math.random() * (max + 1));
// }

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

socket.on("view", (event) => {
  const grid = parseGrid(event)
  updateGrid(grid)
});

function parseGrid(buffer: ArrayBuffer): number[] {
  const bytes = new Uint8Array(buffer);  // Convert to byte array
  const values: number[] = [];

  for (let i = 0; i < bytes.length; i++) {
    const byte = bytes[i];

    // Extract four 2-bit values from the byte
    const v1 = (byte >> 6) & 0b11; // First 2 bits (highest)
    const v2 = (byte >> 4) & 0b11; // Second 2 bits
    const v3 = (byte >> 2) & 0b11; // Third 2 bits
    const v4 = byte & 0b11;        // Fourth 2 bits (lowest)

    values.push(v1, v2, v3, v4);
  }

  console.log("Decoded Grid Values:", values);
  return values;
}

function updateGrid(values: number[]) {
  const gridSize = 64;  // Assuming a 64x64 grid
  const squareSize = offscreenCanvas.width / gridSize;

  for (let i = 0; i < values.length; i++) {
    const row = Math.floor(i / gridSize);
    const col = i % gridSize;

    // 0 -> Black, 1 -> Green
    const color = values[i] === 1 ? "green" : "black";

    offscreenCtx!.fillStyle = color;
    offscreenCtx!.fillRect(col * squareSize, row * squareSize, squareSize, squareSize);
  }

  renderToMainCanvas();
}


// Resize and start animation loop
resizeCanvas();
window.addEventListener("resize", resizeCanvas);
animationLoop();
