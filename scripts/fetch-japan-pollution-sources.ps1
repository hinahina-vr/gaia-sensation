$ErrorActionPreference = 'Stop'
function Get-PublicFile($url, $target, $body) {
    for ($retry=0; $retry -lt 4; $retry++) {
        try {
            $params = @{Uri=$url;OutFile=$target;TimeoutSec=40}
            if ($body) { $params.Method='Post'; $params.Body=$body }
            Invoke-WebRequest @params
            return
        } catch { if ($retry -eq 3) { throw }; Start-Sleep -Seconds 2 }
    }
}
$sourceDir = Join-Path $PSScriptRoot '../data/sources/japan-pollution'
New-Item -ItemType Directory -Force -Path $sourceDir | Out-Null
$airApi = 'https://tenbou.nies.go.jp/download/api/'
$files = @()
foreach ($kind in @('td', 'tm')) {
    $query = @{ type=$kind; prefs='["00"]'; years='["2019","2020","2021","2022","2023"]'; materials='["01","02","03","04","05","06","07","08","09","10","12"]' }
    $response = Invoke-RestMethod -Method Post -Uri ($airApi + 'searchfile.php') -Body $query
    if ($response.status -ne '' -or $response.files.Count -ne $(if ($kind -eq 'td') {55} else {5})) { throw 'Incomplete NIES source listing' }
    foreach ($file in $response.files) {
        if ($file.name -notmatch '^(TD|TM)20(19|2[0-3])[0-9]{4}\.zip$') { throw 'Unexpected source name' }
        $target = Join-Path $sourceDir $file.name
        if (-not (Test-Path -LiteralPath $target) -or (Get-Item -LiteralPath $target).Length -ne $file.size) {
            Get-PublicFile ($airApi + 'archivedownload.php') $target @{type=$kind;file=$file.name}
        }
        if ((Get-Item -LiteralPath $target).Length -ne $file.size) { throw "Unexpected file size: $target" }
        $files += @{ file=$file.name; sha256=(Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash.ToLowerInvariant(); url=($airApi+'archivedownload.php'); form=@{type=$kind;file=$file.name} }
        Write-Output $file.name
    }
}
$waterApi = 'https://water-pub.env.go.jp/water-pub/mizu-site/zip_create/'
foreach ($year in 2020..2024) {
    $name = "nutrients-$year.zip"
    $target = Join-Path $sourceDir $name
    $query = @{featureClassName='p_kosui_y03';whereClause="nendo=$year";extension='csv'}
    if (-not (Test-Path -LiteralPath $target)) {
        $token = (Invoke-RestMethod -Method Post -Uri ($waterApi+'WebService.asmx/StartCreation') -ContentType 'application/json; charset=utf-8' -Body ($query | ConvertTo-Json)).d
        if (-not $token -or $token -in @('RecordNotFound','BadRequest')) { throw "MOE export: $token" }
        $state = 'Running'
        for ($attempt=0; $attempt -lt 60 -and $state -eq 'Running'; $attempt++) {
            Start-Sleep -Milliseconds 1500
            $state = (Invoke-RestMethod -Method Post -Uri ($waterApi+'WebService.asmx/GetThreadStatus') -ContentType 'application/json; charset=utf-8' -Body (@{resultFileName=$token}|ConvertTo-Json)).d
        }
        if ($state -ne 'Stopped') { throw "MOE export did not complete: $state" }
        Get-PublicFile ($waterApi+'download.aspx?id='+$token) $target
    }
    $files += @{file=$name;sha256=(Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash.ToLowerInvariant();url=($waterApi+'WebService.asmx/StartCreation');query=$query}
    Write-Output $name
}
# Retain the actual specification versions with the immutable responses.
foreach ($name in @('TD_manu.pdf','TM_manu.pdf')) {
    $target = Join-Path $sourceDir $name
    $url = 'https://tenbou.nies.go.jp/download/'+$name
    if (-not (Test-Path -LiteralPath $target)) { Get-PublicFile $url $target }
    $files += @{file=$name;sha256=(Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash.ToLowerInvariant();url=$url}
}
# This script is the reproducible source-retention pipeline, not a hand edit.
$manifest = @{retrievedOn=(Get-Date -Format 'yyyy-MM-dd');airYears=@(2019..2023);waterYears=@(2020..2024);sources=$files}
$manifestPath = Join-Path $sourceDir 'manifest.json'
if (-not (Test-Path -LiteralPath $manifestPath)) { $manifest | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $manifestPath -Encoding utf8NoBOM }
