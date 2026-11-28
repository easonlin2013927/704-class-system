# v0.41.1 恢復原寄件服務

- 驗證電子郵件與系統密碼重設使用原本設定的寄件帳號與郵件佇列。
- 移除 Firebase 郵件依賴與服務帳戶掛載要求；外部登入服務不變。
- 保留重設密碼入口、一次性連結、安全限制及所有既有動畫。
- API 由使用者更新，沿用既有寄件設定；未以 mock 測試宣稱真實郵件送達。

[郵件與 API 更新說明](https://github.com/easonlin2013927/704-class-system/blob/main/docs/account-email.md)

## 固定入口

- 學生：https://easonlin2013927.github.io/704-class-system/student/
- 教師：https://easonlin2013927.github.io/704-class-system/teacher/
- 管理員：https://easonlin2013927.github.io/704-class-system/admin/