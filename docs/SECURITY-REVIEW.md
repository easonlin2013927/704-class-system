# 安全修正紀錄（v0.30.5）

本次檢查範圍為使用者提供的兩項 CodeQL 警示、Firebase Web 設定、預覽檔案存取，以及已追蹤程式碼中的常見私密金鑰格式。這不是整個服務的滲透測試或安全保證。

## HTML 與 XSS

`stripHtml` 原本直接把未信任的內容交給 `div.innerHTML`。`sanitizeHtml` 則使用自製清理器。兩者已移到 `src/rich-html.js`，先由 DOMPurify 解析及清理，保留受限的格式、圖片和連結規則，輸出前再清理一次。

隔離瀏覽器測試包含事件屬性、SVG、JavaScript 連結、iframe、畸形 MathML、DOM clobbering 與危險樣式；同時確認合法格式、貼圖及自動超連結保留。

可重跑：以 `PREVIEW_SOURCE=1` 啟動 `node scripts/serve.mjs`，用 `playwright-cli open http://127.0.0.1:4173/` 開啟本機頁面，再執行 `playwright-cli run-code --filename=scripts/rich-html.browser.mjs`。

## 本機預覽代理與檔案

預覽代理只接受既有 Worker 路由，HTTPS 的主機、協定及埠固定在程式中；使用者只能提供經驗證的路徑與查詢字串。靜態檔案加入根目錄邊界檢查，拒絕反斜線、隱藏路徑、控制字元及 Windows 替代資料流。

可重跑：`node scripts/preview-security.test.mjs`。

## Firebase Web API key

Web API key 是瀏覽器使用的專案識別設定，不是服務帳戶私密金鑰，不能視為授權機制。依使用者要求，目前原始碼不再硬寫實際 key，改從 API 容器的 `FIREBASE_API_KEY` 取得。前端登入時仍會接收公開設定。過往 Git 歷史中的公開 Web key 不會因本次修改消失。

`deploy/update-api.sh` 會在環境設定缺少這個欄位時，從正在執行的舊容器移轉公開設定；不輸出 key，也不複製其他環境變數。缺少有效設定時保留帳密登入並停用 Google 登入。

Google Cloud 的 API key 限制需另外核對：允許登入需要的 Firebase Authentication API，並確認網站來源限制包含正式入口。這次沒有登入 Google Cloud 控制台，不能宣稱已核對或變更雲端限制。不要把服務帳戶 JSON、SMTP 密碼或資料庫密碼放進前端或版本庫。

官方說明：[Firebase API keys](https://firebase.google.com/docs/projects/api-keys)、[DOMPurify](https://github.com/cure53/DOMPurify)。
