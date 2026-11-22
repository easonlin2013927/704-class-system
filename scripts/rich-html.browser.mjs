async page => {
  const result=await page.evaluate(async()=>{
    const {sanitizeHtml,stripHtml}=await import('/src/rich-html.js');
    const check=(value,message)=>{if(!value)throw Error(message);};
    const attacks=[
      '<img src=x onerror="window.__xssProbe++">',
      '<svg onload="window.__xssProbe++"><a xlink:href="javascript:window.__xssProbe++">x</a></svg>',
      '<a href="java&#x73;cript:window.__xssProbe++">x</a>',
      '<iframe srcdoc="<script>parent.__xssProbe++</script>"></iframe>',
      '<math><mtext><table><mglyph><style><!--</style><img title="--><img src=x onerror=window.__xssProbe++>">',
      '<form id="output"><input name="innerHTML"><script>window.__xssProbe++</script></form>',
      '<span style="background-image:url(https://invalid.example/probe);position:fixed" onclick="window.__xssProbe++">text</span>',
    ];
    window.__xssProbe=0;
    const host=document.createElement('div');document.body.append(host);
    try{
      for(const input of attacks){
        host.innerHTML=sanitizeHtml(input);
        check(!host.querySelector('script,svg,math,iframe,form,input'),'Dangerous element survived');
        for(const element of host.querySelectorAll('*'))for(const attribute of element.attributes)check(!/^on/i.test(attribute.name)&&!/^javascript:/i.test(attribute.value),'Dangerous attribute survived');
        stripHtml(input);
      }
      const text=stripHtml('<b>hello</b><img src=x onerror="window.__xssProbe++">');
      check(text==='hello','Plain text extraction changed');
      host.innerHTML=sanitizeHtml('<h2>Title</h2><strong>bold</strong><mark style="background-color:yellow">note</mark> https://example.com <img src="data:image/png;base64,aGVsbG8=">');
      check(host.querySelector('h2')?.textContent==='Title'&&host.querySelector('strong'),'Rich formatting lost');
      check(host.querySelector('a')?.rel==='noopener noreferrer','Link protection lost');
      check(host.querySelector('mark')?.style.backgroundColor==='yellow','Highlight lost');
      check(host.querySelector('img')?.src.startsWith('data:image/png;base64,'),'Pasted image lost');
      await new Promise(resolve=>setTimeout(resolve,50));
      check(window.__xssProbe===0,'Payload executed');
      return {payloads:attacks.length,formatting:'pass',links:'pass',images:'pass',scriptExecution:'blocked'};
    }finally{host.remove();delete window.__xssProbe;}
  });
  return result;
}
