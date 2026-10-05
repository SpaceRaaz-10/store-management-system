$base = "http://localhost:8000"
$s = New-Object Microsoft.PowerShell.Commands.WebRequestSession

$csrf = Invoke-RestMethod -Uri "$base/api/auth/csrf" -WebSession $s
$h = @{ "X-CSRF-Token" = $csrf.data.token }
Invoke-RestMethod -Uri "$base/api/auth/login" -WebSession $s -Method POST `
    -ContentType "application/json" -Headers $h `
    -Body (@{ email = "admin@store.local"; password = "Admin@123" } | ConvertTo-Json) | Out-Null

Write-Host "`n--- Trying sales report (format=excel) ---" -ForegroundColor Cyan

try {
    $resp = Invoke-WebRequest -Uri "$base/api/reports/sales?format=excel" -WebSession $s -UseBasicParsing
    Write-Host "SUCCESS — got $($resp.RawContentLength) bytes"
} catch {
    Write-Host "FAILED — Status: $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Red
    try {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $body = $reader.ReadToEnd()
        Write-Host "Response body:" -ForegroundColor Yellow
        Write-Host $body
    } catch { }
}