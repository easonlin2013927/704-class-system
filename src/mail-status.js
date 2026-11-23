export function reportTime(value){const date=new Date(value);return value&&!Number.isNaN(date.getTime())?date.toLocaleString('zh-TW',{timeZone:'Asia/Taipei',hour12:false}):'—';}

function diagnostic(value){
 const raw=String(value||'');let parsed;
 try{parsed=JSON.parse(raw);}catch{}
 if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))parsed={code:/^[A-Z0-9_]+$/.test(raw)?raw:'',smtp:/^[45]\d{2}$/.test(raw)?Number(raw):null};
 return {...parsed,raw,display:[parsed.code,parsed.smtp?'SMTP '+parsed.smtp:'',parsed.enhanced,parsed.command].filter(Boolean).join(' / ')||'—'};
}

function failure(diag){
 const code=String(diag.code||''),smtp=Number(diag.smtp),enhanced=String(diag.enhanced||'');
 if(code==='EAUTH'||[534,535].includes(smtp)||enhanced==='5.7.8')return ['寄件帳號驗證遭拒。','請管理員檢查 Gmail 帳號、兩步驟驗證及伺服器的應用程式密碼設定，更新後再測試。'];
 if(diag.hint==='daily_limit')return ['寄件服務回報每日寄信額度已達上限。','等待寄件服務額度恢復；其上限可能不同於系統的 400 封限制，請避免重複建立測試。'];
 if(enhanced==='5.1.1')return ['收件服務回報信箱不存在（5.1.1）。','確認收件信箱拼字及是否仍有效；請管理員修正或改用另一個已驗證信箱。'];
 if(enhanced==='5.1.2'||code==='EDNS'||code==='ENOTFOUND')return ['郵件網域或 DNS 查詢失敗。','確認收件網域及 API 主機的 DNS 設定，再檢查 SMTP 服務是否能連線。'];
 if(['4.2.2','5.2.2'].includes(enhanced)||smtp===552)return ['收件服務回報容量或大小限制。','請收件人清理信箱容量，或確認收件服務的郵件大小限制後再測試。'];
 if(enhanced==='5.7.32'||enhanced==='5.7.26')return ['郵件服務回報寄件網域驗證或對齊不符合要求。','請管理員確認 Gmail 寄件帳號與 From 地址一致，檢查寄件服務的驗證及網域政策。'];
 if(enhanced==='5.7.29')return ['郵件服務因未使用所需的 TLS 安全連線而拒絕郵件。','請管理員檢查 SMTP 安全連線設定，不要停用 TLS 或憑證驗證。'];
 if(enhanced==='5.7.1')return ['郵件服務依安全、寄送限制或內容政策拒絕郵件。','請管理員檢查寄件帳號限制，以及收件單位的封鎖、垃圾信與外部郵件政策。'];
 if(smtp===554)return ['郵件交易遭拒（554）；單一代碼不足以確認是內容或其他服務政策。','請管理員檢查增強錯誤碼與收件服務紀錄，再調整寄件內容或收件政策。'];
 if(enhanced==='4.7.0'||enhanced==='5.4.5'||smtp===421)return ['郵件服務暫時限制連線或寄送頻率。','暫停密集測試，等待服務解除限制；此限制可能不同於系統的 24 小時寄送額度。'];
 if(code==='ETLS'||(code==='ESOCKET'&&diag.command==='STARTTLS'))return ['SMTP 安全連線建立失敗。','請管理員檢查主機時間、憑證與 TLS 連線；不要停用憑證驗證。'];
 if(['ETIMEDOUT','ECONNECTION','ESOCKET','EAI_AGAIN'].includes(code))return ['SMTP 連線逾時、中斷或暫時無法解析。','檢查 API 主機的網路、DNS 與 Gmail SMTP 連線（465），並確認防火牆未阻擋。'];
 if(smtp===550)return ['收件服務拒絕郵件（550）；舊紀錄不足以區分地址錯誤或收件政策。','確認收件地址與網域，並詢問收件單位是否封鎖外部郵件；重新測試可取得增強錯誤碼。'];
 if(smtp===553||code==='EENVELOPE')return ['寄件或收件地址遭拒。','請檢查信箱格式與 SMTP 寄件地址；若同批只有特定信箱失敗，先確認該收件信箱。'];
 if(smtp>=400&&smtp<500)return ['SMTP 服務回報暫時性錯誤（'+smtp+'）。','等待下次重試；若持續發生，請管理員依錯誤代碼檢查寄信服務。'];
 if(smtp>=500)return ['SMTP 服務拒絕寄送（'+smtp+'）。','請管理員依錯誤代碼檢查帳號、地址及收件政策，修正後再測試。'];
 return ['寄送未成功；目前僅保留錯誤紀錄：'+(diag.display!=='—'?diag.display:diag.raw.slice(0,160)||'未提供代碼')+'。','請管理員檢查寄信設定與連線；舊資料無法還原更詳細的服務端原因，請更新 API 後重新測試。'];
}

export function mailReport(row,job={}){
 const state=row.status==='cancelled'||row.queue_status==='cancelled'?'cancelled':row.status||row.queue_status,diag=diagnostic(row.last_error||row.queue_error);
 const base={error_code:diag.display,last_attempt_at:diag.at||null,failed_count:Number(row.attempts)||0,next_retry_at:null,poll:false};
 const result=(status_key,status_label,reason,advice,style=5,extra={})=>({...base,status_key,status_label,reason,advice,style,...extra});
 if(row.status==='sent')return result('accepted','寄件服務已接受','SMTP 寄件服務已接受這封郵件；這不代表已送進收件匣或已閱讀。','若未收到，請檢查垃圾郵件、信箱容量及收件單位政策。',2,{error_code:'—',last_attempt_at:null});
 if(state==='cancelled'){
  const gate=job.external_enabled===true?'目前全站外部通知已開啟。':job.external_enabled===false?'目前全站外部通知仍關閉。':'目前開關狀態未知，需更新 API 後確認。';
  return result('cancelled','已取消，不會重試',(diag.raw.includes('全站外部通知已關閉')?'這筆任務曾因當時的全站外部通知關閉而取消。':'這筆任務已被取消。')+gate,'啟用開關不會自動重送已取消的舊任務。確認開關已開啟後，請重新發送測試郵件。');
 }
 if(row.disabled)return result('disabled','帳號停用','此帳號目前已停用，系統不會寄送。','如需接收，請管理員先啟用帳號，確認信箱後重新測試。');
 if(Object.hasOwn(row,'queue_id')&&!row.queue_id)return result('not_included','本次未納入','此帳號沒有本次測試的寄送任務，可能在建立測試時尚未啟用或尚未建立。','確認帳號及信箱後重新建立測試；此狀態不是 SMTP 寄送失敗。');
 if(!row.address)return result('no_mailbox','沒有信箱','本次測試找不到可用的通知信箱。','請管理員新增預設信箱，或由使用者新增並驗證通知信箱，再重新測試。');
 if(!row.verified)return result('unverified','等待信箱驗證','通知信箱尚未通過驗證，不會寄出測試郵件。','請使用者完成五分鐘驗證碼流程；管理員預設信箱請確認後台驗證設定。',4);
 if(job.external_enabled===false)return result('gate_wait','等待外部通知開啟','目前全站外部通知關閉，這筆尚未寄出的任務可能接著被取消。','先開啟通知開關，再重新建立測試；不要把此狀態視為收件信箱故障。',4,{poll:true});
 if(job.sender_configured===false)return result('configuration','寄信服務未設定','API 主機缺少 Gmail 寄件帳號或應用程式密碼設定。','請管理員在伺服器補齊設定並重新部署；不要把密碼填入試算表或聊天室。',3,{poll:true});
 if(Number(job.daily_limit)>0&&Number(job.sent_last_24h)>=Number(job.daily_limit))return result('quota','等待系統寄送額度','系統最近 24 小時已寄出 '+job.sent_last_24h+' 封，達到 '+job.daily_limit+' 封上限。','等待額度釋放'+(job.quota_available_at?'（最早 '+reportTime(job.quota_available_at)+'）':'')+'；不要持續建立重複測試。',4,{poll:true,next_retry_at:job.quota_available_at||null});
 if(diag.raw){
  const [reason,advice]=diag.raw.includes('全站外部通知已關閉')?['上次紀錄為外部通知關閉；目前已開啟或開關狀態未知，不能據此判定仍關閉。','請確認目前開關及佇列狀態；若任務已取消，需重新建立測試。']:failure(diag);
  const retry=state==='pending'||!state;
  return result('failed',retry?'寄送失敗，等待重試':'寄送失敗，已停止',reason,advice,3,{poll:retry,next_retry_at:retry?row.next_attempt||null:null});
 }
 if(state==='failed'||state==='expired')return result('stopped',state==='expired'?'任務已過期':'寄送失敗，已停止','此任務已停止，且沒有可用的錯誤紀錄。','請確認寄件設定及信箱，再重新建立測試。',3);
 return result('processing','處理中','已排入寄送佇列，尚無失敗紀錄。','請稍候，背景工作會依序處理；匯出時會重新讀取最新狀態。',4,{poll:true,next_retry_at:row.next_attempt||null});
}
