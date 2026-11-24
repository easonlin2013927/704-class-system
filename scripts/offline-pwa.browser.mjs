async(page)=>{
 const check=(value,message)=>{if(!value)throw Error(message);};
 await page.setViewportSize({width:1280,height:900});
 await page.addInitScript(()=>{
  const params=new URL(location.href).searchParams;
  let mode=params.get('display')||'browser',online=true,ios=params.has('ios');
  const native=matchMedia.bind(window),queries=new Map();
  Object.defineProperty(navigator,'onLine',{configurable:true,get:()=>online});
  Object.defineProperty(navigator,'standalone',{configurable:true,get:()=>ios});
  window.matchMedia=query=>{
   if(!query.startsWith('(display-mode:'))return native(query);
   if(!queries.has(query)){
    const listeners=new Set(),item={media:query,get matches(){return query===`(display-mode: ${mode})`;},addListener:fn=>listeners.add(fn)};
    if(!params.has('legacy'))item.addEventListener=(event,fn)=>{if(event==='change')listeners.add(fn);};
    queries.set(query,{item,listeners});
   }
   return queries.get(query).item;
  };
  window.setPwaMode=value=>{mode=value;for(const {item,listeners} of queries.values())for(const fn of listeners)fn({matches:item.matches,media:item.media});};
  window.setIosPwa=()=>{ios=true;dispatchEvent(new Event('pageshow'));};
  window.setTestOnline=value=>{online=value;dispatchEvent(new Event(value?'online':'offline'));};
  window.sawInstallGate=false;
  new MutationObserver(()=>{if(document.querySelector('.install-gate'))window.sawInstallGate=true;}).observe(document,{childList:true,subtree:true});
 });
 let lookups=0;
 await page.route('http://pwa704.test/**',async route=>{
  const url=new URL(route.request().url()),path=url.pathname;
  if(path.startsWith('/preview-api/')){
   let body={ok:true},status=200;
   if(path==='/preview-api/me'){lookups++;body={id:'fixture-student',role:'student',display_name:'PWA Student',theme:'dark'};}
   else if(path==='/preview-api/school/permissions')body={permissions:{}};
   else if(path==='/preview-api/school/preferences')body={favorites:[]};
   else if(path==='/preview-api/school/mailboxes')body=[{verified:true}];
   else if(path==='/preview-api/announcements'||path==='/preview-api/countdowns'||path==='/preview-api/school/records')body=[];
   else if(path==='/preview-api/public/banner')body={enabled:false,content:'',marqueeEnabled:false,marquee:''};
   else if(path==='/preview-api/public/auth-config')body={firebase:{enabled:false}};
   return route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
  }
  const response=await page.request.fetch('http://127.0.0.1:4173'+path+url.search,{method:route.request().method()});
  await route.fulfill({response});
 });
 let scenario=0;
 const open=(query='')=>page.goto('http://pwa704.test/?app=student&test='+(++scenario)+query);
 await open('&source=pwa');
 await page.locator('.install-gate').waitFor({state:'visible'});
 check(lookups===0,'Ordinary browser must not start authenticated PWA flow');
 await page.evaluate(()=>dispatchEvent(new Event('appinstalled')));
 check(await page.locator('.install-gate').count()===1,'Installing alone must not turn the original browser tab into an app');
 await page.evaluate(()=>setPwaMode('standalone'));
 await page.locator('.topbar').waitFor({state:'visible'});
 check(lookups===1,'Browser-to-app transition must restore the session once');
 await page.evaluate(()=>{setPwaMode('browser');dispatchEvent(new Event('pageshow'));});
 check(await page.locator('.install-gate').count()===0,'A confirmed app window must not flap back to install gate');
 check(lookups===1,'Display events must not repeat login restoration');

 for(const mode of ['standalone','minimal-ui','window-controls-overlay','fullscreen']){
  await open('&display='+mode);
  await page.locator('.topbar').waitFor({state:'visible'});
  check(!await page.evaluate(()=>sawInstallGate),'No install gate in '+mode);
 }
 await open('&ios=1');await page.locator('.topbar').waitFor({state:'visible'});
 check(!await page.evaluate(()=>sawInstallGate),'iOS standalone must enter app');
 await open('&legacy=1');await page.locator('.install-gate').waitFor({state:'visible'});
 await page.evaluate(()=>setPwaMode('minimal-ui'));await page.locator('.topbar').waitFor({state:'visible'});
 await open();await page.locator('.install-gate').waitFor({state:'visible'});
 await page.evaluate(()=>setIosPwa());await page.locator('.topbar').waitFor({state:'visible'});

 await open('&display=standalone');await page.locator('.topbar').waitFor({state:'visible'});
 await page.evaluate(()=>setTestOnline(true));
 await page.waitForFunction(()=>document.documentElement.dataset.connectivity==='online');
 await page.locator('#search').fill('keep offline search');
 await page.evaluate(()=>{document.documentElement.dataset.theme='ocean';setTestOnline(false);});
 await page.locator('#offline-screen').waitFor({state:'visible'});
 check(await page.locator('#app').evaluate(node=>node.inert),'Offline app must be inert');
 const colors=await page.evaluate(()=>{
  const keys=['backgroundColor','color','borderTopColor'];
  return ['#offline-screen','.offline-card','.offline-eyebrow','.offline-status','#offline-retry'].flatMap(selector=>keys.map(key=>getComputedStyle(document.querySelector(selector))[key]));
 });
 for(const color of colors){const channels=color.match(/[\d.]+/g)?.slice(0,3);if(channels)check(channels[0]===channels[1]&&channels[1]===channels[2],'Offline color must be grayscale: '+color);}
 check(await page.locator('.offline-card').evaluate(node=>getComputedStyle(node).boxShadow==='none'),'Offline card must not use colored shadow');
 check(await page.locator('.offline-logo').evaluate(node=>node.tagName.toLowerCase()==='svg'&&node.getAttribute('stroke')==='currentColor'),'Offline symbol must use monochrome lines');
 for(const width of [1440,768,390,320]){
  await page.setViewportSize({width,height:width===320?568:844});
  const bounds=await page.locator('.offline-card').boundingBox();
  check(bounds.x>=0&&bounds.x+bounds.width<=width+1,'Offline panel fits '+width);
  check(bounds.y>=0,'Offline panel remains scrollable from its top at '+width);
 }
 await page.setViewportSize({width:390,height:844});
 await page.screenshot({path:'.taste-skill/offline-monochrome-mobile.png'});
 await page.evaluate(()=>setTestOnline(true));
 await page.locator('#offline-screen').waitFor({state:'hidden'});
 check(await page.locator('#app').evaluate(node=>!node.inert),'Online app must become interactive');
 check(await page.locator('#search').inputValue()==='keep offline search','Recovery preserves the original view');
 return 'Offline/PWA checks passed: ordinary tab, display modes, transition, sticky app context, iOS, legacy events, grayscale, mobile and offline recovery';
}
