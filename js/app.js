import { renderHome, resetHomeFilters } from './views/home.js';
import { renderWorks, cleanupWorks } from './views/works.js';
import { renderPaint } from './views/paint.js';
import { initMotionToggle, toast } from './ui.js';

const main = document.getElementById('main');
let current = null;      // 目前頁面回傳的 { guard, destroy }
let ignoreNext = false;
let renderToken = 0;

initMotionToggle(document.getElementById('motionToggle'));

function parse(hash) {
  const parts = hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent);
  if (parts[0] === 'paint' && parts[1]) return { page: 'paint', drawingId: parts[1] };
  if (parts[0] === 'work' && parts[1]) return { page: 'paint', workId: parts[1] };
  if (parts[0] === 'works') return { page: 'works' };
  return { page: 'home' };
}

async function route(e) {
  if (ignoreNext) { ignoreNext = false; return; }
  if (current?.guard && e) {
    const ok = await current.guard();
    if (!ok) {
      ignoreNext = true;
      location.hash = new URL(e.oldURL).hash || '#/';
      return;
    }
  }
  current?.destroy?.();
  current = null;
  cleanupWorks();

  const token = ++renderToken;
  const r = parse(location.hash);
  document.body.classList.toggle('is-painting', r.page === 'paint');
  document.querySelectorAll('[data-nav]').forEach(a => {
    if (a.dataset.nav === r.page) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  window.scrollTo(0, 0);
  main.innerHTML = '';
  try {
    let view = null;
    if (r.page === 'paint') view = await renderPaint(main, r);
    else if (r.page === 'works') await renderWorks(main);
    else await renderHome(main);
    if (token !== renderToken) { view?.destroy?.(); return; }
    current = view;
    document.title = r.page === 'paint' ? '塗色中｜彩色塗鴉樂園' : r.page === 'works' ? '我的作品｜彩色塗鴉樂園' : '彩色塗鴉樂園';
    if (e) main.focus({ preventScroll: true });
  } catch (err) {
    console.error(err);
    main.innerHTML = `<div class="page"><div class="empty"><p>哎呀，出了點問題：${err.message}</p><a class="btn btn-primary" href="#/">回到圖庫</a></div></div>`;
    if (location.protocol === 'file:') toast('請用本機伺服器開啟網站（見 README）', 5000);
  }
}

window.addEventListener('hashchange', route);

// 點左上角 logo：一律回到首頁預設畫面（清掉分類與搜尋）
document.querySelector('.brand').addEventListener('click', e => {
  resetHomeFilters();
  if (parse(location.hash).page === 'home') {
    // 已在首頁時網址不會變、不會觸發 hashchange，直接重繪
    e.preventDefault();
    if (location.hash !== '#/') history.replaceState(null, '', '#/');
    route();
  }
});
route();
