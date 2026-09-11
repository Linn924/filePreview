import type { Suite } from "../../../../tests/context";
import { checkContinuous } from "../../../../tests/continuous";
const suite: Suite = async (c) => {
  for (const name of ["presentation.pptx", "legacy.ppt"]) {
    const win = await c.open(name);
    await c.check(
      win,
      "PPT pages coexist " + name,
      "document.querySelector('.slide-host').shadowRoot.querySelectorAll('.slide-page').length>=2",
    );
    await c.check(
      win,
      "PPT content survives " + name,
      "document.querySelector('.slide-host').shadowRoot.textContent.length>150",
    );
    await checkContinuous(c, win, ".slide-scroll");
    await c.snapshot(win, name === "legacy.ppt" ? "ppt-legacy" : "pptx");
    c.close(win);
  }
};
export default suite;
