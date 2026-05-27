Write-Host "Cleaning ports 3000/3001..." -ForegroundColor Yellow
Get-NetTCPConnection -LocalPort 3000,3001 -State Listen -ErrorAction SilentlyContinue |
  ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
Start-Sleep -Milliseconds 500
Write-Host "Starting dev servers..." -ForegroundColor Green
pnpm dev
