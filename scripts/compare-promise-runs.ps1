# Runs the promise check N times on a FRESH production server each time (empty in-memory
# cache), so every run really calls Gemini, then compares the results.
#   powershell -File scripts/compare-promise-runs.ps1 -CoinId 38849 -Runs 3
# Requires a production build (npm run build) and .env.local with CMC + Gemini keys.
param([int]$CoinId = 38849, [int]$Runs = 3, [int]$Port = 3124)

$ErrorActionPreference = "Stop"
$out = Join-Path $env:TEMP "covex-promise-runs"
New-Item -ItemType Directory -Force $out | Out-Null

function Stop-Port([int]$p) {
  Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue |
    ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
  for ($i = 0; $i -lt 20; $i++) {
    if (-not (Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue)) { return }
    Start-Sleep -Milliseconds 500
  }
  throw "Port $p is still in use"
}

Stop-Port $Port
for ($r = 1; $r -le $Runs; $r++) {
  $proc = Start-Process -FilePath "cmd.exe" -ArgumentList "/c npx next start -p $Port" -WindowStyle Hidden -PassThru
  $ok = $false
  for ($i = 0; $i -lt 60; $i++) {
    try { Invoke-WebRequest -UseBasicParsing "http://localhost:$Port/" -TimeoutSec 3 | Out-Null; $ok = $true; break } catch { Start-Sleep -Seconds 1 }
  }
  if (-not $ok) { throw "Server didn't start" }
  $listener = (Get-NetTCPConnection -LocalPort $Port -State Listen).OwningProcess | Select-Object -First 1
  $started = (Get-Process -Id $listener).StartTime
  $file = Join-Path $out "run$r.json"
  Invoke-WebRequest -UseBasicParsing "http://localhost:$Port/api/promises/$CoinId" -TimeoutSec 240 -OutFile $file
  "run ${r}: server pid $listener started $started"
  Stop-Port $Port
}
node -e "
const fs=require('fs'),path=require('path');const dir=process.argv[1];const n=+process.argv[2];
const runs=[...Array(n)].map((_,i)=>JSON.parse(fs.readFileSync(path.join(dir,'run'+(i+1)+'.json'),'utf8')));
const k=r=>(r.promises||[]).map(p=>p.dueDate+' | '+p.quote);
runs.forEach((r,i)=>console.log('run',i+1,':',r.error?('ERR '+JSON.stringify(r.error)):r.promises.length+' items, generatedAt '+r.generatedAt));
const base=JSON.stringify(k(runs[0]));console.log('all identical:',runs.every(r=>JSON.stringify(k(r))===base));
runs.forEach((r,i)=>{console.log('--- run',i+1);for(const l of k(r))console.log('  ',l)});
" $out $Runs
