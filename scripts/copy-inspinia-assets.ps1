# Copy full Inspinia theme assets from ReferenceTheme/Inspinia/Seed/public to client/public.
# Run from repo root: .\scripts\copy-inspinia-assets.ps1
# Ensures: CSS (with fonts), JS (config, vendors, app), plugins (bootstrap, simplebar), images.

$ErrorActionPreference = "Stop"
$root = (Get-Item $PSScriptRoot).Parent.FullName
$src = Join-Path $root "ReferenceTheme\Inspinia\Seed\public"
$dest = Join-Path $root "client\public"

if (-not (Test-Path $src)) {
    Write-Error "Inspinia Seed public folder not found: $src"
    exit 1
}

# 1. CSS (required: theme, Bootstrap, Tabler Icons, fonts)
$cssDest = Join-Path $dest "css"
New-Item -ItemType Directory -Force -Path $cssDest | Out-Null
Copy-Item -Path (Join-Path $src "css\*") -Destination $cssDest -Recurse -Force
Write-Host "Copied css/ (including fonts)"

# 2. JS: config (theme/skin), vendors (Bootstrap, jQuery, Simplebar, etc.), app (sidebar/topbar behavior)
$jsDest = Join-Path $dest "js"
New-Item -ItemType Directory -Force -Path $jsDest | Out-Null
foreach ($f in @("config.js", "vendors.min.js", "app.js")) {
    $fp = Join-Path $src "js\$f"
    if (Test-Path $fp) { Copy-Item -Path $fp -Destination $jsDest -Force }
}
Write-Host "Copied js/ (config, vendors, app)"

# 3. Plugins: Bootstrap bundle (dropdown/collapse), Simplebar (sidebar scroll)
$pbDest = Join-Path $dest "plugins\bootstrap"
$psDest = Join-Path $dest "plugins\simplebar"
New-Item -ItemType Directory -Force -Path $pbDest | Out-Null
New-Item -ItemType Directory -Force -Path $psDest | Out-Null
Copy-Item -Path (Join-Path $src "plugins\bootstrap\*") -Destination $pbDest -Recurse -Force
Copy-Item -Path (Join-Path $src "plugins\simplebar\*") -Destination $psDest -Recurse -Force
Write-Host "Copied plugins/bootstrap and plugins/simplebar"

# 4. Images: logos and user placeholders
$imgDest = Join-Path $dest "images"
New-Item -ItemType Directory -Force -Path $imgDest | Out-Null
Copy-Item -Path (Join-Path $src "images\*") -Destination $imgDest -Recurse -Force
Write-Host "Copied images/"

Write-Host "Done. Restart the dev server if running."
