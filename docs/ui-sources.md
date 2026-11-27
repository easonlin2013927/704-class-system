# 共用介面樣式來源

`src/uiverse-system.css` 與 `src/public-pages.css` 的元件樣式由本專案自行撰寫，使用原生 HTML/CSS 與既有主題變數。沒有新增 React、Tailwind 或其他元件依賴，也沒有移植下列作品的完整或實質程式碼。

2026-11-27 的視覺研究參考：

- [Input by alexruix](https://uiverse.io/alexruix/slippery-snail-18)：輸入框邊線與短時間的焦點轉換。保留現有可見標籤，沒有採用浮動標籤結構。
- [Button by adamgiebl](https://uiverse.io/adamgiebl/wise-moth-35)：按鈕表面層次與按壓回饋。以細邊線、內側微光與小陰影自行實作。
- [Switch by MuhammadHasann](https://uiverse.io/MuhammadHasann/nasty-moth-15)：原生 checkbox 與 label 控制的切換狀態。沿用專案現有 checkbox、label 與滑塊結構，沒有採用閃爍裝飾。

上述 Uiverse 作品各自標示 MIT License；其著作權屬於原作者。本次只參考互動技巧，沒有複製需要附帶授權聲明的實質程式碼。未來若移植作品程式碼，必須一併保留作品原始著作權與完整 MIT 授權文字。

預設黑白主題與其他可選主題共用元件行為。軟木留言牆、頒獎台金銀銅、主題預覽及登入供應商標誌保留原有配色。滑鼠懸停效果限定支援 hover 的裝置；減少動畫設定停用新增轉換。

後續動態補強亦由本專案自行撰寫：CSS 環形載入、按鈕高光與按壓深度、輸入框焦點內光。GitHub 專案按鈕重用既有 `github-logo.svg`。畫面切換使用 Web Animations API 的 180ms 淡入，依畫面識別碼決定是否播放。

對話框透過共用 `openDialog`／`closeDialog` 控制 180ms 進退場，背景模糊由 0px 轉換到 5px；Escape 與 dialog 表單提交也保留退場動畫。刪除確認、成功圓圈勾勾及新增連結輸入窗沿用共用提示框，不依賴瀏覽器原生 confirm／prompt。這些元件延續 [Uiverse](https://uiverse.io/) 的短動畫、細邊線與狀態回饋方向，程式碼由本專案自行撰寫。
