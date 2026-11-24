export const pwaDisplayModes=['standalone','minimal-ui','window-controls-overlay','fullscreen'];

export function isAppWindow(context=globalThis){
 return context.navigator.standalone===true||pwaDisplayModes.some(mode=>context.matchMedia(`(display-mode: ${mode})`).matches);
}
