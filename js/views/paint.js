import { Painter, SIZE } from '../painter.js';
import { loadCatalog } from '../catalog.js';
import { getWork, putWork, newId, settings } from '../storage.js';
import { icon } from '../icons.js';
import { mascotSVG, escapeHTML, toast, ask, confirmDanger, celebrate, bubble, downloadBlob } from '../ui.js';

const PALETTE = [
  ['#ff4d4d', '紅色'], ['#ff9f1c', '橘色'], ['#ffd60a', '黃色'], ['#a3e635', '黃綠色'], ['#2ecc71', '綠色'], ['#14b8a6', '藍綠色'],
  ['#4cc9f0', '天空藍'], ['#3a86ff', '藍色'], ['#3f37c9', '深藍色'], ['#9b5de5', '紫色'], ['#f15bb5', '桃紅色'], ['#ffafcc', '粉紅色'],
  ['#8d5524', '咖啡色'], ['#f6c89f', '膚色'], ['#ffe5b4', '杏色'], ['#adb5bd', '灰色'], ['#222222', '黑色'], ['#ffffff', '白色'],
];
const MY_MAX = 6; // 「我的顏色」一排 6 格
const BACKGROUNDS = [
  ['#ffffff', '白色'], ['#fff6d6', '奶油黃'], ['#e0f4ff', '天空藍'], ['#ffe8f1', '粉紅'], ['#e3f8e8', '薄荷綠'],
];
const TOOLS = [
  { id: 'fill', label: '填色', icon: 'bucket', key: 'F', tip: '選個喜歡的顏色，點一下圖案裡的白色區域！' },
  { id: 'brush', label: '畫筆', icon: 'brush', key: 'B', tip: '按住拖曳，就能自由畫畫！' },
  { id: 'eraser', label: '橡皮擦', icon: 'eraser', key: 'E', tip: '擦掉畫錯的地方，黑色線條不會被擦掉喔！' },
  { id: 'hand', label: '移動', icon: 'hand', key: 'H', tip: '按住拖曳可以移動畫布，兩根手指可以放大縮小。' },
];
const CHEERS = ['好漂亮的顏色！', '哇，越來越繽紛了！', '你真是小畫家！', '這個配色好可愛！', '繼續加油，畫得真棒！'];

export async function renderPaint(main, { drawingId, workId }) {
  const cat = await loadCatalog();
  let work = null;
  let drawing;
  if (workId) {
    work = await getWork(workId);
    if (!work) { toast('找不到這張作品'); location.hash = '#/works'; return null; }
    drawing = cat.byId.get(work.drawingId) || { id: work.drawingId, name: work.name };
  } else {
    drawing = cat.byId.get(drawingId);
    if (!drawing) { toast('找不到這張圖'); location.hash = '#/'; return null; }
  }
  const name = work?.name || drawing.name;

  const st = {
    tool: 'fill',
    color: settings.get('color', PALETTE[2][0]),
    size: settings.get('size', 20),
    scale: 1, tx: 0, ty: 0, fit: 1,
    fills: 0,
  };

  main.innerHTML = `
  <div class="workspace">
    <div class="topbar" role="toolbar" aria-label="作品工具列">
      <button class="btn btn-small" id="backBtn" type="button">${icon('back')} 返回圖庫</button>
      <div class="topbar-group">
        <button class="btn btn-small" id="undoBtn" type="button" aria-keyshortcuts="Control+Z" disabled>${icon('undo')} 撤銷</button>
        <button class="btn btn-small" id="redoBtn" type="button" aria-keyshortcuts="Control+Y" disabled>${icon('redo')} 重做</button>
      </div>
      <div class="topbar-title" id="title">${escapeHTML(name)}</div>
      <div class="topbar-group">
        <button class="btn btn-small btn-danger" id="clearBtn" type="button">${icon('trash')} 清除</button>
        <button class="btn btn-small btn-pink" id="saveBtn" type="button" aria-keyshortcuts="Control+S">${icon('save')} 儲存</button>
        <button class="btn btn-small btn-green" id="downloadBtn" type="button">${icon('download')} 下載</button>
      </div>
    </div>

    <div class="stage" id="stage" data-tool="fill">
      <div class="tip-bubble">
        <div class="mascot">${mascotSVG()}</div>
        <div class="tip-text" id="tip" aria-live="polite"></div>
      </div>
      <div class="canvas-wrap" id="wrap" style="width:${SIZE}px;height:${SIZE}px;visibility:hidden">
        <canvas id="canvas" role="img" aria-label="${escapeHTML(name)}的塗色畫布"></canvas>
      </div>
      <div class="brush-cursor" id="cursor"></div>
      <div class="zoom-controls" role="group" aria-label="縮放">
        <button class="btn" id="zoomIn" type="button" aria-label="放大" title="放大 (+)">${icon('zoomIn')}</button>
        <div class="zoom-level" id="zoomLevel" aria-live="polite">100%</div>
        <button class="btn" id="zoomOut" type="button" aria-label="縮小" title="縮小 (-)">${icon('zoomOut')}</button>
        <button class="btn" id="zoomFit" type="button" aria-label="符合畫面" title="符合畫面 (0)">${icon('fit')}</button>
      </div>
      <div class="loading" id="loading">彩彩熊正在準備畫紙…</div>
    </div>

    <aside class="side" aria-label="塗色工具">
      <section class="panel" aria-labelledby="toolTitle">
        <h2 id="toolTitle">${icon('palette')} 工具</h2>
        <div class="tools" role="group" aria-label="選擇工具">
          ${TOOLS.map(t => `<button class="tool-btn" type="button" data-tool="${t.id}" aria-pressed="${t.id === st.tool}" aria-keyshortcuts="${t.key}" title="${t.label} (${t.key})">${icon(t.icon)}${t.label}</button>`).join('')}
        </div>
      </section>

      <section class="panel" aria-labelledby="colorTitle" id="colorPanel">
        <h2 id="colorTitle">🖍️ 顏色</h2>
        <div class="current-color">
          <span class="current-swatch" id="curSwatch"></span>
          <span class="current-color-text">目前顏色<strong id="curName"></strong></span>
        </div>
        <div class="swatches" role="group" aria-label="常用色票">
          ${PALETTE.map(([hex, n]) => `<button class="swatch" type="button" data-color="${hex}" style="background:${hex}" aria-label="${n}" title="${n}"></button>`).join('')}
        </div>
        <label class="custom-color">
          <input type="color" id="customColor" value="${st.color}">
          <span>自己調顏色</span>
        </label>
        <div class="my-colors">
          <div class="my-colors-head">
            <span class="my-colors-title">⭐ 我的顏色</span>
            <button class="btn btn-small btn-pink" id="saveColorBtn" type="button" title="把目前的顏色存到「我的顏色」">${icon('save')} 存起來</button>
          </div>
          <div class="my-swatches" id="mySwatches" role="group" aria-label="我的顏色（最多 ${MY_MAX} 個）"></div>
        </div>
      </section>

      <section class="panel" aria-labelledby="sizeTitle" id="sizePanel">
        <h2 id="sizeTitle">✏️ 畫筆粗細</h2>
        <div class="size-row">
          <input type="range" id="sizeRange" min="4" max="80" step="1" value="${st.size}" aria-label="畫筆粗細">
          <div class="size-preview" aria-hidden="true"><span id="sizeDot"></span></div>
        </div>
        <div class="size-presets">
          <button class="btn btn-small" type="button" data-size="8">細</button>
          <button class="btn btn-small" type="button" data-size="20">中</button>
          <button class="btn btn-small" type="button" data-size="44">粗</button>
        </div>
      </section>

      <section class="panel" aria-labelledby="bgTitle">
        <h2 id="bgTitle">🌤️ 背景色</h2>
        <div class="bg-swatches" role="group" aria-label="背景色">
          ${BACKGROUNDS.map(([hex, n]) => `<button class="swatch" type="button" data-bg="${hex}" style="background:${hex}" aria-label="背景：${n}" title="${n}"></button>`).join('')}
          <label class="swatch" style="background:conic-gradient(#ff4d4d,#ffd60a,#2ecc71,#4cc9f0,#9b5de5,#ff4d4d);cursor:pointer;display:block" title="自己選背景色">
            <span class="visually-hidden">自己選背景色</span>
            <input type="color" id="customBg" value="#ffffff" style="opacity:0;width:100%;height:100%;cursor:pointer">
          </label>
        </div>
      </section>

      <section class="panel side-actions">
        <button class="btn btn-blue" id="resetBtn" type="button">${icon('reset')} 復原到原始線稿</button>
      </section>

      <section class="panel" aria-labelledby="helpTitle">
        <h2 id="helpTitle">💡 小提示</h2>
        <ul class="help-list">
          <li>🪣 填色會自動停在黑色線條裡，不會塗出去。</li>
          <li>🤏 兩根手指可以放大縮小、移動畫布。</li>
          <li>↩️ 畫錯了？按「撤銷」就能回到上一步。</li>
          <li>⌨️ 快捷鍵：<kbd>F</kbd>填色 <kbd>B</kbd>畫筆 <kbd>E</kbd>橡皮擦 <kbd>H</kbd>移動 <kbd>Ctrl</kbd>+<kbd>Z</kbd>撤銷 <kbd>+</kbd><kbd>-</kbd>縮放</li>
        </ul>
      </section>
    </aside>
  </div>`;

  const $ = s => main.querySelector(s);
  const stage = $('#stage'), wrap = $('#wrap'), canvas = $('#canvas'), cursor = $('#cursor');
  const painter = new Painter(canvas);

  // ---------- 載入線稿與作品 ----------
  let lineArtBlob = work?.lineArt || null;
  try {
    if (!lineArtBlob) {
      const res = await fetch(drawing.lineArt);
      if (!res.ok) throw new Error('線稿載入失敗');
      lineArtBlob = await res.blob();
    }
    const url = URL.createObjectURL(lineArtBlob);
    try { await painter.loadLineArt(url); } finally { URL.revokeObjectURL(url); }
    if (work) {
      await painter.loadColorLayer(work.colorLayer);
      painter.background = work.background || '#ffffff';
      painter.render();
    }
  } catch (e) {
    $('#loading').textContent = '哎呀，畫紙載入失敗了：' + e.message;
    return null;
  }
  $('#loading').remove();

  // ---------- 狀態更新 ----------
  const tipEl = $('#tip');
  const setTip = (text) => {
    tipEl.textContent = text;
    tipEl.classList.remove('bounce'); void tipEl.offsetWidth; tipEl.classList.add('bounce');
  };
  const refreshButtons = () => {
    $('#undoBtn').disabled = !painter.canUndo;
    $('#redoBtn').disabled = !painter.canRedo;
    $('#title').innerHTML = escapeHTML(name) + (painter.dirty ? '<span class="unsaved-dot" title="尚未儲存"></span><span class="visually-hidden">（尚未儲存）</span>' : '');
  };
  painter.onChange = refreshButtons;

  const setTool = (id) => {
    st.tool = id;
    stage.dataset.tool = id;
    main.querySelectorAll('.tool-btn').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.tool === id)));
    $('#sizePanel').style.display = (id === 'brush' || id === 'eraser') ? '' : 'none';
    setTip(TOOLS.find(t => t.id === id).tip);
    updateCursor();
  };
  const setColor = (hex, announce = true) => {
    st.color = hex.toLowerCase();
    settings.set('color', st.color);
    $('#curSwatch').style.background = st.color;
    const known = PALETTE.find(p => p[0] === st.color);
    $('#curName').textContent = known ? known[1] : '我的顏色';
    $('#customColor').value = st.color.length === 7 ? st.color : '#000000';
    main.querySelectorAll('.swatch[data-color]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.color === st.color)));
    if (st.tool === 'eraser' || st.tool === 'hand') setTool(st.tool === 'eraser' ? 'brush' : 'fill');
    if (announce) setTip(`選好${known ? known[1] : '新顏色'}了！${st.tool === 'fill' ? '點一下想塗的地方吧！' : '開始畫吧！'}`);
  };
  // ---------- 我的顏色（自己調的顏色，存在 localStorage） ----------
  const isHex = v => typeof v === 'string' && /^#[0-9a-f]{6}$/.test(v);
  let myColors = settings.get('myColors', []);
  myColors = Array.isArray(myColors) ? myColors.filter(isHex).slice(0, MY_MAX) : [];
  const renderMyColors = () => {
    $('#mySwatches').innerHTML = Array.from({ length: MY_MAX }, (_, i) => {
      const hex = myColors[i];
      return hex
        ? `<button class="swatch" type="button" data-color="${hex}" style="background:${hex}" aria-label="我的顏色 ${i + 1}" title="我的顏色 ${i + 1}" aria-pressed="${hex === st.color}"></button>`
        : `<button class="swatch swatch-empty" type="button" data-empty aria-label="空格：把目前顏色存到這裡" title="把目前顏色存到這裡">+</button>`;
    }).join('');
  };
  const saveMyColor = () => {
    const hex = st.color;
    if (!isHex(hex)) return;
    if (myColors.includes(hex)) { toast('這個顏色已經存過了喔'); return; }
    // 新顏色放最前面，滿 6 個時擠掉最舊的
    myColors = [hex, ...myColors].slice(0, MY_MAX);
    settings.set('myColors', myColors);
    renderMyColors();
    setTip('顏色存起來了！下次也可以用喔！');
  };

  const setSize = (v) => {
    st.size = Math.max(4, Math.min(80, Number(v)));
    settings.set('size', st.size);
    $('#sizeRange').value = st.size;
    const dot = $('#sizeDot');
    const px = Math.max(4, Math.min(60, st.size * 0.7));
    dot.style.width = dot.style.height = px + 'px';
    updateCursor();
  };
  const syncBg = () => {
    main.querySelectorAll('.swatch[data-bg]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.bg === painter.background)));
  };

  // ---------- 視圖（縮放、平移） ----------
  const applyView = () => {
    wrap.style.transform = `translate(${st.tx}px, ${st.ty}px) scale(${st.scale})`;
    wrap.style.visibility = 'visible';
    $('#zoomLevel').textContent = Math.round((st.scale / st.fit) * 100) + '%';
    updateCursor();
  };
  const computeFit = () => {
    const r = stage.getBoundingClientRect();
    const pad = r.width < 600 ? 10 : 24;
    const top = 58; // 留位置給上方的提示泡泡
    const fit = Math.max(0.05, Math.min((r.width - pad * 2) / SIZE, (r.height - top - pad) / SIZE));
    return { r, fit, top, pad };
  };
  const fitView = () => {
    const { r, fit, top, pad } = computeFit();
    st.fit = st.scale = fit;
    st.tx = (r.width - SIZE * fit) / 2;
    st.ty = top + (r.height - top - pad - SIZE * fit) / 2;
    applyView();
  };
  const clampPan = () => {
    const r = stage.getBoundingClientRect();
    const w = SIZE * st.scale, keep = 80;
    st.tx = Math.min(r.width - keep, Math.max(keep - w, st.tx));
    st.ty = Math.min(r.height - keep, Math.max(keep - w, st.ty));
  };
  const zoomAt = (sx, sy, newScale) => {
    newScale = Math.max(st.fit * 0.6, Math.min(st.fit * 6, newScale));
    const cx = (sx - st.tx) / st.scale, cy = (sy - st.ty) / st.scale;
    st.scale = newScale;
    st.tx = sx - cx * newScale;
    st.ty = sy - cy * newScale;
    clampPan();
    applyView();
  };
  const zoomCenter = (factor) => {
    const r = stage.getBoundingClientRect();
    zoomAt(r.width / 2, r.height / 2, st.scale * factor);
  };
  const ro = new ResizeObserver(() => {
    const prevFit = st.fit, prevScale = st.scale;
    const { r, fit } = computeFit();
    if (!prevFit || Math.abs(prevScale - prevFit) < 1e-6) { fitView(); return; }
    // 保留目前縮放倍率與畫面中心
    const cx = (r.width / 2 - st.tx) / st.scale;
    const cy = (r.height / 2 - st.ty) / st.scale;
    st.fit = fit;
    st.scale = fit * (prevScale / prevFit);
    st.tx = r.width / 2 - cx * st.scale;
    st.ty = r.height / 2 - cy * st.scale;
    clampPan();
    applyView();
  });
  ro.observe(stage);

  // ---------- 指標事件（滑鼠、手指、觸控筆） ----------
  const toCanvas = (e) => {
    const r = canvas.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * SIZE, ((e.clientY - r.top) / r.height) * SIZE];
  };
  const stagePoint = (e) => {
    const r = stage.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };
  const pointers = new Map();
  let mode = null;           // 'stroke' | 'pan' | 'pinch' | 'fill'
  let start = null;
  let spaceDown = false;

  function updateCursor(e) {
    if (!(st.tool === 'brush' || st.tool === 'eraser')) { cursor.style.display = 'none'; return; }
    const d = st.size * st.scale;
    cursor.style.width = cursor.style.height = d + 'px';
    if (e) {
      const [x, y] = stagePoint(e);
      cursor.style.left = x + 'px';
      cursor.style.top = y + 'px';
      cursor.style.display = e.pointerType === 'mouse' ? 'block' : 'none';
    }
  }

  stage.addEventListener('pointerdown', e => {
    if (e.target.closest('.zoom-controls')) return;
    if (e.button !== undefined && e.button > 1) return;
    stage.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, stagePoint(e));
    if (pointers.size === 2) {
      // 第二根手指：改成兩指縮放
      if (mode === 'stroke') painter.cancelStroke();
      const [a, b] = [...pointers.values()];
      start = { dist: Math.hypot(a[0] - b[0], a[1] - b[1]), mid: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], scale: st.scale, tx: st.tx, ty: st.ty };
      mode = 'pinch';
      return;
    }
    if (pointers.size > 2) return;
    const [sx, sy] = stagePoint(e);
    if (st.tool === 'hand' || e.button === 1 || spaceDown) {
      mode = 'pan';
      start = { x: sx, y: sy, tx: st.tx, ty: st.ty };
      stage.classList.add('is-panning');
    } else if (st.tool === 'brush' || st.tool === 'eraser') {
      mode = 'stroke';
      const [x, y] = toCanvas(e);
      painter.beginStroke(x, y, { color: st.color, size: st.size, erase: st.tool === 'eraser' });
    } else {
      mode = 'fill';
      start = { x: sx, y: sy, e: { clientX: e.clientX, clientY: e.clientY } };
    }
  });

  stage.addEventListener('pointermove', e => {
    updateCursor(e);
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, stagePoint(e));
    if (mode === 'pinch' && pointers.size >= 2) {
      const [a, b] = [...pointers.values()];
      const dist = Math.hypot(a[0] - b[0], a[1] - b[1]);
      const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      const newScale = Math.max(st.fit * 0.6, Math.min(st.fit * 6, start.scale * (dist / (start.dist || 1))));
      const cx = (start.mid[0] - start.tx) / start.scale, cy = (start.mid[1] - start.ty) / start.scale;
      st.scale = newScale;
      st.tx = mid[0] - cx * newScale;
      st.ty = mid[1] - cy * newScale;
      clampPan();
      applyView();
    } else if (mode === 'pan') {
      const [sx, sy] = stagePoint(e);
      st.tx = start.tx + (sx - start.x);
      st.ty = start.ty + (sy - start.y);
      clampPan();
      applyView();
    } else if (mode === 'stroke') {
      const events = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
      for (const ev of (events.length ? events : [e])) {
        const [x, y] = toCanvas(ev);
        painter.moveStroke(x, y);
      }
    } else if (mode === 'fill') {
      const [sx, sy] = stagePoint(e);
      // 單指拖曳超過一段距離就當作移動畫布
      if (Math.hypot(sx - start.x, sy - start.y) > 12) {
        mode = 'pan';
        start = { x: sx, y: sy, tx: st.tx, ty: st.ty };
        stage.classList.add('is-panning');
      }
    }
  });

  const endPointer = e => {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    if (mode === 'stroke') {
      painter.endStroke();
      mode = null;
    } else if (mode === 'fill' && e.type === 'pointerup') {
      doFill(start.e);
      mode = null;
    } else if (mode === 'pinch') {
      if (pointers.size === 0) mode = null;
    } else if (pointers.size === 0) {
      mode = null;
    }
    if (pointers.size === 0) stage.classList.remove('is-panning');
  };
  stage.addEventListener('pointerup', endPointer);
  stage.addEventListener('pointercancel', endPointer);
  stage.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') cursor.style.display = 'none'; });

  stage.addEventListener('wheel', e => {
    e.preventDefault();
    const [sx, sy] = stagePoint(e);
    if (e.ctrlKey || e.metaKey) {
      zoomAt(sx, sy, st.scale * Math.exp(-e.deltaY * 0.01));
    } else {
      st.tx -= e.deltaX;
      st.ty -= e.deltaY;
      clampPan();
      applyView();
    }
  }, { passive: false });

  function doFill(pt) {
    const [x, y] = toCanvas(pt);
    if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return;
    const result = painter.fill(x, y, st.color);
    if (result === 'line') {
      setTip('點在黑色線條上了，往白色區域裡面點點看！');
    } else if (result === 'ok') {
      bubble(pt.clientX, pt.clientY, st.color);
      st.fills++;
      if (st.fills % 6 === 0) setTip(CHEERS[(st.fills / 6) % CHEERS.length | 0]);
    }
  }

  // ---------- 側邊工具 ----------
  main.querySelector('.tools').addEventListener('click', e => {
    const b = e.target.closest('.tool-btn');
    if (b) setTool(b.dataset.tool);
  });
  main.querySelector('.swatches').addEventListener('click', e => {
    const b = e.target.closest('.swatch');
    if (b) setColor(b.dataset.color);
  });
  $('#mySwatches').addEventListener('click', e => {
    const b = e.target.closest('.swatch');
    if (!b) return;
    if (b.hasAttribute('data-empty')) saveMyColor();
    else setColor(b.dataset.color);
  });
  $('#saveColorBtn').addEventListener('click', saveMyColor);
  $('#customColor').addEventListener('input', e => setColor(e.target.value, false));
  $('#customColor').addEventListener('change', e => setColor(e.target.value));
  $('#sizeRange').addEventListener('input', e => setSize(e.target.value));
  main.querySelector('.size-presets').addEventListener('click', e => {
    const b = e.target.closest('[data-size]');
    if (b) setSize(b.dataset.size);
  });
  main.querySelector('.bg-swatches').addEventListener('click', e => {
    const b = e.target.closest('.swatch[data-bg]');
    if (!b) return;
    painter.setBackground(b.dataset.bg);
    syncBg();
    setTip('背景換好了！');
  });
  $('#customBg').addEventListener('change', e => { painter.setBackground(e.target.value); syncBg(); setTip('背景換好了！'); });

  $('#zoomIn').addEventListener('click', () => zoomCenter(1.3));
  $('#zoomOut').addEventListener('click', () => zoomCenter(1 / 1.3));
  $('#zoomFit').addEventListener('click', fitView);

  // ---------- 上方工具列 ----------
  const undo = () => { if (painter.undo()) { syncBg(); setTip('回到上一步了！'); } };
  const redo = () => { if (painter.redo()) { syncBg(); setTip('又做回來了！'); } };
  $('#undoBtn').addEventListener('click', undo);
  $('#redoBtn').addEventListener('click', redo);

  $('#clearBtn').addEventListener('click', async () => {
    const ok = await confirmDanger('要清除所有顏色嗎？', '黑色線稿會留下來。清除後還可以按「撤銷」救回來喔。', '清除顏色');
    if (!ok) return;
    if (painter.clearColors()) { toast('顏色清除了，重新開始吧！'); setTip('白白的畫紙，再畫一次吧！'); }
    else toast('畫紙已經是乾淨的囉');
  });
  $('#resetBtn').addEventListener('click', async () => {
    const ok = await confirmDanger('要復原到原始線稿嗎？', '所有顏色、畫筆和背景色都會回到一開始的樣子。', '復原線稿');
    if (!ok) return;
    painter.clearColors({ resetBackground: true });
    syncBg();
    fitView();
    toast('已經復原成原始線稿');
  });

  let saving = false;
  const save = async (leaving = false) => {
    if (saving) return false;
    saving = true;
    $('#saveBtn').disabled = true;
    try {
      const now = Date.now();
      const record = {
        id: work?.id || newId(),
        drawingId: drawing.id,
        name,
        lineArt: lineArtBlob,
        colorLayer: await painter.colorLayerBlob(),
        background: painter.background,
        thumbnail: await painter.thumbnailBlob(),
        createdAt: work?.createdAt || now,
        updatedAt: now,
      };
      await putWork(record);
      work = record;
      painter.dirty = false;
      refreshButtons();
      // 離開時網址已經是下一頁，不要改掉它
      if (!leaving) history.replaceState(null, '', '#/work/' + encodeURIComponent(record.id));
      if (!leaving) {
        const r = $('#saveBtn').getBoundingClientRect();
        celebrate(r.left + r.width / 2, r.bottom + 10);
        toast('儲存好了！可以在「我的作品」找到它 ⭐');
        setTip('完成了，畫得真棒！');
      }
      return true;
    } catch (e) {
      toast('儲存失敗：' + e.message);
      return false;
    } finally {
      saving = false;
      $('#saveBtn').disabled = false;
    }
  };
  $('#saveBtn').addEventListener('click', () => save());

  $('#downloadBtn').addEventListener('click', async () => {
    const btn = $('#downloadBtn');
    btn.disabled = true;
    try {
      const blob = await painter.pngBlob();
      downloadBlob(blob, `${name}-塗色作品.png`);
      const r = btn.getBoundingClientRect();
      celebrate(r.left + r.width / 2, r.bottom + 10);
      toast('下載完成！畫得真棒！');
    } catch (e) {
      toast('下載失敗：' + e.message);
    } finally { btn.disabled = false; }
  });

  $('#backBtn').addEventListener('click', () => { location.hash = '#/'; });

  // ---------- 鍵盤 ----------
  const onKey = e => {
    const tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || document.querySelector('dialog[open]')) return;
    const mod = e.ctrlKey || e.metaKey;
    const k = e.key.toLowerCase();
    if (mod && k === 'z' && !e.shiftKey) { e.preventDefault(); undo(); return; }
    if (mod && (k === 'y' || (k === 'z' && e.shiftKey))) { e.preventDefault(); redo(); return; }
    if (mod && k === 's') { e.preventDefault(); save(); return; }
    if (mod || e.altKey) return;
    if (k === ' ' && tag !== 'button') { spaceDown = true; e.preventDefault(); return; }
    const t = TOOLS.find(t => t.key.toLowerCase() === k);
    if (t) { setTool(t.id); return; }
    if (k === '+' || k === '=') zoomCenter(1.3);
    else if (k === '-' || k === '_') zoomCenter(1 / 1.3);
    else if (k === '0') fitView();
  };
  const onKeyUp = e => { if (e.key === ' ') spaceDown = false; };
  const onBeforeUnload = e => { if (painter.dirty) { e.preventDefault(); e.returnValue = ''; } };
  window.addEventListener('keydown', onKey);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('beforeunload', onBeforeUnload);

  // ---------- 初始化 ----------
  setTool('fill');
  renderMyColors();
  setColor(st.color, false);
  setSize(st.size);
  syncBg();
  fitView();
  refreshButtons();
  setTip(work ? '歡迎回來！繼續把它畫完吧！' : '選個喜歡的顏色吧！然後點一下圖案裡的白色區域。');

  return {
    // 離開前若有未儲存的變更，先詢問
    async guard() {
      if (!painter.dirty) return true;
      const v = await ask({
        title: '要先儲存作品嗎？',
        text: '還有沒儲存的顏色喔，離開前要不要先存起來？',
        buttons: [
          { label: '儲存後離開', value: 'save', className: 'btn-primary' },
          { label: '不儲存', value: 'discard', className: 'btn-danger' },
          { label: '繼續畫', value: 'cancel', className: 'btn-blue' },
        ],
      });
      if (v === 'save') {
        const ok = await save(true);
        if (ok) toast('作品已儲存 ⭐');
        return ok;
      }
      return v === 'discard';
    },
    destroy() {
      ro.disconnect();
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('beforeunload', onBeforeUnload);
    },
  };
}
