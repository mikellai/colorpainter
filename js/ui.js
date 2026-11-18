import { settings } from './storage.js';

// ===== 引導角色：彩彩熊 =====
export function mascotSVG(mood = 'happy') {
  const mouth = mood === 'wow'
    ? '<ellipse cx="60" cy="80" rx="7" ry="8" fill="#3a2e5c"/>'
    : '<path d="M52 77 Q60 86 68 77" fill="none" stroke="#3a2e5c" stroke-width="3.5" stroke-linecap="round"/>';
  return `<svg viewBox="0 0 120 130" role="img" aria-label="彩彩熊">
    <ellipse cx="60" cy="122" rx="34" ry="6" fill="rgba(58,46,92,.12)"/>
    <ellipse cx="60" cy="104" rx="30" ry="22" fill="#b07a52"/>
    <ellipse cx="60" cy="108" rx="17" ry="13" fill="#f3d9b8"/>
    <circle cx="24" cy="30" r="15" fill="#8a5a3c"/><circle cx="24" cy="30" r="8" fill="#f3b8a0"/>
    <circle cx="96" cy="30" r="15" fill="#8a5a3c"/><circle cx="96" cy="30" r="8" fill="#f3b8a0"/>
    <circle cx="60" cy="58" r="40" fill="#b07a52"/>
    <ellipse cx="60" cy="74" rx="19" ry="14" fill="#f3d9b8"/>
    <circle cx="45" cy="52" r="5.5" fill="#3a2e5c"/><circle cx="43.5" cy="50.5" r="1.8" fill="#fff"/>
    <circle cx="75" cy="52" r="5.5" fill="#3a2e5c"/><circle cx="73.5" cy="50.5" r="1.8" fill="#fff"/>
    <ellipse cx="60" cy="68" rx="6" ry="4.5" fill="#3a2e5c"/>
    ${mouth}
    <circle cx="32" cy="70" r="6" fill="#ff9ec7" opacity=".7"/><circle cx="88" cy="70" r="6" fill="#ff9ec7" opacity=".7"/>
    <path d="M30 22 C40 6 80 6 90 22 C80 16 40 16 30 22 Z" fill="#ff9a76"/>
    <circle cx="60" cy="9" r="5" fill="#ffd65c"/>
    <g transform="translate(92 92) rotate(30)"><rect x="-4" y="-22" width="8" height="30" rx="3" fill="#ffd65c"/><path d="M-4 -22 L0 -32 L4 -22 Z" fill="#ff9ec7"/></g>
  </svg>`;
}

// ===== 動畫開關 =====
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
export function motionEnabled() {
  return settings.get('motion', !reduceMotion.matches) && !reduceMotion.matches;
}
export function initMotionToggle(btn) {
  const apply = () => {
    const on = motionEnabled();
    document.body.classList.toggle('motion-on', on);
    btn.setAttribute('aria-pressed', String(on));
    btn.querySelector('.nav-toggle-text').textContent = on ? '動畫：開' : '動畫：關';
    btn.setAttribute('aria-label', on ? '慶祝動畫已開啟，按一下關閉' : '慶祝動畫已關閉，按一下開啟');
  };
  btn.addEventListener('click', () => {
    if (reduceMotion.matches) { toast('裝置設定了「減少動態效果」，動畫會保持關閉'); return; }
    settings.set('motion', !motionEnabled());
    apply();
  });
  apply();
}

// ===== 提示訊息 =====
let toastTimer;
export function toast(msg, ms = 2400) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}

// ===== 對話框 =====
// buttons: [{ label, value, className }]，回傳被按下按鈕的 value（按 Esc 回傳 'cancel'）
export function ask({ title, text = '', buttons, mood = 'happy' }) {
  const dlg = document.getElementById('dialog');
  dlg.querySelector('.dialog-title').textContent = title;
  dlg.querySelector('.dialog-text').textContent = text;
  dlg.querySelector('.dialog-mascot').innerHTML = mascotSVG(mood);
  const actions = dlg.querySelector('.dialog-actions');
  actions.innerHTML = '';
  for (const b of buttons) {
    const btn = document.createElement('button');
    btn.className = 'btn ' + (b.className || '');
    btn.value = b.value;
    btn.textContent = b.label;
    actions.appendChild(btn);
  }
  return new Promise(resolve => {
    const onClose = () => {
      dlg.removeEventListener('close', onClose);
      resolve(dlg.returnValue || 'cancel');
    };
    dlg.returnValue = '';
    dlg.addEventListener('close', onClose);
    dlg.showModal();
    // 預設焦點放在第一個（較安全的）按鈕
    actions.querySelector('button')?.focus();
  });
}

export async function confirmDanger(title, text, okLabel) {
  const v = await ask({
    title, text, mood: 'wow',
    buttons: [
      { label: '先不要', value: 'cancel', className: 'btn-blue' },
      { label: okLabel, value: 'ok', className: 'btn-danger' },
    ],
  });
  return v === 'ok';
}

// ===== 慶祝動畫：星星與彩帶（約 1 秒，不閃爍） =====
const COLORS = ['#ffd65c', '#ff9ec7', '#7fd3f7', '#8fd694', '#ff9a76', '#c8b6ff'];
const STAR = '<svg viewBox="0 0 40 40"><path d="M20 2 L25 15 L38 15 L27 23 L31 37 L20 29 L9 37 L13 23 L2 15 L15 15 Z" fill="currentColor"/></svg>';
const RIBBON = '<svg viewBox="0 0 20 20"><rect x="2" y="7" width="16" height="6" rx="3" fill="currentColor"/></svg>';

export function celebrate(x = window.innerWidth / 2, y = window.innerHeight / 2.5, count = 26) {
  if (!motionEnabled()) return;
  const layer = document.getElementById('celebrate');
  for (let i = 0; i < count; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    p.innerHTML = i % 3 === 0 ? RIBBON : STAR;
    p.style.color = COLORS[i % COLORS.length];
    const a = (Math.PI * 2 * i) / count + Math.random() * 0.4;
    const d = 90 + Math.random() * 120;
    const size = 14 + Math.random() * 14;
    p.style.width = p.style.height = size + 'px';
    p.style.setProperty('--x0', `${x - size / 2}px`);
    p.style.setProperty('--y0', `${y - size / 2}px`);
    p.style.setProperty('--x1', `${x - size / 2 + Math.cos(a) * d}px`);
    p.style.setProperty('--y1', `${y - size / 2 + Math.sin(a) * d + 40}px`);
    p.style.setProperty('--r', `${(Math.random() - 0.5) * 360}deg`);
    layer.appendChild(p);
    setTimeout(() => p.remove(), 1200);
  }
}

// 填色時的小泡泡
export function bubble(x, y, color) {
  if (!motionEnabled()) return;
  const layer = document.getElementById('celebrate');
  const b = document.createElement('div');
  b.className = 'bubble-pop';
  b.style.left = x + 'px';
  b.style.top = y + 'px';
  b.style.width = b.style.height = '54px';
  b.style.color = color;
  layer.appendChild(b);
  setTimeout(() => b.remove(), 600);
}

export function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
