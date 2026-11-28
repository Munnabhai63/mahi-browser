# 10_CONFIG — Preload, Shared Types, Constants & Validation

This folder contains Electron Preload bridge scripts, cross-process TypeScript types, default constants, and runtime Zod validation schemas.

## Directory Structure
- preload/
  - index.ts: Single authoritative TypeScript Preload definition exposing window.mahiAPI (compiled to `dist-electron/preload/index.cjs` by Vite)
- shared/
  - constants/: Default user agents, RPA templates, extension store
  - types/: All 18 TypeScript type definition files
  - validation/: Zod runtime validation schemas
