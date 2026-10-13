# Project cover: screenshots a live page into assets/shots/<Name>.jpg (16:10, 1440x900).
# Usage:  powershell -File tools/shot.ps1 -Url https://eyeanton.github.io/wishlist/ -Name wishlist
# Then set the project's cover to assets/shots/<Name>.jpg in the admin (or projects.json).
# Note: a fresh browser profile is used, so first-visit popups (onboarding, cookies) end up in the shot —
# in that case take the screenshot by hand and upload it in the admin.
param(
  [Parameter(Mandatory = $true)][string]$Url,
  [Parameter(Mandatory = $true)][string]$Name,
  [int]$Width = 1440,
  [int]$Height = 900
)
$root = Split-Path $PSScriptRoot -Parent
$chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$png = Join-Path $env:TEMP "shot-render.png"
$prof = Join-Path $env:TEMP "shot-chrome-profile"

& $chrome --headless=new --disable-gpu --hide-scrollbars --window-size="$Width,$Height" `
  --virtual-time-budget=8000 --user-data-dir="$prof" --screenshot="$png" $Url | Out-Null
Start-Sleep -Seconds 2

Add-Type -AssemblyName System.Drawing
$img = [System.Drawing.Image]::FromFile($png)
$enc = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq "image/jpeg" }
$p = New-Object System.Drawing.Imaging.EncoderParameters 1
$p.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [long]88)
$out = Join-Path $root "assets\shots\$Name.jpg"
$img.Save($out, $enc, $p)
$img.Dispose()
Remove-Item $png
"Saved $out"
