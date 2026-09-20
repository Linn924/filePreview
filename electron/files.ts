import { open } from "node:fs/promises";
import path from "node:path";
import { previewError } from '../shared/previewError';
import { randomUUID } from "node:crypto";
import { extensions, type PreviewFile } from "../shared/contracts";

const selectedPaths = new Map<string, string>();

/** 文本类扩展名，限制 5 MB；其余格式限制 100 MB。 */
const TEXT_EXTS = new Set(["txt", "text", "json", "md", "log", "xml"]);

/**
 * 内部公共校验：打开文件句柄，检查类型、格式与大小限制。
 * 成功时返回 { handle, stat, limit }；失败时设置 file.error 并返回 null。
 */
async function openAndValidate(
  filePath: string,
  file: PreviewFile,
): Promise<{ handle: Awaited<ReturnType<typeof open>>; size: number } | null> {
  let handle;
  try {
    handle = await open(filePath, "r");
    const stat = await handle.stat();
    file.size = stat.size;
    if (!stat.isFile()) throw new Error("请选择文件，暂不支持文件夹。");
    if (!extensions.includes(file.ext)) throw new Error("暂不支持此文件格式。");
    const limit = TEXT_EXTS.has(file.ext) ? 5 : 100;
    if (stat.size > limit * 1024 * 1024)
      throw new Error(`文件超过 ${limit} MB，请选择较小的文件。`);
    return { handle, size: stat.size };
  } catch (e) {
    await handle?.close();
    file.error =
      (e as NodeJS.ErrnoException)?.code
        ? previewError(e, "文件")
        : e instanceof Error
          ? e.message
          : "无法读取文件。";
    return null;
  }
}

/** 元数据阶段：仅校验并记录路径，不读取字节。 */
export async function preparePreviewFile(filePath: string): Promise<PreviewFile> {
  const file: PreviewFile = {
    id: randomUUID(),
    name: path.basename(filePath),
    ext: path.extname(filePath).slice(1).toLowerCase(),
    size: 0,
    bytes: new Uint8Array(),
    error: "",
  };
  const result = await openAndValidate(filePath, file);
  if (result) {
    await result.handle.close();
    selectedPaths.set(file.id, filePath);
  }
  return file;
}

/** 按需加载：标签挂载时读取字节。 */
export async function loadPreparedFile(file: PreviewFile): Promise<PreviewFile> {
  if (file.bytes?.byteLength || file.error) return file;
  const selected = selectedPaths.get(file.id);
  if (!selected) return { ...file, error: "文件已关闭，请重新选择。" };
  const loaded = await readPreviewFile(selected);
  return { ...loaded, id: file.id, view: file.view };
}

export function releasePreparedFile(id: string) { selectedPaths.delete(id); }
export function preparedFileCount() { return selectedPaths.size; }

/** 直接读取文件的完整字节（供打印等场景使用）。 */
export async function readPreviewFile(filePath: string): Promise<PreviewFile> {
  const file: PreviewFile = {
    id: randomUUID(),
    name: path.basename(filePath),
    ext: path.extname(filePath).slice(1).toLowerCase(),
    size: 0,
    bytes: new Uint8Array(),
    error: "",
  };
  const result = await openAndValidate(filePath, file);
  if (!result) return file;
  try {
    file.bytes = new Uint8Array(await result.handle.readFile());
  } catch (e) {
    file.error = previewError(e, "文件");
  } finally {
    await result.handle.close();
  }
  return file;
}

export function fileArguments(args: string[]): string[] {
  return args.filter(
    (arg) =>
      path.isAbsolute(arg) &&
      extensions.includes(path.extname(arg).slice(1).toLowerCase()),
  );
}
