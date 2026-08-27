const fs = require('fs');

let data = fs.readFileSync('07_BACKEND/ipc/register-handlers.ts', 'utf8');

// Add our license service imports
if (!data.includes('verifyLicense')) {
  data = data.replace('import { setActiveUserId } from \'../commercial/commercial-entitlement-service.js\';', 
    'import { setActiveUserId } from \'../commercial/commercial-entitlement-service.js\';\nimport { verifyLicense, getHWID } from \'../../08_SECURITY/license-service.js\';');
}

// Intercept commercial:getHwid
if (!data.includes('commercial:getHwid')) {
  data = data.replace('ipcMain.handle(\'commercial:login\',', 
    'ipcMain.handle(\'commercial:getHwid\', async () => getHWID());\n\n  ipcMain.handle(\'commercial:login\',');
}

// Patch commercial:login
const searchLogin = `ipcMain.handle('commercial:login', async (_event, dto) => {
    try {
      return loginUser(dto);
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });`;

const newLogin = `ipcMain.handle('commercial:login', async (_event, dto) => {
    try {
      if (dto.password === 'LICENSE_MODE') {
        const licenseKey = dto.email; // email field holds the key
        const check = verifyLicense(licenseKey);
        
        if (check.valid) {
          // Mock a successful user session for the frontend
          const user = {
            id: 'local-license-user',
            email: 'licensed@mahi.local',
            name: 'Licensed User',
            role: 'PRO' as any,
            status: 'ACTIVE' as any,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          
          setActiveUserId(user.id);
          
          return {
            success: true,
            user,
            token: licenseKey // we use the license key as the "token" to persist
          };
        } else {
          return { success: false, error: check.error };
        }
      }
      
      // Fallback to traditional local login if needed
      const result = loginUser(dto);
      if (result.success && result.user) {
        setActiveUserId(result.user.id);
      }
      return result;
    } catch (err) {
      throw new Error(sanitizeError(err));
    }
  });`;

data = data.replace(searchLogin, newLogin);

fs.writeFileSync('07_BACKEND/ipc/register-handlers.ts', data);
console.log('done');
