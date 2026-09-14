import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

// Library-level parse benchmarks (no window). Full UI open→ready is suite `bench`.
const root = resolve("outputs/bench");
await mkdir(root, { recursive: true });

const samples: Array<{ label: string; ms: number }> = [];
async function time(label: string, fn: () => Promise<void>) {
  const list: number[] = [];
  for (let i = 0; i < 3; i++) {
    const t0 = performance.now();
    await fn();
    list.push(performance.now() - t0);
  }
  list.sort((a, b) => a - b);
  samples.push({ label, ms: Math.round(list[1]) });
  console.log(label, Math.round(list[1]) + "ms");
}

const pdfPath = resolve("work/fixtures/long-mixed.pdf");
const xlsxPath = resolve("work/fixtures/bench-large.xlsx");
const { readFileSync, existsSync, writeFileSync } = await import("node:fs");
if (!existsSync(pdfPath)) {
  // 80-page synthetic PDF (same shape as tests/longFixture)
  const count = 80;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${Array.from({ length: count }, (_, i) => `${3 + i} 0 R`).join(" ")}] /Count ${count} >>`,
  ];
  for (let i = 0; i < count; i++)
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${i % 2 ? "842 595" : "595 842"}] /Resources << >> /Contents ${3 + count} 0 R >>`,
    );
  const content = "0.1 0.4 0.8 rg 40 40 200 200 re f";
  objects.push(
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  );
  let pdf = "%PDF-1.4\n";
  const offsets = objects.map((object, i) => {
    const offset = Buffer.byteLength(pdf);
    pdf += `${i + 1} 0 obj\n${object}\nendobj\n`;
    return offset;
  });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((n) => String(n).padStart(10, "0") + " 00000 n \n").join("")}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  writeFileSync(pdfPath, pdf);
}
if (!existsSync(xlsxPath)) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("大表");
  for (let c = 1; c <= 8; c++) ws.getColumn(c).width = 14;
  ws.getRow(1).values = Array.from({ length: 8 }, (_, i) => "列" + (i + 1));
  for (let r = 2; r <= 10000; r++)
    ws.getRow(r).values = Array.from({ length: 8 }, (_, c) => r * 10 + c);
  writeFileSync(xlsxPath, Buffer.from(await wb.xlsx.writeBuffer()));
}

await time("read long-mixed.pdf", async () => {
  void readFileSync(pdfPath).byteLength;
});
await time("pdfjs getDocument+page1 (long-mixed)", async () => {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task = getDocument({ data: new Uint8Array(readFileSync(pdfPath)) });
  const pdf = await task.promise;
  await pdf.getPage(1);
  await task.destroy();
});
await time("xlsx parse bench-large (10k rows)", async () => {
  const XLSX = await import("xlsx");
  const book = XLSX.read(new Uint8Array(readFileSync(xlsxPath)), {
    type: "array",
  });
  void book.SheetNames.length;
});

const payload = {
  at: new Date().toISOString(),
  kind: "library-parse",
  results: samples,
};
const file = resolve(root, `bench-lib-${Date.now()}.json`);
await writeFile(file, JSON.stringify(payload, null, 2), "utf8");
console.log("wrote", file);
