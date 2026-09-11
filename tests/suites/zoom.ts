import type { Suite } from "../context";

// Exercise input events, not only change: Vue coerces number inputs during input.
const suite: Suite = async (c) => {
  const win = await c.open("text.txt");
  const input = "document.querySelector('.zoom-control input')";
  async function enter(
    value: string,
    mode: "enter" | "blur",
    expected: number,
  ) {
    await c.evaluate(
      win,
      `(()=>{const el=${input};el.focus();el.value=${JSON.stringify(value)};el.dispatchEvent(new Event('input',{bubbles:true}));})()`,
    );
    await c.pause(30);
    await c.evaluate(
      win,
      mode === "enter"
        ? `${input}.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}))`
        : `${input}.blur()`,
    );
    await c.check(
      win,
      `${mode}: ${value || "empty"} → ${expected}%`,
      `${input}.value==='${expected}' && Math.abs(parseFloat(getComputedStyle(document.querySelector('.text pre')).fontSize)-${(14 * expected) / 100})<0.02`,
    );
  }
  await enter("137", "enter", 137);
  await enter("175", "blur", 175);
  await enter("999", "enter", 400);
  await enter("1", "blur", 25);
  await enter("", "blur", 25);
  await enter("137.4", "enter", 137);
  await c.evaluate(win, `${input}.blur()`);
  await c.check(
    win,
    "blur after Enter keeps committed value",
    `${input}.value==='137'`,
  );
  c.close(win);
};
export default suite;
