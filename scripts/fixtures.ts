// Developer-only fixtures. Test files are written under work/, never by the app.
import { mkdir, writeFile } from "node:fs/promises";
import ExcelJS from "exceljs";
import XLSX from "xlsx";
import JSZip from "jszip";
const root = new URL("../work/fixtures/", import.meta.url);
await mkdir(root, { recursive: true });
const save = (name: string, bytes: Uint8Array) =>
  writeFile(new URL(name, root), bytes);
const wb = new ExcelJS.Workbook();
const ws = wb.addWorksheet("季度报告");
ws.columns = [{ width: 26 }, { width: 18 }, { width: 18 }, { width: 20 }];
ws.mergeCells("A1:D2");
ws.getCell("A1").value = "2026 季度销售报告";
ws.getCell("A1").font = {
  name: "Microsoft YaHei",
  size: 20,
  bold: true,
  color: { argb: "FFFFFFFF" },
};
ws.getCell("A1").fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FF285A9F" },
};
ws.getCell("A1").alignment = { horizontal: "center", vertical: "middle" };
ws.getRow(1).height = 24;
ws.getRow(2).height = 24;
ws.getRow(3).values = ["产品", "销售额", "完成率", "日期"];
ws.getRow(4).values = [
  "本地预览工具",
  12500.5,
  0.875,
  new Date("2026-09-11T00:00:00Z"),
];
ws.getRow(5).values = [
  "文档服务",
  9800,
  0.96,
  new Date("2026-09-10T00:00:00Z"),
];
for (let r = 3; r <= 5; r++) {
  ws.getRow(r).height = 28;
  for (let c = 1; c <= 4; c++) {
    const cell = ws.getCell(r, c);
    cell.border = {
      top: { style: "thin", color: { argb: "FFADBBD0" } },
      bottom: { style: "thin", color: { argb: "FFADBBD0" } },
      left: { style: "thin", color: { argb: "FFADBBD0" } },
      right: { style: "thin", color: { argb: "FFADBBD0" } },
    };
    if (r === 3) {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE7EEF8" },
      };
      cell.font = { bold: true };
    }
  }
}
ws.getCell("B4").numFmt = "#,##0.00";
ws.getCell("C4").numFmt = "0.0%";
ws.getCell("D4").numFmt = "yyyy-mm-dd";
ws.getCell("A7").value = {
  richText: [
    { text: "彩色", font: { color: { argb: "FFCC4422" }, bold: true } },
    { text: "富文本" },
  ],
};
wb.addWorksheet("说明").getCell("A1").value = "第二个工作表";
const big = wb.addWorksheet("分页测试");
for (let r = 1; r <= 205; r++) big.getCell(r, 1).value = "第" + r + "行";
big.getCell(1, 105).value = "第105列";
await save("styled.xlsx", Buffer.from(await wb.xlsx.writeBuffer()));
const xlsBook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(
  xlsBook,
  XLSX.utils.aoa_to_sheet([
    ["旧版 Excel", 42],
    ["中文", 2026],
  ]),
  "旧版",
);
await save(
  "legacy.xls",
  XLSX.write(xlsBook, { type: "buffer", bookType: "biff8" }),
);
await save(
  "text.txt",
  Buffer.from("本地文本预览\n<script>window.BAD = true</script>"),
);
await save("data.json", Buffer.from('{"名称":"本地预览","数值":42}'));
await save("invalid.json", Buffer.from("{bad"));
await save("table.csv", Buffer.from("\ufeff名称,数值\n中文,42"));
await save(
  "readme.md",
  Buffer.from(
    "# Markdown 预览\n\n**粗体**、列表与表格。\n\n- 只读\n- 离线\n\n<script>window.BAD=true</script>",
  ),
);
await save(
  "vector.svg",
  Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="240"><rect width="400" height="240" fill="#285a9f"/><text x="30" y="130" fill="white" font-size="35">LOCAL PREVIEW</text></svg>',
  ),
);
await save(
  "image.png",
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=",
    "base64",
  ),
);
await save("broken.docx", Buffer.from("broken"));
await save("unsupported.bin", Buffer.from("unknown"));
const zip = new JSZip();
zip.file(
  "[Content_Types].xml",
  '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
);
zip.file(
  "_rels/.rels",
  '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
);
zip.file(
  "word/document.xml",
  '<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:color w:val="285A9F"/><w:sz w:val="40"/></w:rPr><w:t>本地 Word 预览测试</w:t></w:r></w:p><w:p><w:r><w:t>文档只在本机预览。保留原始文件，不生成转换副本。</w:t></w:r></w:p><w:tbl><w:tblPr><w:tblW w:w="6000" w:type="dxa"/><w:tblBorders><w:top w:val="single" w:sz="8"/><w:bottom w:val="single" w:sz="8"/><w:left w:val="single" w:sz="8"/><w:right w:val="single" w:sz="8"/><w:insideH w:val="single" w:sz="8"/><w:insideV w:val="single" w:sz="8"/></w:tblBorders></w:tblPr><w:tblGrid><w:gridCol w:w="3000"/><w:gridCol w:w="3000"/></w:tblGrid><w:tr><w:tc><w:p><w:r><w:t>项目</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>本地文件预览</w:t></w:r></w:p></w:tc></w:tr></w:tbl><w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr></w:body></w:document>',
);
await save("document.docx", await zip.generateAsync({ type: "nodebuffer" }));
const contents = [
  "BT /F1 24 Tf 40 220 Td (Local Preview - page 1) Tj ET",
  "BT /F1 24 Tf 40 220 Td (Local Preview - page 2) Tj ET",
];
const objs = [
  "<< /Type /Catalog /Pages 2 0 R >>",
  "<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>",
  "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 500 300] /Resources << /Font << /F1 7 0 R >> >> /Contents 5 0 R >>",
  "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 500 300] /Resources << /Font << /F1 7 0 R >> >> /Contents 6 0 R >>",
  ...contents.map((s) => `<< /Length ${s.length} >>\nstream\n${s}\nendstream`),
  "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
];
let pdf = "%PDF-1.4\n";
const offsets = [0];
objs.forEach((s, i) => {
  offsets.push(Buffer.byteLength(pdf));
  pdf += `${i + 1} 0 obj\n${s}\nendobj\n`;
});
const xref = Buffer.byteLength(pdf);
pdf +=
  `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` +
  offsets
    .slice(1)
    .map((n) => String(n).padStart(10, "0") + " 00000 n \n")
    .join("") +
  `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
await save("document.pdf", Buffer.from(pdf));
for (const [name, url] of [
  [
    "legacy.ppt",
    "https://raw.githubusercontent.com/unStone/web-ppt/master/fixtures/sample.ppt",
  ],
  [
    "presentation.pptx",
    "https://raw.githubusercontent.com/unStone/web-ppt/master/fixtures/showcase.pptx",
  ],
  [
    "legacy.doc",
    "https://raw.githubusercontent.com/flyfish-dev/file-viewer/main/apps/viewer-demo/public/example/test.doc",
  ],
]) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  await save(name, Buffer.from(await response.arrayBuffer()));
}
console.log(
  "Fixtures ready under work/fixtures (external PPT/PPTX: unStone/web-ppt, MIT; DOC: flyfish-dev/file-viewer, Apache-2.0).",
);
