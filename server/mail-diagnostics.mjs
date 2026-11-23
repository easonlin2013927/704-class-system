export function mailFailure(error,now=new Date()){
 const code=/^[A-Z][A-Z0-9_]{0,39}$/.test(error?.code||'')?error.code:'ESEND';
 const smtp=/^[245]\d{2}$/.test(String(error?.responseCode||''))?Number(error.responseCode):null;
 const enhanced=String(error?.response||'').match(/\b([245]\.\d{1,3}\.\d{1,3})\b/)?.[1]||'';
 const hint=/daily.{0,40}(?:limit|quota)|sending limit exceeded/i.test(String(error?.response||''))?'daily_limit':'';
 const command=String(error?.command||'').match(/^[A-Z]+/)?.[0]||'';
 return JSON.stringify({code,smtp,enhanced,hint,command:['AUTH','CONN','EHLO','HELO','MAIL','RCPT','DATA','STARTTLS'].includes(command)?command:'',at:new Date(now).toISOString()});
}
