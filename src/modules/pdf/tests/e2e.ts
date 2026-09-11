import type { Suite } from "../../../../tests/context";
const suite: Suite = async (c) => {
  const win = await c.open("document.pdf");
  await c.check(
    win,
    "PDF nonblank pixels",
    "(()=>{const c=document.querySelector('canvas');return c.width>0&&c.getContext('2d').getImageData(0,0,c.width,c.height).data.some((v,i)=>i%4!==3&&v<150)})()",
  );
  await c.wheel(win, ".pdf-scroll", 120);
  await c.check(
    win,
    "outside wheel changes PDF page",
    "document.querySelector('.page-nav input').value==='2'",
  );
  await c.wheel(win, "canvas", -120);
  await c.check(
    win,
    "inside wheel zoom synchronized",
    "document.querySelector('.zoom-control input').value==='110'",
  );
  await c.evaluate(
    win,
    "(()=>{const z=document.querySelector('.zoom-control input');z.value='137';z.dispatchEvent(new Event('change',{bubbles:true}))})()",
  );
  await c.check(
    win,
    "custom PDF zoom",
    "document.querySelector('.zoom-control input').value==='137'",
  );
  await c.snapshot(win, "pdf");
  c.close(win);
};
export default suite;
