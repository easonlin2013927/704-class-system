# 704 班級系統無障礙檢視 — 2026-11-05

## 檢視範圍

本次依 WCAG 導向流程檢視 `index.html`、`src/main.js`、`src/school.js`、`src/styles.css`、`src/themes.css` 與 `src/school.css`。目前環境沒有 Chrome DevTools MCP，因此無法執行 Lighthouse、無障礙樹比對、實際鍵盤巡覽與 320px 自動量測；以下為原始碼檢視，分數標示為未取得。

### Lighthouse 分數

- Desktop：未取得（環境缺少 Chrome DevTools MCP）
- Mobile：未取得（環境缺少 Chrome DevTools MCP）

### 導覽與結構

- 已加入「跳至主要內容」連結，主要工作頁具有 `#main-content`。
- 公告卡原本只有 click 事件，已加入 Enter／Space 鍵操作。
- 全域焦點樣式已涵蓋連結、文字區域、summary 與可聚焦容器。
- 登入與強制變更密碼頁仍需逐頁確認單一 H1；公告編輯預覽的標題層級仍需實際頁面檢查。

### 內容與互動

- 跑馬公告已由 `<marquee>` 改為靜態重要通知，避免無法暫停的移動內容。
- 圖示按鈕採一致的 44px 目標；公告編輯與刪除按鈕已補上具內容脈絡的 accessible name。
- 通用 school dialog 已使用 `aria-labelledby`；`main.js` 中個別建立的 dialog 尚需後續逐一補齊。
- 設定分類仍需完整檢查其導覽／頁籤語意；目前視覺不再依賴 hover 才能操作。

### Resize 與 Reflow

- viewport 允許縮放，並加入 `viewport-fit=cover`。
- 390px 與 768px 靜態畫面可正常重排，未看到水平頁面溢位。
- 功能導覽在 960px 以下改為單列可捲動；長期仍建議改成底部常用功能＋完整功能抽屜。
- 資料表限制在 `.table-scroll` 內水平捲動，頁面本身不應橫向捲動。

### 動態、對比與觸控

- 已加入完整 `prefers-reduced-motion` 規則並停用 hover 位移。
- 新深色主題連結色 `#72A2FF` 對深色底具較高辨識度，不再沿用低對比紫色。
- 主要控制最小高度 44px；聊天次要動作至少 36px，仍建議在實機確認密集區域。

## Consolidated Findings Summary

| Severity | WCAG | Element(s) / Selector | Issue | Recommendation |
| :--- | :--- | :--- | :--- | :--- |
| Critical | 2.1.1 | `.announcement-card[data-open]` | 原本無法用 Enter／Space 開啟 | 已加入鍵盤事件；後續可改成真正連結語意 |
| Major | 2.4.7 | Global focusable controls | 焦點規則未涵蓋連結、textarea、summary 與 tabindex | 已新增全域 `:focus-visible` |
| Major | 2.2.2 | `.site-marquee marquee` | 無法暫停的連續移動內容 | 已改為靜態通知 |
| Major | 4.1.2 | `.school-dialog` | 對話框沒有程式化名稱 | 通用 dialog 已加 `aria-labelledby`；個別 dialog 待補 |
| Major | 1.3.1 | `.status-table` and school tables | 部分資料表缺 caption 或 scope | 系統狀態表已有完整語意；其餘功能表待逐表補齊 |
| Major | 4.1.2 | Icon-only controls | 部分控制只依賴 title | 登出及公告卡操作已補 aria-label；編輯工具列待盤點 |
| Major | 1.4.3 | Dark theme links | 舊紫色連結對比不足 | 已改用較亮的訊號藍 token |
| Minor | 2.4.1 | All authenticated pages | 跳至內容目標需逐路由確認 | 大部分主頁已加入固定目標；個人化長模板待補 |
| Minor | 4.1.3 | Chat updates | 自動刷新沒有精簡的新訊息宣告 | 後續增加獨立 polite 狀態，不讓整段歷史成為 live region |

## 尚未完成的瀏覽器驗證

- Lighthouse desktop/mobile
- 原生 dialog 的焦點回復
- 320px 放大與文字放大 200%
- 螢幕閱讀器下的聊天更新
- 7 種主題的實際對比量測

