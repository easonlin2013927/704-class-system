export const themes = [
 {id:'dark',name:'鉛字深灰',description:'深灰紙面、淺色文字與藍墨標記',bg:'#20262a',surface:'#293036',text:'#f4f0e6',accent:'#9dc3df'},
 {id:'light',name:'班務紙本',description:'米白紙張、深色鉛字與藍墨重點',bg:'#f3f0e8',surface:'#fffdf8',text:'#1c2a36',accent:'#24517a'},
 {id:'ocean',name:'海洋藍',description:'淡藍紙面、墨青文字與海藍標記',bg:'#edf3f4',surface:'#fbfdfc',text:'#18313a',accent:'#1d6474'},
 {id:'forest',name:'黑板森林',description:'深綠黑板、粉筆文字與黃色重點',bg:'#172d26',surface:'#1f3930',text:'#f1eee1',accent:'#f0cf72'},
 {id:'rose',name:'玫瑰紙箋',description:'淡粉紙面、深紅文字與玫瑰標記',bg:'#f5eeec',surface:'#fffaf7',text:'#3b292c',accent:'#914b52'},
 {id:'amber',name:'暖陽琥珀',description:'米色紙感、棕墨文字與琥珀標記',bg:'#f4efe3',surface:'#fffdf6',text:'#3a3022',accent:'#76551c'},
 {id:'midnight',name:'午夜墨藍',description:'深藍紙面、暖白文字與天藍標記',bg:'#18212d',surface:'#202c3a',text:'#f3f0e8',accent:'#a8c6e5'},
 {id:'slate',name:'石板藍灰',description:'冷灰底色、清晰白字與霧藍重點',bg:'#273139',surface:'#333f48',text:'#f4f1e9',accent:'#a9c7d4'},
 {id:'notebook',name:'作業簿',description:'橫線紙感、藍墨標題與紅筆批註',bg:'#e9eef1',surface:'#fffef9',text:'#233646',accent:'#315f86'},
 {id:'lavender',name:'薰衣草紙',description:'灰紫紙面、深紫文字與柔紫標記',bg:'#efedf3',surface:'#fbf9fd',text:'#352e43',accent:'#6f5a8d'},
 {id:'brick',name:'紅磚教室',description:'暖灰紙面、磚紅標記與深棕文字',bg:'#eee9e3',surface:'#fffaf3',text:'#3c302b',accent:'#985447'},
 {id:'teal',name:'青墨筆記',description:'淡青紙面、深青文字與青綠標記',bg:'#e7f0ee',surface:'#f9fcfa',text:'#193a38',accent:'#24756c'},
 {id:'mono',name:'黑白講義',description:'純淨灰階、高對比排版與黑色標記',bg:'#ececeb',surface:'#ffffff',text:'#202020',accent:'#3a3a3a'},
];
export function applyTheme(id){document.documentElement.dataset.theme=themes.some(theme=>theme.id===id)?id:'dark';}
export async function prepareAvatar(file){
 if(!['image/png','image/jpeg','image/webp'].includes(file.type))throw new Error('請選擇 PNG、JPEG 或 WebP 圖片');
 if(file.size>400*1024*1024)throw new Error('請選擇 400 MB 以內的圖片');
 let bitmap;
 try{bitmap=await createImageBitmap(file);}catch{throw new Error('無法讀取圖片，請重新選擇');}
 const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;
 const context=canvas.getContext('2d'),side=Math.min(bitmap.width,bitmap.height);
 context.drawImage(bitmap,(bitmap.width-side)/2,(bitmap.height-side)/2,side,side,0,0,256,256);bitmap.close();
 const result=canvas.toDataURL('image/webp',0.85);
 if(result.length>210000)throw new Error('圖片壓縮後仍過大，請換一張圖片');
 return result;
}
