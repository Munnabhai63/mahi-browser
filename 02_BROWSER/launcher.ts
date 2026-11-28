export {
  fnv1a32,
  createMulberry32,
  deriveProfileStealthSeed,
  resolveEffectiveWebrtcPolicy,
  type TimezoneMismatchWarning,
  type LaunchedProcessInfo,
} from './launcher/launcher-shared.js';

export {
  cleanupStaleLocks,
  hasExistingSession,
  prepareCleanProfilePreferences,
  prepareSessionPersistence,
  markCleanExit,
  type SanitizedLaunchArgsOptions,
  buildSanitizedLaunchArgs,
} from './launcher/chromium-args-builder.js';

export {
  getProfileDebugPort,
  allocateEphemeralDebugPort,
} from './launcher/cdp-attach-helper.js';

export {
  ensureProfileStealthExtension,
  ensureProfileTitleExtension,
} from './launcher/extension-loader.js';

export { launchCamoufoxProfile } from './launcher/camoufox-launcher.js';

export { launchBrowser } from './launcher/launch-orchestrator.js';
