const { app, BrowserWindow, session, Menu, dialog, ipcMain, net, protocol } = require('electron')
const { readFile, stat } = require('node:fs/promises')
const path = require('node:path')
const { pathToFileURL } = require('node:url')
protocol.registerSchemesAsPrivileged([{ scheme: 'preview', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }])
for (const flag of ['disable-http-cache', 'disable-gpu-shader-disk-cache', 'disable-background-networking', 'disable-breakpad']) app.commandLine.appendSwitch(flag)
const payloads = new Map()
const previewWindows = new Set()
let localSession
const extensions = ['docx', 'doc', 'txt', 'text', 'json', 'md', 'log', 'xml', 'xlsx', 'xls', 'csv', 'tsv', 'pptx', 'ppt', 'pdf', 'png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'svg']
const assetRoot = path.resolve(__dirname, '../dist')

function createWindow(preview = false, title = 'File Preview') {
  const win = new BrowserWindow({ width: preview ? 1200 : 940, height: preview ? 860 : 720, minWidth: 720, minHeight: 520, show: false, title, backgroundColor: '#f5f6f8', autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), session: localSession, nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true, spellcheck: false } })
  const contentId = win.webContents.id
  win.once('ready-to-show', () => { if (!win.isDestroyed()) win.show() })
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  win.webContents.on('will-navigate', event => event.preventDefault())
  win.webContents.on('will-frame-navigate', event => event.preventDefault())
  win.webContents.on('will-attach-webview', event => event.preventDefault())
  win.webContents.on('page-title-updated', event => event.preventDefault())
  win.webContents.on('before-input-event', (event, input) => {
    if ((input.control || input.meta) && ['s', 'p'].includes(input.key.toLowerCase())) event.preventDefault()
  })
  if (preview) previewWindows.add(win.id)
  win.on('closed', () => { payloads.delete(contentId); previewWindows.delete(win.id) })
  return win
}

async function openPath(filePath) {
  if (previewWindows.size >= 12) throw new Error('最多同时打开 12 个预览窗口，请先关闭部分窗口。')
  const name = path.basename(filePath)
  const ext = path.extname(name).slice(1).toLowerCase()
  const payload = { name, size: 0, ext, bytes: new Uint8Array(), error: '' }
  try {
    const info = await stat(filePath)
    payload.size = info.size
    if (!info.isFile()) throw new Error('请选择文件，暂不支持文件夹。')
    if (!extensions.includes(ext)) throw new Error('暂不支持此格式。请选择 Word、Excel、PPT、PDF、文本或图片文件。')
    if (info.size > 100 * 1024 * 1024) throw new Error('文件超过 100 MB，请使用较小的文件。')
    if (['txt', 'text', 'json', 'md', 'log', 'xml'].includes(ext) && info.size > 5 * 1024 * 1024) throw new Error('文本文件超过 5 MB，请使用较小的文件。')
    payload.bytes = new Uint8Array(await readFile(filePath))
  } catch (error) { payload.error = error instanceof Error ? error.message : '无法读取文件。' }
  const win = createWindow(true, name + ' — File Preview')
  payloads.set(win.webContents.id, payload)
  await win.loadURL('preview://local/index.html?preview=1')
  return win
}

function trusted(event) {
  if (event.senderFrame !== event.sender.mainFrame || !event.senderFrame.url.startsWith('preview://local/')) throw new Error('无效调用来源。')
}

const ready = app.whenReady().then(async () => {
  Menu.setApplicationMenu(null)
  // No persist: prefix: selected content and storage belong to an in-memory session.
  localSession = session.fromPartition('local-preview-memory', { cache: false })
  localSession.setPermissionRequestHandler((_wc, _permission, callback) => callback(false))
  localSession.setPermissionCheckHandler(() => false)
  localSession.on('will-download', event => event.preventDefault())
  localSession.webRequest.onBeforeRequest({ urls: ['<all_urls>'] }, (details, callback) => {
    callback({ cancel: !details.url.startsWith('preview://local/') && !details.url.startsWith('blob:') && !details.url.startsWith('data:') })
  })
  await localSession.protocol.handle('preview', request => {
    try {
      const url = new URL(request.url)
      if (url.hostname !== 'local') return new Response(null, { status: 403 })
      const asset = path.resolve(assetRoot, '.' + decodeURIComponent(url.pathname))
      if (!asset.startsWith(assetRoot + path.sep)) return new Response(null, { status: 403 })
      return net.fetch(pathToFileURL(asset).toString(), { bypassCustomProtocolHandlers: true })
    } catch { return new Response(null, { status: 404 }) }
  })
  ipcMain.handle('preview:select', async event => {
    trusted(event)
    const result = await dialog.showOpenDialog(BrowserWindow.fromWebContents(event.sender), { title: '选择本地文件', properties: ['openFile', 'multiSelections'], filters: [{ name: '支持的文件', extensions }, { name: '所有文件', extensions: ['*'] }] })
    if (!result.canceled) for (const filePath of result.filePaths) await openPath(filePath)
  })
  ipcMain.handle('preview:drop', async (event, paths) => {
    trusted(event)
    if (!Array.isArray(paths) || paths.length > 12 || paths.some(p => typeof p !== 'string' || !path.isAbsolute(p))) throw new Error('请选择有效的本地文件（最多 12 个）。')
    for (const filePath of paths) await openPath(filePath)
  })
  ipcMain.handle('preview:consume', event => {
    trusted(event)
    const payload = payloads.get(event.sender.id)
    payloads.delete(event.sender.id)
    return payload
  })
  ipcMain.on('preview:close', event => { trusted(event); BrowserWindow.fromWebContents(event.sender)?.close() })
  const home = createWindow()
  await home.loadURL('preview://local/index.html')
  return home
})
app.on('window-all-closed', () => app.quit())
module.exports = { ready, openPath, payloads }
