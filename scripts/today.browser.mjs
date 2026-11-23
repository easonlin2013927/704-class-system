async (page)=>{
 const check=(value,message)=>{if(!value)throw Error(message);};
 await page.route('**/__today-test',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><script type="importmap">{"imports":{"dompurify":"/vendor/dompurify.js"}}</script></head><body><main id="today-test"></main></body></html>'}));
 await page.goto('http://127.0.0.1:4173/__today-test');
 const cdp=await page.context().newCDPSession(page); await cdp.send('Emulation.setTimezoneOverride',{timezoneId:'America/Los_Angeles'});
 const result=await page.evaluate(async()=>{
  const {mountSchool}=await import('/src/school.js'),{cloud}=await import('/src/cloud.js');
  const node=document.querySelector('#today-test'),navigation=[];
  let announcement=null,fail=false;
  window.addEventListener('open-announcement',e=>announcement=e.detail);
  cloud.school=async()=>{if(fail)throw Error('Test API unavailable');return {date:'2026-11-22T16:01:00Z',day:'2026-11-23',unread:3,announcements:[{id:'post',title:'<img src=x onerror=alert(1)>',category:'academic'}],activities:[{title:'Class meeting',target_at:'2026-11-23T01:00:00Z'}],homework:[{title:'Math',subject:'Math',due_on:'2026-11-23',done:true}],records:[{title:'Missing work',kind:'missing',resolved:false,student:'Student'}]};};
  const mount=user=>mountSchool({node,user,view:'today',notify:()=>{},navigate:view=>navigation.push(view)});
  await mount({role:'student',id:'student'});
  const studentText=node.textContent;
  const safe=!node.querySelector('img');
  node.querySelector('[data-announcement]').click();
  for(const target of ['homework','records','notifications'])node.querySelector(`[data-today-go="${target}"]`).click();
  await mount({role:'assistant',id:'assistant',permissions:{}});
  const restrictedText=node.textContent;
  await mount({role:'teacher',id:'teacher',permissions:{homework:true,records:true}});
  const teacherText=node.textContent;
  fail=true;await mount({role:'student',id:'student'});
  const errorText=node.textContent;
  fail=false;node.querySelector('[data-today-retry]').click();
  await new Promise(resolve=>setTimeout(resolve,0));
  return {studentText,safe,announcement,navigation,restrictedText,teacherText,errorText,recovered:node.textContent};
 });
 check(result.studentText.includes('11月23日'),'Taipei date must ignore browser timezone');
 check(result.studentText.includes('今天截止')&&result.studentText.includes('已完成'),'Homework date and status');
 check(result.studentText.includes('課務公告')&&result.studentText.includes('3 則未讀'),'Category and unread labels');
 check(result.safe,'Announcement titles must be escaped');
 check(result.announcement==='post','Announcement click must open detail');
 check(result.navigation.join(',')==='homework,records,notifications','Cards must navigate');
 check(!result.restrictedText.includes('作業與期限')&&!result.restrictedText.includes('班級紀錄'),'Unauthorized sections hidden');
 check(result.teacherText.includes('班級紀錄')&&result.teacherText.includes('Student'),'Staff records available');
 check(result.errorText.includes('Test API unavailable')&&result.errorText.includes('重新載入'),'Recoverable API error');
 check(result.recovered.includes('今日公告'),'Retry must recover');
 console.log('Today browser checks passed: date, permissions, escaping, navigation, retry');
}
