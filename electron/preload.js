'use strict';

const { contextBridge } = require('electron');

// Expose a minimal API to the renderer process
contextBridge.exposeInMainWorld('sf2gh', {
  platform: process.platform,
  isElectron: true,
});
