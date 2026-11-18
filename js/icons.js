// 簡單的線條圖示（24x24），統一用 currentColor 上色
const P = {
  back: '<path d="M15 5 L8 12 L15 19"/><path d="M8 12 H20"/>',
  undo: '<path d="M9 14 L4 9 L9 4"/><path d="M4 9 H14 a5.5 5.5 0 0 1 0 11 H9"/>',
  redo: '<path d="M15 14 L20 9 L15 4"/><path d="M20 9 H10 a5.5 5.5 0 0 0 0 11 H15"/>',
  trash: '<path d="M4 7 H20"/><path d="M9 7 V4 H15 V7"/><path d="M6 7 L7 20 H17 L18 7"/><path d="M10 11 V16 M14 11 V16"/>',
  save: '<path d="M12 20 C4 14 3 10 5 7 C7 4 11 5 12 8 C13 5 17 4 19 7 C21 10 20 14 12 20 Z"/>',
  download: '<path d="M12 4 V15"/><path d="M7 10 L12 15 L17 10"/><path d="M5 19 H19"/>',
  bucket: '<path d="M5 11 L11 5 L18 12 L12 18 Z"/><path d="M5 11 H17"/><path d="M20 14 C21 16 21 18 19.5 18 C18 18 18 16 20 14 Z"/>',
  brush: '<path d="M19 4 L10 13"/><path d="M10 13 C7 13 5 15 5 17 C5 19 4 20 3 20 C7 21 11 20 11 16 Z"/><path d="M16 4 L20 8"/>',
  eraser: '<path d="M14 4 L20 10 L11 19 H7 L4 16 Z"/><path d="M9 9 L15 15"/><path d="M11 19 H20"/>',
  hand: '<path d="M8 13 V6 a1.5 1.5 0 0 1 3 0 V11 V4.5 a1.5 1.5 0 0 1 3 0 V11 V6 a1.5 1.5 0 0 1 3 0 V14 C17 18 15 21 11.5 21 C8.5 21 7 19 5 16 L3.8 13.8 a1.4 1.4 0 0 1 2.4 -1.4 Z"/>',
  zoomIn: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 L20 20"/><path d="M8 10.5 H13 M10.5 8 V13"/>',
  zoomOut: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 L20 20"/><path d="M8 10.5 H13"/>',
  fit: '<path d="M4 9 V4 H9"/><path d="M15 4 H20 V9"/><path d="M20 15 V20 H15"/><path d="M9 20 H4 V15"/>',
  reset: '<path d="M4 12 a8 8 0 1 0 3 -6.2"/><path d="M4 4 V9 H9"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 L20 20"/>',
  shuffle: '<path d="M4 7 H8 C12 7 12 17 16 17 H20"/><path d="M4 17 H8 C10 17 11 14.5 11.6 12.5"/><path d="M13 9.5 C13.6 8 14.5 7 16 7 H20"/><path d="M17 4 L20 7 L17 10"/><path d="M17 14 L20 17 L17 20"/>',
  play: '<path d="M8 5 L19 12 L8 19 Z"/>',
  edit: '<path d="M4 20 L5 15 L16 4 L20 8 L9 19 Z"/><path d="M13.5 6.5 L17.5 10.5"/>',
  palette: '<path d="M12 3 C6.5 3 3 7 3 11.5 C3 16 6.5 20 11 20 C13 20 13 18 12 17 C11 15.5 12 14 14 14 H16 C19 14 21 12 21 9.5 C21 6 17 3 12 3 Z"/><circle cx="7.5" cy="11" r="1.2"/><circle cx="10" cy="7" r="1.2"/><circle cx="15" cy="7" r="1.2"/>',
  sparkle: '<path d="M12 3 L13.8 10.2 L21 12 L13.8 13.8 L12 21 L10.2 13.8 L3 12 L10.2 10.2 Z"/>',
  close: '<path d="M6 6 L18 18 M18 6 L6 18"/>',
};

export function icon(name, cls = '') {
  return `<svg class="icon ${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${P[name] || ''}</svg>`;
}
