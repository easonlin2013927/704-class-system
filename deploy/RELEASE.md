# v0.38.5 加入網站所有權驗證

- 根入口及公開介紹首頁加入管理員提供的 Google Search Console HTML 驗證標記。
- 各身分的建置入口繼承根頁面的驗證標記，供 Google 讀取；不新增任何畫面內容。
- 網頁發布後仍需由管理員在 Search Console 按「驗證」，網站部署本身不代表 Google 已完成驗證。
- 不需更新 API 或 Worker。

完整歷史請見 [更新紀錄](../log.md)。
