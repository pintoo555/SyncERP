# Install Node.js LTS on Windows
# Run: Right-click -> Run with PowerShell, or in PowerShell: .\install-node.ps1

$nodeVersion = "22.15.0"
$msiUrl = "https://nodejs.org/dist/v$nodeVersion/node-v$nodeVersion-x64.msi"
$msiPath = "$env:TEMP\node-v$nodeVersion-x64.msi"

Write-Host "Downloading Node.js v$nodeVersion LTS..." -ForegroundColor Cyan
try {
    Invoke-WebRequest -Uri $msiUrl -OutFile $msiPath -UseBasicParsing
} catch {
    Write-Host "Download failed. Try installing manually from: https://nodejs.org" -ForegroundColor Red
    exit 1
}

Write-Host "Installing Node.js (this may require Administrator)..." -ForegroundColor Cyan
Start-Process msiexec.exe -ArgumentList "/i", "`"$msiPath`"", "/quiet", "/norestart" -Wait

Remove-Item $msiPath -ErrorAction SilentlyContinue
Write-Host "Done. Restart your terminal (or PC) and run: node -v" -ForegroundColor Green
