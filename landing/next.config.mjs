import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  images: { unoptimized: true },
  trailingSlash: false,
  turbopack: {
    root: path.resolve(__dirname, '..'),
  },
  typescript: {
    ignoreBuildErrors: false,
  },
};

export default nextConfig;
