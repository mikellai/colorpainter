// 塗色引擎：三層合成 = 背景色 + 上色圖層（使用者的顏色）+ 線稿圖層（永遠在最上面）
// 線稿只用來當邊界，不會被畫筆或橡皮擦改到。

export const SIZE = 1000;          // 畫布內部解析度（正方形）
const LINE_THRESHOLD = 90;          // 線稿 alpha 大於此值視為「線」
const SMALL_GAP = 1;                // 一般填色時的線條加粗（處理反鋸齒）
const BIG_GAP = 4;                  // 偵測到缺口時用的加粗半徑（可補 ~9px 的缺口）
const MAX_HISTORY_BYTES = 160e6;    // 撤銷紀錄記憶體上限

export class Painter {
  constructor(canvas) {
    this.view = canvas;
    this.view.width = this.view.height = SIZE;
    this.vctx = canvas.getContext('2d');
    this.color = mk();
    this.cctx = this.color.getContext('2d', { willReadFrequently: true });
    this.line = mk();
    this.lctx = this.line.getContext('2d');
    this.background = '#ffffff';
    this.mask = null;     // 原始線條遮罩
    this.maskS = null;    // 小幅加粗
    this.maskB = null;    // 大幅加粗（補缺口用）
    this.undoStack = [];
    this.redoStack = [];
    this.historyBytes = 0;
    this.dirty = false;
    this.onChange = () => {};
    this._raf = 0;
    this._stroke = null;
  }

  // ---------- 載入 ----------
  async loadLineArt(src) {
    const img = await loadImage(src);
    const tmp = mk();
    const t = tmp.getContext('2d', { willReadFrequently: true });
    t.fillStyle = '#fff';
    t.fillRect(0, 0, SIZE, SIZE);
    const s = Math.min(SIZE / (img.naturalWidth || SIZE), SIZE / (img.naturalHeight || SIZE));
    const w = (img.naturalWidth || SIZE) * s, h = (img.naturalHeight || SIZE) * s;
    t.drawImage(img, (SIZE - w) / 2, (SIZE - h) / 2, w, h);
    const data = t.getImageData(0, 0, SIZE, SIZE);
    const d = data.data;
    const mask = new Uint8Array(SIZE * SIZE);
    // 白色變透明、深色保留：讓任何白底黑線的圖都能當線稿
    for (let i = 0, p = 0; p < mask.length; i += 4, p++) {
      const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      const a = Math.max(0, Math.min(255, Math.round((255 - lum) * 1.15)));
      d[i] = 34; d[i + 1] = 30; d[i + 2] = 50; d[i + 3] = a;
      if (a > LINE_THRESHOLD) mask[p] = 1;
    }
    this.lctx.putImageData(data, 0, 0);
    this.mask = mask;
    this.maskS = dilate(mask, SMALL_GAP);
    this.maskB = dilate(mask, BIG_GAP);
    this.render();
  }

  async loadColorLayer(blob) {
    const url = URL.createObjectURL(blob);
    try {
      const img = await loadImage(url);
      this.cctx.clearRect(0, 0, SIZE, SIZE);
      this.cctx.drawImage(img, 0, 0, SIZE, SIZE);
    } finally { URL.revokeObjectURL(url); }
    this.render();
  }

  // ---------- 畫面 ----------
  render() {
    cancelAnimationFrame(this._raf);
    this._raf = 0;
    const v = this.vctx;
    v.globalCompositeOperation = 'source-over';
    v.fillStyle = this.background;
    v.fillRect(0, 0, SIZE, SIZE);
    v.drawImage(this.color, 0, 0);
    v.drawImage(this.line, 0, 0);
  }
  scheduleRender() {
    if (!this._raf) this._raf = requestAnimationFrame(() => this.render());
  }

  composite(size = SIZE) {
    const c = mk(size);
    const x = c.getContext('2d');
    x.fillStyle = this.background;
    x.fillRect(0, 0, size, size);
    x.imageSmoothingQuality = 'high';
    x.drawImage(this.color, 0, 0, size, size);
    x.drawImage(this.line, 0, 0, size, size);
    return c;
  }

  // ---------- 油漆桶 ----------
  // 回傳 'ok' | 'line'（點在線上）| 'same'
  fill(px, py, hex) {
    const x = Math.floor(px), y = Math.floor(py);
    if (x < 0 || y < 0 || x >= SIZE || y >= SIZE || !this.mask) return 'line';
    const seed = y * SIZE + x;
    if (this.mask[seed]) return 'line';

    // 一般情況：用小幅加粗的線條當邊界
    const region = this.maskS[seed] ? flood(this.mask, seed) : flood(this.maskS, seed);
    let box = expandBox(region, 3);
    let grown = dilate(region.mask, 3, box);
    // 容錯：用「補缺口」的粗邊界再填一次。若一般填色多出一大塊粗邊界填不到的區域，
    // 代表顏色從線稿缺口漏出去了，改用補缺口的結果。
    if (!this.maskB[seed]) {
      const strict = flood(this.maskB, seed);
      const sBox = expandBox(strict, BIG_GAP + 2);
      const sGrown = dilate(strict.mask, BIG_GAP + 2, sBox);
      let leaked = 0;
      for (let y = region.y0; y <= region.y1; y++) {
        for (let i = y * SIZE + region.x0, e = y * SIZE + region.x1; i <= e; i++) {
          if (region.mask[i] && !sGrown[i]) leaked++;
        }
      }
      if (leaked > SIZE * SIZE * 0.004) {
        box = sBox;
        grown = sGrown;
      }
    }

    const [r, g, b] = hexToRgb(hex);
    const bw = box.x1 - box.x0 + 1, bh = box.y1 - box.y0 + 1;
    const before = this.cctx.getImageData(box.x0, box.y0, bw, bh);
    const after = new ImageData(new Uint8ClampedArray(before.data), bw, bh);
    const d = after.data;
    let changed = false;
    for (let yy = 0; yy < bh; yy++) {
      const row = (yy + box.y0) * SIZE + box.x0;
      for (let xx = 0; xx < bw; xx++) {
        if (!grown[row + xx]) continue;
        const i = (yy * bw + xx) * 4;
        if (d[i] !== r || d[i + 1] !== g || d[i + 2] !== b || d[i + 3] !== 255) changed = true;
        d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255;
      }
    }
    if (!changed) return 'same';
    this.cctx.putImageData(after, box.x0, box.y0);
    this.pushHistory({ type: 'pixels', x: box.x0, y: box.y0, before, after });
    this.render();
    return 'ok';
  }

  // ---------- 畫筆／橡皮擦 ----------
  beginStroke(x, y, { color, size, erase }) {
    this._stroke = {
      snapshot: this.cctx.getImageData(0, 0, SIZE, SIZE),
      pts: [[x, y]],
      minX: x, minY: y, maxX: x, maxY: y,
      size, erase,
    };
    const c = this.cctx;
    c.save();
    c.globalCompositeOperation = erase ? 'destination-out' : 'source-over';
    c.fillStyle = c.strokeStyle = erase ? '#000' : color;
    c.lineWidth = size;
    c.lineCap = c.lineJoin = 'round';
    c.beginPath();
    c.arc(x, y, size / 2, 0, Math.PI * 2);
    c.fill();
    this.scheduleRender();
  }

  moveStroke(x, y) {
    const s = this._stroke;
    if (!s) return;
    const pts = s.pts;
    const [lx, ly] = pts[pts.length - 1];
    if (Math.hypot(x - lx, y - ly) < 1) return;
    pts.push([x, y]);
    s.minX = Math.min(s.minX, x); s.maxX = Math.max(s.maxX, x);
    s.minY = Math.min(s.minY, y); s.maxY = Math.max(s.maxY, y);
    const c = this.cctx;
    const n = pts.length;
    // 用中點二次曲線讓線條平滑
    const p0 = pts[n - 3] || pts[n - 2], p1 = pts[n - 2], p2 = pts[n - 1];
    const m1 = [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2];
    const m2 = [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2];
    c.beginPath();
    c.moveTo(n < 3 ? p1[0] : m1[0], n < 3 ? p1[1] : m1[1]);
    c.quadraticCurveTo(p1[0], p1[1], m2[0], m2[1]);
    c.lineTo(p2[0], p2[1]);
    c.stroke();
    this.scheduleRender();
  }

  endStroke() {
    const s = this._stroke;
    if (!s) return;
    this.cctx.restore();
    this._stroke = null;
    const pad = Math.ceil(s.size / 2) + 3;
    const x0 = clamp(Math.floor(s.minX - pad)), y0 = clamp(Math.floor(s.minY - pad));
    const x1 = clamp(Math.ceil(s.maxX + pad)), y1 = clamp(Math.ceil(s.maxY + pad));
    const w = x1 - x0 + 1, h = y1 - y0 + 1;
    const before = crop(s.snapshot, x0, y0, w, h);
    const after = this.cctx.getImageData(x0, y0, w, h);
    this.pushHistory({ type: 'pixels', x: x0, y: y0, before, after });
    this.render();
  }

  // 兩指縮放開始時取消正在畫的線
  cancelStroke() {
    const s = this._stroke;
    if (!s) return;
    this.cctx.restore();
    this.cctx.putImageData(s.snapshot, 0, 0);
    this._stroke = null;
    this.render();
  }

  // ---------- 背景、清除、復原 ----------
  setBackground(hex) {
    if (hex === this.background) return;
    this.pushHistory({ type: 'bg', before: this.background, after: hex });
    this.background = hex;
    this.render();
  }

  clearColors({ resetBackground = false } = {}) {
    const before = this.cctx.getImageData(0, 0, SIZE, SIZE);
    const isEmpty = isBlank(before) && (!resetBackground || this.background === '#ffffff');
    if (isEmpty) return false;
    this.cctx.clearRect(0, 0, SIZE, SIZE);
    const after = this.cctx.getImageData(0, 0, SIZE, SIZE);
    const items = [{ type: 'pixels', x: 0, y: 0, before, after }];
    if (resetBackground && this.background !== '#ffffff') {
      items.push({ type: 'bg', before: this.background, after: '#ffffff' });
      this.background = '#ffffff';
    }
    this.pushHistory(items.length === 1 ? items[0] : { type: 'group', items });
    this.render();
    return true;
  }

  // ---------- 撤銷／重做 ----------
  pushHistory(entry) {
    entry.bytes = entrySize(entry);
    this.undoStack.push(entry);
    this.historyBytes += entry.bytes;
    for (const e of this.redoStack) this.historyBytes -= e.bytes;
    this.redoStack = [];
    while (this.historyBytes > MAX_HISTORY_BYTES && this.undoStack.length > 1) {
      this.historyBytes -= this.undoStack.shift().bytes;
    }
    this.dirty = true;
    this.onChange();
  }
  apply(entry, dir) {
    if (entry.type === 'group') {
      const list = dir === 'before' ? [...entry.items].reverse() : entry.items;
      list.forEach(e => this.apply(e, dir));
    } else if (entry.type === 'pixels') {
      this.cctx.putImageData(entry[dir], entry.x, entry.y);
    } else if (entry.type === 'bg') {
      this.background = entry[dir];
    }
  }
  undo() {
    const e = this.undoStack.pop();
    if (!e) return false;
    this.apply(e, 'before');
    this.redoStack.push(e);
    this.dirty = true;
    this.render();
    this.onChange();
    return true;
  }
  redo() {
    const e = this.redoStack.pop();
    if (!e) return false;
    this.apply(e, 'after');
    this.undoStack.push(e);
    this.dirty = true;
    this.render();
    this.onChange();
    return true;
  }
  get canUndo() { return this.undoStack.length > 0; }
  get canRedo() { return this.redoStack.length > 0; }

  colorLayerBlob() { return toBlob(this.color); }
  pngBlob() { return toBlob(this.composite()); }
  thumbnailBlob() { return toBlob(this.composite(360)); }
}

// ================= 工具函式 =================
function mk(size = SIZE) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return c;
}
function clamp(v) { return Math.max(0, Math.min(SIZE - 1, v)); }

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('圖片載入失敗：' + src));
    img.src = src;
  });
}

function toBlob(canvas) {
  return new Promise((resolve, reject) =>
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('無法產生圖片'))), 'image/png'));
}

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// 掃描線填充：在 wall=0 的連通區域內，從 seed 開始
function flood(wall, seed) {
  const W = SIZE, H = SIZE;
  const out = new Uint8Array(W * H);
  const stack = [seed];
  let count = 0, x0 = W, y0 = H, x1 = 0, y1 = 0;
  while (stack.length) {
    const p = stack.pop();
    if (out[p] || wall[p]) continue;
    const y = (p / W) | 0;
    let l = p, r = p;
    const rowStart = y * W, rowEnd = rowStart + W - 1;
    while (l > rowStart && !wall[l - 1] && !out[l - 1]) l--;
    while (r < rowEnd && !wall[r + 1] && !out[r + 1]) r++;
    for (let i = l; i <= r; i++) out[i] = 1;
    count += r - l + 1;
    const lx = l - rowStart, rx = r - rowStart;
    if (lx < x0) x0 = lx; if (rx > x1) x1 = rx;
    if (y < y0) y0 = y; if (y > y1) y1 = y;
    // 只在每段的起點推入上下列，減少堆疊大小
    for (const ny of [y - 1, y + 1]) {
      if (ny < 0 || ny >= H) continue;
      const base = ny * W;
      let inRun = false;
      for (let x = lx; x <= rx; x++) {
        const q = base + x;
        const open = !wall[q] && !out[q];
        if (open && !inRun) { stack.push(q); inRun = true; }
        else if (!open) inRun = false;
      }
    }
  }
  return { mask: out, count, x0, y0, x1, y1 };
}

function expandBox(region, g) {
  return {
    x0: Math.max(0, region.x0 - g), y0: Math.max(0, region.y0 - g),
    x1: Math.min(SIZE - 1, region.x1 + g), y1: Math.min(SIZE - 1, region.y1 + g),
  };
}

// 方形膨脹（可分離：先水平、再垂直），可限制在 box 範圍內計算
function dilate(src, r, box = { x0: 0, y0: 0, x1: SIZE - 1, y1: SIZE - 1 }) {
  if (r <= 0) return src;
  const W = SIZE;
  const tmp = new Uint8Array(src.length);
  const out = new Uint8Array(src.length);
  const { x0, y0, x1, y1 } = box;
  const ys0 = Math.max(0, y0 - r), ys1 = Math.min(SIZE - 1, y1 + r);
  for (let y = ys0; y <= ys1; y++) {
    const row = y * W;
    // 滑動視窗計數
    let cnt = 0;
    for (let x = Math.max(0, x0 - r); x <= Math.min(SIZE - 1, x0 + r - 1); x++) cnt += src[row + x];
    for (let x = x0; x <= x1; x++) {
      const add = x + r, rem = x - r - 1;
      if (add < W) cnt += src[row + add];
      if (rem >= 0) cnt -= src[row + rem];
      if (cnt > 0) tmp[row + x] = 1;
    }
  }
  for (let x = x0; x <= x1; x++) {
    let cnt = 0;
    for (let y = Math.max(0, y0 - r); y <= Math.min(SIZE - 1, y0 + r - 1); y++) cnt += tmp[y * W + x];
    for (let y = y0; y <= y1; y++) {
      const add = y + r, rem = y - r - 1;
      if (add < SIZE) cnt += tmp[add * W + x];
      if (rem >= 0) cnt -= tmp[rem * W + x];
      if (cnt > 0) out[y * W + x] = 1;
    }
  }
  return out;
}

function crop(img, x, y, w, h) {
  const out = new ImageData(w, h);
  const src = img.data, dst = out.data;
  for (let yy = 0; yy < h; yy++) {
    const s = ((y + yy) * img.width + x) * 4;
    dst.set(src.subarray(s, s + w * 4), yy * w * 4);
  }
  return out;
}

function isBlank(img) {
  const d = img.data;
  for (let i = 3; i < d.length; i += 4) if (d[i]) return false;
  return true;
}

function entrySize(e) {
  if (e.type === 'group') return e.items.reduce((s, i) => s + entrySize(i), 0);
  if (e.type === 'pixels') return e.before.data.length * 2;
  return 16;
}
