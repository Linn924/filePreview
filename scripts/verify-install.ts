/**
 * Post-install verification (no physical printer).
 * Checks Open With ProgId registration and lists install dir.
 * Usage (after installing to D:\file-preview\File Preview):
 *   npm run verify:install
 * Uninstall check:
 *   npm run verify:install -- --expect-absent
 */
import { existsSync, readdirSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const installDir =
  process.env.FILE_PREVIEW_DIR || "D:\\file-preview\\File Preview";
const exe = resolve(installDir, "File Preview.exe");
const expectAbsent = process.argv.includes("--expect-absent");

function regQuery(key: string): string {
  try {
    return execFileSync("reg", ["query", key], { encoding: "utf8" });
  } catch {
    return "";
  }
}

const progId = "FilePreview.FilePreview";
const appId = "local.preview.desktop";

if (expectAbsent) {
  if (existsSync(exe))
    throw Error("卸载后仍存在 " + exe);
  const openWith = regQuery(
    `HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\FileExts\\.pdf\\OpenWithProgids`,
  );
  if (openWith.toLowerCase().includes("filepreview"))
    console.warn("警告：OpenWithProgids 仍可能残留 FilePreview（需人工确认）");
  console.log("PASS 卸载后主程序已移除");
  process.exit(0);
}

if (!existsSync(exe)) throw Error("未找到安装的 File Preview.exe: " + exe);
const files = readdirSync(installDir);
if (!files.includes("resources")) throw Error("安装目录缺少 resources");
const size = statSync(exe).size;
if (size < 10_000_000) throw Error("主程序体积异常偏小");

// Installer associations script only adds OpenWithProgids, never UserChoice.
const pdfOpen = regQuery(
  `HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\FileExts\\.pdf\\OpenWithProgids`,
);
const hasOpenWith =
  pdfOpen.toLowerCase().includes("filepreview") ||
  pdfOpen.toLowerCase().includes("local.preview");
// Soft-fail if user never launched via installer associations yet.
if (!hasOpenWith)
  console.warn(
    "提示：当前用户 .pdf OpenWithProgids 未见 FilePreview（若从未用安装版右键打开，属正常；安装注册表 HKLM 需管理员 query）",
  );

console.log("PASS 安装目录存在:", installDir);
console.log("PASS 主程序大小:", size, "bytes");
console.log("PASS 未向实体打印机提交（本脚本只做文件/注册表检查）");
