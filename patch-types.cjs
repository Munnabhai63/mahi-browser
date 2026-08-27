const fs = require('fs');

let data = fs.readFileSync('10_CONFIG/preload/index.ts', 'utf8');

if (!data.includes('getHwid: () =>')) {
  data = data.replace('commercialLogin: (dto) => ipcRenderer.invoke(\'commercial:login\', dto),', 
    'commercialLogin: (dto) => ipcRenderer.invoke(\'commercial:login\', dto),\n  getHwid: () => ipcRenderer.invoke(\'commercial:getHwid\'),');
}

fs.writeFileSync('10_CONFIG/preload/index.ts', data);

let globalTypes = fs.readFileSync('10_CONFIG/shared/types/global.d.ts', 'utf8');
if (!globalTypes.includes('getHwid(): Promise<string>')) {
  globalTypes = globalTypes.replace('commercialLogin(dto: any): Promise<any>;', 
    'commercialLogin(dto: any): Promise<any>;\n  getHwid(): Promise<string>;');
}
fs.writeFileSync('10_CONFIG/shared/types/global.d.ts', globalTypes);

let uiModal = fs.readFileSync('01_UI/components/CommercialUserModal.tsx', 'utf8');
uiModal = uiModal.replace("window.mahiAPI.invoke('commercial:getHwid').then(res => setHwid(res))", "window.mahiAPI.getHwid().then((res: string) => setHwid(res))");
uiModal = uiModal.replace("showToast({ title: 'Copied!', message: 'Hardware ID copied to clipboard' });", "showToast({ type: 'success', title: 'Copied!', message: 'Hardware ID copied to clipboard' });");
fs.writeFileSync('01_UI/components/CommercialUserModal.tsx', uiModal);
