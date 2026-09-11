import assert from "node:assert/strict";
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
