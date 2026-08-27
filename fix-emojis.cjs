const fs = require('fs');
let content = fs.readFileSync('07_BACKEND/server/super-admin-html.ts', 'utf8');
const svgIcon = (path) => '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="inline-block mr-1.5 -mt-0.5"><path d="' + path + '"/></svg>';
content = content.replace(/>([\uD800-\uDBFF][\uDC00-\uDFFF]|\u2600-\u27BF|[\uE000-\uF8FF]) /g, (match, p1) => { return '>' + svgIcon('M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z') + ' '; });
content = content.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]|\u2600-\u27BF|[\uE000-\uF8FF]/g, '');
fs.writeFileSync('07_BACKEND/server/super-admin-html.ts', content, 'utf8');
console.log('Done');
