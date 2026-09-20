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
    // 第 1 页应为已渲染内容（不再是空占位）
    await c.check(
      win,
      "PPT first slide rendered immediately " + name,
      "!document.querySelector('.slide-host').shadowRoot.querySelector('.slide-page:first-of-type').classList.contains('slide-placeholder')",
    );
    // 总页数应全部创建（含占位）- input[max] 是总页数，Shadow DOM 节点数应相等
    await c.check(
      win,
      "PPT all page nodes created " + name,
      "(()=>{const inp=document.querySelector('.page-nav input[type=number]');const total=inp?Number(inp.max):0;const nodes=document.querySelector('.slide-host').shadowRoot.querySelectorAll('.slide-page').length;return total>0&&nodes===total;})()",
    );
    await checkContinuous(c, win, ".slide-scroll");
    await c.snapshot(win, name === "legacy.ppt" ? "ppt-legacy" : "pptx");
    c.close(win);
  }
};
export default suite;
