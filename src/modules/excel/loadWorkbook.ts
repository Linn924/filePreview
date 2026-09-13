import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
export async function loadWorkbook(bytes: Uint8Array, ext: string) {
  // Basic cell data remains available when the optional style engine rejects a file.
  const book = XLSX.read(bytes, { type: 'array', cellStyles: true, cellText: true, cellHTML: false });
  let styled: ExcelJS.Workbook | undefined;
  let warning = '';
  if (ext === 'xlsx') {
    try {
      styled = new ExcelJS.Workbook();
      await styled.xlsx.load(bytes.slice().buffer);
    } catch {
      styled = undefined;
      warning = '部分样式或图片无法还原，已使用基础表格预览；单元格数据仍可查看。';
    }
  }
  return { book, styled, warning };
}
