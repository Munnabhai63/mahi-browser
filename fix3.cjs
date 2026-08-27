const fs = require('fs');
let data = fs.readFileSync('07_BACKEND/ipc/register-handlers.ts', 'utf8');

if (!data.includes('getHWID } from')) {
  data = data.replace(/import \{ verifyLicense \} from '\.\.\/\.\.\/08_SECURITY\/license-service\.js';/, "import { verifyLicense, getHWID } from '../../08_SECURITY/license-service.js';");
}

fs.writeFileSync('07_BACKEND/ipc/register-handlers.ts', data);
