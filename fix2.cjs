const fs = require('fs');
let data = fs.readFileSync('10_CONFIG/preload/preload.cjs', 'utf8');

if (!data.includes('getHwid: () =>')) {
  data = data.replace("commercialLogin: (dto) => ipcRenderer.invoke('commercial:login', dto),", "commercialLogin: (dto) => ipcRenderer.invoke('commercial:login', dto),\n  getHwid: () => ipcRenderer.invoke('commercial:getHwid'),");
}

fs.writeFileSync('10_CONFIG/preload/preload.cjs', data);
