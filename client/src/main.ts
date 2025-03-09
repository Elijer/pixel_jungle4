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

  // NOTE: By wrapping everything in an additional nest of "initial data", I can pass presets from server to client
  // like the map size, if that's ever needed
  // socket.off("initialData")
  // socket.on("initialData", (initialData)=>{

  const listenerController = new AbortController();
  const { signal } = listenerController; // add this to key bindings to efficiently clean them up

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

    socket.on("update", (data)=>{
      console.log(data)
    })

    // And THIS is called whenever anything in the map moves
    // OR if the player moves
    // (starting out we won't do any optimistic updates for movement / player actions, 
    // cause honestly we don't have to - updates are very fast
    // Although...they will have some latency. So, it would improve the experience quite a bit
    // to do optimistic updates,
    // but again, not my first priority
    // )
    // socket.on("upate", (buff) => {
      
    // })

  // })

  socket.on("disconnect", ()=>{
    listenerController.abort();
    // document.removeEventListener("keydown", controlsListener)
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

resizeCanvas(); // would rather do this with css
animationLoop();