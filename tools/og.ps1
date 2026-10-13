# Link preview: renders tools/og.html into assets/og.jpg (1200x630).
# Run from anywhere:  powershell -File tools/og.ps1
$root = Split-Path $PSScriptRoot -Parent
$chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$png = Join-Path $env:TEMP "og-render.png"
$prof = Join-Path $env:TEMP "og-chrome-profile"
$url = "file:///" + ($root -replace '\\', '/') + "/tools/og.html"

& $chrome --headless=new --disable-gpu --hide-scrollbars --window-size=1200,630 `
  --virtual-time-budget=6000 --user-data-dir="$prof" --screenshot="$png" $url | Out-Null
Start-Sleep -Seconds 2

Add-Type -AssemblyName System.Drawing
$img = [System.Drawing.Image]::FromFile($png)
$enc = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq "image/jpeg" }
$p = New-Object System.Drawing.Imaging.EncoderParameters 1
$p.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [long]88)
$out = Join-Path $root "assets\og.jpg"
$img.Save($out, $enc, $p)
$img.Dispose()
Remove-Item $png
"Saved $out"
