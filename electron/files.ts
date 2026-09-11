import { open } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { extensions, type PreviewFile } from "../shared/contracts";
export async function readPreviewFile(filePath: string): Promise<PreviewFile> {
  const file: PreviewFile = {
    id: randomUUID(),
    name: path.basename(filePath),
    ext: path.extname(filePath).slice(1).toLowerCase(),
    size: 0,
    bytes: new Uint8Array(),
    error: "",
  };
  let handle;
  try {
    handle = await open(filePath, "r");
    const stat = await handle.stat();
    file.size = stat.size;
    if (!stat.isFile()) throw new Error("请选择文件，暂不支持文件夹。");
    if (!extensions.includes(file.ext)) throw new Error("暂不支持此文件格式。");
    const limit = ["txt", "text", "json", "md", "log", "xml"].includes(file.ext)
      ? 5
      : 100;
    if (stat.size > limit * 1024 * 1024)
      throw new Error(`文件超过 ${limit} MB，请选择较小的文件。`);
    file.bytes = new Uint8Array(await handle.readFile());
  } catch (e) {
    file.error = e instanceof Error ? e.message : "无法读取文件。";
  } finally {
    await handle?.close();
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
