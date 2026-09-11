import { useWheelPreview } from "../../composables/useWheelPreview";
import {
  computed,
  onMounted,
  onBeforeUnmount,
  ref,
  shallowRef,
  type CSSProperties,
} from "vue";
import * as XLSX from "xlsx";
import ExcelJS from "exceljs";
import type { PreviewFile } from "../../types";
import type { PreviewProps, PreviewEmit } from "../types";
export function usePreview(props: PreviewProps, emit: PreviewEmit) {
  const pane = ref<HTMLElement>();
  useWheelPreview(pane, {
    zoom: () => props.zoom,
    enabled: () => props.wheelZoom !== false,
    update: (value) => emit("update:zoom", value),
    page: (direction) => {
      rowPage.value = Math.max(
        0,
        Math.min(
          Math.ceil(rowCount.value / pageRows) - 1,
          rowPage.value + direction,
        ),
      );
    },
  });
  const book = shallowRef<XLSX.WorkBook>();
  let styled: ExcelJS.Workbook | undefined;
  const sheetName = ref("");
  const rowPage = ref(0);
  const colPage = ref(0);
  const pageRows = 200,
    pageCols = 100;
  const widths = ref<Record<string, number>>({});
  function resizeColumn(event: PointerEvent, c: number) {
    event.preventDefault();
    event.stopPropagation();
    const element = event.currentTarget as HTMLElement,
      start = event.clientX,
      width = colWidth(c);
    element.setPointerCapture(event.pointerId);
    const move = (e: PointerEvent) => {
      widths.value = {
        ...widths.value,
        [sheetName.value + ":" + c]: Math.max(
          40,
          Math.min(1800, width + (e.clientX - start) / (props.zoom / 100)),
        ),
      };
    };
    const up = () => {
      element.removeEventListener("pointermove", move);
      element.removeEventListener("pointerup", up);
      element.removeEventListener("pointercancel", up);
    };
    element.addEventListener("pointermove", move);
    element.addEventListener("pointerup", up);
    element.addEventListener("pointercancel", up);
  }
  const sheet = computed(() => book.value?.Sheets[sheetName.value]);
  const styledSheet = computed(() => styled?.getWorksheet(sheetName.value));
  const range = computed(() =>
    sheet.value?.["!ref"]
      ? XLSX.utils.decode_range(sheet.value["!ref"])
      : undefined,
  );
  const rowCount = computed(() => (range.value ? range.value.e.r + 1 : 0));
  const colCount = computed(() => (range.value ? range.value.e.c + 1 : 0));
  const startRow = computed(() => rowPage.value * pageRows);
  const startCol = computed(() => colPage.value * pageCols);
  const endRow = computed(() =>
    Math.min(rowCount.value, startRow.value + pageRows),
  );
  const endCol = computed(() =>
    Math.min(colCount.value, startCol.value + pageCols),
  );
  function rowHeight(r: number) {
    const row = styledSheet.value?.getRow(r + 1);
    const fallback = sheet.value?.["!rows"]?.[r];
    return row?.hidden || fallback?.hidden
      ? 0
      : ((row?.height || fallback?.hpt || 18) * 4) / 3;
  }
  function colWidth(c: number) {
    const col = styledSheet.value?.getColumn(c + 1);
    const fallback = sheet.value?.["!cols"]?.[c];
    return col?.hidden || fallback?.hidden
      ? 0
      : widths.value[sheetName.value + ":" + c] ||
          fallback?.wpx ||
          (col?.width || fallback?.wch || 12) * 7 + 5;
  }
  const columns = computed(() =>
    Array.from(
      { length: Math.max(0, endCol.value - startCol.value) },
      (_, i) => startCol.value + i,
    ).filter((c) => colWidth(c) > 0),
  );
  const theme = [
    "#ffffff",
    "#000000",
    "#e7e6e6",
    "#44546a",
    "#4472c4",
    "#ed7d31",
    "#a5a5a5",
    "#ffc000",
    "#5b9bd5",
    "#70ad47",
  ];
  function color(
    value?: Partial<ExcelJS.Color> & {
      rgb?: string;
      indexed?: number;
      theme?: number;
      tint?: number;
    },
  ): string | undefined {
    if (!value) return undefined;
    const hex =
      "argb" in value ? value.argb : "rgb" in value ? value.rgb : undefined;
    let result = hex
      ? "#" + hex.slice(-6)
      : value.theme !== undefined
        ? theme[value.theme]
        : value.indexed === 64
          ? "#000000"
          : undefined;
    if (result && value.tint) {
      const t = value.tint;
      result =
        "#" +
        [1, 3, 5]
          .map((i) =>
            Math.round(
              t < 0
                ? parseInt(result!.slice(i, i + 2), 16) * (1 + t)
                : parseInt(result!.slice(i, i + 2), 16) * (1 - t) + 255 * t,
            )
              .toString(16)
              .padStart(2, "0"),
          )
          .join("");
    }
    return result;
  }
  function fontStyle(font?: Partial<ExcelJS.Font>): CSSProperties {
    return font
      ? {
          fontFamily: font.name
            ? `"${font.name.replace(/["\\]/g, "")}", "Microsoft YaHei", sans-serif`
            : undefined,
          fontSize: font.size ? font.size + "pt" : undefined,
          fontWeight: font.bold ? "700" : undefined,
          fontStyle: font.italic ? "italic" : undefined,
          textDecoration:
            [
              font.underline ? "underline" : "",
              font.strike ? "line-through" : "",
            ]
              .filter(Boolean)
              .join(" ") || undefined,
          color: color(font.color),
        }
      : {};
  }
  function styleAt(r: number, c: number): CSSProperties {
    const cell = styledSheet.value?.getCell(r + 1, c + 1);
    const basic = sheet.value?.[XLSX.utils.encode_cell({ r, c })];
    const s = cell?.style;
    const result: CSSProperties = {
      ...fontStyle(s?.font),
      textAlign:
        s?.alignment?.horizontal === "centerContinuous"
          ? "center"
          : (s?.alignment?.horizontal as CSSProperties["textAlign"]) ||
            (basic?.t === "n" ? "right" : "left"),
      verticalAlign:
        s?.alignment?.vertical === "middle"
          ? "middle"
          : s?.alignment?.vertical || "bottom",
      whiteSpace: s?.alignment?.wrapText ? "pre-wrap" : "pre",
      paddingLeft: s?.alignment?.indent
        ? s.alignment.indent * 8 + 4 + "px"
        : undefined,
    };
    const fill = s?.fill;
    if (fill?.type === "pattern" && fill.pattern !== "none")
      result.backgroundColor = color(fill.fgColor) || color(fill.bgColor);
    if (!fill && basic?.s?.fgColor)
      result.backgroundColor = color(basic.s.fgColor);
    for (const side of ["top", "right", "bottom", "left"] as const) {
      const border = s?.border?.[side];
      if (!border?.style) continue;
      const width = border.style.includes("medium")
        ? 2
        : border.style === "thick"
          ? 3
          : 1;
      const line =
        border.style === "double"
          ? "double"
          : /dash/i.test(border.style)
            ? "dashed"
            : border.style === "dotted"
              ? "dotted"
              : "solid";
      (result as Record<string, string>)[
        `border${side[0].toUpperCase() + side.slice(1)}`
      ] =
        `${line === "double" ? 3 : width}px ${line} ${color(border.color) || "#222"}`;
    }
    return result;
  }
  const merged = computed(() => {
    const spans = new Map<
      string,
      { rows: number; cols: number; r: number; c: number } | null
    >();
    for (const m of sheet.value?.["!merges"] || []) {
      const r0 = Math.max(m.s.r, startRow.value),
        r1 = Math.min(m.e.r, endRow.value - 1);
      const c0 = Math.max(m.s.c, startCol.value),
        c1 = Math.min(m.e.c, endCol.value - 1);
      const visibleRows = Array.from(
        { length: Math.max(0, r1 - r0 + 1) },
        (_, i) => r0 + i,
      ).filter((r) => rowHeight(r) > 0);
      const visibleCols = columns.value.filter((c) => c >= c0 && c <= c1);
      if (!visibleRows.length || !visibleCols.length) continue;
      for (const r of visibleRows)
        for (const c of visibleCols)
          spans.set(
            `${r}:${c}`,
            r === visibleRows[0] && c === visibleCols[0]
              ? {
                  rows: visibleRows.length,
                  cols: visibleCols.length,
                  r: m.s.r,
                  c: m.s.c,
                }
              : null,
          );
    }
    return spans;
  });
  const rows = computed(() =>
    Array.from(
      { length: Math.max(0, endRow.value - startRow.value) },
      (_, i) => startRow.value + i,
    )
      .filter((r) => rowHeight(r) > 0)
      .map((r) => ({
        r,
        height: rowHeight(r),
        cells: columns.value.flatMap((c) => {
          const merge = merged.value.get(`${r}:${c}`);
          if (merge === null) return [];
          const sourceRow = merge?.r ?? r,
            sourceCol = merge?.c ?? c;
          const value =
            sheet.value?.[
              XLSX.utils.encode_cell({ r: sourceRow, c: sourceCol })
            ];
          const rich = styledSheet.value?.getCell(
            sourceRow + 1,
            sourceCol + 1,
          ).value;
          return [
            {
              c,
              text: value ? XLSX.utils.format_cell(value) : "",
              style: styleAt(sourceRow, sourceCol),
              rowspan: merge?.rows || 1,
              colspan: merge?.cols || 1,
              rich:
                rich && typeof rich === "object" && "richText" in rich
                  ? rich.richText
                  : undefined,
            },
          ];
        }),
      })),
  );
  const imageUrls = new Map<string, string>();
  function offset(from: number, to: number, dimension: (n: number) => number) {
    let result = 0;
    for (
      let i = Math.min(from, Math.floor(to));
      i < Math.max(from, Math.floor(to));
      i++
    )
      result += dimension(i);
    return (
      (to < from ? -result : result) + (to % 1) * dimension(Math.floor(to))
    );
  }
  const images = computed(() =>
    (styledSheet.value?.getImages() || []).flatMap((img) => {
      const anchor = img.range as typeof img.range & {
        ext?: { width: number; height: number };
      };
      if (!anchor?.tl || !styled) return [];
      const id = String(img.imageId);
      let url = imageUrls.get(id);
      if (!url) {
        const media = styled.getImage(Number(img.imageId));
        if (!media) return [];
        if (media.buffer)
          url = URL.createObjectURL(
            new Blob([new Uint8Array(media.buffer).slice().buffer], {
              type: "image/" + media.extension,
            }),
          );
        else if (media.base64)
          url = media.base64.startsWith("data:")
            ? media.base64
            : `data:image/${media.extension};base64,${media.base64}`;
        else return [];
        imageUrls.set(id, url);
      }
      const left = offset(startCol.value, anchor.tl.col, colWidth),
        top = offset(startRow.value, anchor.tl.row, rowHeight);
      const width =
        anchor.ext?.width ||
        (anchor.br
          ? offset(Math.floor(anchor.tl.col), anchor.br.col, colWidth) -
            (anchor.tl.col % 1) * colWidth(Math.floor(anchor.tl.col))
          : 100);
      const height =
        anchor.ext?.height ||
        (anchor.br
          ? offset(Math.floor(anchor.tl.row), anchor.br.row, rowHeight) -
            (anchor.tl.row % 1) * rowHeight(Math.floor(anchor.tl.row))
          : 100);
      if (left + width < 0 || top + height < 0) return [];
      return [
        {
          id,
          url,
          style: {
            left: left + 46 + "px",
            top: top + 28 + "px",
            width: width + "px",
            height: height + "px",
          },
        },
      ];
    }),
  );
  onMounted(async () => {
    try {
      if (props.file.ext === "xlsx") {
        styled = new ExcelJS.Workbook();
        await styled.xlsx.load(props.file.bytes.slice().buffer);
      }
      book.value = XLSX.read(props.file.bytes, {
        type: "array",
        cellStyles: true,
        cellText: true,
        cellHTML: false,
      });
      sheetName.value = book.value.SheetNames[0] || "";
      emit("ready");
    } catch (e) {
      emit(
        "error",
        "无法解析表格，文件可能损坏、加密或不兼容。" +
          (e instanceof Error ? ` ${e.message}` : ""),
      );
    }
  });
  onBeforeUnmount(() => {
    for (const url of imageUrls.values())
      if (url.startsWith("blob:")) URL.revokeObjectURL(url);
    imageUrls.clear();
    styled = undefined;
  });

  return {
    pane,
    book,
    sheetName,
    rowPage,
    colPage,
    rows,
    columns,
    colWidth,
    fontStyle,
    images,
    rowCount,
    colCount,
    pageRows,
    pageCols,
    startCol,
    endCol,
    endRow,
    resizeColumn,
    XLSX,
  };
}
