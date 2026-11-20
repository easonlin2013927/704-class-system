export const themes = [{id:'dark',name:'曜石工作台',description:'全站統一使用墨黑介面、黑白細線與暖白文字',bg:'#000000',surface:'#0a0a0c',text:'#fcfdff',accent:'#fcfdff'}];
export function applyTheme(){document.documentElement.dataset.theme='dark';}
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
