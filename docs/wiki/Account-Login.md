# 登入服務綁定

目前可綁定 Google 與 GitHub。登入服務與通知信箱分開管理；綁定個人帳戶不會改變通知寄送地址。

## 第一次設定

1. 從自己的固定入口進入，使用系統帳號及密碼登入。教師與小老師使用教師入口。
2. 開啟「設定／帳號管理／登入服務」。
3. 在 Google 或 GitHub 卡片按「綁定」。
4. 輸入目前的 **704 系統密碼**，按「連接帳戶」。這裡不是輸入 Google 或 GitHub 密碼。
5. 在供應商的視窗選擇或授權你想用來登入的帳戶，完成連接。
6. 確認設定顯示「已綁定」。GitHub 未提供信箱時會顯示「GitHub 帳戶（未提供信箱）」，仍可使用。

之後可在原本的登入入口按「使用 Google 登入」或「使用 GitHub 登入」。不需要先把該信箱加入通知信箱，也不限學校網域。未綁定帳戶不能登入系統。

每個外部帳戶只能綁定一個系統帳號；每個系統帳號可各綁定一個 Google 與 GitHub 帳戶。若同一供應商已綁定，需先解除原綁定，再改綁其他帳戶。取消授權、密碼錯誤或綁定失敗，不會修改原綁定。

## 解除或更換

在同一處按「解除綁定」，輸入目前的 704 系統密碼並確認。使用該綁定登入的裝置會失去登入狀態；其他供應商與帳密登入不受影響。例如解除 GitHub，不會登出使用 Google 登入的裝置。

若無法使用原外部帳戶，請先使用系統帳密登入，再解除或更換。忘記系統密碼時請聯絡管理員。

## Firebase 帳戶衝突

如果 Firebase 回報 `auth/account-exists-with-different-credential`，代表其「每個電子郵件地址只有一個帳戶」設定與其他供應商帳戶衝突。請管理員檢查 Authentication 的使用者帳戶連結設定。若要讓供應商獨立授權，可評估使用「每個身分識別提供者建立帳戶」設定；請先評估既有 Firebase 使用者與其他應用程式。系統不會依相同信箱自動合併或綁定。參考 [Firebase 官方說明](https://firebase.google.com/docs/auth/web/github-auth#handling-account-exists-with-different-credential-errors)。

## 升級後的既有使用者

以前依已驗證信箱自動登入的 Google 帳戶，不會自動成為綁定帳戶。升級後請先以帳密登入，再主動完成綁定。

固定入口：

- [學生](https://easonlin2013927.github.io/704-class-system/student/)
- [教師／小老師](https://easonlin2013927.github.io/704-class-system/teacher/)
- [管理員](https://easonlin2013927.github.io/704-class-system/admin/)
