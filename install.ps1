# BatRunner installer — downloads the latest release and installs it into VS Code.
# Usage (CMD or PowerShell):
#   powershell -ExecutionPolicy Bypass -c "irm https://raw.githubusercontent.com/FanFantom9452/BatRunner/master/install.ps1 | iex"
$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

$check = [char]::ConvertFromUtf32(0x2705)  # green check mark
$cross = [char]::ConvertFromUtf32(0x274C)  # red cross mark
$url   = 'https://github.com/FanFantom9452/BatRunner/releases/latest/download/batrunner.vsix'
$vsix  = Join-Path $env:TEMP 'batrunner.vsix'

try {
    Write-Host 'Downloading BatRunner...' -ForegroundColor Cyan
    Invoke-WebRequest -Uri $url -OutFile $vsix -UseBasicParsing

    & code --install-extension $vsix
    if ($LASTEXITCODE -ne 0) { throw "code --install-extension exited with code $LASTEXITCODE" }

    Write-Host ''
    Write-Host ("  $check  BatRunner - Install Completed") -ForegroundColor Green
    Write-Host '      Reload VS Code:  Ctrl+Shift+P  >  Reload Window' -ForegroundColor Green
}
catch {
    Write-Host ''
    Write-Host ("  $cross  Install failed: " + $_.Exception.Message) -ForegroundColor Red
    Write-Host '      Make sure VS Code is installed and the "code" command is on PATH.' -ForegroundColor Yellow
    exit 1
}
