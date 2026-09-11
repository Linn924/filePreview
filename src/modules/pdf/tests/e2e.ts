import type { Suite } from "../../../../tests/context";
import { checkContinuous } from "../../../../tests/continuous";
const suite: Suite = async (c) => {
  const win = await c.open("document.pdf");
  await c.check(
    win,
    "PDF pages coexist",
    "document.querySelectorAll('.pdf-page').length===2",
  );
  await c.check(win, "PDF painted", "document.querySelector('canvas').width>0");
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
};
export default suite;
