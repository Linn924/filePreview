export type { PreviewFile } from "../shared/contracts";
import type { DesktopBridge } from "../shared/contracts";
declare global {
  interface Window {
    localPreview: DesktopBridge;
  }
}
export function fileSize(size: number) {
  return size < 1024
    ? `${size} B`
    : size < 1048576
      ? `${(size / 1024).toFixed(1)} KB`
      : `${(size / 1048576).toFixed(1)} MB`;
}
