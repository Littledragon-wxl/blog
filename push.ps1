# ====== Blog quick-push script ======
# Usage:
#   .\push.ps1              -> auto-bump version suffix (20260829b -> 20260829c) and push
#   .\push.ps1 20260829c    -> set version explicitly
#   .\push.ps1 -M "message" -> custom commit message

param(
  [string]$Version = "",
  [string]$M = ""
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

# Read current version from index.html (UTF-8)
$content = [System.IO.File]::ReadAllText((Join-Path $PSScriptRoot $html), $utf8)
$cur = $null
$m = [regex]::Match($content, 'v=([0-9A-Za-z]+)')
if ($m.Success) { $cur = $m.Groups[1].Value }

if ([string]::IsNullOrWhiteSpace($Version)) {
  if (-not $cur) { Write-Host "No version found. Use .\push.ps1 <version>" -ForegroundColor Red; exit 1 }
  $Version = Increment-Suffix $cur
  Write-Host "Version: $cur -> $Version" -ForegroundColor Cyan
} else {
  Write-Host "Version: $cur -> $Version (custom)" -ForegroundColor Cyan
}

# Replace version, write back as UTF-8 (no BOM)
$content = $content -replace ('v=' + [regex]::Escape($cur)), ('v=' + $Version)
[System.IO.File]::WriteAllText((Join-Path $PSScriptRoot $html), $content, $utf8)

# Commit message
$msg = $M
if ([string]::IsNullOrWhiteSpace($msg)) { $msg = "chore: bump version to $Version" }

git add -A
git commit -m $msg
git push https://github.com/Littledragon-wxl/blog.git main

Write-Host ""
Write-Host "Done. Pushed version $Version" -ForegroundColor Green
