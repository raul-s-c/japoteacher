param(
  [int]$TokenBudget = 1500000,
  [long]$UsageBaseline = 7155493
)

$ErrorActionPreference = 'Stop'
$env:PYTHONUTF8 = '1'
$root = Split-Path -Parent $PSScriptRoot
$python = 'C:\Users\rauls\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
$log = Join-Path $root 'data\editorial\editorial-expansion-20260814.log'

function TotalUsage {
  & $python -c "import json; print(sum((x.get('usage') or {}).get('total_tokens',(x.get('usage') or {}).get('input_tokens',0)+(x.get('usage') or {}).get('output_tokens',0)) for x in map(json.loads,open('data/editorial/usage.jsonl',encoding='utf-8')) if x))"
}

function Run-Editorial([string[]]$Arguments) {
  "[$(Get-Date -Format o)] $($Arguments -join ' ')" | Tee-Object -FilePath $log -Append
  & $python @Arguments 2>&1 | Tee-Object -FilePath $log -Append
  if ($LASTEXITCODE -ne 0) { throw "Falló el paso editorial: $($Arguments -join ' ')" }
}

function Has-Budget { return ([long](TotalUsage) - $UsageBaseline) -lt $TokenBudget }

Push-Location $root
try {
  Run-Editorial @('scripts/revalidate-legacy-pairs.py','N5','--usage-baseline',$UsageBaseline,'--token-budget',$TokenBudget)
  if (Has-Budget) { Run-Editorial @('scripts/revalidate-legacy-pairs.py','N4','--usage-baseline',$UsageBaseline,'--token-budget',$TokenBudget) }
  $n5Topics = 'familia,relaciones,trabajo,estudio,ahorro,inversiones,negocio,ocio,vida_diaria,ciencia,historia,idiomas'
  $n4Topics = 'familia,relaciones,trabajo,tecnologia,ahorro,inversiones,negocio,ocio,viajes,sociedad,ciencia,historia,idiomas'
  while (Has-Budget) {
    Run-Editorial @('scripts/editorial-generate.py','N5','--append','8','--topics',$n5Topics,'--usage-baseline',$UsageBaseline,'--token-budget',$TokenBudget)
    if (-not (Has-Budget)) { break }
    Run-Editorial @('scripts/editorial-generate.py','N4','--append','8','--topics',$n4Topics,'--usage-baseline',$UsageBaseline,'--token-budget',$TokenBudget)
  }
  "[$(Get-Date -Format o)] Finished. Spent=$([long](TotalUsage) - $UsageBaseline)" | Tee-Object -FilePath $log -Append
} finally {
  Pop-Location
}
