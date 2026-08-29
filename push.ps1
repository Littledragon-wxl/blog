# ====== Blog quick-push script ======
# Usage:
#   .\push.ps1              -> auto-bump version suffix (20260829g -> 20260829h) and push
#   .\push.ps1 20260829h    -> set version explicitly
#   .\push.ps1 -M "message" -> custom commit message
#
# NOTE: keep this file pure ASCII. PowerShell 5.1 parses BOM-less UTF-8
# scripts as ANSI, which corrupts non-ASCII comments/args and has caused
# a broken replace in production (v20260829g incident).

param(
  [string]$Version = "",
  # NOTE: do not name this $M — PS variables are case-insensitive, $M collides
  # with the $m regex-match variable below and coerces the Match object to string.
  [Alias("M")]
  [string]$Msg = ""
)

$ErrorActionPreference = "Stop"
Set-Location -Path $PSScriptRoot

$html = "index.html"
$utf8 = New-Object System.Text.UTF8Encoding($false)

# Increment trailing letter sequence: a->b ... z->aa, az->ba
function Increment-Suffix([string]$s) {
  $chars = $s.ToCharArray()
  for ($i = $chars.Length - 1; $i -ge 0; $i--) {
    if ($chars[$i] -eq 'z') { $chars[$i] = 'a' }
    else { $chars[$i] = [char]([int]$chars[$i] + 1); return -join $chars }
  }
  return 'a' + (-join $chars)
}

# Read current version from the first ?v=... asset query in index.html
$content = [System.IO.File]::ReadAllText((Join-Path $PSScriptRoot $html), $utf8)
$m = [regex]::Match($content, '\?v=([0-9A-Za-z]+)')
if (-not $m.Success) {
  Write-Host "No ?v= version found in index.html. Aborting (nothing was modified)." -ForegroundColor Red
  exit 1
}
$cur = $m.Groups[1].Value

if ([string]::IsNullOrWhiteSpace($Version)) {
  $Version = Increment-Suffix $cur
  Write-Host "Version: $cur -> $Version" -ForegroundColor Cyan
} else {
  Write-Host "Version: $cur -> $Version (custom)" -ForegroundColor Cyan
}

# Replace ONLY asset query strings (?v=...), never attribute names like http-equiv=
$newContent = [regex]::Replace($content, '\?v=[0-9A-Za-z]+', ('?v=' + $Version))
[System.IO.File]::WriteAllText((Join-Path $PSScriptRoot $html), $newContent, $utf8)

# Sync APP_VERSION inside js/app.js (cache-busting logic depends on it)
$appJs = Join-Path $PSScriptRoot "js\app.js"
$jsContent = [System.IO.File]::ReadAllText($appJs, $utf8)
$jsNew = [regex]::Replace($jsContent, "const APP_VERSION = '[0-9A-Za-z]+';", ("const APP_VERSION = '" + $Version + "';"))
[System.IO.File]::WriteAllText($appJs, $jsNew, $utf8)
Write-Host "APP_VERSION synced to $Version" -ForegroundColor Cyan

# Commit message
if ([string]::IsNullOrWhiteSpace($Msg)) { $Msg = "chore: bump version to $Version" }

git add -A
git commit -m $msg
git push https://github.com/Littledragon-wxl/blog.git main

Write-Host ""
Write-Host "Done. Pushed version $Version" -ForegroundColor Green
