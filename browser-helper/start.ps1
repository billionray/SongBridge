$ErrorActionPreference = 'Stop'
Push-Location -LiteralPath $PSScriptRoot
try {
    & node (Join-Path $PSScriptRoot 'start.mjs')
    if ($LASTEXITCODE -ne 0) { throw "SongBridge exited with code $LASTEXITCODE" }
} catch {
    Write-Host $_ -ForegroundColor Red
    Read-Host 'Press Enter to close'
    exit 1
} finally {
    Pop-Location
}

