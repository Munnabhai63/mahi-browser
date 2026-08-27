import { createProfile } from './07_BACKEND/services/profile-service.js';
import { ProcessManager } from './07_BACKEND/services/process-manager.js';

async function test() {
  try {
    const profile = createProfile({
      name: 'Test Profile',
      folder: 'Test',
      settings: {} as any
    });
    console.log('Created profile:', profile.id);
    
    // Note: processManager is not exported as class, it's a singleton in process-manager.ts.
    // Let's import it directly from the file.
  } catch (e) {
    console.error(e);
  }
}

test();
