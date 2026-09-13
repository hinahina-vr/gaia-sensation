$ErrorActionPreference = 'Stop'
$sourceDir = Join-Path $PSScriptRoot '../artifacts/prtr-biology-sources'
New-Item -ItemType Directory -Path $sourceDir -Force | Out-Null
$sources = @(
  @{ Name='office_2022.zip'; Url='https://www.nite.go.jp/chem/prtr/mapdata/data/2022/data_3/office/office_2022.zip' },
  @{ Name='R04PRTRdata.zip'; Url='https://www.env.go.jp/chemi/prtr/kaiji/data/R04PRTRdata.zip' }
)
# River surveys, not dam surveys. Regions 81–89 are the nine public river blocks.
foreach ($region in 81..89) {
  foreach ($kind in '01','02') {
    $sources += @{ Name="RT${region}_B${kind}.zip"; Url="https://www.nilim.go.jp/lab/fbg/ksnkankyo/download/slist/RT${region}_B${kind}.zip" }
    $sources += @{ Name="RG${region}_B${kind}.zip"; Url="https://www.nilim.go.jp/lab/fbg/ksnkankyo/download/shape/RG${region}_B${kind}.zip" }
  }
}
foreach ($source in $sources) {
  $target = Join-Path $sourceDir $source.Name
  if (-not (Test-Path -LiteralPath $target)) { Invoke-WebRequest $source.Url -OutFile $target }
  Write-Output "$($source.Name) $((Get-Item -LiteralPath $target).Length) bytes"
}
