// 圖庫資料：從 drawings/drawings.json 讀取（新增圖案只要改這個檔案，不用動程式）
let cache = null;

export const DIFFICULTY = {
  easy: { label: '簡單', stars: 1 },
  medium: { label: '中等', stars: 2 },
  hard: { label: '較難', stars: 3 },
};

export async function loadCatalog() {
  if (cache) return cache;
  const res = await fetch('drawings/drawings.json', { cache: 'no-cache' });
  if (!res.ok) throw new Error('圖庫載入失敗');
  const data = await res.json();
  const catMap = new Map(data.categories.map(c => [c.id, c]));
  const drawings = data.drawings.map(d => ({
    ...d,
    thumbnail: d.thumbnail || d.lineArt,
    categoryInfo: catMap.get(d.category) || { id: d.category, name: d.category, emoji: '🖍️' },
  }));
  cache = { categories: data.categories, drawings, byId: new Map(drawings.map(d => [d.id, d])) };
  return cache;
}

export function searchDrawings(list, { q = '', category = 'all' } = {}) {
  const k = q.trim().toLowerCase();
  return list.filter(d => {
    if (category !== 'all' && d.category !== category) return false;
    if (!k) return true;
    const hay = [d.name, d.categoryInfo.name, ...(d.tags || []), DIFFICULTY[d.difficulty]?.label || '']
      .join(' ').toLowerCase();
    return hay.includes(k);
  });
}
