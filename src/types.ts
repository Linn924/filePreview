export type PreviewFile = { name: string; size: number; ext: string; bytes: Uint8Array; error: string }
declare global {
  interface Window {
    localPreview: { select(): Promise<void>; drop(files: File[]): Promise<void>; consume(): Promise<PreviewFile | undefined>; close(): void }
  }
}
export function fileSize(size: number) { return size < 1024 ? `${size} B` : size < 1048576 ? `${(size / 1024).toFixed(1)} KB` : `${(size / 1048576).toFixed(1)} MB` }
