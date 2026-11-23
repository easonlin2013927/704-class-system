import {cloud} from './cloud.js';
import {exportMailTest} from './broadcast.js?v=0.27.1';
import {mailReport} from './mail-status.js';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const role={student:'學生',teacher:'教師',assistant:'小老師',admin:'管理員'};
const reportRows=job=>job.rows.map(x=>({...x,...mailReport(x,job),role_label:role[x.role]||x.role}));
export function mountMailTest(host){host.innerHTML=`<h2>測試郵件</h2><p>向所有已啟用帳號的可用信箱寄送測試郵件。寄件服務接受不代表已進入收件匣；未驗證的信箱不會寄出。</p><button class="secondary-button" type="button" data-test-send>發送測試郵件</button><p data-test-message role="status"></p><div data-test-table></div>`;let timer;const msg=host.querySelector('[data-test-message]'),table=host.querySelector('[data-test-table]');
 async function refresh(id){try{const job=await cloud.school('mail-tests/'+id);if(!host.isConnected)return;const rows=reportRows(job);msg.textContent='建立時間：'+new Date(job.created_at).toLocaleString('zh-TW')+'　｜　'+rows.length+' 筆收件資料';table.innerHTML='<button type="button" class="secondary-button" data-test-export>匯出 Excel</button>';table.querySelector('[data-test-export]').onclick=async event=>{const button=event.currentTarget;button.disabled=true;try{const latest=await cloud.school('mail-tests/'+id);if(host.isConnected)exportMailTest(latest,reportRows(latest));}catch(error){if(host.isConnected)msg.textContent=error.message;}finally{button.disabled=false;}};if(rows.some(x=>x.poll))timer=setTimeout(()=>refresh(id),4000);}catch(e){if(host.isConnected)msg.textContent=e.message;}}
 host.querySelector('[data-test-send]').onclick=async e=>{e.currentTarget.disabled=true;clearTimeout(timer);try{const job=await cloud.school('mail-tests','POST',{});await refresh(job.id);}catch(error){msg.textContent=error.message;}finally{e.currentTarget.disabled=false;}};
 cloud.school('mail-test-latest').then(job=>{if(job?.id&&host.isConnected)refresh(job.id);}).catch(e=>{if(host.isConnected)msg.textContent=e.message;});
}
