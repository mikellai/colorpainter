import { listWorks, deleteWork } from '../storage.js';
import { icon } from '../icons.js';
import { mascotSVG, escapeHTML, toast, confirmDanger, downloadBlob, celebrate } from '../ui.js';
import { Painter } from '../painter.js';

const urls = [];

export function cleanupWorks() {
  while (urls.length) URL.revokeObjectURL(urls.pop());
}

export async function renderWorks(main) {
  cleanupWorks();
  let works = [];
  let error = '';
  try { works = await listWorks(); } catch (e) { error = e.message; }

  main.innerHTML = `
  <div class="page">
    <div class="page-title"><span style="font-size:36px" aria-hidden="true">⭐</span><h1>我的作品</h1></div>
    <p class="page-desc">作品存在這台裝置的瀏覽器裡，不用註冊帳號。換裝置或清除瀏覽器資料時作品會不見喔，記得先下載！</p>
    <div id="worksBody"></div>
  </div>`;
  const body = main.querySelector('#worksBody');

  if (error) {
    body.innerHTML = `<div class="empty"><div class="mascot">${mascotSVG('wow')}</div><p>這個瀏覽器沒辦法儲存作品（${escapeHTML(error)}）</p></div>`;
    return;
  }
  if (!works.length) {
    body.innerHTML = `<div class="empty">
      <div class="mascot">${mascotSVG()}</div>
      <p>還沒有作品喔！去圖庫挑一張圖開始畫吧！</p>
      <a class="btn btn-primary" href="#/">${icon('palette')} 去圖庫挑一張</a>
    </div>`;
    return;
  }

  const fmt = new Intl.DateTimeFormat('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  body.innerHTML = `<div class="grid works-grid">${works.map(w => {
    const url = URL.createObjectURL(w.thumbnail);
    urls.push(url);
    return `<article class="card work-card" data-id="${escapeHTML(w.id)}">
      <a class="card-thumb" href="#/work/${encodeURIComponent(w.id)}" aria-label="繼續畫：${escapeHTML(w.name)}"><img src="${url}" alt="${escapeHTML(w.name)}的作品縮圖"></a>
      <div class="card-body">
        <div class="card-title">${escapeHTML(w.name)}</div>
        <div class="work-date">最後修改：${fmt.format(new Date(w.updatedAt))}</div>
        <div class="work-actions">
          <a class="btn btn-small btn-primary btn-continue" href="#/work/${encodeURIComponent(w.id)}">${icon('edit')} 繼續畫</a>
          <button class="btn btn-small btn-green" type="button" data-act="download" aria-label="下載 ${escapeHTML(w.name)}">${icon('download')} 下載</button>
          <button class="btn btn-small btn-danger" type="button" data-act="delete" aria-label="刪除 ${escapeHTML(w.name)}">${icon('trash')} 刪除</button>
        </div>
      </div>
    </article>`;
  }).join('')}</div>`;

  body.addEventListener('click', async e => {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    const card = btn.closest('.work-card');
    const work = works.find(w => w.id === card.dataset.id);
    if (!work) return;
    if (btn.dataset.act === 'delete') {
      const ok = await confirmDanger('要刪除這張作品嗎？', `「${work.name}」刪除後就找不回來了喔。`, '確定刪除');
      if (!ok) return;
      await deleteWork(work.id);
      toast('作品已刪除');
      renderWorks(main);
    } else if (btn.dataset.act === 'download') {
      btn.disabled = true;
      try {
        const blob = await renderWorkPNG(work);
        downloadBlob(blob, `${work.name}-塗色作品.png`);
        const r = btn.getBoundingClientRect();
        celebrate(r.left + r.width / 2, r.top, 18);
        toast('下載完成！畫得真棒！');
      } catch (err) {
        toast('下載失敗：' + err.message);
      } finally { btn.disabled = false; }
    }
  });
}

async function renderWorkPNG(work) {
  const p = new Painter(document.createElement('canvas'));
  const url = URL.createObjectURL(work.lineArt);
  try { await p.loadLineArt(url); } finally { URL.revokeObjectURL(url); }
  await p.loadColorLayer(work.colorLayer);
  p.background = work.background;
  return p.pngBlob();
}
