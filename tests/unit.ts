import assert from "node:assert/strict";
import { previewError } from '../shared/previewError';
assert.match(previewError({name:'PasswordException'}, 'PDF'), /密码保护/);
assert.match(previewError({code:'ENOENT'}, '文件'), /移动或删除/);
assert.match(previewError({code:'EACCES'}, '文件'), /权限/);
assert.match(previewError({name:'InvalidPDFException'}, 'PDF'), /损坏/);
assert.ok(!previewError(new Error('secret-path'), 'Word').includes('secret-path'));
import {
  paperSize,
  selectedPages,
  printDefaults,
  validatePrintOptions,
} from "../shared/printing";
import { fitScale } from "../src/composables/fit";
assert.deepEqual(paperSize({ ...printDefaults, paper: "A5" }), {
  width: 148,
  height: 210,
});
assert.deepEqual(
  paperSize({ ...printDefaults, paper: "A5", landscape: true }),
  { width: 210, height: 148 },
);
assert.deepEqual(selectedPages("1-3,2,5", 5), [1, 2, 3, 5]);
assert.throws(() => selectedPages("6", 5));
assert.throws(() =>
  validatePrintOptions({ ...printDefaults, deviceName: "printer", copies: 0 }),
);
assert.equal(fitScale(100, 200, 400, 400, "width"), 4);
assert.equal(fitScale(100, 200, 400, 400, "page"), 2);
import { defaults, normalizeSettings, extensions } from "../shared/contracts";
import { readFileSync } from "node:fs";
import { clampZoom } from "../src/composables/zoom";
import { fileArguments } from "../electron/files";
assert.equal(clampZoom(1), 25);
assert.equal(clampZoom(1000), 400);
assert.equal(clampZoom(137.4), 137);
assert.deepEqual(normalizeSettings({}), defaults);
assert.equal(normalizeSettings({ defaultZoom: NaN }).defaultZoom, 100);
assert.equal(normalizeSettings({ defaultZoom: 0 }).defaultZoom, 25);
assert.equal(normalizeSettings({ theme: "dark" }).theme, "dark");
assert.equal(
  "filePath" in normalizeSettings({ filePath: "secret" } as never),
  false,
);
assert.deepEqual(
  fileArguments([
    "--flag",
    "https://example.com/file.pdf",
    "C:\\data\\中文.pdf",
  ]),
  ["C:\\data\\中文.pdf"],
);
console.log(
  "PASS unit: zoom boundaries, settings validation, preference whitelist, command-line paths",
);
const associations = readFileSync("electron-dist/associations.nsh", "utf8");
for (const ext of extensions)
  assert.ok(
    associations.includes(`Software\\Classes\\.${ext}\\OpenWithProgids`),
  );
assert.ok(!associations.includes("UserChoice"));
assert.ok(
  !/WriteRegStr[^\n]+"Software\\Classes\\\.[^"\\]+"/.test(associations),
);
assert.ok(associations.includes('"%1"'));
console.log(
  "PASS installer: Open With supports all formats and preserves default associations",
);
