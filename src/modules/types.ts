import type { Component } from "vue";
import type { PreviewFile } from "../../shared/contracts";
export interface PreviewModule {
  id: string;
  extensions: string[];
  component: Component;
}
export interface PreviewProps {
  file: PreviewFile;
  zoom: number;
  wheelZoom?: boolean;
}
export interface PreviewEmit {
  (event: "ready"): void;
  (event: "error", message: string): void;
  (event: "update:zoom", value: number): void;
}
