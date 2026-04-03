<#
.SYNOPSIS
    XrmForge CLI Wrapper mit automatischer TokenVault-Authentifizierung.
.DESCRIPTION
    Lädt den Dataverse-Token aus dem Markant TokenVault und ruft die XrmForge CLI auf.
    Das System (dataverse_dev, dataverse_test etc.) wird automatisch aus der --url abgeleitet.
.EXAMPLE
    .\xrmforge.ps1 generate --url https://markant-dev.crm4.dynamics.com --entities account --output ./test-output
.EXAMPLE
    .\xrmforge.ps1 generate --url https://markant-test.crm4.dynamics.com --entities account,contact --output ./types --cache
.NOTES
    Voraussetzung: TokenVault muss eingerichtet sein und gültige Tokens haben.
    Prüfung: Get-VaultHealth (im Markant-Repo)
#>
param(
    [Parameter(ValueFromRemainingArguments)]
    [string[]]$PassthroughArgs
)

Set-ExecutionPolicy -Scope Process Bypass -Force
$ErrorActionPreference = 'Stop'

# ── URL zu TokenVault-System Mapping ──
$urlToSystem = @{
    'markant-dev'      = 'dataverse_dev'
    'markant-test'     = 'dataverse_test'
    'markant-datatest' = 'dataverse_datatest'
    'markant-prod'     = 'dataverse_prod'
    'markant'          = 'dataverse_prod'
}

# ── URL aus den Argumenten extrahieren ──
$allArgs = $PassthroughArgs
$urlIndex = -1
for ($i = 0; $i -lt $allArgs.Count; $i++) {
    if ($allArgs[$i] -eq '--url' -and $i + 1 -lt $allArgs.Count) {
        $urlIndex = $i + 1
        break
    }
}

if ($urlIndex -eq -1) {
    Write-Host "Fehler: --url Parameter nicht gefunden." -ForegroundColor Red
    Write-Host "Beispiel: .\xrmforge.ps1 generate --url https://markant-dev.crm4.dynamics.com --entities account --output ./types" -ForegroundColor Gray
    exit 1
}

$envUrl = $allArgs[$urlIndex]

# ── System aus URL ableiten ──
$system = $null
foreach ($key in $urlToSystem.Keys) {
    if ($envUrl -match "https://$key\.crm") {
        $system = $urlToSystem[$key]
        break
    }
}

if (-not $system) {
    Write-Host "Fehler: Konnte kein TokenVault-System aus URL '$envUrl' ableiten." -ForegroundColor Red
    Write-Host "Bekannte Umgebungen: $($urlToSystem.Keys -join ', ')" -ForegroundColor Gray
    exit 1
}

# ── TokenVault laden und Token holen ──
$vaultPath = Join-Path (Split-Path $PSScriptRoot -Parent) 'Markant\projekte\common\auth\TokenVault.ps1'
if (-not (Test-Path $vaultPath)) {
    # Fallback: absoluter Pfad
    $vaultPath = 'C:\Users\Juerg\source\repos\Markant\projekte\common\auth\TokenVault.ps1'
}

if (-not (Test-Path $vaultPath)) {
    Write-Host "Fehler: TokenVault nicht gefunden unter: $vaultPath" -ForegroundColor Red
    exit 1
}

. $vaultPath
$token = Get-VaultToken -System $system

if (-not $token) {
    Write-Host "Fehler: Kein gültiger Token für System '$system'." -ForegroundColor Red
    Write-Host "Bitte 'Unlock-VaultToken -System $system' ausführen." -ForegroundColor Yellow
    exit 1
}

$env:XRMFORGE_TOKEN = $token

# ── Auth-Parameter anpassen: --auth token erzwingen, vorhandene Auth-Params entfernen ──
$cleanArgs = [System.Collections.ArrayList]::new()
$skipNext = $false
for ($i = 0; $i -lt $allArgs.Count; $i++) {
    if ($skipNext) { $skipNext = $false; continue }
    if ($allArgs[$i] -in '--auth', '--tenant-id', '--client-id', '--client-secret', '--token') {
        $skipNext = $true
        continue
    }
    [void]$cleanArgs.Add($allArgs[$i])
}

# --auth token einfügen nach dem Subcommand (erstes Argument)
$finalArgs = [System.Collections.ArrayList]::new()
[void]$finalArgs.Add($cleanArgs[0])  # z.B. 'generate'
[void]$finalArgs.Add('--auth')
[void]$finalArgs.Add('token')
for ($i = 1; $i -lt $cleanArgs.Count; $i++) {
    [void]$finalArgs.Add($cleanArgs[$i])
}

Write-Host "XrmForge [$system] Token geladen" -ForegroundColor Green

# ── CLI ausführen ──
& npx tsx packages/cli/src/index.ts @finalArgs
