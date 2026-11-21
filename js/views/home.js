import { loadCatalog, searchDrawings, DIFFICULTY } from '../catalog.js';
import { icon } from '../icons.js';
import { mascotSVG, escapeHTML, motionEnabled } from '../ui.js';

const state = { q: '', category: 'all', featuredId: null };

export function drawingCard(d) {
  const lv = DIFFICULTY[d.difficulty] || DIFFICULTY.easy;
  return `<a class="card" href="#/paint/${encodeURIComponent(d.id)}" aria-label="${escapeHTML(d.name)}，${escapeHTML(d.categoryInfo.name)}，難度${lv.label}，點一下開始塗色">
    <div class="card-thumb"><img src="${escapeHTML(d.thumbnail)}" alt="" loading="lazy" width="200" height="200"></div>
    <div class="card-body">
      <div class="card-title">${escapeHTML(d.name)}</div>
      <div class="card-meta">
        <span class="tag tag-${escapeHTML(d.category)}"><span aria-hidden="true">${d.categoryInfo.emoji}</span>${escapeHTML(d.categoryInfo.name)}</span>
        <span class="level"><span class="stars" aria-hidden="true">${'★'.repeat(lv.stars)}${'☆'.repeat(3 - lv.stars)}</span> ${lv.label}</span>
      </div>
    </div>
  </a>`;
}

function rainbow(text) {
  return `<span class="rainbow-text">${[...text].map(c => `<span>${c}</span>`).join('')}</span>`;
}

export async function renderHome(main) {
  const cat = await loadCatalog();
  if (!state.featuredId || !cat.byId.has(state.featuredId)) state.featuredId = pick(cat.drawings).id;

  main.innerHTML = `
  <div class="page">
    <section class="hero" aria-labelledby="heroTitle">
      <div>
        <div class="hero-guide">
          <div class="mascot">${mascotSVG()}</div>
          <div class="speech">
            <h1 id="heroTitle">${rainbow('一起來塗鴉吧！')}</h1>
            <p class="hero-sub">嗨！我是彩彩熊。選一張喜歡的圖，開始上色吧！</p>
          </div>
        </div>
        <form class="search-row" role="search" id="searchForm">
          <label class="search-box">
            ${icon('search')}
            <span class="visually-hidden">搜尋圖案</span>
            <input id="searchInput" type="search" placeholder="想畫什麼？例如：獅子、城堡" value="${escapeHTML(state.q)}" autocomplete="off" enterkeyhint="search">
          </label>
        </form>
      </div>
      <div class="featured" aria-live="polite">
        <div class="featured-label">今天畫這張好嗎？</div>
        <div class="featured-img" id="featuredImg"></div>
        <div class="featured-name" id="featuredName"></div>
        <div class="featured-actions">
          <a class="btn btn-primary" id="featuredStart" href="#">${icon('play')} 開始塗色</a>
          <button class="btn btn-blue" id="featuredShuffle" type="button">${icon('shuffle')} 換一張圖</button>
        </div>
      </div>
    </section>

    <div class="chips" role="group" aria-label="圖案分類">
      <button class="chip" type="button" data-cat="all" aria-pressed="${state.category === 'all'}"><span class="chip-emoji" aria-hidden="true">🌈</span>全部</button>
      ${cat.categories.map(c => `<button class="chip" type="button" data-cat="${c.id}" aria-pressed="${state.category === c.id}"><span class="chip-emoji" aria-hidden="true">${c.emoji}</span>${escapeHTML(c.name)}</button>`).join('')}
    </div>

    <div id="results"></div>
  </div>`;

  const results = main.querySelector('#results');
  const renderResults = () => {
    const filtering = state.q.trim() || state.category !== 'all';
    if (filtering) {
      const list = searchDrawings(cat.drawings, state);
      const catName = state.category === 'all' ? '' : cat.categories.find(c => c.id === state.category)?.name;
      const title = state.q.trim() ? `「${escapeHTML(state.q.trim())}」的搜尋結果` : `${escapeHTML(catName)}`;
      results.innerHTML = list.length ? `
        <section class="section" aria-labelledby="resTitle">
          <div class="section-head"><span class="badge-emoji" aria-hidden="true">🔍</span><h2 id="resTitle">${title}</h2>
            <span class="result-count">找到 ${list.length} 張圖</span></div>
          <div class="grid">${list.map(drawingCard).join('')}</div>
        </section>` : `
        <div class="empty">
          <div class="mascot">${mascotSVG('wow')}</div>
          <p>找不到耶，換個字試試看！</p>
          <button class="btn btn-primary" type="button" id="clearFilter">看全部圖案</button>
        </div>`;
      results.querySelector('#clearFilter')?.addEventListener('click', () => {
        state.q = ''; state.category = 'all';
        main.querySelector('#searchInput').value = '';
        syncChips(); renderResults();
      });
      return;
    }
    const popular = cat.drawings.filter(d => d.popular);
    const latest = [...cat.drawings].sort((a, b) => (b.addedAt || '').localeCompare(a.addedAt || '')).slice(0, 4);
    results.innerHTML = `
      <section class="section" aria-labelledby="popTitle">
        <div class="section-head"><span class="badge-emoji" aria-hidden="true">🔥</span><h2 id="popTitle">熱門圖案</h2></div>
        <div class="grid">${popular.map(drawingCard).join('')}</div>
      </section>
      <section class="section" aria-labelledby="newTitle">
        <div class="section-head"><span class="badge-emoji" aria-hidden="true">🆕</span><h2 id="newTitle">最新圖案</h2></div>
        <div class="grid">${latest.map(drawingCard).join('')}</div>
      </section>
      <section class="section" aria-labelledby="allTitle">
        <div class="section-head"><span class="badge-emoji" aria-hidden="true">📚</span><h2 id="allTitle">全部圖案</h2>
          <span class="result-count">共 ${cat.drawings.length} 張</span></div>
        <div class="grid">${cat.drawings.map(drawingCard).join('')}</div>
      </section>`;
  };

  const syncChips = () => main.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-pressed', String(c.dataset.cat === state.category)));

  main.querySelector('.chips').addEventListener('click', e => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    state.category = chip.dataset.cat;
    syncChips();
    renderResults();
  });

  const input = main.querySelector('#searchInput');
  input.addEventListener('input', () => { state.q = input.value; renderResults(); });
  main.querySelector('#searchForm').addEventListener('submit', e => {
    e.preventDefault();
    input.blur();
    results.scrollIntoView({ behavior: motionEnabled() ? 'smooth' : 'auto', block: 'start' });
  });

  const renderFeatured = (animate) => {
    const d = cat.byId.get(state.featuredId);
    const img = main.querySelector('#featuredImg');
    img.innerHTML = `<img src="${escapeHTML(d.thumbnail)}" alt="${escapeHTML(d.name)}的線稿">`;
    main.querySelector('#featuredName').textContent = d.name;
    main.querySelector('#featuredStart').href = `#/paint/${encodeURIComponent(d.id)}`;
    main.querySelector('#featuredStart').setAttribute('aria-label', `開始塗色：${d.name}`);
    if (animate) { img.classList.remove('pop'); void img.offsetWidth; img.classList.add('pop'); }
  };
  main.querySelector('#featuredShuffle').addEventListener('click', () => {
    state.featuredId = pick(cat.drawings.filter(d => d.id !== state.featuredId)).id;
    renderFeatured(true);
  });

  renderFeatured(false);
  renderResults();
}

function pick(list) { return list[Math.floor(Math.random() * list.length)]; }
