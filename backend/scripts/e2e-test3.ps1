# Final timing check: approve must respond fast despite Redis being down
$api = 'http://localhost:5000/api/v1'
$deadline=(Get-Date).AddSeconds(45); $r=$null
while((Get-Date) -lt $deadline -and -not $r){ try { $r = Invoke-WebRequest -Uri http://localhost:5000/health -UseBasicParsing -TimeoutSec 3 } catch { Start-Sleep -Seconds 2 } }
if (-not $r) { 'backend not responding'; exit 1 }

$wlogin = Invoke-RestMethod -Uri "$api/auth/login" -Method Post -ContentType 'application/json' -Body (@{email='laila@altilgraf.com'; password='Writer@123'} | ConvertTo-Json)
$wHeaders = @{ Authorization = "Bearer $($wlogin.data.accessToken)" }
$cats = Invoke-RestMethod -Uri "$api/categories"
$catId = $cats.data[2]._id

$content = '<p>' + ('فقرة اختبار نهائية للتحقق من سرعة استجابة الموافقة بعد إصلاح مهلة الطابور. ' * 4) + '</p>'
$body = [Text.Encoding]::UTF8.GetBytes((@{
  title = ('اختبار سرعة الموافقة ' + (Get-Date -Format 'HHmmss'))
  content = $content
  category = $catId
  status = 'pending'
} | ConvertTo-Json))
$article = Invoke-RestMethod -Uri "$api/articles" -Method Post -Headers $wHeaders -ContentType 'application/json; charset=utf-8' -Body $body
"A. submitted: $($article.data.status)"

$login = Invoke-RestMethod -Uri "$api/auth/login" -Method Post -ContentType 'application/json' -Body (@{email='admin@alwid.com'; password='Admin@123'} | ConvertTo-Json)
$aHeaders = @{ Authorization = "Bearer $($login.data.accessToken)" }

$sw = [Diagnostics.Stopwatch]::StartNew()
$approve = Invoke-RestMethod -Uri "$api/articles/$($article.data._id)/approve" -Method Post -Headers $aHeaders -ContentType 'application/json' -Body '{}' -TimeoutSec 30
$sw.Stop()
"B. approved in $($sw.ElapsedMilliseconds)ms - status: $($approve.data.status)"

# cleanup
Invoke-RestMethod -Uri "$api/articles/$($article.data._id)/archive" -Method Post -Headers $aHeaders -TimeoutSec 30 | Out-Null
"C. cleaned up"
