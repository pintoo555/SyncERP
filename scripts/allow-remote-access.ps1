# Allow remote access to the dev app (client on 3001, API on 4001).
# Run this script as Administrator once on the PC that hosts the app.
# In PowerShell (Admin): .\scripts\allow-remote-access.ps1

$ports = @(3001, 4001)
foreach ($port in $ports) {
    $name = "Synchronics App port $port"
    $existing = Get-NetFirewallRule -DisplayName $name -ErrorAction SilentlyContinue
    if ($existing) {
        Write-Host "Rule '$name' already exists." -ForegroundColor Yellow
    } else {
        New-NetFirewallRule -DisplayName $name -Direction Inbound -Protocol TCP -LocalPort $port -Action Allow | Out-Null
        Write-Host "Added firewall rule: $name" -ForegroundColor Green
    }
}
Write-Host ""
Write-Host "Remote access: from another PC, open https://YOUR_IP:3001 (e.g. run 'ipconfig' to get YOUR_IP)" -ForegroundColor Cyan
