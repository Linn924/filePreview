import { spawn } from 'node:child_process'
import { resolve } from 'node:path'
import { writeFileSync } from 'node:fs'
const exe = resolve(process.argv[2] || 'outputs/release/win-unpacked/File Preview.exe')
const child = spawn(exe, ['--remote-debugging-port=19387'], { windowsHide: true, stdio: 'ignore' })
const pause = ms => new Promise(r => setTimeout(r, ms))
const clients = []
async function connect(url) {
  const socket = new WebSocket(url)
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject })
  const pending = new Map(); let id = 0
  socket.onclose = () => { for (const p of pending.values()) p.reject(new Error('Connection closed')); pending.clear() }
  socket.onmessage = event => { const m = JSON.parse(event.data); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result) } }
  clients.push(socket)
  return (method, params = {}) => new Promise((resolve, reject) => { const n = ++id; pending.set(n, { resolve, reject }); socket.send(JSON.stringify({ id: n, method, params })) })
}
async function targets() { return await (await fetch('http://127.0.0.1:19387/json')).json() }
async function waitFor(fn, name) { for (let i=0;i<150;i++) { try { const result=await fn(); if(result) return result } catch {} await pause(200) } throw new Error(name) }
const results=[]
let browser
try {
  const version = await waitFor(async()=>{const r=await fetch('http://127.0.0.1:19387/json/version');return r.json()}, 'Packaged application startup')
  browser = await connect(version.webSocketDebuggerUrl)
  const home = await waitFor(async()=>(await targets()).find(t=>t.type==='page' && t.url==='preview://local/index.html'), 'Home target')
  const command = await connect(home.webSocketDebuggerUrl)
  async function evaluate(cmd, expression) { const result = await cmd('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if(result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails)); return result.result.value }
  await waitFor(()=>evaluate(command, `!!document.querySelector('.welcome') && !!window.localPreview`), 'Packaged home rendering')
  results.push('PASS packaged application and preload start')
  for (const [filename, condition] of [['styled.xlsx',`document.querySelector('table')?.textContent.includes('季度销售报告')`],['document.pdf',`document.querySelector('canvas')?.width > 0 && !document.querySelector('.loading')`],['presentation.pptx',`document.querySelector('.slide-host')?.textContent.length > 5 && !document.querySelector('.loading')`]]) {
    await evaluate(command, `(()=>{const i=document.createElement('input');i.type='file';i.id='package-test';document.body.append(i)})()`)
    const doc = await command('DOM.getDocument')
    const node = await command('DOM.querySelector',{nodeId:doc.root.nodeId,selector:'#package-test'})
    await command('DOM.setFileInputFiles',{nodeId:node.nodeId,files:[resolve('work/fixtures',filename)]})
    await evaluate(command, `(()=>{const dt=new DataTransfer();dt.items.add(document.querySelector('#package-test').files[0]);document.querySelector('main').dispatchEvent(new DragEvent('drop',{bubbles:true,dataTransfer:dt}));document.querySelector('#package-test').remove()})()`)
    const preview=await waitFor(async()=>(await targets()).find(t=>t.type==='page'&&t.url.includes('?preview=1')), 'Preview window created')
    const renderer=await connect(preview.webSocketDebuggerUrl)
    await waitFor(()=>evaluate(renderer,condition),'Packaged preview '+filename)
    results.push('PASS packaged new-window preview '+filename)
    await browser('Target.closeTarget',{targetId:preview.id})
    await waitFor(async()=>!(await targets()).some(t=>t.id===preview.id),'Preview window closed')
  }
  writeFileSync('outputs/verification/package-smoke.txt',results.join('\n')+'\n')
  console.log(results.join('\n'))
} finally {
  if(browser) { try { await browser('Browser.close') } catch {} }
  for(const client of clients) client.close()
  if(child.exitCode === null) child.kill()
}
