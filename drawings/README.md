# 線稿素材說明

這個資料夾放所有塗色用的線稿，和網站程式分開管理。目前共 8 類、每類 20 張（共 160 張），都是本專案原創、線條清楚、背景簡單的兒童著色圖，可以自由替換。

## 資料夾結構

```
drawings/
  drawings.json        圖庫資料（分類與圖案清單）
  animals/             動物
  plants/              植物
  scenery/             自然風景
  stories/             故事
  buildings/           建築
  furniture/           家具
  food/                食物
  people/              人物
```

## 新增一張圖

1. 把檔案放進對應分類的資料夾，例如 `drawings/animals/rabbit.svg`。
2. 打開 `drawings.json`，在 `drawings` 陣列加入一筆：

```json
{
  "id": "rabbit",
  "name": "蹦蹦小兔",
  "category": "animals",
  "thumbnail": "drawings/animals/rabbit.svg",
  "lineArt": "drawings/animals/rabbit.svg",
  "difficulty": "easy",
  "tags": ["兔子", "耳朵"],
  "popular": false,
  "addedAt": "2026-12-01"
}
```

| 欄位 | 說明 |
| --- | --- |
| `id` | 唯一代號，只用英文、數字、`-`。會出現在網址裡，已儲存的作品也靠它對應，**上線後不要改** |
| `name` | 顯示名稱 |
| `category` | 分類代號，要和 `categories` 裡的 `id` 一樣 |
| `thumbnail` | 縮圖路徑。可以直接用線稿，也可以另外放一張小 PNG |
| `lineArt` | 塗色用的線稿路徑 |
| `difficulty` | `easy`（簡單）、`medium`（中等）、`hard`（較難） |
| `tags` | 搜尋關鍵字（選填） |
| `popular` | `true` 時出現在「熱門圖案」 |
| `addedAt` | 加入日期，「最新圖案」依這個欄位排序，顯示最新 4 張 |

## 刪除一張圖

從 `drawings.json` 拿掉那筆資料，再刪掉檔案。已經存在「我的作品」裡的作品不受影響，因為作品會另外保存一份原始線稿。

## 新增分類

在 `categories` 陣列加入 `{ "id": "space", "name": "太空", "emoji": "🚀" }`，再建立 `drawings/space/` 資料夾。

## 線稿製作規範

- **白底黑線**。程式會把白色轉成透明、深色當成線條，所以 SVG、PNG、JPG 都可以用。
- **正方形**最好（建議 800×800 以上），其他比例會自動置中縮放。
- **線條要夠粗**：800px 寬的圖建議線寬 6–8px。太細的線在填色時容易被當成缺口。
- **區域要封閉**：每個想要分開塗色的區塊，邊線都要接起來。小於約 9px 的缺口程式會自動補起來，更大的缺口顏色會流到旁邊。
- 想讓區塊不能被塗（例如眼珠），就直接塗成黑色。
- SVG 要寫 `width` 和 `height` 屬性（例如 `width="800" height="800"`），某些瀏覽器少了它會畫不出來。
- 只能使用原創或已取得授權的圖，不要放未經授權的知名卡通角色。
