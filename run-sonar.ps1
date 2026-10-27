# run-sonar.ps1
# Starts a local SonarQube server in Docker (if needed) and scans this project.
# Run it from the project root (the folder that contains package.json):
#   powershell -ExecutionPolicy Bypass -File .\run-sonar.ps1

$ErrorActionPreference = "Stop"

if (-not (Test-Path "package.json")) {
    Write-Host "ERROR: package.json not found. Run this script in the project root." -ForegroundColor Red
    exit 1
}
if (-not (Test-Path "sonar-project.properties")) {
    Write-Host "ERROR: sonar-project.properties not found. Put it next to package.json." -ForegroundColor Red
    exit 1
}
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host "ERROR: Docker is not installed or not in PATH. Install Docker Desktop and open it first." -ForegroundColor Red
    exit 1
}

$name = "sonarqube"
$status = docker ps -a --filter "name=^/$name$" --format "{{.Status}}"

if (-not $status) {
    Write-Host "Creating the SonarQube container (first time only, this downloads about 1 GB)..." -ForegroundColor Yellow
    docker run -d --name $name -p 9000:9000 sonarqube:community | Out-Null
} elseif ($status -notlike "Up*") {
    Write-Host "Starting the existing SonarQube container..." -ForegroundColor Yellow
    docker start $name | Out-Null
}

Write-Host "Waiting for SonarQube to be ready (can take 1-3 minutes)..."
$ready = $false
for ($i = 0; $i -lt 90; $i++) {
    try {
        $s = Invoke-RestMethod "http://localhost:9000/api/system/status" -TimeoutSec 3
        if ($s.status -eq "UP") { $ready = $true; break }
    } catch { }
    Start-Sleep -Seconds 4
}
if (-not $ready) {
    Write-Host "SonarQube did not start in time. Check the logs with: docker logs sonarqube" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "SonarQube is ready: http://localhost:9000" -ForegroundColor Green
Write-Host "First time only: log in with admin / admin, set a new password,"
Write-Host "then open My Account > Security > Generate Token and copy the token."
Write-Host ""

$secure = Read-Host "Paste your SonarQube token here (it will not be shown or saved)" -AsSecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try {
    $token = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
} finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
}
if (-not $token) {
    Write-Host "No token entered." -ForegroundColor Red
    exit 1
}

Write-Host "Scanning..." -ForegroundColor Yellow
npx @sonar/scan "-Dsonar.token=$token"

Write-Host ""
Write-Host "Done. Open http://localhost:9000 and look at the project 'Ouchang Garage' (Overview and Issues tabs)." -ForegroundColor Green
