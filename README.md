# 704班級系統

[專案說明](README.md) · [更新紀錄](log.md) · [版本下載](https://github.com/easonlin2013927/704-class-system/releases)

提供學生、教師、小老師與管理員共用的班級工作台。公告、帳號與班級資料集中保存在伺服器 PostgreSQL；前端使用 GitHub Pages，Node.js API 透過 Cloudflare Worker 提供服務。

## 介面與操作提示

預設採用黑白線條介面，仍可在「設定 → 個人化」選擇其他主題。共用元件採短動畫，並遵守裝置的「減少動畫」設定；設計參考與來源見 [介面來源說明](docs/ui-sources.md)。

載入狀態使用環形指示，按鈕及輸入框提供懸停、按壓與焦點回饋。功能切換播放短暫淡入；對話框以 180ms 淡入淡出，背景同步漸進模糊。輸入或刷新相同畫面時不重播頁面動畫。

刪除資料前會顯示「取消／刪除」確認窗，預設選取取消。只有伺服器確認刪除成功後，才顯示綠色圓圈勾勾與「刪除成功」；取消或失敗不會顯示成功。成功提示的外圈短暫旋轉後收成完整圓圈，勾勾保持不動；減少動畫設定停用旋轉。批次刪除會標示數量。

登入結果顯示於畫面頂部：綠色為成功，紅色為失敗。一般操作錯誤顯示中央紅色 × 提示窗，閱讀訊息後按「確定」或 Escape 返回原畫面。一般成功使用頂部小通知，備份建立、帳號刪除等重要結果使用中央確認窗；表單仍保留必要的欄位與重試提示。

導覽、勾選與開關、提示文字、密碼顯示切換、卡片與列表增刪、便利貼拖放、英雄榜公布、聊天已讀與實際檔案進度共用短動畫。輪詢保留既有項目，不重播整份畫面；原生日期與下拉選單保留瀏覽器行為。

## 固定入口

| 身分 | 入口 |
| --- | --- |
| 學生 | [學生端登入／安裝 PWA](https://easonlin2013927.github.io/704-class-system/student/) |
| 教師／小老師 | [教師端登入／安裝 PWA](https://easonlin2013927.github.io/704-class-system/teacher/) |
| 管理員 | [管理員登入](https://easonlin2013927.github.io/704-class-system/admin/) |

網址不隨版本變更。學生與教師請安裝對應 PWA；iPhone／iPad 使用 Safari「分享 → 加入主畫面」。管理員可直接使用一般瀏覽器。入口不會改變帳號權限。

## 公開介紹與政策

[系統介紹／應用程式首頁](https://easonlin2013927.github.io/704-class-system/about/) · [隱私權政策](https://easonlin2013927.github.io/704-class-system/privacy/) · [服務條款](https://easonlin2013927.github.io/704-class-system/terms/)

三頁可直接閱讀，不需登入或安裝 PWA。可分別填入 Google Auth Platform「品牌」的首頁、隱私權政策與服務條款欄位；網域所有權與品牌驗證仍需由 Google 審核。

Search Console 的網站所有權驗證標記保留於根目錄 `index.html` 與 `about/index.html` 的 HTML head；後續發布時請勿移除，以免影響持續驗證。

## 主要功能

- **今天**：依臺北日期顯示今日公告、活動、作業期限、個人提醒或班級紀錄，以及收件閘未讀數量。資料及操作入口依帳號權限顯示。
- **公告與搜尋**：富文字、分類、附件、評論、閱讀狀態、草稿及排程發布；全站搜尋只顯示有權閱讀的內容。
- **班級管理**：作業登錄與提交、缺交與評語、成績簿、班級積分、全班選取與批量動作。
- **聊天與通知**：聊天、檔案傳送、安全與檢舉、系統收件閘、裝置推播與電子郵件通知。
- **帳號與設定**：細項權限、個人化風格、常用功能、登入工作階段與外部登入服務綁定。
- **維護工具**：系統健康、資料庫備份建立／下載／刪除，以及全站外部通知開關。

第一次使用系統帳號密碼登入，再到「設定 → 帳號管理 → 登入服務」綁定 Google、GitHub 或 Microsoft。每個外部帳戶只能綁定一個系統帳號，不以相同信箱自動配對。詳見[登入服務操作說明](docs/wiki/Account-Login.md)。

所有登入入口與安裝頁提供「忘記密碼／重設密碼」。電子郵件地址驗證與密碼重設使用原本設定的寄件帳號與郵件佇列，確認連結後才更新系統資料；不需要 Firebase 郵件範本或服務帳戶。詳見 [驗證與密碼重設郵件](docs/account-email.md)。

## 使用手冊

- [學生使用手冊](docs/wiki/Student-Guide.md)
- [教師使用手冊](docs/wiki/Teacher-Guide.md)
- [小老師使用手冊](docs/wiki/Assistant-Guide.md)
- [管理員使用手冊](docs/wiki/Admin-Guide.md)
- [維護人員使用說明](docs/wiki/Maintenance-Guide.md)
- [權限、常用功能與搜尋](docs/wiki/Permissions-and-Search.md)
- [個人化設定](docs/wiki/Personalization.md)
- [電子郵件通知設定](docs/email-notifications.md)
- [完整文件目錄](docs/wiki/Home.md)
- [下載角色介紹簡報（PPTX）](https://easonlin2013927.github.io/704-class-system/downloads/704-class-system-role-guide.pptx)

## 資料與通知

公告、帳號與其他業務資料存放於伺服器；瀏覽器快取僅供應用程式載入，不作為資料庫。沒有網際網路時，系統顯示離線畫面，重新連線後恢復操作。

管理員關閉全站外部通知後，系統仍保存收件閘通知；帳號驗證等必要郵件另依規則處理。通知恢復後不補送已取消的舊郵件。寄件服務接受請求不等於郵件已送達或已閱讀。

## 開發與部署

使用 Node.js 22。前端以 esbuild 建置，DOMPurify 清理富文字。

```sh
npm ci
npm run check
npm run build
node scripts/serve.mjs
```

部署及主機環境設定見 [1Panel 部署說明](deploy/README.md)與 [Worker 維護說明](deploy/worker/README.md)。API 更新腳本先測試新版，再切換正式容器；失敗時還原舊版，保留上傳目錄掛載。

```bash
git -C /data/704-class-system/source pull --ff-only origin main
bash /data/704-class-system/source/deploy/update-api.sh
```

資料庫需定期備份。不要執行舊的 supabase/schema.sql。版本變更與升級需求請見 [log.md](log.md)，README 僅保留目前使用及開發說明。

## 問題回報

使用 [Issues](https://github.com/easonlin2013927/704-class-system/issues/new/choose) 回報問題或提出建議。請勿提交密碼、學生個資或名冊。

## 班級互動工具

學生可使用全班公開的心情留言板，教師與獲授權帳號可回覆；資料繳收支援截止日、批次狀態及未繳提醒。聊天支援狀態、已讀及離線郵件，英雄榜可由教師與管理員設定名次及頒獎台。操作及權限說明見 [班級互動與資料繳收](docs/wiki/Classroom-Tools.md)。
