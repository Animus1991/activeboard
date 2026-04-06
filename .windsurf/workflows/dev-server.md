---
description: Start dev servers (kill zombie ports first, use fixed port 5173)
---

## Steps to start the TableForge dev environment

1. Kill any zombie node processes on ports 5173 and 3001:
// turbo
```bash
powershell -Command "Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }; Get-NetTCPConnection -LocalPort 3001 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }; echo 'Ports cleared'"
```

2. Start the API server (port 3001) with WebSocket support:
```bash
# From apps/api directory
pnpm dev
```

3. Start the web dev server (port 5173):
```bash
# From apps/web directory  
pnpm dev
```

## IMPORTANT: Commands that hang on Windows

The following commands are known to hang indefinitely on this machine. DO NOT run them as blocking commands:

- `npx tsc --noEmit` — hangs due to Three.js type resolution (~50MB types)
- `npx tsc --noEmit 2>&1` — same issue + PowerShell pipe buffering
- `npx vite build` — can hang with large projects
- `git add -A` with many uncommitted files — can be slow

### Workarounds:

1. **For typecheck**: Use `npx tsc --noEmit --skipLibCheck` and run as non-blocking with 30s wait max
2. **For git**: Run `git add .` and `git commit` as separate commands, non-blocking
3. **For port conflicts**: Always kill existing processes before starting servers (see step 1)
4. **Never change ports**: If port 5173 is busy, kill the process — don't use 5174/5175/5176
