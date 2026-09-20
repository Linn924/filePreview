import {writeFileSync} from 'node:fs';
import type {Suite} from '../context';

/** Real Electron layout matrix. Audit mode records before images without enforcing new rules. */
const suite:Suite=async c=>{
 const audit=process.env.FILE_PREVIEW_VISUAL_AUDIT==='1';
 const measurements:unknown[]=[];
 c.program.updateSettings({maximizePreview:false});
 try{
  for(const name of ['document.pdf','document.docx','styled.xlsx','presentation.pptx','vector.svg','readme.md','data.json']){
   const win=await c.open(name);win.setMinimumSize(520,380);
   for(const theme of ['light','dark'] as const){
    c.program.updateSettings({theme});win.setContentSize(960,640);win.webContents.setZoomFactor(1.25);await c.pause(180);
    if(name==='document.pdf')await c.click(win,'.pdf-search-toggle');
    if(name==='data.json')await c.click(win,'.text-search-toggle');
    const metrics=await c.evaluate(win,`(()=>{const bar=document.querySelector('.actbar');const rect=bar.getBoundingClientRect();const controls=[...bar.querySelectorAll('button,input,select')].filter(el=>el.getClientRects().length);return {width:innerWidth,height:innerHeight,barHeight:rect.height,barOverflow:bar.scrollWidth-bar.clientWidth,clipped:controls.filter(el=>{const r=el.getBoundingClientRect();return r.left<0||r.right>innerWidth||r.bottom>rect.bottom+1}).map(el=>el.getAttribute('aria-label')||el.textContent.trim()),excelMargin:document.querySelector('.excel')?getComputedStyle(document.querySelector('.excel')).margin:null}})()`);
    measurements.push({name,theme,metrics});
    await c.snapshot(win,`visual-${audit?'before':'after'}-${name.replace('.','-')}-${theme}`);
    if(!audit){
     await c.check(win,`${name} ${theme}: actions stay visible at 125%`,`(()=>{const bar=document.querySelector('.actbar');return bar.scrollWidth<=bar.clientWidth+1&&[...bar.querySelectorAll('button,input,select')].filter(el=>el.getClientRects().length).every(el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1&&r.bottom<=bar.getBoundingClientRect().bottom+1})})()`);
     await c.check(win,`${name} ${theme}: content remains usable`,`document.querySelector('.preview-tab').clientHeight-document.querySelector('.actbar').clientHeight-document.querySelector('.idbar').clientHeight>200`);
    }
    if(name==='document.pdf')await c.click(win,'.pdf-search-toggle');
    if(name==='data.json')await c.click(win,'.text-search-toggle');
   }
   c.close(win);
  }
 }finally{c.program.updateSettings({maximizePreview:true,theme:'light'});}
 writeFileSync(`outputs/verification/visual-${audit?'before':'after'}.json`,JSON.stringify(measurements,null,2));
};export default suite;
