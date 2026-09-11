import type { Suite } from "../../../../tests/context";
const suite: Suite = async (c) => {
  for (const [file, test] of [
    [
      "text.txt",
      "document.querySelector('pre').textContent.includes('<script>') && !window.BAD",
    ],
    [
      "data.json",
      "document.querySelector('pre').textContent.includes(String.fromCharCode(10))",
    ],
    ["invalid.json", "document.body.innerText.includes('JSON 格式不完整')"],
    [
      "readme.md",
      "document.querySelector('.markdown h1').textContent==='Markdown 预览' && !window.BAD",
    ],
  ]) {
    const win = await c.open(file);
    await c.check(win, file, test);
    await c.wheel(win, ".preview-content", -120);
    await c.check(
      win,
      "text wheel wheel does not zoom",
      "document.querySelector('.zoom-control input').value==='100'",
    );
    c.close(win);
  }
};
export default suite;
