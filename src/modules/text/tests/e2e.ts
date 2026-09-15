import type { Suite } from "../../../../tests/context";
const suite: Suite = async (c) => {
  const text = await c.open("text.txt");
  await c.check(
    text,
    "text.txt",
    "document.querySelector('.text-code').textContent.includes('<script>') && !window.BAD",
  );
  await c.check(
    text,
    "text line numbers shown",
    "document.querySelectorAll('.line-no').length>0",
  );
  await c.click(text, ".text-search-toggle");
  await c.evaluate(
    text,
    "(()=>{const i=document.querySelector('.text-search-input');i.value='script';i.dispatchEvent(new Event('input',{bubbles:true}))})()",
  );
  await c.check(
    text,
    "text search marks hits",
    "!!document.querySelector('.text-hit') && document.body.textContent.includes('行命中')",
  );
  await c.wheel(text, ".preview-content", -120);
  await c.check(
    text,
    "text wheel does not zoom",
    "document.querySelector('.zoom-control input').value==='100'",
  );
  c.close(text);
  for (const [file, needle] of [
    ["data.json", String.fromCharCode(10)],
    ["invalid.json", "JSON 格式不完整"],
  ] as const) {
    const win = await c.open(file);
    await c.check(
      win,
      file,
      `document.body.innerText.includes(${JSON.stringify(needle)})`,
    );
    if (file === "data.json")
      await c.check(
        win,
        "json highlight tokens",
        "!!document.querySelector('.tok-key,.tok-str,.tok-num')",
      );
    await c.wheel(win, ".preview-content", -120);
    await c.check(
      win,
      "text wheel does not zoom",
      "document.querySelector('.zoom-control input').value==='100'",
    );
    c.close(win);
  }
  const md = await c.open("readme.md");
  await c.check(
    md,
    "readme.md",
    "document.querySelector('.markdown h1').textContent==='Markdown 预览' && !window.BAD",
  );
  await c.wheel(md, ".preview-content", -120);
  await c.check(
    md,
    "text wheel does not zoom",
    "document.querySelector('.zoom-control input').value==='100'",
  );
  c.close(md);
};
export default suite;
