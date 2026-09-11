const { contextBridge, ipcRenderer, webUtils } = require('electron')
contextBridge.exposeInMainWorld('localPreview', {
  select: () => ipcRenderer.invoke('preview:select'),
  drop: files => ipcRenderer.invoke('preview:drop', Array.from(files, file => webUtils.getPathForFile(file))),
  consume: () => ipcRenderer.invoke('preview:consume'),
  close: () => ipcRenderer.send('preview:close')
})
