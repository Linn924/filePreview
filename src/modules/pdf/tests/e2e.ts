import type { Suite } from "../../../../tests/context";
import { checkContinuous } from "../../../../tests/continuous";
import { longFixture } from './longFixture';
const suite: Suite = async (c) => {
  const win = await c.open("document.pdf");
  await c.check(
    win,
    "PDF pages coexist",
    "document.querySelectorAll('.pdf-page').length===2",
  );
  await c.check(win, "PDF painted", "document.querySelector('canvas').width>0");
  // Fix the viewport: on tall monitors both short fixture pages otherwise fit.
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
  longFixture(c.fixture('long-mixed.pdf'));
  const long = await c.open('long-mixed.pdf');
  long.unmaximize();
  long.setSize(1000, 700);
  await c.pause(250);
  await c.check(long, 'long PDF first page painted and full page count available',
    "document.querySelectorAll('.pdf-page').length===80 && document.querySelector('canvas').width>0");
  await c.check(long, 'mixed page dimensions resolve correctly',
    "(()=>{const p=[...document.querySelectorAll('.pdf-page')];return p.every((e,i)=>Math.abs(parseFloat(e.style.width)/parseFloat(e.style.height)-(i%2?842/595:595/842))<0.01)})()");
  await c.evaluate(long, "(()=>{const p=document.querySelector('.page-nav input');p.value='80';p.dispatchEvent(new Event('change',{bubbles:true}))})()");
  await c.check(long, 'long PDF last page renders after jump',
    "document.querySelector('.page-nav input').value==='80' && document.querySelectorAll('canvas')[79].width>0");
  await c.evaluate(long, "(()=>{const z=document.querySelector('.zoom-control input');for(const v of ['125','80','137']){z.value=v;z.dispatchEvent(new Event('input',{bubbles:true}));z.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));}})()");
  await c.check(long, 'rapid zoom retains rendered page without errors',
    "document.querySelector('.zoom-control input').value==='137' && [...document.querySelectorAll('canvas')].some(c=>c.width>0) && !document.querySelector('.error')");
  c.close(long);
};
export default suite;
