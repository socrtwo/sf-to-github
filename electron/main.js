'use strict';

const { app, BrowserWindow, shell } = require('electron');
const path = require('path');

// Start the Express server
const server = require('../src/index');

const PORT = process.env.PORT || 3000;
let mainWindow;

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

  // Start the Express server then load the app
  const expressServer = server.listen(PORT, () => {
    mainWindow.loadURL(`http://localhost:${PORT}`);
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
    expressServer.close();
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
