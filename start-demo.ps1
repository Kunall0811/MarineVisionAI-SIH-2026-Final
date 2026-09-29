$ErrorActionPreference = "Stop"

Write-Host "=== MarineVision AI demo setup ===" -ForegroundColor Cyan

if (-not (Test-Path ".\backend\.env")) {
  Copy-Item ".\backend\.env.example" ".\backend\.env"
  Write-Host "Created backend\.env. For Docker demo the defaults already point to local MongoDB/Redis." -ForegroundColor Yellow
}

if (Get-Command docker -ErrorAction SilentlyContinue) {
  Write-Host "Starting MongoDB + Redis..." -ForegroundColor Cyan
  docker compose up -d
} else {
  Write-Host "Docker is not installed. Start MongoDB on 127.0.0.1:27017 and Redis on 127.0.0.1:6379 manually." -ForegroundColor Yellow
}

Write-Host "`nTerminal 1 - backend:" -ForegroundColor Green
Write-Host "cd backend"
Write-Host "npm install"
Write-Host "npm run start:dev"

Write-Host "`nTerminal 2 - frontend:" -ForegroundColor Green
Write-Host "cd frontend"
Write-Host "npm install"
Write-Host "npm run dev"

Write-Host "`nDemo Admin: admin@marinevision.ai / Admin@12345" -ForegroundColor Cyan
Write-Host "Demo Operator: operator@marinevision.ai / Operator@12345" -ForegroundColor Cyan
Write-Host "After login, open Globe to see MongoDB historical evidence and use FRIDAY for voice/text commands." -ForegroundColor Cyan
