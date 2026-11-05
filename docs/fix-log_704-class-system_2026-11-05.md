# Accessibility Fix Log — 704 班級系統 — 2026-11-05

## Summary

- 原始碼層級優先發現：18 類
- 本次完成的機械／全域修正：8 類
- 本次完成的脈絡修正：2 類
- 需瀏覽器或逐頁人工確認：8 類

## Changes Made

| Finding | Selector | File | Change | Tier |
| :--- | :--- | :--- | :--- | :--- |
| 鍵盤無法開啟公告 | `[data-open]` | `src/main.js` | 加入 Enter／Space 鍵操作 | 2 |
| 焦點樣式涵蓋不足 | Global | `src/redesign.css` | 擴大 `:focus-visible` 選取範圍 | 1 |
| 缺少跳至內容 | `.skip-link` | `src/main.js`, `src/redesign.css` | 新增跳至內容連結與目標 | 2 |
| 無法暫停的跑馬內容 | `.site-marquee` | `src/main.js` | 將 marquee 改為靜態通知 | 1 |
| 動作減少 | Global | `src/redesign.css` | 停止動畫、轉場與 hover 位移 | 1 |
| 觸控目標偏小 | 通用控制 | `src/redesign.css` | 通用控制改為至少 44px | 4 |
| 對話框缺少名稱 | `.school-dialog` | `src/school.js` | 以標題 id 建立 `aria-labelledby` | 2 |
| 圖示控制名稱不足 | 登出、公告操作 | `src/main.js` | 加入明確 `aria-label` | 3 |
| 深色連結對比不足 | Theme tokens | `src/redesign.css` | 深色主題採較亮連結／焦點色 | 1 |
| 安全區域未納入 | `.school-nav`, `.message-form` | `src/redesign.css` | 納入 `env(safe-area-inset-bottom)` | 1 |

## Flagged for Manual Review

| Finding | Selector | Recommendation |
| :--- | :--- | :--- |
| 個別 dialog 命名與焦點回復 | `#person-dialog`, `#activity-dialog` | 加入 `aria-labelledby` 並確認關閉後焦點回觸發按鈕 |
| School 資料表語意 | `.status-table` | 逐表加入 caption、scope 與必要列標題 |
| 聊天更新宣告 | `.chat-messages` | 增加只播報新訊息數量的 polite 狀態 |
| 設定／積分分類語意 | `.settings-tabs` | 統一成導覽語意或完成 tab keyboard pattern |
| 320px／文字放大 | 全站 | 使用可用的 Chrome DevTools MCP 後做 320px 與 200% 檢查 |

## Verification

- 靜態建置：成功
- 1440×900、768 寬與 390×844：已由 headless Chrome 產圖檢查
- 水平頁面溢位：1440px 檢查未發現
- Lighthouse：未執行，因環境沒有 Chrome DevTools MCP
