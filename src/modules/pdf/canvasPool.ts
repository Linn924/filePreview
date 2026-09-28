import { watch } from 'vue';
import { pdfResources } from './resources';
type Entry={canvas:HTMLCanvasElement;temporary:boolean};
const canvases = new Map<HTMLCanvasElement,Entry>();
const pixels=(canvas:HTMLCanvasElement)=>canvas.width*canvas.height;
function publish() {
  if(typeof document==='undefined')return;
  const value=pdfCanvasStats();
  document.documentElement.dataset.pdfCanvasPixels=String(value.pixels);
  document.documentElement.dataset.pdfCanvasBudget=String(value.budget);
}
export function releasePdfCanvas(canvas:HTMLCanvasElement) { canvases.delete(canvas);canvas.width=0;canvas.height=0;publish(); }
function prune() {
  for(const entry of canvases.values()) {
    if(entry.temporary)continue;
    const tab=entry.canvas.closest<HTMLElement>('.preview-tab');
    if(!entry.canvas.isConnected||(tab&&getComputedStyle(tab).display==='none'))releasePdfCanvas(entry.canvas);
  }
}
export function pdfCanvasStats() { return {count:canvases.size,pixels:[...canvases.keys()].reduce((n,c)=>n+pixels(c),0),budget:pdfResources.value.pixels}; }
export function availablePdfPixels(canvas?:HTMLCanvasElement) {
  prune();return Math.max(0,pdfResources.value.pixels-pdfCanvasStats().pixels+(canvas&&canvases.has(canvas)?pixels(canvas):0));
}
export function allocatePdfCanvas(canvas:HTMLCanvasElement,width:number,height:number,temporary=false) {
  if(width*height>availablePdfPixels(canvas))return false;
  canvas.width=width;canvas.height=height;canvases.set(canvas,{canvas,temporary});publish();return true;
}
watch(pdfResources,()=>{
  prune();
  for(const entry of canvases.values()) {
    if(pdfCanvasStats().pixels<=pdfResources.value.pixels)break;
    if(!entry.temporary)releasePdfCanvas(entry.canvas);
  }
  publish();
});
