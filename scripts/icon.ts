import pngToIco from "png-to-ico";
import { writeFile } from "node:fs/promises";
// Format conversion of the user-provided logo; no generated replacement artwork.
await writeFile("assets/icon.ico", await pngToIco("assets/logo.png"));
