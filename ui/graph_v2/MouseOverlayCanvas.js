class MouseOverlayCanvas {
  constructor(container) {
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.peerCursors = new Map();
    this.setupCanvas(container);
    this.startRenderLoop();
  }

  setupCanvas(container) {
    this.canvas.style.position = 'absolute';
    this.canvas.style.top = '0';
    this.canvas.style.left = '0';
    this.canvas.style.pointerEvents = 'none';
    this.canvas.style.zIndex = '10'; // Ensure it's above the Three.js canvas
    container.appendChild(this.canvas);

    const resizeObserver = new ResizeObserver(() => this.resizeCanvas());
    resizeObserver.observe(container);

    // Initial resize
    this.resizeCanvas();
  }

  resizeCanvas() {
    const { width, height } = this.canvas.parentElement.getBoundingClientRect();
    this.canvas.width = width;
    this.canvas.height = height;
  }

  updateMousePosition(peerId, x, y) {
    this.peerCursors.set(peerId, { x, y });
  }

  startRenderLoop() {
    const renderLoop = () => {
      this.drawCursors();
      requestAnimationFrame(renderLoop);
    };
    renderLoop();
  }

  drawCursors() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this.peerCursors.forEach((position, peerId) => {
      this.ctx.beginPath();
      this.ctx.arc(position.x, position.y, 5, 0, 2 * Math.PI);
      this.ctx.fillStyle = this.getColorForPeer(peerId);
      this.ctx.fill();

      this.ctx.font = '12px Arial';
      this.ctx.fillStyle = 'white';
      this.ctx.fillText(peerId, position.x + 10, position.y + 5);
    });
  }
  
    getColorForPeer(peerId) {
      // Simple hash function to generate a color based on peerId
      let hash = 0;
      for (let i = 0; i < peerId.length; i++) {
        hash = peerId.charCodeAt(i) + ((hash << 5) - hash);
      }
      const color = `hsl(${hash % 360}, 100%, 50%)`;
      return color;
    }
  
    removePeerCursor(peerId) {
      this.peerCursors.delete(peerId);
      this.drawCursors();
    }
  
    clear() {
      this.peerCursors.clear();
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }
  
  export default MouseOverlayCanvas;