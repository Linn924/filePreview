import { app, nativeImage, BrowserWindow, type WebContents } from 'electron';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import type { Suite } from '../../../../tests/context';
import { performanceFixture } from './performanceFixture';
import { longFixture } from './longFixture';

const median=(values:number[])=>[...values].sort((a,b)=>a-b)[Math.floor(values.length/2)];
const suite: Suite = async c => {
  const out=path.resolve('outputs/bench');mkdirSync(out,{recursive:true});
  const phase=process.env.FILE_PREVIEW_PERF_PHASE || 'after';
  const only=process.env.FILE_PREVIEW_PERF_SCENARIO;
  performanceFixture(c.fixture('perf-invoice.pdf'),'invoice');
  performanceFixture(c.fixture('perf-dense.pdf'),'dense');
  longFixture(c.fixture('perf-long.pdf'),500);
  const jpg=nativeImage.createFromPath(c.fixture('image.png')).resize({width:1400,height:2000}).toJPEG(90);
  performanceFixture(c.fixture('perf-scan.pdf'),'scan',jpg);
  c.program.updateSettings({multiFileMode:'tabs'});
  const printTimes:number[]=[];
  const intercept=(_event:Electron.Event,wc:WebContents)=>{
    // Benchmark active reading deterministically even when the chat covers the window.
    wc.setBackgroundThrottling(false);
    let started=performance.now();wc.on('did-start-loading',()=>{started=performance.now();});
    wc.getPrintersAsync=async()=>[{name:'perf-printer',displayName:'performance test',description:'mock',options:{}}];
    wc.print=(_options,callback)=>{printTimes.push(Math.round(performance.now()-started));callback?.(true,'');};
  };
  app.on('web-contents-created',intercept);
  const records: Array<{scenario:string;openMedianMs:number;switchMedianMs?:number;zoomMs?:number;searchMs?:number;printMedianMs?:number;peakWorkingSetMB:number;idleWorkingSetMB:number;closedWorkingSetMB:number}> = [];
  const totalMemory=()=>app.getAppMetrics().reduce((n,p)=>n+p.memory.workingSetSize,0)/1024;
  try { for(const scenario of ['invoice-50','long-500','scan-12','dense-20','windows-6','print-10']) {
    if(only&&scenario!==only)continue;
    // Print baseline was measured in a fresh test process; match that isolation.
    if(!only&&scenario==='print-10')continue;
    await c.pause(300);
    const idleWorkingSetMB=totalMemory();let peak=idleWorkingSetMB;
    const sampler=setInterval(()=>{peak=Math.max(peak,totalMemory());},50);
    const wins: import('electron').BrowserWindow[]=[];
    const opens:number[]=[],switches:number[]=[];
    let zoomMs:number|undefined,searchMs:number|undefined,printMedianMs:number|undefined;
    try {
      const file=scenario==='scan-12'?'perf-scan.pdf':scenario==='dense-20'?'perf-dense.pdf':scenario==='long-500'?'perf-long.pdf':'perf-invoice.pdf';
      const start=performance.now();
      if(scenario==='invoice-50'||scenario==='windows-6'||scenario==='print-10')
        wins.push(...await c.program.openPaths(Array(scenario==='invoice-50'?50:scenario==='print-10'?10:6).fill(c.fixture(file)),scenario==='windows-6'?'windows':'tabs'));
      else wins.push(await c.program.openPaths([c.fixture(file)],'tabs').then(w=>w[0]));
      for(const win of wins)await c.check(win,scenario+' first bitmap',"(()=>{const tab=[...document.querySelectorAll('.preview-tab')].find(t=>getComputedStyle(t).display!=='none');return !!tab&&!tab.querySelector('.loading')&&[...tab.querySelectorAll('.pdf-page canvas')].some(c=>c.width>0)})()");
      opens.push(Math.round(performance.now()-start));
      const win=wins[0];
      if(scenario==='invoice-50') {
        for(const index of [...Array(50).keys(),0,25,49,0,25,49]) {
          const t=performance.now();await c.evaluate(win,`document.querySelectorAll('.tab')[${index}].click()`);
          try { await c.check(win,'invoice tab '+index,"(()=>{const tab=[...document.querySelectorAll('.preview-tab')].find(t=>getComputedStyle(t).display!=='none');return !!tab&&!tab.querySelector('.loading')&&[...tab.querySelectorAll('.pdf-page canvas')].some(c=>c.width>0)})()"); }
          catch(error){console.log('PDF stalled stage',await c.evaluate(win,"JSON.stringify({queue:document.documentElement.dataset.pdfQueue,stage:[...document.querySelectorAll('.preview-tab')].filter(t=>getComputedStyle(t).display!=='none').map(t=>({stage:t.querySelector('.pdf-scroll')?.dataset.pdfStage,canvases:[...t.querySelectorAll('canvas')].map(c=>[c.width,c.height])}))})"));throw error;}
          switches.push(Math.round(performance.now()-t));
        }
      }
      if(scenario==='long-500') {
        for(const page of [250,500,1,250,500,1]) {
          const t=performance.now();await c.evaluate(win,`(()=>{const p=document.querySelector('.page-nav input');p.value='${page}';p.dispatchEvent(new Event('change',{bubbles:true}))})()`);
          await c.check(win,'long page '+page,`document.querySelector('.pdf-page[data-page="${page-1}"] canvas')?.width>0`);
          switches.push(Math.round(performance.now()-t));
        }
      }
      const zStart=performance.now();
      await c.evaluate(win,"(()=>{const z=document.querySelector('.zoom-control input');z.value='137';z.dispatchEvent(new Event('input',{bubbles:true}));z.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}))})()");
      await c.pause(250);
      await c.check(win,scenario+' zoom remains painted',"[...document.querySelectorAll('.pdf-page canvas')].some(c=>c.width>0)&&!document.querySelector('.error')");
      zoomMs=Math.round(performance.now()-zStart);
      if(scenario==='dense-20') {
        await c.click(win,'.pdf-search-toggle');
        await c.evaluate(win,"(()=>{const i=document.querySelector('.pdf-search-input');i.value='invoice';i.dispatchEvent(new Event('input',{bubbles:true}))})()");
        const t=performance.now();await c.click(win,'.pdf-search-go');
        await c.check(win,'dense search complete',"!document.querySelector('.pdf-search-go').disabled&&document.querySelector('.pdf-search-count').textContent.includes('20000')");
        searchMs=Math.round(performance.now()-t);
      }
      if(scenario==='print-10') {
        c.program.updateSettings({printEntry:'all'});
        await c.click(win,'.pdf-print-button');
        let panel:BrowserWindow|undefined;
        for(let i=0;i<50&&!panel;i++){panel=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().includes('print-panel=1'));if(!panel)await c.pause(40);}
        if(!panel)throw Error('Print panel did not become available');wins.push(panel);
        await c.check(panel,'ten print jobs ready',"document.querySelectorAll('.print-files li').length===10&&!document.querySelector('.print-go').disabled");
        await c.click(panel,'.print-go');
        const deadline=Date.now()+60000;
        while(!await c.evaluate<boolean>(panel,"[...document.querySelectorAll('.print-files li')].every(row=>row.textContent.includes('已提交到系统队列'))")) {
          if(Date.now()>deadline)throw Error('Ten print jobs did not finish within 60 seconds');
          await c.pause(100);
        }
        c.pass('ten print jobs submitted');
        assert.equal(printTimes.length,10);printMedianMs=median(printTimes);
      }
      peak=Math.max(peak,totalMemory());
    } finally { for(const win of wins)c.close(win);clearInterval(sampler); }
    await c.pause(1800);
    records.push({scenario,openMedianMs:median(opens),switchMedianMs:switches.length?median(switches):undefined,zoomMs,searchMs,printMedianMs,peakWorkingSetMB:Math.round(peak*10)/10,idleWorkingSetMB:Math.round(idleWorkingSetMB*10)/10,closedWorkingSetMB:Math.round(totalMemory()*10)/10});
  } } finally { app.removeListener('web-contents-created',intercept); }
  const result={phase,at:new Date().toISOString(),records,note:'Synthetic fixtures; 50ms samples of summed Electron process working sets. Open one scenario run, switch median, zoom includes 250ms settle wait. Not precise GPU allocation or universal speed claim.'};
  if(only&&existsSync(path.join(out,'pdf-chain-'+phase+'.json'))) {
    const previous=JSON.parse(readFileSync(path.join(out,'pdf-chain-'+phase+'.json'),'utf8')) as typeof result;
    result.records=[...previous.records.filter(r=>!records.some(current=>current.scenario===r.scenario)),...records];
  }
  writeFileSync(path.join(out,'pdf-chain-'+phase+'.json'),JSON.stringify(result,null,2));
  c.pass('PDF chain performance '+JSON.stringify(records));
  if(phase==='after'&&existsSync(path.join(out,'pdf-chain-before.json'))) {
    const baseline=JSON.parse(readFileSync(path.join(out,'pdf-chain-before.json'),'utf8')) as typeof result;
    for(const record of records) {
      const before=baseline.records.find(r=>r.scenario===record.scenario)!;
      assert.ok(record.peakWorkingSetMB<=before.peakWorkingSetMB*1.25+64,'memory regression '+record.scenario);
      for(const field of ['openMedianMs','switchMedianMs','zoomMs','searchMs','printMedianMs'] as const)
        if(record[field]!==undefined&&before[field]!==undefined)
          assert.ok(record[field]!<=before[field]!*1.3+100,'latency regression '+record.scenario+' '+field);
    }
    c.pass('PDF performance regression thresholds satisfied');
  }
};
export default suite;
