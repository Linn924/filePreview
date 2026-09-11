import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { writeFileSync, mkdirSync } from "node:fs";
type Target = {
  id: string;
  type: string;
  url: string;
  webSocketDebuggerUrl: string;
};
type Command = (
  method: string,
  params?: Record<string, unknown>,
) => Promise<any>;
const exe = resolve(
  process.argv[2] || "outputs/release/win-unpacked/File Preview.exe",
);
const profile = resolve("work/test-profiles/package-" + process.pid);
mkdirSync(profile, { recursive: true });
mkdirSync("outputs/verification", { recursive: true });
const child = spawn(
  exe,
  [
    "--remote-debugging-port=19387",
    "--user-data-dir=" + profile,
    resolve("work/fixtures/document.pdf"),
  ],
  { windowsHide: true, stdio: "ignore" },
);
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const sockets: WebSocket[] = [];
async function connect(url: string): Promise<Command> {
  const socket = new WebSocket(url);
  await new Promise((resolve, reject) => {
    socket.onopen = resolve;
    socket.onerror = reject;
  });
  const pending = new Map<
    number,
    { resolve: (value: any) => void; reject: (error: Error) => void }
  >();
  let id = 0;
  socket.onmessage = (event) => {
    const m = JSON.parse(String(event.data));
    const p = pending.get(m.id);
    if (p) {
      pending.delete(m.id);
      m.error ? p.reject(Error(JSON.stringify(m.error))) : p.resolve(m.result);
    }
  };
  socket.onclose = () => {
    for (const p of pending.values()) p.reject(Error("Connection closed"));
    pending.clear();
  };
  sockets.push(socket);
  return (method, params = {}) =>
    new Promise((resolve, reject) => {
      const next = ++id;
      pending.set(next, { resolve, reject });
      socket.send(JSON.stringify({ id: next, method, params }));
    });
}
const targets = async (): Promise<Target[]> =>
  (await (await fetch("http://127.0.0.1:19387/json")).json()) as Target[];
async function waitFor<T>(
  check: () => Promise<T | undefined | false>,
  label: string,
): Promise<T> {
  for (let i = 0; i < 150; i++) {
    try {
      const result = await check();
      if (result) return result;
    } catch {}
    await pause(200);
  }
  throw Error(label);
}
async function evaluate(command: Command, expression: string) {
  const r = await command("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (r.exceptionDetails) throw Error(JSON.stringify(r.exceptionDetails));
  return r.result.value;
}
const results: string[] = [];
try {
  const first = await waitFor(
    async () => (await targets()).find((t) => t.url.includes("?preview=1")),
    "File argument was not opened",
  );
  const view = await connect(first.webSocketDebuggerUrl);
  await waitFor(
    () =>
      evaluate(
        view,
        "document.querySelector('canvas')?.width>0&&!document.querySelector('.loading')",
      ),
    "Packaged PDF render",
  );
  results.push("PASS command-line PDF file opened in packaged app");
  const before = new Set((await targets()).map((t) => t.id));
  const second = spawn(
    exe,
    ["--user-data-dir=" + profile, resolve("work/fixtures/presentation.pptx")],
    { windowsHide: true, stdio: "ignore" },
  );
  const incoming = await waitFor(
    async () =>
      (await targets()).find(
        (t) => !before.has(t.id) && t.url.includes("?preview=1"),
      ),
    "Second-instance file delivery",
  );
  const ppt = await connect(incoming.webSocketDebuggerUrl);
  await waitFor(
    () =>
      evaluate(
        ppt,
        "document.querySelector('.slide-host')?.shadowRoot?.textContent.length>150&&!document.querySelector('.loading')",
      ),
    "Packaged PPT render",
  );
  results.push("PASS second-instance PPTX delivered to existing application");
  await evaluate(view, "setTimeout(()=>window.localPreview.close(),100);true");
  await evaluate(ppt, "setTimeout(()=>window.localPreview.close(),100);true");
  await pause(250);
  const home = (await targets()).find((t) => t.type === "page");
  if (home) {
    const command = await connect(home.webSocketDebuggerUrl);
    await evaluate(
      command,
      "setTimeout(()=>window.localPreview.close(),100);true",
    );
  }
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    pause(1500),
  ]);
  if (second.exitCode === null) second.kill();
  writeFileSync("outputs/verification/package-v3.txt", results.join("\n"));
  console.log(results.join("\n"));
} finally {
  for (const socket of sockets) socket.close();
  if (child.exitCode === null) child.kill();
}
