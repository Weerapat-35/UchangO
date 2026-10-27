# fix-structure.ps1
# Run this inside the project root (the folder that contains package.json).
# It fixes the usual reasons why Next.js returns 404 for /admin after copying new files:
#   1) nested folders such as src\src or public\public
#   2) a leftover root "app" folder that hides src\app
#   3) a stale .next cache

$ErrorActionPreference = "Stop"

if (-not (Test-Path "package.json")) {
    Write-Host "ERROR: package.json not found. Put this script in the project root and run it there." -ForegroundColor Red
    exit 1
}

function Merge-Up($nested, $target) {
    if (Test-Path $nested) {
        Write-Host "Found nested folder '$nested' -> merging into '$target'" -ForegroundColor Yellow
        robocopy $nested $target /E /MOVE /NFL /NDL /NJH /NJS | Out-Null
        if (Test-Path $nested) { Remove-Item $nested -Recurse -Force }
    }
}

Merge-Up "src\src" "src"
Merge-Up "public\public" "public"

if ((Test-Path "app") -and (Test-Path "src\app")) {
    $backup = "_app_backup_root"
    if (Test-Path $backup) { $backup = "_app_backup_root_" + (Get-Date -Format "yyyyMMddHHmmss") }
    Write-Host "Root 'app' folder found next to src\app (Next.js would ignore src\app). Renaming it to '$backup'" -ForegroundColor Yellow
    Rename-Item "app" $backup
}

if (Test-Path ".next") {
    try {
        Remove-Item ".next" -Recurse -Force
        Write-Host "Removed .next cache" -ForegroundColor Green
    } catch {
        Write-Host "Could not remove .next. Stop 'npm run dev' (Ctrl+C) and run this script again." -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "---- Check ----"
$checks = @(
    "src\app\admin\page.tsx",
    "src\app\layout.tsx",
    "src\components\app-nav.tsx",
    "public\brand\ouchang-o-logo.png"
)
$allOk = $true
foreach ($c in $checks) {
    if (Test-Path $c) {
        Write-Host "OK       $c" -ForegroundColor Green
    } else {
        Write-Host "MISSING  $c" -ForegroundColor Red
        $allOk = $false
    }
}

foreach ($old in @("src\app\theme.css", "src\app\dark-theme.generated.css", "src\components\theme-toggle.tsx")) {
    if (Test-Path $old) {
        Write-Host "OLD FILE still here (from the version with dark mode): $old" -ForegroundColor Yellow
    }
}

Write-Host ""
if ($allOk) {
    Write-Host "Done. Now run: npm run dev   and open http://localhost:3000/admin" -ForegroundColor Green
} else {
    Write-Host "Some files are missing. Extract src_no_dark_mode.zip so that the result is <project>\src\app\... and public_new_logo.zip so that the result is <project>\public\brand\..., then run this script again." -ForegroundColor Red
}
