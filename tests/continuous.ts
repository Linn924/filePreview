import type { TestContext } from "./context";
import type { BrowserWindow } from "electron";
export async function checkContinuous(
  c: TestContext,
  win: BrowserWindow,
  selector: string,
) {
  const point = await c.evaluate<{ x: number; y: number }>(
    win,
    `(()=>{const r=document.querySelector('${selector}').getBoundingClientRect();return{x:r.left+Math.min(150,r.width/2),y:r.top+100}})()`,
  );
  win.show();
  win.focus();
  win.webContents.debugger.attach("1.3");
  try {
    await win.webContents.debugger.sendCommand("Input.dispatchMouseEvent", {
      type: "mouseWheel",
      x: point.x,
      y: point.y,
      deltaX: 0,
      deltaY: 180,
    });
    await c.pause(500);
  } finally {
    win.webContents.debugger.detach();
  }
  await c.check(
    win,
    "native wheel scrolls content without zoom",
    `document.querySelector('${selector}').scrollTop>30&&document.querySelector('.zoom-control input').value==='100'`,
  );
  await c.evaluate(
    win,
    `(()=>{const root=document.querySelector('${selector}');root.scrollTop=root.scrollHeight;root.dispatchEvent(new Event('scroll'))})()`,
  );
  await c.check(
    win,
    "scroll across page boundaries updates indicator",
    "Number(document.querySelector('.page-nav input').value)>=2",
  );
  await c.evaluate(
    win,
    "(()=>{const input=document.querySelector('.page-nav input');input.value='2';input.dispatchEvent(new Event('change',{bubbles:true}))})()",
  );
  await c.check(
    win,
    "page input locates page two",
    "document.querySelector('.page-nav input').value==='2'",
  );
  await c.click(win, ".page-nav button", "上一页");
  await c.check(
    win,
    "previous page scrolls back",
    `document.querySelector('.page-nav input').value==='1'&&document.querySelector('${selector}').scrollTop<60`,
  );
}
