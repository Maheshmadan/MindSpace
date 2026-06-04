const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('spotlightAPI', {
  saveThought: (data) => ipcRenderer.send('spotlight-save-thought', data),
  saveArchive: (data) => ipcRenderer.send('spotlight-save-archive', data),
  executeWorkflow: (name) => ipcRenderer.send('spotlight-execute-workflow', name),
  getWorkflows: () => ipcRenderer.invoke('spotlight-get-workflows'),
  searchLocalFiles: (query) => ipcRenderer.invoke('spotlight-search-files', query),
  openFile: (filePath) => ipcRenderer.send('spotlight-open-file', filePath),
  openUrl: (url) => ipcRenderer.send('spotlight-open-url', url),
  close: () => ipcRenderer.send('spotlight-close'),
});
