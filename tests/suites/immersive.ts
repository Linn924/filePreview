import type { Suite } from "../context";
const suite: Suite = async (c) => {
  const win = await c.open("document.pdf");
  await c.evaluate(win, "document.querySelector('.pdf-scroll').scrollTop=100");
  await c.click(win, ".immersive-toggle");
  await c.pause(400);
  if (!win.isFullScreen() || c.home.isFullScreen())
    throw Error("Native fullscreen must affect only preview window");
  await c.check(
    win,
    "immersive removes window chrome and reserves whole viewport",
    "document.documentElement.classList.contains('immersive')&&getComputedStyle(document.querySelector('.tabs')).display==='none'&&document.querySelector('.pdf-scroll').clientHeight>=innerHeight-2",
  );
  for (const mode of ["width", "page"]) {
    await c.evaluate(
      win,
      `(()=>{const el=document.querySelector('[aria-label=页面适配]');el.value='${mode}';el.dispatchEvent(new Event('change',{bubbles:true}))})()`,
    );
    await c.pause(250);
    await c.check(
      win,
      "PDF " + mode + " preserves aspect ratio",
      "(()=>{const p=document.querySelector('.pdf-page').getBoundingClientRect();return Math.abs(p.width/p.height-5/3)<0.01})()",
    );
    if (mode === "page")
      await c.check(
        win,
        "whole page fits fullscreen",
        "document.querySelector('.pdf-page').getBoundingClientRect().height<=document.querySelector('.pdf-scroll').clientHeight",
      );
  }
  await c.snapshot(win, "immersive-pdf");
  win.webContents.sendInputEvent({ type: "keyDown", keyCode: "Escape" });
  win.webContents.sendInputEvent({ type: "keyUp", keyCode: "Escape" });
  await c.pause(450);
  if (win.isFullScreen()) throw Error("Escape must exit fullscreen");
  await c.check(
    win,
    "exit restores controls and mode",
    "!document.documentElement.classList.contains('immersive')&&document.querySelector('[aria-label=页面适配]').value==='original'",
  );
  c.close(win);
  for (const [name, expression] of [
    [
      "document.docx",
      "document.querySelector('.word-host').shadowRoot.querySelector('section.docx')",
    ],
    [
      "presentation.pptx",
      "document.querySelector('.slide-host').shadowRoot.querySelector('.slide-page')",
    ],
    ["vector.svg", "document.querySelector('.image img')"],
  ]) {
    const preview = await c.open(name);
    const ratio = await c.evaluate<number>(
      preview,
      `(()=>{const r=${expression}.getBoundingClientRect();return r.width/r.height})()`,
    );
    for (const mode of ["width", "page"]) {
      await c.evaluate(
        preview,
        `(()=>{const el=document.querySelector('[aria-label=页面适配]');el.value='${mode}';el.dispatchEvent(new Event('change',{bubbles:true}))})()`,
      );
      await c.pause(200);
      await c.check(
        preview,
        `${name} ${mode} preserves proportions`,
        `(()=>{const r=${expression}.getBoundingClientRect();return r.width>1&&r.height>1&&Math.abs(r.width/r.height-${ratio})<0.02})()`,
      );
    }
    c.close(preview);
  }
};
export default suite;
