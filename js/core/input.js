// Клавиатура + мышь + pointer lock.
export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pressed = new Set();     // сработало в этом кадре
    this.mouseDown = false;
    this.dx = 0; this.dy = 0;
    this.locked = false;
    this.clickQueued = false;

    window.addEventListener('keydown', e => {
      if (e.repeat) return;
      this.keys.add(e.code);
      this.pressed.add(e.code);
      if (['Space', 'Tab', 'KeyE', 'KeyR'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', e => this.keys.delete(e.code));
    window.addEventListener('blur', () => { this.keys.clear(); this.mouseDown = false; });

    canvas.addEventListener('mousedown', e => {
      if (e.button === 0) { this.mouseDown = true; this.clickQueued = true; }
    });
    window.addEventListener('mouseup', e => { if (e.button === 0) this.mouseDown = false; });
    window.addEventListener('mousemove', e => {
      if (!this.locked) return;
      this.dx += e.movementX || 0;
      this.dy += e.movementY || 0;
    });
    canvas.addEventListener('contextmenu', e => e.preventDefault());

    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
    });
    document.addEventListener('pointerlockerror', () => { this.locked = false; });
  }

  lock() {
    if (this.canvas.requestPointerLock) {
      const p = this.canvas.requestPointerLock();
      if (p && p.catch) p.catch(() => {});
    }
  }
  unlock() { if (document.exitPointerLock) document.exitPointerLock(); }

  down(code) { return this.keys.has(code); }
  hit(code) { return this.pressed.has(code); }
  takeClick() { const c = this.clickQueued; this.clickQueued = false; return c; }

  endFrame() {
    this.pressed.clear();
    this.dx = 0; this.dy = 0;
    this.clickQueued = false;
  }
}
