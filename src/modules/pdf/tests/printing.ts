import { app, dialog, BrowserWindow, type WebContents } from "electron";
import type { Suite } from "../../../../tests/context";
const suite: Suite = async (c) => {
  const calls: Array<{
    paper: string;
    pages: number;
    source: number;
    pdfPages: number;
    copies: number;
  }> = [];
  let failed = "";
  let hold = false;
  let release: (() => void) | undefined;
  const realDialog = dialog.showOpenDialog;
  // Never contact a physical printer. Chromium still renders a real print document.
  const intercept = (_event: Electron.Event, wc: WebContents) => {
    wc.getPrintersAsync = async () => [
      {
        name: "test-printer",
        displayName: "测试打印机",
        description: "test",
        options: {},
      },
    ];
    wc.print = (options, callback) => {
      void (async () => {
        try {
          if (hold)
            await new Promise<void>((resolve) => {
              release = resolve;
            });
          const data = await wc.executeJavaScript(
            "(()=>{const pages=[...document.querySelectorAll('.print-sheet')];return{pages:pages.length,source:Number(pages[0]?.dataset.sourcePage),painted:pages.every(p=>p.querySelector('canvas').width>0)}})()",
          );
          if (!data.painted) throw Error("Unrendered print page");
          const buffer = await wc.printToPDF({
            preferCSSPageSize: true,
            printBackground: true,
          });
          const count = (
            buffer.toString("latin1").match(/\/Type\s*\/Page\b/g) || []
          ).length;
          const box = buffer
            .toString("latin1")
            .match(/\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)/);
          if (
            options?.pageSize === "A5" &&
            (!box ||
              Math.abs(Number(box[1]) - (148 * 72) / 25.4) > 2 ||
              Math.abs(Number(box[2]) - (210 * 72) / 25.4) > 2)
          )
            throw Error("A5 physical paper dimensions incorrect");
          calls.push({
            paper: String(options?.pageSize),
            pages: data.pages,
            source: data.source,
            pdfPages: count,
            copies: options?.copies || 1,
          });
          callback?.(true, "");
        } catch (e) {
          failed = String(e);
          callback?.(false, failed);
        }
      })();
    };
  };
  app.on("web-contents-created", intercept);
  async function waitPrintPanel(): Promise<BrowserWindow> {
    for (let i = 0; i < 50; i++) {
      const w = BrowserWindow.getAllWindows().find(
        (x) =>
          !x.isDestroyed() &&
          !x.isModal() &&
          x.webContents.getURL().includes("print-panel=1"),
      );
      if (w) return w;
      await c.pause(40);
    }
    throw Error("Print panel did not open in time");
  }
  async function closePrintPanels() {
    for (const w of BrowserWindow.getAllWindows())
      if (
        !w.isDestroyed() &&
        w.webContents.getURL().includes("print-panel=1")
      )
        c.close(w);
    await c.pause(120);
  }
  try {
    c.program.updateSettings({ printEntry: "current", multiFileMode: "windows" });
    const preview = await c.open("document.pdf");
    await c.click(preview, ".pdf-print-button");
    const win = await waitPrintPanel();
    await c.check(
      win,
      "printEntry current adds only the active PDF",
      "document.querySelectorAll('.print-files li').length===1",
    );
    if (!win || win.isModal() || !win.isResizable())
      throw Error("Print settings must be independent resizable window");
    await c.check(
      preview,
      "preview is not covered by modal",
      "!document.querySelector('.pdf-print-panel,.pdf-print-backdrop')",
    );
    await c.click(win, ".toggle-print-options");
    await c.check(
      win,
      "original and target dimensions shown",
      "document.querySelector('.paper-dimensions')?.textContent.includes('mm')",
    );
    await c.check(
      win,
      "paper layout preview canvas present",
      "!!document.querySelector('.paper-layout-preview canvas')",
    );
    await c.check(
      win,
      "PDF paper choices include A4/A5",
      "[...document.querySelector('[aria-label=打印纸张]').options].some(o=>o.value==='A5')",
    );
    await c.check(
      win,
      "print scale and page order controls exist",
      "!!document.querySelector('.print-options select') && document.body.textContent.includes('适合纸张') && document.body.textContent.includes('仅缩小')",
    );
    await c.check(
      win,
      "system printer queue button present",
      "!!document.querySelector('.open-print-queue')",
    );
    await c.evaluate(
      win,
      "(()=>{const s=document.querySelector('[aria-label=打印纸张]');s.value='A5';s.dispatchEvent(new Event('change',{bubbles:true}))})()",
    );
    await c.check(
      win,
      "paper support hint shown when A5 selected",
      "!!document.querySelector('.paper-hint') && document.querySelector('.paper-hint')?.textContent?.includes('A5')",
    );
    await c.click(win, ".pdf-print-panel .primary");
    await c.check(
      win,
      "A5 PDF submitted",
      "document.querySelector('.print-files').textContent.includes('已提交到系统队列')",
    );
    if (
      failed ||
      calls[0]?.paper !== "A5" ||
      calls[0]?.pages !== 2 ||
      calls[0]?.pdfPages !== 2
    )
      throw Error(
        "A5 all-page print validation " + JSON.stringify(calls) + " " + failed,
      );
    await c.evaluate(
      win,
      "(()=>{const r=document.querySelector('.print-range input');r.value='2';r.dispatchEvent(new Event('input',{bubbles:true}))})()",
    );
    await c.click(win, ".pdf-print-panel .primary");
    await c.pause(400);
    await c.check(
      win,
      "selected page printed",
      "document.querySelector('.print-files').textContent.includes('已提交到系统队列')",
    );
    if (
      calls[1]?.pages !== 1 ||
      calls[1]?.source !== 2 ||
      calls[1]?.pdfPages !== 1
    )
      throw Error("Page range " + JSON.stringify(calls));
    dialog.showOpenDialog = (async () => ({
      canceled: false,
      filePaths: [c.fixture("document.pdf")],
    })) as typeof dialog.showOpenDialog;
    await c.click(win, ".pdf-print-panel footer button", "添加文件");
    await c.check(win,'collapsed files do not render paper previews',"document.querySelectorAll('.print-file-card .print-paper-preview').length<=1");
    await c.check(
      win,
      "batch list contains two PDFs",
      "document.querySelectorAll('.print-files li').length===2",
    );
    await c.click(win, ".print-files li:nth-child(2) .toggle-print-options");
    await c.evaluate(
      win,
      "(()=>{const row=document.querySelectorAll('.print-files li')[1];const n=row.querySelector('input[type=number]');n.value='2';n.dispatchEvent(new Event('input',{bubbles:true}));})()",
    );
    await c.click(win, ".pdf-print-panel .primary");
    await c.pause(400);
    await c.check(
      win,
      "batch submits both PDF jobs",
      "[...document.querySelectorAll('.print-files li')].every(row=>row.textContent.includes('已提交到系统队列'))",
    );
    if (calls.length !== 4)
      throw Error("Batch queue did not submit exactly two jobs");
    if (
      calls[2].paper !== "A5" ||
      calls[2].source !== 2 ||
      calls[2].pages !== 1 ||
      calls[3].paper !== "A4" ||
      calls[3].pages !== 2 ||
      calls[3].copies !== 2
    )
      throw Error("Per-file settings not isolated: " + JSON.stringify(calls));
    await c.click(win, ".print-selected");
    await c.click(win, ".pdf-print-panel .primary");
    await c.pause(300);
    await c.check(
      win,
      "unchecked PDF is not submitted",
      "document.querySelector('.print-status').textContent==='未勾选'&&document.querySelectorAll('.print-status')[1].textContent.includes('已提交')",
    );
    if (Number(calls.length) !== 5) throw Error("Unchecked PDF was printed");
    await c.click(win, ".print-selected");
    calls.pop();
    await c.evaluate(
      win,
      "(()=>{const r=document.querySelector('.print-range input');r.value='999';r.dispatchEvent(new Event('input',{bubbles:true}))})()",
    );
    await c.click(win, ".apply-print-all");
    await c.check(
      win,
      "apply-all copies settings",
      "[...document.querySelectorAll('.print-range input')].every(el=>el.value==='999')&&[...document.querySelectorAll('[aria-label=打印纸张]')].every(el=>el.value==='A5')",
    );
    await c.click(win, ".pdf-print-panel .primary");
    await c.check(
      win,
      "invalid ranges fail without printing",
      "[...document.querySelectorAll('.print-files li')].every(row=>row.textContent.includes('失败'))",
    );
    if (calls.length !== 4) throw Error("Invalid range submitted a print job");
    await c.pause(150);
    await c.evaluate(
      win,
      "(()=>{const r=document.querySelector('.print-range input');r.value='2';r.dispatchEvent(new Event('input',{bubbles:true}))})()",
    );
    await c.pause(80);
    await c.click(win, ".apply-print-all");
    await c.pause(150);
    hold = true;
    await c.check(
      win,
      "print go available before stop test",
      "(()=>{const b=document.querySelector('.pdf-print-panel footer .print-go');return !!b && !b.disabled})()",
    );
    await c.click(win, ".pdf-print-panel footer .print-go");
    await c.check(
      win,
      "busy batch shows stop control",
      "!![...document.querySelectorAll('.pdf-print-panel footer button')].find((b)=>b.textContent&&b.textContent.includes('停止'))",
    );
    for (let i = 0; i < 100 && !release; i++) await c.pause(50);
    if (!release) throw Error("Print job not ready for stop test");
    await c.click(
      win,
      ".pdf-print-panel footer button",
      "停止后续任务",
    );
    hold = false;
    release();
    await c.check(
      win,
      "stop keeps later PDFs unsubmitted",
      "document.querySelectorAll('.print-files li')[1].textContent.includes('未提交')",
    );
    if (Number(calls.length) !== 5)
      throw Error("Stop submitted unexpected jobs");
    c.pass(
      "PDF all pages and selected page render to actual print layout without physical printing",
    );
    await c.snapshot(win, "pdf-print-settings");
    dialog.showOpenDialog = (async () => ({
      canceled: false,
      filePaths: Array(13).fill(c.fixture("document.pdf")),
    })) as typeof dialog.showOpenDialog;
    await c.click(win, ".pdf-print-panel footer button", "添加文件");
    await c.click(win, ".print-file-card:last-child .preview-print-file");
    await c.check(
      preview,
      "print selection opens preview tab",
      "document.querySelectorAll('.tab').length===2",
    );
    await c.check(
      win,
      "PDF selection and batch accept more than twelve files",
      "document.querySelectorAll('.print-files li').length===15",
    );
    await c.click(win, ".pdf-print-panel header button", "并排查看");
    await c.pause(250);
    const pb = preview.getBounds(),
      sb = win.getBounds();
    if (pb.x + pb.width > sb.x + 2) throw Error("Side-by-side windows overlap "+JSON.stringify({pb,sb}));
    c.program.updateSettings({ printEntry: "current" });
    await c.click(preview, ".preview-tab .pdf-print-button");
    await c.check(
      win,
      "reopening same tab retains one entry",
      "document.querySelectorAll('.print-files li').length===15",
    );
    c.program.updateSettings({ printEntry: "all" });
    await c.click(preview, ".preview-tab .pdf-print-button");
    await c.check(
      win,
      "printEntry all adds missing PDF tabs by id dedupe",
      "document.querySelectorAll('.print-files li').length>=15",
    );
    c.close(preview);
    await c.click(win, ".preview-print-file");
    await c.pause(250);
    const reopened = BrowserWindow.getAllWindows().find(
      (w) =>
        w.id !== win.id &&
        w.id !== c.home.id &&
        w.webContents.getURL().includes("?preview=1"),
    );
    if (!reopened) throw Error("Closed preview was not recreated");
    await c.check(
      reopened,
      "print list can recreate preview",
      "document.querySelector('.filename').textContent.includes('document.pdf')",
    );
    c.close(reopened);
    dialog.showOpenDialog = (async () => ({canceled:false,filePaths:Array(60).fill(c.fixture('document.pdf'))})) as typeof dialog.showOpenDialog;
    await c.click(win,'.pdf-print-panel footer button','添加文件');
    await c.check(win,'print list keeps DOM bounded',"document.querySelectorAll('.print-file-card').length<=40");
    await c.evaluate(win,"(()=>{const list=document.querySelector('.print-files');list.scrollTop=list.scrollHeight;list.dispatchEvent(new Event('scroll'))})()");
    await c.check(win,'long print list loads later rows',"document.querySelectorAll('.print-file-card').length>40");
    c.close(win);
    const text = await c.open("text.txt");
    await c.check(
      text,
      "other formats have no print action",
      "!document.querySelector('.pdf-print-button')",
    );
    c.close(text);
    // Image print: submit intercepted, in-memory only.
    const img = await c.open("image.png");
    await c.click(img, ".file-print-button");
    await c.pause(300);
    const imgPanel = await waitPrintPanel();
    await c.check(
      imgPanel,
      "image appears in print list",
      "document.body.textContent.includes('image.png')",
    );
    c.close(imgPanel);
    c.close(img);
    c.program.updateSettings({ multiFileMode: "tabs", printEntry: "all" });
    const multi = await c.program.openPaths([
      c.fixture("document.pdf"),
      c.fixture("document.pdf"),
    ]);
    await c.check(
      multi[0],
      "multi-PDF tabs loaded",
      "document.querySelectorAll('.tab').length===2 && !document.querySelector('.loading')",
    );
    await c.pause(500);
    await c.click(multi[0], ".pdf-print-button");
    await c.pause(400);
    const panelAll = BrowserWindow.getAllWindows().find((w) =>
      w.webContents.getURL().includes("print-panel=1"),
    );
    if (!panelAll) throw Error("printEntry all did not open panel");
    await c.check(
      panelAll,
      "printEntry all lists every open PDF tab",
      "document.querySelectorAll('.print-files li').length===2",
    );
    c.close(panelAll);
    c.close(multi[0]);
    await c.pause(400);
    c.program.updateSettings({ printEntry: "none" });
    const noneWin = await c.open("document.pdf");
    await c.pause(300);
    await c.click(noneWin, ".pdf-print-button");
    await c.pause(400);
    const panelNone = await waitPrintPanel();
    await c.check(
      panelNone,
      "printEntry none opens without auto-adding files",
      "document.querySelectorAll('.print-files li').length===0",
    );
    c.close(panelNone);
    c.close(noneWin);
    await closePrintPanels();
    c.program.updateSettings({ printEntry: "all" });
  } finally {
    app.removeListener("web-contents-created", intercept);
    dialog.showOpenDialog = realDialog;
  }
};
export default suite;
