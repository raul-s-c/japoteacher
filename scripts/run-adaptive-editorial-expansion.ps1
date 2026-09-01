param(
  [int]$TokenBudget = 1500000,
  [int]$GenerationBudget = 1300000,
  [long]$UsageBaseline = 0,
  [string]$UsageReferenceZip = $(if ($env:JAPOTEACHER_USAGE_REFERENCE_ZIP) { $env:JAPOTEACHER_USAGE_REFERENCE_ZIP } else { Join-Path $HOME 'Downloads\japanese_usage_progress_v2_csv.zip' })
)

$ErrorActionPreference = 'Stop'
$env:PYTHONUTF8 = '1'
$root = Split-Path -Parent $PSScriptRoot
$python = 'C:\Users\rauls\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
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
if (-not (Test-Path -LiteralPath $UsageReferenceZip)) { throw "No se encuentra la referencia de cobertura: $UsageReferenceZip" }

# Prioridad basada en la evidencia actual: Dinero es el menor banco; ES->JP necesita más
# práctica N5, y Trabajo/Familia requieren una rampa N4 baja-media antes de los tramos altos.
$n5Topics = 'ahorro,inversiones,negocio,relaciones,familia,trabajo,estudio,vida_diaria'
$n4Topics = 'ahorro,inversiones,negocio,trabajo,tecnologia,estudio,relaciones,servicios'

Push-Location $root
try {
  while (Has-Budget $GenerationBudget) {
    Run-Editorial @('scripts/editorial-generate.py','N5','--append','8','--topics',$n5Topics,'--usage-reference-zip',$UsageReferenceZip,'--usage-baseline',$UsageBaseline,'--token-budget',$GenerationBudget)
    if (-not (Has-Budget $GenerationBudget)) { break }
    Run-Editorial @('scripts/editorial-generate.py','N4','--append','8','--topics',$n4Topics,'--usage-reference-zip',$UsageReferenceZip,'--usage-baseline',$UsageBaseline,'--token-budget',$GenerationBudget)
  }
  Run-Editorial @('scripts/audit-editorial-pairs.py','N5')
  Run-Editorial @('scripts/audit-editorial-pairs.py','N4')
  Run-Editorial @('scripts/publish-editorial-bank.py')
  Run-Editorial @('scripts/generate-editorial-furigana.py')
  Run-Editorial @('scripts/audit-jlpt-bank.py')
  Run-Editorial @('scripts/audit-difficulty.py')
  "[$(Get-Date -Format o)] Finished. Spent=$(Spent); budget=$TokenBudget" | Tee-Object -FilePath $log -Append
} finally {
  Pop-Location
}
