import type { Suite } from "../../../../tests/context";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, basename } from "node:path";
import { longFixture } from "./longFixture";
import ExcelJS from "exceljs";

async function ensureLargeXlsx(path: string) {
  if (existsSync(path)) return;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("大表");
  for (let c = 1; c <= 8; c++) ws.getColumn(c).width = 14;
  ws.getRow(1).values = Array.from({ length: 8 }, (_, i) => "列" + (i + 1));
  for (let r = 2; r <= 10000; r++)
    ws.getRow(r).values = Array.from({ length: 8 }, (_, c) => r * 10 + c);
  const buf = await wb.xlsx.writeBuffer();
  writeFileSync(path, Buffer.from(buf));
}

function median(ns: number[]) {
  const s = [...ns].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

const suite: Suite = async (c) => {
  longFixture(c.fixture("long-mixed.pdf"));
  await ensureLargeXlsx(c.fixture("bench-large.xlsx"));
  const rounds = 3;
  const records: Array<{
    file: string;
    samplesMs: number[];
    medianMs: number;
  }> = [];
  for (const name of ["long-mixed.pdf", "bench-large.xlsx", "document.pdf"]) {
    const samples: number[] = [];
    for (let i = 0; i < rounds; i++) {
      const t0 = performance.now();
      const win = await c.open(name);
      const t1 = performance.now();
      samples.push(Math.round(t1 - t0));
      c.close(win);
      await c.pause(150);
    }
    records.push({
      file: basename(name),
      samplesMs: samples,
      medianMs: median(samples),
    });
    c.pass(
      `bench ${name} median ${median(samples)}ms (${samples.join("/")})`,
    );
  }

  // Batch preview habit: 10 PDFs in one window, measure tab switches.
  {
    const paths = Array.from({ length: 10 }, () => c.fixture("document.pdf"));
    const tOpen = performance.now();
    const [batch] = await c.program.openPaths(paths, "tabs");
    const openMs = Math.round(performance.now() - tOpen);
    await c.check(
      batch,
      "batch-tabs loaded 10 tabs",
      "document.querySelectorAll('.tab').length===10",
    );
    const tSwitch = performance.now();
    for (let i = 0; i < 20; i++) {
      await c.evaluate(
        batch,
        "document.querySelector('.tabs').dispatchEvent(new WheelEvent('wheel',{deltaY:120,bubbles:true,cancelable:true}))",
      );
    }
    await c.pause(80);
    const switchMs = Math.round(performance.now() - tSwitch);
    records.push({
      file: "batch-tabs-10",
      samplesMs: [openMs, switchMs],
      medianMs: openMs,
    });
    c.pass(`bench batch-tabs-10 open ${openMs}ms + 20 switches ${switchMs}ms`);
    c.close(batch);
  }
  const outDir = resolve("outputs/bench");
  mkdirSync(outDir, { recursive: true });
  const payload = {
    at: new Date().toISOString(),
    platform: process.platform,
    electron: (process.versions as { electron?: string }).electron,
    rounds,
    results: records,
    note: "open→loaded（preview-tab 且非 loading）的挂钟时间；含窗口创建与解析，不等于纯渲染毫秒。",
  };
  const file = resolve(outDir, `bench-${Date.now()}.json`);
  writeFileSync(file, JSON.stringify(payload, null, 2), "utf8");
  c.pass("bench results written to outputs/bench");
};
export default suite;
