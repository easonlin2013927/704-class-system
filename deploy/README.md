# 1Panel 部署（自架 PostgreSQL）

cloudflared 直接運行在同一台主機時適用下列步驟。0.3.0 將登入分成學生、教師與維護人員三個入口；前端與後端必須一起升級。

## 1. 準備原始碼

在主機選一個專用目錄下載本 repository，保留 server 與 deploy 的相對位置。若 repository 私人，使用自己的 GitHub 權限下載，不要將 token 放入網址或設定檔。

## 2. 填寫主機端環境設定

複製 deploy/.env.example 為 deploy/.env，僅在主機上修改：

- PGHOST：PostgreSQL 容器名稱。
- PGPORT：容器內部埠，通常為 5432。
- PGDATABASE、PGUSER：已建立的專用資料庫與使用者。
- PGPASSWORD：該使用者的密碼。
- DB_NETWORK：PostgreSQL 所連接的 Docker 網路名稱。
- ALLOWED_ORIGIN：保持 https://easonlin2013927.github.io，不能加網址路徑或尾斜線。
- PUBLIC_API_URL：保持 `https://704-announcement-api.easonlin2013927.workers.dev`。
- UPLOAD_STORAGE_HOST：設定為 1.8 TB 硬碟上的絕對目錄，例如 `/mnt/class-storage/704-uploads`。聊天室檔案、公告附件、頭像與桌布都會存放於此；請先建立目錄並確認 Docker 有讀寫權限。
- CHAT_UPLOAD_DIR：容器內保持 `/data/chat-files`，不需更改。

不要使用資料庫超級使用者。專用帳號必須能在專用資料庫的 public schema 建表，不能授予其他資料庫管理權限。不要執行舊 supabase/schema.sql。

## 3. 啟動

在主機終端進入原始碼目錄，執行：

```sh
docker compose --env-file deploy/.env -f deploy/compose.yml up -d --build
docker compose --env-file deploy/.env -f deploy/compose.yml ps
curl http://127.0.0.1:7040/health
```

健康檢查應回傳 {"status":"ok"}。如果失敗，查看 api704 容器日誌；檢查 Docker 網路、PGHOST、密碼及建表權限。分享日誌前遮蔽個資。

啟動只建立不存在的資料表，不會清空公告。只發佈 127.0.0.1:7040，資料庫不開放外網。

所有上傳位置的單一檔案上限為 400 MB。聊天室附件在建立 72 小時後會自動從資料庫紀錄與 `UPLOAD_STORAGE_HOST` 刪除；公告附件、頭像與桌布不會套用三天期限。備份時請同時備份 PostgreSQL 與 `UPLOAD_STORAGE_HOST`。

## 4. 建立帳號

在 1Panel 的檔案管理中建立主機端暫存 accounts.json，權限限管理員，內容例如：

```json
{"email":"teacher@example.com","password":"請換成至少12字元的隨機密碼","name":"教師","role":"teacher"}
```

在該檔案所在位置執行：

```sh
docker exec -i api704 node account.mjs < accounts.json
```

成功顯示 Account saved 後，刪除這個含明文密碼的暫存檔。學生帳號使用 role: student，維護人員帳號使用 role: admin，逐一建立。勿將 accounts.json 放進 repository 或分享。相同 email 會更新密碼、名稱與角色，並撤銷舊登入。

## 5. Cloudflare Tunnel

同一主機上的 cloudflared，新增「已發佈的應用程式」：

- 子網域 api704，網域 easonlin2013927.dpdns.org，路徑留空。
- 服務 URL：http://127.0.0.1:7040。
- 若介面分成類型與網址，類型選 HTTP，網址填 127.0.0.1:7040。

外部網址是 HTTPS，Tunnel 至本機是 HTTP。不要將服務指向 PostgreSQL 5432 或 1Panel 管理連接埠。Cloudflare Access 若阻擋 API，需另行處理瀏覽器的跨來源驗證；本版本使用自己的帳號驗證。

先開啟 https://api704.easonlin2013927.dpdns.org/health 確認成功，再使用前端登入。

## 6. 正式驗收與備份

教師建立公告，另一裝置的學生登入後可閱讀；學生不能呼叫寫入 API。教師修改、置頂與刪除後，學生重新登入可看到更新。清除瀏覽器資料、重新部署及重啟 API 都不能刪除公告。

帳密由 scrypt 雜湊處理，登入 token 在資料庫僅存雜湊，八小時過期，前端只放記憶體。所有教師共同管理全部公告。登入限流目前為單個 API 程序記憶體，每帳號十五分鐘八次失敗；重啟會重設，正式使用建議另搭配 Cloudflare 的流量限制。

備份 PostgreSQL 的 accounts704 與 announcements704 及表結構。sessions704 僅含登入狀態，可不復原。不要刪除資料庫或資料卷；沒有自動到期刪除公告的工作。不要把「永久保留」誤認為不需要備份。

此部署尚未在使用者主機驗證；完成連線與角色驗收後再標正式 Release。


## Cloudflare Workers 新入口

前端目前透過 Workers 連接 API，原 Tunnel 與資料庫仍需維持運作。部署、配額及回復方式見 [Worker 維護說明](worker/README.md)。
