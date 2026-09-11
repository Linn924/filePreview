import { app, BrowserWindow, dialog } from "electron";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { Suite } from "../context";
const suite: Suite = async (c) => {
  await c.check(
    c.home,
    "removed old slogans and status",
    "!document.querySelector('.privacy,.statusbar') && !document.body.innerText.includes('独立窗口中预览')",
  );
  await c.check(
    c.home,
    "user logo loaded",
    "document.querySelector('.app-logo').naturalWidth > 0",
  );
  await c.click(c.home, ".settings-button");
  await c.evaluate(
    c.home,
    "(()=>{const s=document.querySelector('#theme');s.value='dark';s.dispatchEvent(new Event('change',{bubbles:true}))})()",
  );
  await c.check(
    c.home,
    "dark theme applied",
    "document.documentElement.dataset.theme==='dark'",
  );
  const config = JSON.parse(
    readFileSync(
      path.join(app.getPath("userData"), "preferences.json"),
      "utf8",
    ),
  );
  if (
    config.theme !== "dark" ||
    Object.keys(config).some(
      (k) => /path|file|history/i.test(k) && k !== "multiFileMode",
    )
  )
    throw Error("Preference persistence");
  c.pass("preferences persist without file paths");
  await c.snapshot(c.home, "settings-dark");
  await c.click(c.home, 'button[aria-label="关闭设置"]');
  c.program.updateSettings({ theme: "light", multiFileMode: "ask" });
  const real = dialog.showMessageBox;
  let prompts = 0;
  dialog.showMessageBox = (async () => {
    prompts++;
    return { response: 0, checkboxChecked: true };
  }) as typeof dialog.showMessageBox;
  const tabs = (
    await c.program.openPaths([c.fixture("text.txt"), c.fixture("data.json")])
  )[0];
  await c.check(
    tabs,
    "multi-file tabs",
    "document.querySelectorAll('.tab').length===2",
  );
  if (prompts !== 1 || c.program.settings.get().multiFileMode !== "tabs")
    throw Error("Multi-file preference not saved");
  await c.click(tabs, ".tab button", "data.json");
  await c.check(
    tabs,
    "tab switch",
    "document.querySelector('.tab.active').textContent.includes('data.json')",
  );
  await c.evaluate(
    tabs,
    "(()=>{const tabs=document.querySelectorAll('.tab');tabs[1].dispatchEvent(new DragEvent('dragstart',{bubbles:true}));tabs[0].dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true}))})()",
  );
  await c.check(
    tabs,
    "tab reorder",
    "document.querySelector('.tab').textContent.includes('data.json')",
  );
  await c.click(tabs, ".tab-close");
  await c.check(
    tabs,
    "tab close releases component",
    "document.querySelectorAll('.preview-tab').length===1",
  );
  c.close(tabs);
  const again = await c.program.openPaths([
    c.fixture("text.txt"),
    c.fixture("data.json"),
  ]);
  if (prompts !== 1 || again.length !== 1)
    throw Error("Repeated multi-file prompt");
  c.close(again[0]);
  c.pass("multi-file choice remembered");
  c.program.updateSettings({ multiFileMode: "windows" });
  const separate = await c.program.openPaths([
    c.fixture("text.txt"),
    c.fixture("data.json"),
  ]);
  if (separate.length !== 2) throw Error("Independent windows");
  await c.pause(700);
  if (!separate.every((win) => win.isMaximized()))
    throw Error("Preview window not maximized");
  separate.forEach(c.close);
  c.pass("independent windows default maximized");
  c.program.updateSettings({ closeAction: "ask" });
  dialog.showMessageBox = (async () => {
    prompts++;
    return { response: 1, checkboxChecked: true };
  }) as typeof dialog.showMessageBox;
  c.home.close();
  await c.pause(300);
  if (c.home.isVisible() || c.program.settings.get().closeAction !== "tray")
    throw Error("Tray close preference");
  const promptCount = prompts;
  c.home.showInactive();
  c.home.close();
  await c.pause(200);
  if (prompts !== promptCount) throw Error("Repeated close prompt");
  c.home.showInactive();
  c.pass("close-to-tray remembered without exiting");
  dialog.showMessageBox = real;
  await c.check(
    c.home,
    "external network blocked",
    "fetch('https://example.com').then(()=>false,()=>true)",
  );
  if (c.home.webContents.session.isPersistent() || c.program.payloads.size)
    throw Error("Session/payload leak");
  c.pass("memory session and payload release");
  await c.snapshot(c.home, "home");
};
export default suite;
