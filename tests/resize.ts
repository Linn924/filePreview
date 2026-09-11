import type { BrowserWindow } from "electron";
import type { TestContext } from "./context";
export async function checkResize(
  c: TestContext,
  win: BrowserWindow,
  handleExpression: string,
  widthExpression: string,
) {
  const before = await c.evaluate<number>(win, widthExpression);
  const point = await c.evaluate<{ x: number; y: number }>(
    win,
    `(()=>{const h=${handleExpression};const r=h.getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2}})()`,
  );
  win.webContents.debugger.attach("1.3");
  try {
    await win.webContents.debugger.sendCommand("Input.dispatchMouseEvent", {
      type: "mousePressed",
      x: point.x,
      y: point.y,
      button: "left",
      clickCount: 1,
    });
    await win.webContents.debugger.sendCommand("Input.dispatchMouseEvent", {
      type: "mouseMoved",
      x: point.x + 85,
      y: point.y,
      button: "left",
      buttons: 1,
    });
    await win.webContents.debugger.sendCommand("Input.dispatchMouseEvent", {
      type: "mouseReleased",
      x: point.x + 85,
      y: point.y,
      button: "left",
      clickCount: 1,
    });
    await c.pause(200);
    const after = await c.evaluate<number>(win, widthExpression);
    if (after <= before + 20)
      throw Error(`Column did not widen: ${before} → ${after}`);
    c.pass("real pointer drag widens table column");
  } finally {
    win.webContents.debugger.detach();
  }
}
