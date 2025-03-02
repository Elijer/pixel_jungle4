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
  
  socket.on("view", (buff) => {
    const squareSize = offscreenCanvas.width / 64;
    const dv = new DataView(buff);
    
    for (let i = 0; i < dv.byteLength; i++) {
      const byte = dv.getUint8(i);
      
      // Unpack in simple ascending order
      for (let j = 0; j < 4; j++) {
        const v = (byte >> (2 * j)) & 0b11;
        
        const color = colors[v];
        const tileNum = i * 4 + j;
        const row = Math.floor(tileNum / 64);
        const col = tileNum % 64;
        
        offscreenCtx!.fillStyle = color;
        offscreenCtx!.fillRect(col * squareSize, row * squareSize, squareSize, squareSize);
      }
    }
  });
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


// Other bit unpacking strategies for inspo
  // socket.on("view", (buff)=>{
  //   const squareSize = offscreenCanvas.width / 64;
  //   const dv = new DataView(buff)

  //   for (let i = 0; i < dv.byteLength; i++){
  //     const byte = dv.getUint8(i)

  //     for (let j = 0; j < 4; j++){
  //       const v = (byte >> (2 * j)) & 0b11
  //       if (v) console.log(v)
  //       let color = colors[v]
  //       const tileNum = i * 4 + j
  //       const row = Math.floor(tileNum / 64)
  //       const col = tileNum % 64
  //       offscreenCtx!.fillStyle = color
  //       offscreenCtx!.fillRect(col * squareSize, row * squareSize, squareSize, squareSize);

  //     }
  //   }

  // })

// Method of reverse packing extraction but maybe some good tidbits to cannibalize in there
// socket.on("connect", () => {
//   socket.on("view", (buff) => {
//     const squareSize = offscreenCanvas.width / 64;
//     const dv = new DataView(buff);
    
//     for (let i = 0; i < dv.byteLength; i++) {
//       const byte = dv.getUint8(i);
      
//       // Extract in reverse order from how we iterate through grid positions
//       const values = [
//         (byte >> 6) & 0b11,  // bits 7-6 (v1)
//         (byte >> 4) & 0b11,  // bits 5-4 (v2)
//         (byte >> 2) & 0b11,  // bits 3-2 (v3)
//         byte & 0b11          // bits 1-0 (v4)
//       ];
      
//       for (let j = 0; j < 4; j++) {
//         const value = values[j];
//         if (value) console.log(value);
        
//         const color = colors[value];
//         const tileNum = i * 4 + j;
//         const row = Math.floor(tileNum / 64);
//         const col = tileNum % 64;
        
//         offscreenCtx!.fillStyle = color;
//         offscreenCtx!.fillRect(col * squareSize, row * squareSize, squareSize, squareSize);
//       }
//     }
//   });
// });