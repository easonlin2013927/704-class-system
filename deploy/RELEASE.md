# v0.41.0 Firebase 郵件與全站動態

- 電子郵件驗證與系統密碼重設使用 Firebase 原生寄信；公開確認頁及所有登入／安裝入口提供重設密碼。
- 保留系統帳密與 Google／GitHub／Microsoft 綁定；一次性連結驗證成功後才更新本地資料，密碼變更撤舊連結，重設撤舊工作階段。
- 全站共用控制項、導覽、提示、卡片、列表、便利貼、頒獎台、聊天與真實檔案進度加入短動畫；輪詢去重與減少動畫保留。
- 安全測試與瀏覽器檢查通過；沒有使用真實 Firebase 寄送測試信。

## 啟用 Firebase 郵件

本版需完成 Firebase Console 範本與服務帳戶設定，並由使用者更新 API。詳見 [設定步驟](https://github.com/easonlin2013927/704-class-system/blob/main/docs/firebase-email.md)。其他通知仍使用原寄件服務。

## 固定入口

- 學生：https://easonlin2013927.github.io/704-class-system/student/
- 教師：https://easonlin2013927.github.io/704-class-system/teacher/
- 管理員：https://easonlin2013927.github.io/704-class-system/admin/
- 郵件確認：https://easonlin2013927.github.io/704-class-system/auth-action/