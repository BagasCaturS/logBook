param(
  [Parameter(Mandatory = $true)][string]$version,
  [string]$message
)

$ErrorActionPreference = "Stop"

if ($version -notmatch "^\d+\.\d+\.\d+$") {
  throw "Gunakan format versi: 0.2.0"
}

$msg = if ($message) { $message } else { "Rilis v$version" }
$root = Split-Path -Parent $PSScriptRoot
Push-Location $root

try {
  npm version $version --no-git-tag-version
  node -e "const fs=require('fs');const p='src-tauri/tauri.conf.json';const j=JSON.parse(fs.readFileSync(p));j.version=process.argv[1];fs.writeFileSync(p,JSON.stringify(j,null,2)+'\n');" $version
  node -e "const fs=require('fs');const p='src-tauri/Cargo.toml';const t=fs.readFileSync(p,'utf8');const q=String.fromCharCode(34);fs.writeFileSync(p,t.replace(/^version = .*$/m,'version = '+q+process.argv[1]+q));" $version
} finally {
  Pop-Location
}

git -C $root add -A
git -C $root commit -m "$msg"
git -C $root tag "v$version"
git -C $root push
git -C $root push origin "v$version"

Write-Host "Tag v$version didorong. GitHub Actions akan membangun & merilis otomatis (10-15 menit)."