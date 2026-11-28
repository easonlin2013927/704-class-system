# Firebase 驗證與重設密碼郵件

僅「電子郵件地址驗證」及「系統密碼重設」改用 Firebase Authentication 原生郵件。公告、聊天提醒、資料繳收與其他通知仍使用原寄件服務。Firebase 郵件不受全站一般通知開關控制，也不會回退到舊六位數驗證碼佇列。

## Firebase Console 設定

1. 開啟專案 `class-system-d36d9` 的 Authentication → Sign-in method，啟用「電子郵件／密碼」。不需啟用電子郵件連結登入。
2. Authentication → Settings → Authorized domains 確認包含 `easonlin2013927.github.io`。
3. Authentication → Templates，分別編輯「電子郵件地址驗證」與「重設密碼」。將兩者的「自訂動作網址／Action URL」設為：

   `https://easonlin2013927.github.io/704-class-system/auth-action/`

4. 選擇繁體中文範本，保留 Firebase 提供的動作連結變數。寄件者名稱可填「704班級系統」。不要把 Action URL 設成登入入口，也不要將 Firebase 郵件中的一次性代碼或 state 分享到公開頁面。

## 伺服器憑證

Firebase 專案設定 → 服務帳戶可建立服務帳戶私密金鑰。服務帳戶須屬於 `class-system-d36d9`，並具有管理 Authentication 使用者的權限，例如 `roles/firebaseauth.admin`。請妥善保管，勿上傳至 GitHub、聊天訊息或前端設定。

在樹莓派建立目錄：

```bash
mkdir -p "$HOME/.config/704-api"
chmod 700 "$HOME/.config/704-api"
```

使用 SCP 或你的檔案傳輸工具，將下載的 JSON 放到：

```text
~/.config/704-api/firebase-service-account.json
```

再執行：

```bash
chmod 600 "$HOME/.config/704-api/firebase-service-account.json"
sudo chown 1000:1000 "$HOME/.config/704-api/firebase-service-account.json"
curl -fsSL https://raw.githubusercontent.com/easonlin2013927/704-class-system/main/deploy/update-api.sh -o /tmp/704-update-api.sh
bash /tmp/704-update-api.sh
```

成功輸出應包含 `DEPLOY_OK v0.41.0`。容器使用 UID 1000，金鑰設為該 UID 所有且權限 600，避免唯讀掛載後仍無法讀取。腳本會將私密金鑰以唯讀方式掛載到容器 `/run/secrets/firebase-service-account.json`，設定 `GOOGLE_APPLICATION_CREDENTIALS`，沿用既有 `FIREBASE_API_KEY`，並保留 API 切換前檢查與失敗回復。設定檢查只確認可讀取、專案與必要欄位，不代表 OAuth 權限或實際寄件已驗證。

以 Compose 部署時，設定主機上的 `FIREBASE_KEY_FILE` 絕對路徑，參考 `deploy/compose.yml`。亦支援服務端環境變數 `FIREBASE_SERVICE_ACCOUNT_JSON`，但不要將 JSON 寫入版本控制中的檔案。`FIREBASE_EMAIL_CONTINUE_URL` 預設為正式 `/auth-action/`，一般不需設定。

## 使用方式與限制

- 所有登入入口與學生／教師的安裝頁均提供「忘記密碼／重設密碼」。輸入系統帳號及已驗證通知信箱；只有啟用帳號、正確入口及唯一對應帳號的已驗證信箱符合條件。
- 受理訊息不透露帳號是否存在，也不保證信件已送達。未收到時先檢查信箱、垃圾郵件、上述設定與 Firebase 寄件額度。
- 重設要求採背景寄送，避免回應時間洩露帳號是否存在；若 API 剛好重啟，尚未完成的要求可能中斷，可等待一分鐘後重送。
- 郵件中的連結使用有效期限與一次性狀態；開啟頁面不會立刻消耗連結，需按下確認。驗證成功後才更新通知信箱；重設成功後才更新系統密碼、撤銷舊工作階段與其他重設連結。
- 系統密碼仍由本專案伺服器保存雜湊，不會將原密碼上傳 Firebase。Google、GitHub、Microsoft 的登入密碼及綁定方式不變。
- 缺少服務帳戶設定時，系統會提示尚未設定，不會假裝寄信成功。其他 Firebase 寄送失敗可能仍使用統一受理訊息，以免洩露帳號是否存在；管理員需檢查安全診斷與 Firebase 狀態。
- Firebase 的範本外觀、語言與寄件額度由 Firebase 管理；本專案的黑白頁面負責連結確認與系統密碼更新。

實際寄信驗收：使用測試帳號新增信箱，收到驗證郵件後完成確認；登出後要求重設，再以新密碼登入並確認舊密碼失效。不要以瀏覽器 mock 測試通過當作真實 Firebase 寄送已驗證。

參考：[Firebase 郵件動作處理器](https://firebase.google.com/docs/auth/custom-email-handler)、[Firebase REST API](https://firebase.google.com/docs/reference/rest/auth)、[自訂郵件範本](https://support.google.com/firebase/answer/7000714)。
