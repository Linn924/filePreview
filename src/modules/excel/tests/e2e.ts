import type { Suite } from "../../../../tests/context";
import { checkResize } from "../../../../tests/resize";
const suite: Suite = async (c) => {
  const win = await c.open("styled.xlsx");
  await c.check(
    win,
    "Excel merges and styles",
    "(()=>{const c=document.querySelector('td[colspan=\"4\"][rowspan=\"2\"]');return c&&getComputedStyle(c).backgroundColor==='rgb(40, 90, 159)'})()",
  );
  await c.check(
    win,
    "Excel formatted values",
    "document.querySelector('table').textContent.includes('87.5%')",
  );
  await c.check(
    win,
    "Excel resizable columns",
    "document.querySelectorAll('.column-resize-handle').length===4",
  );
  await checkResize(
    c,
    win,
    "document.querySelector('.column-resize-handle')",
    "document.querySelectorAll('thead th')[1].getBoundingClientRect().width",
  );
  await c.wheel(win, "table", -120);
  await c.check(
    win,
    "Excel wheel does not zoom",
    "document.querySelector('.zoom-control input').value==='100'",
  );
  await c.click(win, ".sheets button", "分页测试");
  await c.evaluate(
    win,
    "(()=>{const el=document.querySelector('.table-wrap');el.scrollTop=el.scrollHeight;el.dispatchEvent(new Event('scroll'))})()",
  );
  await c.check(
    win,
    "Excel outside wheel row page",
    "document.querySelectorAll('tbody tr').length>200&&document.querySelector('tbody th').textContent==='1'",
  );
  await c.click(win, "footer button", "上一页");
  await c.click(win, "footer button", "后 100 列");
  await c.check(
    win,
    "all Excel columns reachable",
    "document.querySelector('table').textContent.includes('第105列')",
  );
  await c.click(win, ".sheets button", "季度报告");
  await c.snapshot(win, "excel");
  c.close(win);
  for (const name of ["legacy.xls", "table.csv"]) {
    const w = await c.open(name);
    await c.check(w, "table " + name, "!!document.querySelector('table')");
    c.close(w);
  }
};
export default suite;
