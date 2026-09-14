<script setup lang="ts">
import PageNavigation from "../../components/PageNavigation.vue";
import type { PreviewProps } from "../types";
import { usePreview } from "./usePreview";
const props = defineProps<PreviewProps>();
const emit = defineEmits<{
  ready: [];
  error: [message: string];
  "update:zoom": [value: number];
}>();
const {
  warning,
  pane,
  scroll,
  onScroll,
  jump,
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
  padTop,
  padBottom,
  resizeColumn,
  XLSX,
} = usePreview(props, emit);
</script>
<template>
  <section ref="pane" class="excel">
    <div v-if="warning" class="notice" role="status">{{ warning }}</div>
    <nav class="sheets" aria-label="工作表">
      <button
        v-for="name in book?.SheetNames"
        :key="name"
        :class="{ active: name === sheetName }"
        @click="
          sheetName = name;
          rowPage = colPage = 0;
        "
      >
        {{ name }}
      </button>
    </nav>
    <div ref="scroll" class="table-wrap" @scroll.passive="onScroll">
      <div
        v-if="rows.length"
        class="sheet-surface"
        :style="{ zoom: zoom / 100 }"
      >
        <table class="spreadsheet preview-content">
          <colgroup>
            <col style="width: 46px" />
            <col
              v-for="c in columns"
              :key="c"
              :style="{ width: colWidth(c) + 'px' }"
            />
          </colgroup>
          <thead>
            <tr>
              <th></th>
              <th v-for="c in columns" :key="c">
                {{ XLSX.utils.encode_col(c)
                }}<span
                  class="column-resize-handle"
                  role="separator"
                  aria-orientation="vertical"
                  title="拖动调整列宽"
                  @pointerdown="resizeColumn($event, c)"
                ></span>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-if="padTop > 0"
              class="row-virtual-spacer"
              aria-hidden="true"
              :style="{ height: padTop + 'px' }"
            >
              <td :colspan="columns.length + 1"></td>
            </tr>
            <tr
              v-for="row in rows"
              :key="row.r"
              :data-row="row.r"
              :style="{ height: row.height + 'px' }"
            >
              <th>{{ row.r + 1 }}</th>
              <td
                v-for="cell in row.cells"
                :key="cell.c"
                :style="cell.style"
                :rowspan="cell.rowspan"
                :colspan="cell.colspan"
                :title="cell.text"
              >
                <template v-if="cell.rich"
                  ><span
                    v-for="(run, i) in cell.rich"
                    :key="i"
                    :style="fontStyle(run.font)"
                    >{{ run.text }}</span
                  ></template
                ><template v-else>{{ cell.text }}</template>
              </td>
            </tr>
            <tr
              v-if="padBottom > 0"
              class="row-virtual-spacer"
              aria-hidden="true"
              :style="{ height: padBottom + 'px' }"
            >
              <td :colspan="columns.length + 1"></td>
            </tr>
          </tbody>
        </table>
        <img
          v-for="(img, i) in images"
          :key="img.id + ':' + i"
          class="sheet-image"
          :src="img.url"
          :style="img.style"
          alt="表格内嵌图片"
        />
      </div>
      <p v-else class="empty">此工作表没有数据</p>
    </div>
    <footer class="sheet-footer">
      <span
        >{{ rowCount.toLocaleString() }} 行 ·
        {{ colCount.toLocaleString() }} 列</span
      >
      <div v-if="colCount > pageCols">
        <button :disabled="colPage === 0" @click="colPage--">
          前 {{ pageCols }} 列</button
        ><span>{{ startCol + 1 }}–{{ endCol }} 列</span
        ><button :disabled="endCol >= colCount" @click="colPage++">
          后 {{ pageCols }} 列
        </button>
      </div>
    </footer>
    <PageNavigation
      v-if="rowCount > pageRows"
      :current="rowPage + 1"
      :total="Math.ceil(rowCount / pageRows)"
      label="行分组"
      @jump="jump"
    />
  </section>
</template>
