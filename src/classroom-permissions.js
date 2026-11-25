import {cloud} from './cloud.js';

const labels={honors:'段考英雄榜編輯與公布',board_manage:'班級留言板管理（刪除他人留言）',board_reply:'班級留言板回覆'};

export async function mountClassroomPermissions(node,notify){
 node.innerHTML='<h2>班級工具權限</h2><p>可分別授權學生與小老師。留言板管理不包含移動他人的便利貼。</p><label>選擇帳號<select id="classroom-permission-account"><option value="">請選擇帳號</option></select></label><form hidden><div class="permission-grid"></div><button class="secondary-button" type="submit">儲存班級工具權限</button></form><p role="status"></p>';
 const select=node.querySelector('select'),form=node.querySelector('form'),fields=form.querySelector('div'),message=node.querySelector('[role="status"]');let revision=0;
 select.onchange=async()=>{
  const current=++revision,id=select.value;form.hidden=true;fields.replaceChildren();message.textContent='';if(!id)return;
  message.textContent='正在讀取權限…';
  try{const value=await cloud.school('permissions/'+id);if(current!==revision||!node.isConnected)return;
   for(const [key,label] of Object.entries(labels)){const row=document.createElement('label'),input=document.createElement('input');row.className='check-option';input.type='checkbox';input.name=key;input.checked=value.permissions[key]===true;row.append(input,document.createTextNode(label));fields.append(row);}
   form.hidden=false;message.textContent='';
  }catch(error){if(current===revision)message.textContent=error.message;}
 };
 form.onsubmit=async event=>{
  event.preventDefault();const button=form.querySelector('button'),id=select.value,body=Object.fromEntries(Object.keys(labels).map(key=>[key,form.elements[key].checked]));button.disabled=true;select.disabled=true;
  try{await cloud.school('permissions/'+id,'PUT',body);message.textContent='權限已儲存，該使用者重新整理頁面後生效。';notify('班級工具權限已更新');}
  catch(error){message.textContent=error.message;}finally{button.disabled=false;select.disabled=false;}
 };
 try{const accounts=await cloud.school('permission-accounts');if(!node.isConnected)return;for(const account of accounts)select.add(new Option(`${account.display_name}（${account.role==='assistant'?'小老師':'學生'}）`,account.id));}
 catch(error){message.textContent=error.message;}
}
