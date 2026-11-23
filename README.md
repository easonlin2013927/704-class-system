# 704班級系統

[專案說明](README.md) · [更新紀錄](log.md) · [版本下載](https://github.com/easonlin2013927/704-class-system/releases)

提供學生、教師、小老師與管理員共用的班級工作台。公告、帳號與班級資料集中保存在伺服器 PostgreSQL；前端使用 GitHub Pages，Node.js API 透過 Cloudflare Worker 提供服務。

## 固定入口

| 身分 | 入口 |
| --- | --- |
| 學生 | [學生端登入／安裝 PWA](https://easonlin2013927.github.io/704-class-system/student/) |
| 教師／小老師 | [教師端登入／安裝 PWA](https://easonlin2013927.github.io/704-class-system/teacher/) |
| 管理員 | [管理員登入](https://easonlin2013927.github.io/704-class-system/admin/) |

網址不隨版本變更。學生與教師請安裝對應 PWA；iPhone／iPad 使用 Safari「分享 → 加入主畫面」。管理員可直接使用一般瀏覽器。入口不會改變帳號權限。

## 主要功能

- **今天**：依臺北日期顯示今日公告、活動、作業期限、個人提醒或班級紀錄，以及收件閘未讀數量。資料及操作入口依帳號權限顯示。
- **公告與搜尋**：富文字、分類、附件、評論、閱讀狀態、草稿及排程發布；全站搜尋只顯示有權閱讀的內容。
- **班級管理**：作業登錄與提交、缺交與評語、成績簿、班級積分、全班選取與批量動作。
- **聊天與通知**：聊天、檔案傳送、安全與檢舉、系統收件閘、裝置推播與電子郵件通知。
- **帳號與設定**：細項權限、個人化風格、常用功能、登入工作階段與外部登入服務綁定。
- **維護工具**：系統健康、資料庫備份建立／下載／刪除，以及全站外部通知開關。

第一次使用系統帳號密碼登入，再到「設定 → 帳號管理 → 登入服務」綁定 Google、GitHub 或 Microsoft。每個外部帳戶只能綁定一個系統帳號，不以相同信箱自動配對。詳見[登入服務操作說明](docs/wiki/Account-Login.md)。

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
