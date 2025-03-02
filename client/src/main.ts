import './style.css';
import { io } from "socket.io-client";

const herokuUrl = 'set the url for whatever service you are using'
let socketAddress = window.location.hostname === "localhost" ? "ws://localhost:3000" : herokuUrl
const socket = io(socketAddress)

// Grab the canvas
const canvas = document.querySelector("canvas");
const ctx = canvas!.getContext("2d");

// Create an off-screen canvas
const offscreenCanvas = document.createElement("canvas");
const offscreenCtx = offscreenCanvas.getContext("2d");

const colors = ["black", "yellow", "orange", "red"]

socket.on("connect", ()=> {
  socket.on("view", (buff)=>{
    const squareSize = offscreenCanvas.width / 64;
    const dv = new DataView(buff)
    // const tiles = []

    for (let i = 0; i < dv.byteLength; i++){
      const byte = dv.getUint8(i)

      for (let j = 0; j < 4; j++){
        const v = (byte >> (2 * j)) & 0b11
        let color = colors[v]

        const tileNum = i * 4 + j
        const row = Math.floor(tileNum / 64)
        const col = tileNum % 64
        offscreenCtx!.fillStyle = color
        offscreenCtx!.fillRect(col * squareSize, row * squareSize, squareSize, squareSize);
      }
    }

  })
})


// resizes both canvases dynamically
function resizeCanvas() {
    const size = Math.min(window.innerWidth, window.innerHeight) * 0.90;
    canvas!.width = size;
    canvas!.height = size;
    offscreenCanvas.width = size;
    offscreenCanvas.height = size;
}


// just clears canvas and copies offscreen to visible canvas
function renderToMainCanvas() {
    ctx!.clearRect(0, 0, canvas!.width, canvas!.height);
    ctx!.drawImage(offscreenCanvas, 0, 0);
}

function animationLoop() {
  renderToMainCanvas();
  requestAnimationFrame(animationLoop); // Use requestAnimationFrame for smoother animation
}

resizeCanvas(); // I don't know why I'm doing this with js...?
animationLoop();