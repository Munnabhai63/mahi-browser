import { detectSystemBrowsers } from './02_BROWSER/detector.js';

const browsers = detectSystemBrowsers();
console.log(JSON.stringify(browsers, null, 2));
