import fs from 'node:fs';
import path from 'node:path';

export const dynamic = 'force-static';

export async function GET() {
  const filePath = path.join(process.cwd(), 'public', 'theme.html');
  const html = fs.readFileSync(filePath, 'utf-8');
  return new Response(html, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
    },
  });
}
