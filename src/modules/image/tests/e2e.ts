import type { Suite } from "../../../../tests/context";
import { existsSync, writeFileSync } from "node:fs";
const suite: Suite = async (c) => {
  for (const ext of ["jpeg", "webp", "gif", "bmp"]) {
    if (existsSync(c.fixture("image." + ext))) continue;
    let bytes: Buffer;
    if (ext === "jpeg" || ext === "webp")
      bytes = Buffer.from(
        await c.evaluate<string>(
          c.home,
          `(()=>{const canvas=document.createElement('canvas');canvas.width=canvas.height=2;return canvas.toDataURL('image/${ext}').split(',')[1]})()`,
        ),
        "base64",
      );
    else if (ext === "gif")
      bytes = Buffer.from(
        "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
        "base64",
      );
    else {
      bytes = Buffer.alloc(58);
      bytes.write("BM");
      bytes.writeUInt32LE(58, 2);
      bytes.writeUInt32LE(54, 10);
      bytes.writeUInt32LE(40, 14);
      bytes.writeInt32LE(1, 18);
      bytes.writeInt32LE(1, 22);
      bytes.writeUInt16LE(1, 26);
      bytes.writeUInt16LE(24, 28);
      bytes[54] = 255;
    }
    writeFileSync(c.fixture("image." + ext), bytes);
  }
  for (const name of [
    "image.png",
    "vector.svg",
    "image.jpeg",
    "image.webp",
    "image.gif",
    "image.bmp",
  ]) {
    const win = await c.open(name);
    await c.check(
      win,
      "image decoded " + name,
      "document.querySelector('.image img').naturalWidth>0",
    );
    const width = (await c.evaluate(
      win,
      "document.querySelector('.image img').getBoundingClientRect().width",
    )) as number;
    await c.wheel(win, ".image img", -120);
    await c.check(
      win,
      "image wheel does not zoom",
      "document.querySelector('.zoom-control input').value==='100'",
    );
    await c.check(
      win,
      "image zoom keeps fit baseline",
      `Math.abs(document.querySelector('.image img').getBoundingClientRect().width/${width}-1)<0.03`,
    );
    c.close(win);
  }
  c.program.updateSettings({ theme: "dark" });
  const dark = await c.open("vector.svg");
  await c.check(
    dark,
    "dark image background has no bright grid",
    "getComputedStyle(document.querySelector('.image')).backgroundImage==='none'&&getComputedStyle(document.querySelector('.image')).backgroundColor==='rgb(37, 42, 50)'",
  );
  await c.snapshot(dark, "image-dark");
  c.close(dark);
};
export default suite;
