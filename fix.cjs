const fs = require('fs');
let data = fs.readFileSync('01_UI/components/CommercialUserModal.tsx', 'utf8');

data = data.replace("window.mahiAPI.invoke('commercial:getHwid').then(res => setHwid(res))", "(window.mahiAPI as any).getHwid().then((res: string) => setHwid(res))");
data = data.replace("showToast({ title: 'Copied!', message: 'Hardware ID copied to clipboard' })", "showToast({ type: 'success', title: 'Copied!', message: 'Hardware ID copied to clipboard' })");

fs.writeFileSync('01_UI/components/CommercialUserModal.tsx', data);
