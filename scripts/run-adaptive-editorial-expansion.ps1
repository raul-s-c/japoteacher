param(
  [int]$TokenBudget = 1500000,
  [int]$GenerationBudget = 1300000,
  [long]$UsageBaseline = 0
)

$ErrorActionPreference = 'Stop'
$env:PYTHONUTF8 = '1'
$root = Split-Path -Parent $PSScriptRoot
$bundledPython = 'C:\Users\rauls\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
$python = if (Test-Path $bundledPython) { $bundledPython } else { 'python' }
$log = Join-Path $root 'data\editorial\adaptive-expansion.log'

function TotalUsage {
  & $python -c "import json; print(sum((x.get('usage') or {}).get('total_tokens',(x.get('usage') or {}).get('input_tokens',0)+(x.get('usage') or {}).get('output_tokens',0)) for x in map(json.loads,open('data/editorial/usage.jsonl',encoding='utf-8')) if x))"
}

function Spent { return [long](TotalUsage) - $UsageBaseline }
function Has-Budget([long]$Limit) { return (Spent) -lt $Limit }
function Run-Editorial([string[]]$Arguments) {
  "[$(Get-Date -Format o)] $($Arguments -join ' ')" | Tee-Object -FilePath $log -Append
  & $python @Arguments 2>&1 | Tee-Object -FilePath $log -Append
  if ($LASTEXITCODE -ne 0) { throw "Falló el paso editorial: $($Arguments -join ' ')" }
}

if (-not $env:JAPOTEACHER_EDITORIAL_KEY) { throw 'Falta JAPOTEACHER_EDITORIAL_KEY en el entorno.' }
if ($UsageBaseline -le 0) { $UsageBaseline = [long](TotalUsage) }
if ($GenerationBudget -gt $TokenBudget) { throw 'GenerationBudget no puede superar TokenBudget.' }

# Prioridad basada en la evidencia actual: Dinero es el menor banco; ES->JP necesita más
# práctica N5, y Trabajo/Familia requieren una rampa N4 baja-media antes de los tramos altos.
$n5Topics = 'ahorro,inversiones,negocio,relaciones,familia,trabajo,estudio,vida_diaria'
$n4Topics = 'ahorro,inversiones,negocio,trabajo,tecnologia,estudio,relaciones,servicios'

Push-Location $root
try {
  while (Has-Budget $GenerationBudget) {
    Run-Editorial @('scripts/editorial-generate.py','N5','--append','8','--topics',$n5Topics,'--usage-baseline',$UsageBaseline,'--token-budget',$GenerationBudget)
    if (-not (Has-Budget $GenerationBudget)) { break }
    Run-Editorial @('scripts/editorial-generate.py','N4','--append','8','--topics',$n4Topics,'--usage-baseline',$UsageBaseline,'--token-budget',$GenerationBudget)
  }
  Run-Editorial @('scripts/audit-editorial-pairs.py','N5')
  Run-Editorial @('scripts/audit-editorial-pairs.py','N4')
  Run-Editorial @('scripts/publish-editorial-bank.py')
  if (Has-Budget $TokenBudget) {
    $env:EDITORIAL_API_KEY = $env:JAPOTEACHER_EDITORIAL_KEY
    & node scripts/review-difficulty-with-ai.mjs --levels N5,N4 --apply-reviewed --usage-baseline $UsageBaseline --token-budget $TokenBudget 2>&1 | Tee-Object -FilePath $log -Append
    if ($LASTEXITCODE -ne 0) { throw 'Falló la recalibración editorial de dificultad.' }
  }
  Run-Editorial @('scripts/generate-editorial-furigana.py')
  Run-Editorial @('scripts/audit-jlpt-bank.py')
  Run-Editorial @('scripts/audit-difficulty.py')
  "[$(Get-Date -Format o)] Finished. Spent=$(Spent); budget=$TokenBudget" | Tee-Object -FilePath $log -Append
} finally {
  Pop-Location
}
