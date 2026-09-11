const { app, BrowserWindow, dialog, nativeImage } = require('electron')
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const root = path.resolve(__dirname, '../work/fixtures')
const output = path.resolve(__dirname, '../outputs/verification')
fs.mkdirSync(output, { recursive: true })
const results = [], errors = []
const pause = ms => new Promise(resolve => setTimeout(resolve, ms))
const digest = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
app.on('browser-window-created', (_event, win) => {
  win.webContents.on('console-message', event => { if (event.level === 'error') errors.push(event.message) })
})
const program = require('../electron/main.cjs')
async function check(win, name, expression) {
  for (let i = 0; i < 200; i++) {
    if (await win.webContents.executeJavaScript(expression)) { results.push('PASS ' + name); return }
    await pause(100)
  }
  throw new Error(name + ': ' + await win.webContents.executeJavaScript('document.body.innerText'))
}
async function snapshot(win, name) { win.showInactive(); await pause(700); fs.writeFileSync(path.join(output, name + '.png'), (await win.webContents.capturePage()).toPNG()) }
async function open(name) {
  const win = await program.openPath(path.join(root, name))
  await check(win, 'load ' + name, `!!document.querySelector('.filebar') && !document.querySelector('.loading')`)
  return win
}
async function clickText(win, selector, label) { await win.webContents.executeJavaScript(`Array.from(document.querySelectorAll(${JSON.stringify(selector)})).find(b => b.textContent.trim() === ${JSON.stringify(label)}).click()`); await pause(120) }
const timeout = setTimeout(() => { console.error('Test timed out', results, errors); app.exit(1) }, 240000)
program.ready.then(async home => {
  const originalFiles = new Map(fs.readdirSync(root).map(name => [name, digest(path.join(root, name))]))
  try {
    await check(home, 'home ready', `document.body.innerText.includes('独立窗口')`)
    await snapshot(home, 'home')
    // Exercise the actual native-picker IPC path, while replacing only the modal selection.
    const realDialog = dialog.showOpenDialog
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [path.join(root, 'text.txt'), path.join(root, 'data.json')] })
    await clickText(home, 'header button', '选择文件')
    for (let i = 0; i < 100 && BrowserWindow.getAllWindows().length < 3; i++) await pause(100)
    dialog.showOpenDialog = realDialog
    const children = BrowserWindow.getAllWindows().filter(w => w.id !== home.id)
    if (children.length !== 2) throw new Error('Picker must open 2 independent windows')
    await check(home, 'home remains unchanged', `!!document.querySelector('.welcome') && !document.querySelector('.filebar')`)
    for (const child of children) {
      await check(child, 'independent document loaded', `!!document.querySelector('pre') && !document.querySelector('.loading')`)
      child.close()
    }
    if (program.payloads.size) throw new Error('Main-process payloads were not released')
    results.push('PASS per-window payload consumed and released')
    // Create a real file-backed File object through CDP, then dispatch the same DOM drop event as a user.
    home.webContents.debugger.attach('1.3')
    await home.webContents.executeJavaScript(`(() => { const input = document.createElement('input'); input.type = 'file'; input.id = 'test-drop'; input.hidden = true; document.body.append(input) })()`)
    const tree = await home.webContents.debugger.sendCommand('DOM.getDocument')
    const node = await home.webContents.debugger.sendCommand('DOM.querySelector', { nodeId: tree.root.nodeId, selector: '#test-drop' })
    await home.webContents.debugger.sendCommand('DOM.setFileInputFiles', { nodeId: node.nodeId, files: [path.join(root, 'legacy.xls')] })
    await home.webContents.executeJavaScript(`(() => { const dt = new DataTransfer(); dt.items.add(document.querySelector('#test-drop').files[0]); document.querySelector('main').dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer: dt })); document.querySelector('#test-drop').remove() })()`)
    home.webContents.debugger.detach()
    for (let i = 0; i < 100 && BrowserWindow.getAllWindows().length < 2; i++) await pause(100)
    let win = BrowserWindow.getAllWindows().find(w => w.id !== home.id)
    if (!win) throw new Error('Drop did not open new window')
    await check(win, 'real file drop / XLS', `document.querySelector('table')?.textContent.includes('旧版 Excel')`)
    win.close()
    win = await open('styled.xlsx')
    await check(win, 'xlsx styles and merges', `(() => { const c = document.querySelector('td[colspan="4"][rowspan="2"]'); return c && getComputedStyle(c).backgroundColor === 'rgb(40, 90, 159)' && getComputedStyle(c).fontWeight === '700' })()`)
    await check(win, 'xlsx number formatting', `document.querySelector('table').textContent.includes('87.5%') && document.querySelector('table').textContent.includes('12,500.50')`)
    await snapshot(win, 'excel')
    await clickText(win, '.sheets button', '说明')
    await check(win, 'sheet switch', `document.querySelector('table').textContent.includes('第二个工作表')`)
    await clickText(win, '.sheets button', '分页测试')
    await clickText(win, 'footer button', '下一页')
    await check(win, 'row paging', `document.querySelector('tbody th').textContent === '201'`)
    await clickText(win, 'footer button', '上一页')
    await clickText(win, 'footer button', '后 100 列')
    await check(win, 'all columns accessible', `document.querySelector('table').textContent.includes('第105列')`)
    win.close()
    for (const [name, expression] of [
      ['text.txt', `document.querySelector('pre')?.textContent.includes('<script>') && !window.BAD`],
      ['data.json', `document.querySelector('pre')?.textContent.includes(String.fromCharCode(10))`],
      ['invalid.json', `document.body.innerText.includes('JSON 格式不完整')`],
      ['table.csv', `document.querySelector('table')?.textContent.includes('中文')`],
      ['readme.md', `document.querySelector('.markdown h1')?.textContent === 'Markdown 预览' && !window.BAD`],
      ['vector.svg', `document.querySelector('.image img')?.naturalWidth === 400`],
      ['image.png', `document.querySelector('.image img')?.naturalWidth === 1`]
    ]) { win = await open(name); await check(win, 'render ' + name, expression); win.close() }
    for (const ext of ['jpeg', 'webp', 'gif', 'bmp']) {
      let bytes
      if (ext === 'jpeg') bytes = Buffer.from(await home.webContents.executeJavaScript(`(() => { const c=document.createElement('canvas');c.width=c.height=2;return c.toDataURL('image/jpeg').split(',')[1] })()`), 'base64')
      else if (ext === 'webp') bytes = Buffer.from(await home.webContents.executeJavaScript(`(() => { const c=document.createElement('canvas');c.width=c.height=2;return c.toDataURL('image/webp').split(',')[1] })()`), 'base64')
      else if (ext === 'gif') bytes = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64')
      else { bytes = Buffer.alloc(58); bytes.write('BM'); bytes.writeUInt32LE(58, 2); bytes.writeUInt32LE(54, 10); bytes.writeUInt32LE(40, 14); bytes.writeInt32LE(1, 18); bytes.writeInt32LE(1, 22); bytes.writeUInt16LE(1, 26); bytes.writeUInt16LE(24, 28); bytes[54] = 255 }
      fs.writeFileSync(path.join(root, 'image.' + ext), bytes)
      win = await open('image.' + ext); await check(win, ext + ' decode', `document.querySelector('.image img')?.naturalWidth > 0`); win.close()
    }
    win = await open('document.docx')
    await check(win, 'DOCX text and table', `(() => { const s=document.querySelector('.word-host')?.shadowRoot; return s?.textContent.includes('本地 Word 预览测试') && !!s.querySelector('table') })()`)
    await snapshot(win, 'word'); win.close()
    win = await open('legacy.doc')
    await check(win, 'binary DOC content', `document.querySelector('.word-host')?.shadowRoot?.textContent.length > 100`)
    await snapshot(win, 'legacy-word'); win.close()
    win = await open('presentation.pptx')
    await check(win, 'PPTX slide content', `document.querySelector('.slide-host')?.textContent.length > 5`)
    await snapshot(win, 'powerpoint')
    await clickText(win, '.page-nav button', '下一页')
    await check(win, 'PPTX page switch', `document.querySelector('.page-nav div').textContent.includes('2 /')`)
    win.close()
    win = await open('legacy.ppt')
    await check(win, 'binary PPT slide', `!!document.querySelector('.slide-host svg') && document.querySelector('.slide-host').textContent.length > 0`)
    await snapshot(win, 'legacy-powerpoint'); win.close()
    win = await open('document.pdf')
    await check(win, 'PDF actual pixels', `(() => { const c=document.querySelector('canvas'); if(!c || !c.width) return false; return c.getContext('2d').getImageData(0,0,c.width,c.height).data.some((v,i)=>i%4!==3 && v<150) })()`)
    await snapshot(win, 'pdf')
    await clickText(win, '.page-nav button', '下一页')
    await check(win, 'PDF second page', `document.querySelector('input[type=number]').value === '2' && !document.body.innerText.includes('正在绘制')`)
    await check(win, 'preview-only PDF', `!document.querySelector('iframe,embed,object') && !Array.from(document.querySelectorAll('button,a')).some(e=>/保存|打印|下载/.test(e.textContent))`)
    win.close()
    for (const name of ['broken.docx', 'unsupported.bin']) { win = await open(name); await check(win, 'error handled ' + name, `!!document.querySelector('.error')`); win.close() }
    await check(home, 'network denied', `fetch('https://example.com').then(()=>false,()=>true)`)
    if (home.webContents.session.isPersistent()) throw new Error('Session must be in-memory')
    if (program.payloads.size) throw new Error('Payload leak')
    results.push('PASS nonpersistent session / no retained payloads')
    for (const [name, hash] of originalFiles) if (!['image.jpeg', 'image.webp', 'image.gif', 'image.bmp'].includes(name) && digest(path.join(root, name)) !== hash) throw new Error('Source file changed: ' + name)
    results.push('PASS all original files unchanged (SHA256)')
    fs.writeFileSync(path.join(output, 'smoke.txt'), results.join('\n') + '\n')
    fs.writeFileSync(path.join(output, 'console.json'), JSON.stringify(errors, null, 2))
    console.log(results.join('\n'))
    clearTimeout(timeout); app.exit(0)
  } catch (error) {
    console.error(results.join('\n'), error, errors)
    fs.writeFileSync(path.join(output, 'failure.txt'), results.join('\n') + '\n' + String(error) + '\n' + errors.join('\n'))
    clearTimeout(timeout); app.exit(1)
  }
})
