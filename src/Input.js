export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.mouse = {
      x: 0,
      y: 0,
      down: false,
      right: false,
      rightClicked: false,
    };
    this._ndc = { x: 0, y: 0 };

    window.addEventListener('keydown', (e) => {
      this.keys.add(e.code);
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.mouse.down = false;
      this.mouse.right = false;
    });

    canvas.addEventListener('pointerdown', (e) => {
      this._track(e, canvas);
      if (e.button === 0) {
        this.mouse.down = true;
        canvas.setPointerCapture?.(e.pointerId);
      } else if (e.button === 2) {
        this.mouse.right = true;
        this.mouse.rightClicked = true;
      }
    });
    canvas.addEventListener('pointerup', (e) => {
      if (e.button === 0) this.mouse.down = false;
      if (e.button === 2) this.mouse.right = false;
    });
    canvas.addEventListener('pointercancel', () => {
      this.mouse.down = false;
      this.mouse.right = false;
    });
    canvas.addEventListener('pointermove', (e) => this._track(e, canvas));
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  _track(e, canvas) {
    const r = canvas.getBoundingClientRect();
    this.mouse.x = e.clientX - r.left;
    this.mouse.y = e.clientY - r.top;
    this._ndc.x = ((this.mouse.x / r.width) * 2) - 1;
    this._ndc.y = -(((this.mouse.y / r.height) * 2) - 1);
  }

  consumeRightClick() {
    if (!this.mouse.rightClicked) return false;
    this.mouse.rightClicked = false;
    return true;
  }

  axis() {
    let x = 0, y = 0;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) y -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) y += 1;
    const len = Math.hypot(x, y);
    if (len > 1) { x /= len; y /= len; }
    return { x, y };
  }
}
