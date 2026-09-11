import type { Suite } from "../../../../tests/context";
import { checkResize } from "../../../../tests/resize";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import JSZip from "jszip";
const suite: Suite = async (c) => {
  for (const name of ["document.docx", "legacy.doc"]) {
    const win = await c.open(name);
    await c.check(
      win,
      "Word content " + name,
      "document.querySelector('.word-host').shadowRoot.textContent.length>100",
    );
    if (name === "document.docx")
      await c.check(
        win,
        "Word table resize handles",
        "!!document.querySelector('.word-host').shadowRoot.querySelector('.column-resize-handle')",
      );
    if (name === "document.docx")
      await checkResize(
        c,
        win,
        "document.querySelector('.word-host').shadowRoot.querySelector('.column-resize-handle')",
        "document.querySelector('.word-host').shadowRoot.querySelector('td').getBoundingClientRect().width",
      );
    await c.evaluate(
      win,
      "document.querySelector('.word-host').shadowRoot.querySelector('.preview-content').dispatchEvent(new WheelEvent('wheel',{deltaY:-120,bubbles:true,composed:true,cancelable:true}))",
    );
    await c.check(
      win,
      "Word zoom synchronized",
      "document.querySelector('.zoom-control input').value==='110'",
    );
    await c.snapshot(win, name === "legacy.doc" ? "doc-legacy" : "word");
    c.close(win);
  }
  const bad = await c.open("broken.docx");
  await c.check(
    bad,
    "corrupt Word error",
    "!!document.querySelector('.error')",
  );
  c.close(bad);
  if (!existsSync(c.fixture("pages.docx"))) {
    const archive = await JSZip.loadAsync(
      readFileSync(c.fixture("document.docx")),
    );
    const xml = await archive.file("word/document.xml")!.async("string");
    archive.file(
      "word/document.xml",
      xml.replace(
        "<w:sectPr>",
        '<w:p><w:r><w:br w:type="page"/></w:r></w:p><w:p><w:r><w:t>第二页翻页测试</w:t></w:r></w:p><w:sectPr>',
      ),
    );
    writeFileSync(
      c.fixture("pages.docx"),
      await archive.generateAsync({ type: "nodebuffer" }),
    );
  }
  const pages = await c.open("pages.docx");
  await c.check(
    pages,
    "DOCX real page count",
    "document.querySelector('.page-indicator').textContent.trim()==='1 / 2'",
  );
  await c.wheel(pages, ".document-scroll", 120);
  await c.check(
    pages,
    "Word outside wheel updates page indicator",
    "document.querySelector('.page-indicator').textContent.trim()==='2 / 2'",
  );
  await c.pause(250);
  await c.wheel(pages, ".document-scroll", -120);
  await c.check(
    pages,
    "Word wheel returns previous page",
    "document.querySelector('.page-indicator').textContent.trim()==='1 / 2'",
  );
  c.close(pages);
};
export default suite;
