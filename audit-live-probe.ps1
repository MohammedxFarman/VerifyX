$ErrorActionPreference = 'Stop'
$base = 'https://verifyx-fue5.onrender.com'
$body = @{image='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9XkAAAAASUVORK5CYII=';mimeType='image/png';fileName='audit-one-pixel.png';fileSize=68} | ConvertTo-Json
$timer = [Diagnostics.Stopwatch]::StartNew()
$r = Invoke-RestMethod -Uri ($base + '/api/verify/image?async=true') -Method Post -ContentType 'application/json' -Body $body -TimeoutSec 45
@{stage='initial';seconds=$timer.Elapsed.TotalSeconds;jobId=$r.jobId;report=$r.report} | ConvertTo-Json -Depth 8
if ($r.jobId) {
  Start-Sleep -Seconds 3
  $result = Invoke-RestMethod -Uri ($base + '/api/verify/result/' + $r.jobId) -TimeoutSec 45
  @{stage='poll';seconds=$timer.Elapsed.TotalSeconds;details=$result.details} | ConvertTo-Json -Depth 8
}
