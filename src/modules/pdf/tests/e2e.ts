import type { Suite } from "../../../../tests/context";
import { checkContinuous } from "../../../../tests/continuous";
import { longFixture } from "./longFixture";
const suite: Suite = async (c) => {
  const win = await c.open("document.pdf");
  await c.check(
    win,
    "PDF pages coexist",
    "document.querySelectorAll('.pdf-page').length===2",
  );
  await c.check(win, "PDF painted", "document.querySelector('canvas').width>0");
  win.unmaximize();
  win.setSize(1000, 700);
  await c.pause(250);
  await checkContinuous(c, win, ".pdf-scroll");
  await c.evaluate(
    win,
    "(()=>{const z=document.querySelector('.zoom-control input');z.value='137';z.dispatchEvent(new Event('change',{bubbles:true}))})()",
  );
  await c.check(
    win,
    "custom zoom remains available",
    "document.querySelector('.zoom-control input').value==='137'",
  );
  await c.snapshot(win, "pdf");
  c.close(win);
  longFixture(c.fixture("long-mixed.pdf"));
  const long = await c.open("long-mixed.pdf");
  long.unmaximize();
  long.setSize(1000, 700);
  await c.pause(250);
  await c.check(long, "long PDF first page painted and full page count available",
    "document.querySelectorAll('.pdf-page').length===80 && document.querySelector('canvas').width>0");
  await c.check(long, "mixed page dimensions resolve correctly",
    "(()=>{const p=[...document.querySelectorAll('.pdf-page')];return p.every((e,i)=>Math.abs(parseFloat(e.style.width)/parseFloat(e.style.height)-(i%2?842/595:595/842))<0.01)})()");
  await c.evaluate(long, "(()=>{const p=document.querySelector('.page-nav input');p.value='80';p.dispatchEvent(new Event('change',{bubbles:true}))})()");
  await c.check(long, "long PDF last page renders after jump",
    "document.querySelector('.page-nav input').value==='80' && document.querySelectorAll('canvas')[79].width>0");
  await c.evaluate(long, "(()=>{const z=document.querySelector('.zoom-control input');for(const v of ['125','80','137']){z.value=v;z.dispatchEvent(new Event('input',{bubbles:true}));z.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));}})()");
  await c.check(long, "rapid zoom retains rendered page without errors",
    "document.querySelector('.zoom-control input').value==='137' && [...document.querySelectorAll('canvas')].some(c=>c.width>0) && !document.querySelector('.error')");
  c.close(long);

  // --- Precise search / nav interaction (hit-test chrome after opening panels) ---
  const searchWin = await c.open("document.pdf");
  await c.check(
    searchWin,
    "toolbar buttons hit-test as themselves before search",
    `(()=>{
      const btn=document.querySelector('.pdf-search-toggle');
      if(!btn) return false;
      const r=btn.getBoundingClientRect();
      const el=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);
      return !!(el && (el===btn||btn.contains(el)));
    })()`,
  );
  await c.click(searchWin, ".pdf-search-toggle");
  await c.check(
    searchWin,
    "search bar opens with input and find button",
    "!!document.querySelector('.pdf-search-input') && !!document.querySelector('.pdf-search-go')",
  );
  await c.evaluate(
    searchWin,
    "(()=>{const i=document.querySelector('.pdf-search-input');i.value='Local Preview';i.dispatchEvent(new Event('input',{bubbles:true}))})()",
  );
  await c.click(searchWin, ".pdf-search-go");
  await c.check(
    searchWin,
    "search finds hits and shows count",
    "/\\d+ \\/ \\d+/.test(document.querySelector('.pdf-search-count')?.textContent||'')",
  );
  await c.check(
    searchWin,
    "search marks hit page",
    "!!document.querySelector('.pdf-page.has-hit')",
  );
  // Critical: after search open, toolbar / zoom / nav must still receive clicks.
  await c.check(
    searchWin,
    "toolbar still clickable after search open (hit-test)",
    `(()=>{
      const btn=document.querySelector('.pdf-search-toggle');
      const r=btn.getBoundingClientRect();
      const el=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);
      return !!(el && (el===btn||btn.contains(el)));
    })()`,
  );
  await c.check(
    searchWin,
    "zoom control still clickable after search open",
    `(()=>{
      const btn=document.querySelector('.zoom-control button');
      if(!btn) return false;
      const r=btn.getBoundingClientRect();
      const el=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);
      return !!(el && (el===btn||btn.contains(el)||el.closest('button')===btn));
    })()`,
  );
  await c.click(searchWin, ".pdf-search-go"); // still works
  await c.evaluate(
    searchWin,
    "(()=>{const i=document.querySelector('.pdf-search-input');i.value='zzz-not-in-doc';i.dispatchEvent(new Event('input',{bubbles:true}))})()",
  );
  await c.click(searchWin, ".pdf-search-go");
  await c.check(
    searchWin,
    "empty search shows 无结果",
    "document.querySelector('.pdf-search-count')?.textContent?.includes('无结果')",
  );
  await c.evaluate(
    searchWin,
    "(()=>{const i=document.querySelector('.pdf-search-input');i.value='Local Preview';i.dispatchEvent(new Event('input',{bubbles:true}))})()",
  );
  await c.click(searchWin, ".pdf-search-go");
  await c.click(searchWin, ".pdf-search-bar button", "下一处");
  await c.check(
    searchWin,
    "next hit updates active index",
    "document.querySelector('.pdf-search-count')?.textContent?.includes('/')",
  );

  // Nav panel
  await c.click(searchWin, ".pdf-nav-toggle");
  await c.check(
    searchWin,
    "nav panel opens with tabs",
    "!!document.querySelector('.pdf-nav') && document.querySelectorAll('.pdf-nav-tab').length===2",
  );
  await c.check(
    searchWin,
    "outline empty state when no bookmarks",
    "!!document.querySelector('.pdf-outline') && document.body.innerText.includes('本文档没有目录') || !!document.querySelector('.outline-item')",
  );
  await c.click(searchWin, ".pdf-nav-tab", "缩略图");
  await c.check(
    searchWin,
    "thumbnail tab activates",
    "document.querySelector('.pdf-thumbs') && document.querySelectorAll('.thumb').length===2",
  );
  await c.check(
    searchWin,
    "thumbnail canvas has non-zero size after paint",
    `[...document.querySelectorAll('.thumb canvas')].some(c=>c.width>0&&c.height>0)`,
  );
  await c.check(
    searchWin,
    "toolbar still clickable after nav open",
    `(()=>{
      const btn=document.querySelector('.pdf-search-toggle');
      const r=btn.getBoundingClientRect();
      const el=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);
      return !!(el && (el===btn||btn.contains(el)));
    })()`,
  );
  // Click second thumbnail → page 2
  await c.click(searchWin, ".thumb[data-page='2']");
  await c.check(
    searchWin,
    "thumbnail click jumps to page 2",
    "document.querySelector('.page-nav input').value==='2'",
  );
  await c.click(searchWin, ".pdf-nav-tab", "目录");
  await c.check(
    searchWin,
    "outline tab switches back",
    "!!document.querySelector('.pdf-outline')",
  );
  await c.click(searchWin, ".pdf-nav-tab", "缩略图");
  await c.click(searchWin, ".thumb[data-page='1']");
  await c.check(
    searchWin,
    "thumbnail click jumps back to page 1",
    "document.querySelector('.page-nav input').value==='1'",
  );
  // Page nav still works with search+nav open
  await c.click(searchWin, ".page-nav button", "下一页");
  await c.check(
    searchWin,
    "page next button works with panels open",
    "document.querySelector('.page-nav input').value==='2'",
  );
  await c.snapshot(searchWin, "pdf-search-nav");
  c.close(searchWin);
};
export default suite;
