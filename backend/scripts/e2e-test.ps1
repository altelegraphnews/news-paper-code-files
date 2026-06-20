# End-to-end workflow test: admin approves writer's pending article
$api = 'http://localhost:5000/api/v1'
$deadline=(Get-Date).AddSeconds(45); $r=$null
while((Get-Date) -lt $deadline -and -not $r){ try { $r = Invoke-WebRequest -Uri http://localhost:5000/health -UseBasicParsing -TimeoutSec 3 } catch { Start-Sleep -Seconds 2 } }
if (-not $r) { 'backend not responding'; exit 1 }

$login = Invoke-RestMethod -Uri "$api/auth/login" -Method Post -ContentType 'application/json' -Body (@{email='admin@alwid.com'; password='Admin@123'} | ConvertTo-Json)
$aHeaders = @{ Authorization = "Bearer $($login.data.accessToken)" }
$pending = Invoke-RestMethod -Uri "$api/articles?status=pending&limit=5" -Headers $aHeaders
"7. pending list (admin view): $($pending.data.Count) article(s)"
$artId = $pending.data[0]._id
$slug = $pending.data[0].slug

$approve = Invoke-RestMethod -Uri "$api/articles/$artId/approve" -Method Post -Headers $aHeaders -ContentType 'application/json' -Body '{}' -TimeoutSec 20
"8. approved - status: $($approve.data.status)"

$pub = Invoke-RestMethod -Uri "$api/articles/$([uri]::EscapeDataString($slug))"
"9. public article author: $($pub.data.author.name) - status: $($pub.data.status)"

$wlogin = Invoke-RestMethod -Uri "$api/auth/login" -Method Post -ContentType 'application/json' -Body (@{email='laila@altilgraf.com'; password='Writer@123'} | ConvertTo-Json)
$wHeaders = @{ Authorization = "Bearer $($wlogin.data.accessToken)" }
$me = Invoke-RestMethod -Uri "$api/analytics/me" -Headers $wHeaders
"10. writer stats: total=$($me.data.totalArticles), published=$($me.data.statusCounts.published)"

$writerId = $wlogin.data.user._id
$ovBody = @{ permissionOverrides = @{ 'articles.publish' = $true } } | ConvertTo-Json
$upd = Invoke-RestMethod -Uri "$api/users/$writerId" -Method Put -Headers $aHeaders -ContentType 'application/json' -Body $ovBody
"11. override set - writer publish permission now: $($upd.data.permissions.'articles.publish')"
$revertBody = @{ permissionOverrides = @{} } | ConvertTo-Json
Invoke-RestMethod -Uri "$api/users/$writerId" -Method Put -Headers $aHeaders -ContentType 'application/json' -Body $revertBody | Out-Null
"11b. override reverted"
