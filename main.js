const { app, BrowserWindow, ipcMain, shell, dialog, clipboard, nativeImage, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');
const { execFile, exec } = require('child_process');
const https = require('https');
const http = require('http');

let mainWindow;
let spotlightWindow = null;
let clipboardPollTimer = null;
let lastClipText = '';
let lastClipImageHash = '';

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#f8f7f4',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    icon: path.join(__dirname, 'src', 'assets', 'icon.png'),
    show: false,
    fullscreen: true,
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.webContents.setZoomLevel(0);
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Single instance lock
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

app.whenReady().then(() => {
  createWindow();

  // Register global spotlight shortcut
  globalShortcut.register('Alt+Space', () => {
    toggleSpotlight();
  });

  // Start clipboard polling
  startClipboardPolling();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  stopClipboardPolling();
});

app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// ─── Spotlight Window ───
function toggleSpotlight() {
  if (spotlightWindow && !spotlightWindow.isDestroyed()) {
    spotlightWindow.close();
    spotlightWindow = null;
    return;
  }

  spotlightWindow = new BrowserWindow({
    width: 640,
    height: 70,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    center: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'spotlight-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  spotlightWindow.loadFile(path.join(__dirname, 'src', 'spotlight.html'));
  spotlightWindow.once('ready-to-show', () => spotlightWindow.show());
  spotlightWindow.on('blur', () => {
    if (spotlightWindow && !spotlightWindow.isDestroyed()) {
      spotlightWindow.close();
      spotlightWindow = null;
    }
  });
  spotlightWindow.on('closed', () => { spotlightWindow = null; });
}

ipcMain.on('spotlight-close', () => {
  if (spotlightWindow && !spotlightWindow.isDestroyed()) {
    spotlightWindow.close();
    spotlightWindow = null;
  }
});

// Spotlight saves go through main window's webContents
ipcMain.on('spotlight-save-thought', (event, data) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('spotlight-create-thought', data);
  }
});

ipcMain.on('spotlight-save-archive', (event, data) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('spotlight-create-archive', data);
  }
});

ipcMain.on('spotlight-execute-workflow', (event, name) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('spotlight-execute-workflow', name);
  }
});

ipcMain.handle('spotlight-get-workflows', async () => {
  try {
    const dbPath = path.join(app.getPath('userData'), 'mindspace-data', 'workflows.db');
    if (!fs.existsSync(dbPath)) return [];

    const lines = fs.readFileSync(dbPath, 'utf8').split('\n');
    const wfs = [];
    for (const line of lines) {
      if (!line.trim()) continue;
      try { wfs.push(JSON.parse(line)); } catch (e) { }
    }
    return wfs;
  } catch (err) {
    console.error('Failed to get workflows for spotlight:', err);
    return [];
  }
});
ipcMain.handle('spotlight-search-files', async (event, query) => {
  if (!query) return [];
  return new Promise((resolve) => {
    // Escape query for PowerShell
    const safeQuery = query.replace(/"/g, '""').replace(/'/g, "''");

    const psCommand = `
      $con = New-Object System.Data.OleDb.OleDbConnection("Provider=Search.CollatorDSO;Extended Properties='Application=Windows';")
      $con.Open()
      $cmd = $con.CreateCommand()
      $cmd.CommandText = "SELECT TOP 10 System.ItemName, System.ItemPathDisplay FROM SystemIndex WHERE CONTAINS('*', '""*${safeQuery}*""') OR System.FileName LIKE '%${safeQuery}%'"
      try {
        $r = $cmd.ExecuteReader()
        $results = @()
        while($r.Read()) {
          $results += @{ Name = $r[0]; Path = $r[1] }
        }
        $results | ConvertTo-Json
      } catch {}
      $con.Close()
    `;

    exec(`powershell -NoProfile -Command "${psCommand.replace(/\n/g, '')}"`, (error, stdout, stderr) => {
      if (error || !stdout.trim()) {
        resolve([]);
        return;
      }
      try {
        const res = JSON.parse(stdout);
        resolve(Array.isArray(res) ? res : [res]);
      } catch (e) {
        resolve([]);
      }
    });
  });
});

ipcMain.on('spotlight-open-file', (event, filePath) => {
  shell.openPath(filePath);
});

ipcMain.on('spotlight-open-url', (event, url) => {
  shell.openExternal(url);
});

// ─── Clipboard Polling ───
function startClipboardPolling() {
  lastClipText = clipboard.readText() || '';
  clipboardPollTimer = setInterval(() => {
    if (!mainWindow || mainWindow.isDestroyed()) return;

    // Check text
    const currentText = clipboard.readText() || '';
    if (currentText && currentText !== lastClipText) {
      lastClipText = currentText;
      mainWindow.webContents.send('clipboard-new-entry', {
        type: 'text',
        content: currentText,
        timestamp: new Date().toISOString(),
      });
    }

    // Check image
    const img = clipboard.readImage();
    if (!img.isEmpty()) {
      const png = img.toPNG();
      const hash = require('crypto').createHash('md5').update(png).digest('hex');
      if (hash !== lastClipImageHash) {
        lastClipImageHash = hash;
        const dataUrl = 'data:image/png;base64,' + png.toString('base64');
        mainWindow.webContents.send('clipboard-new-entry', {
          type: 'image',
          content: dataUrl,
          timestamp: new Date().toISOString(),
        });
      }
    }
  }, 1000);
}

function stopClipboardPolling() {
  if (clipboardPollTimer) clearInterval(clipboardPollTimer);
}

// ─── AI Query ───
ipcMain.handle('ai-query', async (event, { provider, apiKey, model, messages }) => {
  const endpoints = {
    openrouter: { host: 'openrouter.ai', path: '/api/v1/chat/completions' },
    groq: { host: 'api.groq.com', path: '/openai/v1/chat/completions' },
    gemini: { host: 'generativelanguage.googleapis.com', path: `/v1beta/models/${model}:generateContent?key=${apiKey}` },
  };

  const ep = endpoints[provider];
  if (!ep) throw new Error('Unknown AI provider: ' + provider);

  // Gemini uses a different format
  if (provider === 'gemini') {
    const body = JSON.stringify({
      contents: messages.map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      })),
    });
    return makeHttpsRequest(ep.host, ep.path, body, null);
  }

  // OpenAI-compatible (OpenRouter, Groq)
  const body = JSON.stringify({ model, messages, temperature: 0.3 });
  return makeHttpsRequest(ep.host, ep.path, body, apiKey);
});

function makeHttpsRequest(host, urlPath, body, apiKey) {
  return new Promise((resolve, reject) => {
    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
    };
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

    const req = https.request({ hostname: host, path: urlPath, method: 'POST', headers }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error('Failed to parse AI response: ' + data.substring(0, 200)));
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ─── Run Shell Command ───
ipcMain.handle('run-shell-command', async (event, command) => {
  return new Promise(async (resolve) => {
    // Hotfix for Windows cmd.exe "start URI:" error dialog
    // If the command is exactly "start something:" (a URI protocol), use Electron's native shell.openExternal
    if (/^start\s+[a-zA-Z0-9_-]+:$/.test(command.trim())) {
      const uri = command.trim().replace(/^start\s+/, '');
      try {
        await shell.openExternal(uri);
        resolve({ success: true, stdout: 'Opened via native shell.openExternal', stderr: '' });
      } catch (e) {
        resolve({ success: false, error: e.message });
      }
      return;
    }

    exec(command, { timeout: 15000 }, (err, stdout, stderr) => {
      resolve({ success: !err, stdout: stdout || '', stderr: stderr || '', error: err?.message });
    });
  });
});

// ─── Window Controls ───
ipcMain.on('window-minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on('window-maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.on('window-close', () => {
  if (mainWindow) mainWindow.close();
});

ipcMain.handle('window-is-maximized', () => {
  return mainWindow ? mainWindow.isMaximized() : false;
});

// ─── Expose userData path ───
ipcMain.handle('get-user-data-path', () => {
  return app.getPath('userData');
});

// ─── Fullscreen Toggle ───
ipcMain.on('window-toggle-fullscreen', () => {
  if (mainWindow) {
    mainWindow.setFullScreen(!mainWindow.isFullScreen());
  }
});

ipcMain.handle('window-is-fullscreen', () => {
  return mainWindow ? mainWindow.isFullScreen() : false;
});

// ─── File Drop Reading ───
ipcMain.handle('read-dropped-file', async (event, filePath) => {
  try {
    const stat = fs.statSync(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const name = path.basename(filePath);
    const isImage = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.svg'].includes(ext);
    const isText = ['.txt', '.md', '.json', '.csv', '.xml', '.html', '.css', '.js', '.ts', '.py', '.yaml', '.yml', '.log', '.ini', '.cfg', '.toml'].includes(ext);

    let content = '';
    let type = 'unknown';

    if (isImage) {
      const buf = fs.readFileSync(filePath);
      const mimeMap = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.bmp': 'image/bmp', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
      content = `data:${mimeMap[ext] || 'image/png'};base64,${buf.toString('base64')}`;
      type = 'image';
    } else if (isText || stat.size < 50000) {
      // Read text content (first 5KB for preview)
      const buf = Buffer.alloc(Math.min(5120, stat.size));
      const fd = fs.openSync(filePath, 'r');
      fs.readSync(fd, buf, 0, buf.length, 0);
      fs.closeSync(fd);
      content = buf.toString('utf8');
      type = 'text';
    } else {
      content = `[Binary file: ${name}, ${(stat.size / 1024).toFixed(1)} KB]`;
      type = 'binary';
    }

    return { name, path: filePath, content, type, size: stat.size, ext };
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.on('open-file-location', (event, filePath) => {
  if (filePath && fs.existsSync(filePath)) {
    shell.showItemInFolder(filePath);
  }
});

// ─── Open External URLs ───
ipcMain.on('open-external', (event, url) => {
  if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
    shell.openExternal(url);
  }
});

// ─── Copy Image to Clipboard (decoded, not base64 text) ───
ipcMain.on('copy-image-to-clipboard', (event, base64Data) => {
  try {
    // Strip data URL prefix if present
    const raw = base64Data.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(raw, 'base64');
    const img = nativeImage.createFromBuffer(buffer);
    clipboard.writeImage(img);
  } catch (e) {
    console.error('Failed to copy image to clipboard:', e);
  }
});

// ─── Select Tool Path (file picker) ───
ipcMain.handle('select-tool-path', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select tool entry file (index.html)',
    filters: [
      { name: 'HTML Files', extensions: ['html', 'htm'] },
      { name: 'All Files', extensions: ['*'] },
    ],
    properties: ['openFile'],
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

// ─── Open Tool in New Window ───
ipcMain.on('open-tool-window', (event, toolPath, toolName) => {
  // Verify file exists
  if (!fs.existsSync(toolPath)) return;

  const toolWin = new BrowserWindow({
    width: 1200,
    height: 800,
    title: toolName || 'Tool',
    icon: path.join(__dirname, 'src', 'assets', 'icon.png'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  toolWin.loadFile(toolPath);
});

// ─── Auto Paste & Search (keyboard automation) ───
// Waits for browser to load, then simulates Ctrl+V and Enter

ipcMain.on('auto-paste-search', (event, delayMs) => {
  const delay = Math.max(delayMs || 3000, 1000);
  const delaySec = delay / 1000;

  const psScript = [
    'Add-Type -AssemblyName System.Windows.Forms',
    `Start-Sleep -Seconds ${delaySec}`,
    '[System.Windows.Forms.SendKeys]::SendWait("^v")',
    'Start-Sleep -Seconds 1',
    '[System.Windows.Forms.SendKeys]::SendWait("{ENTER}")',
  ].join('\n');

  const encoded = Buffer.from(psScript, 'utf16le').toString('base64');
  execFile('powershell', ['-NoProfile', '-EncodedCommand', encoded], (err) => {
    if (err) console.error('Auto-paste failed:', err.message);
  });
});

// ─── Auto Paste Full (image + text → submit) ───
// Image must already be in clipboard before calling this.
// Sequence: wait → paste image → switch clipboard to text → paste text → wait → Enter
ipcMain.on('auto-paste-full', (event, text, delayMs) => {
  const delay = Math.max(delayMs || 3000, 1000);
  const delaySec = delay / 1000;

  // Use a temporary file to hold the text to avoid escaping issues
  const os = require('os');
  const tempFile = path.join(os.tmpdir(), `mindspace-paste-${Date.now()}.txt`);
  fs.writeFileSync(tempFile, text || '', 'utf8');

  const psScript = [
    'Add-Type -AssemblyName System.Windows.Forms',
    `Start-Sleep -Seconds ${delaySec}`,
    // Step 1: Paste image (already in clipboard)
    '[System.Windows.Forms.SendKeys]::SendWait("^v")',
    // Increased wait time for image upload as requested (1.5 seconds)
    'Start-Sleep -Seconds 2.6',
    // Step 2: Read text from file into clipboard and paste it
    `Get-Content -Path '${tempFile.replace(/'/g, "''")}' -Raw | Set-Clipboard`,
    'Start-Sleep -Milliseconds 300',
    '[System.Windows.Forms.SendKeys]::SendWait("^v")',
    // Step 3: Wait then submit
    'Start-Sleep -Seconds 1',
    '[System.Windows.Forms.SendKeys]::SendWait("{ENTER}")',
    // Cleanup temp file
    `Remove-Item -Path '${tempFile.replace(/'/g, "''")}' -ErrorAction SilentlyContinue`
  ].join('\n');

  const encoded = Buffer.from(psScript, 'utf16le').toString('base64');
  execFile('powershell', ['-NoProfile', '-EncodedCommand', encoded], (err) => {
    if (err) console.error('Auto-paste-full failed:', err.message);
  });
});
