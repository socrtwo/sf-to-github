'use strict';

const { app, BrowserWindow, shell } = require('electron');
const path = require('path');

// Start the Express server
const server = require('../src/index');

const PREFERRED_PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const MAX_PORT_ATTEMPTS = 10;
let mainWindow;
let expressServer;

function tryListen(port, attempt) {
  return new Promise((resolve, reject) => {
    const srv = server.listen(port, () => resolve({ srv, port }));
    srv.on('error', (err) => {
      if (err.code === 'EADDRINUSE' && attempt < MAX_PORT_ATTEMPTS) {
        srv.close();
        resolve(tryListen(port + 1, attempt + 1));
      } else {
        reject(err);
      }
    });
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 750,
    minWidth: 500,
    minHeight: 600,
    title: 'SF2GH Migrator',
    icon: path.join(__dirname, '..', 'public', 'icons', 'icon-512.png'),
    backgroundColor: '#0d1117',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Start the Express server then load the app, trying next port if in use
  tryListen(PREFERRED_PORT, 1).then(({ srv, port }) => {
    expressServer = srv;
    mainWindow.loadURL(`http://localhost:${port}`);
  }).catch((err) => {
    const { dialog } = require('electron');
    dialog.showErrorBox('Server Error', `Could not start server: ${err.message}`);
    app.quit();
  });

  // Open external links in the default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') || url.startsWith('http://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    if (expressServer) expressServer.close();
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
