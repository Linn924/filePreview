import word from "./word";
import text from "./text";
import excel from "./excel";
import ppt from "./ppt";
import pdf from "./pdf";
import image from "./image";
export const previewModules = [word, text, excel, ppt, pdf, image];
export function getPreviewModule(extension: string) {
  return previewModules.find((module) =>
    module.extensions.includes(extension.toLowerCase()),
  );
}
