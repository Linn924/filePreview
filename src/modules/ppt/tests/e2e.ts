import type { Suite } from "../../../../tests/context";
const suite: Suite = async (c) => {
  for (const name of ["presentation.pptx", "legacy.ppt"]) {
    const win = await c.open(name);
    await c.check(
      win,
      "PPT text survives " + name,
      "document.querySelector('.slide-host').shadowRoot.textContent.length>150",
    );
    await c.check(
      win,
      "PPT bounds finite " + name,
      "(()=>{const r=document.querySelector('.slide-host').getBoundingClientRect();return r.width>50&&r.height>50&&r.height<innerHeight})()",
    );
    await c.wheel(win, ".slide-scroll", 120);
    await c.check(
      win,
      "outside wheel flips " + name,
      "document.querySelector('.page-indicator').textContent.startsWith('2 /')",
    );
    await c.wheel(win, ".slide-host", -120);
    await c.check(
      win,
      "inside wheel scales " + name,
      "document.querySelector('.zoom-control input').value==='110'",
    );
    await c.snapshot(win, name === "legacy.ppt" ? "ppt-legacy" : "pptx");
    c.close(win);
  }
};
export default suite;
