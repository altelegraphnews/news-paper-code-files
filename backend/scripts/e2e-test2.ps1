# Full cycle: writer drafts -> submits -> admin approves -> public -> override
$api = 'http://localhost:5000/api/v1'
$deadline=(Get-Date).AddSeconds(45); $r=$null
while((Get-Date) -lt $deadline -and -not $r){ try { $r = Invoke-WebRequest -Uri http://localhost:5000/health -UseBasicParsing -TimeoutSec 3 } catch { Start-Sleep -Seconds 2 } }
if (-not $r) { 'backend not responding'; exit 1 }

$wlogin = Invoke-RestMethod -Uri "$api/auth/login" -Method Post -ContentType 'application/json' -Body (@{email='laila@altilgraf.com'; password='Writer@123'} | ConvertTo-Json)
$wHeaders = @{ Authorization = "Bearer $($wlogin.data.accessToken)" }
$cats = Invoke-RestMethod -Uri "$api/categories"
$catId = $cats.data[1]._id

$content = '<p>' + ('هذا اختبار ثان لدورة النشر الكاملة في لوحة تحكم التلغراف بعد إصلاح طابور المهام. ' * 4) + '</p>'
$body = [Text.Encoding]::UTF8.GetBytes((@{
  title = ('اختبار دورة النشر الكاملة ' + (Get-Date -Format 'HHmmss'))
  content = $content
  category = $catId
  status = 'pending'
} | ConvertTo-Json))
$article = Invoke-RestMethod -Uri "$api/articles" -Method Post -Headers $wHeaders -ContentType 'application/json; charset=utf-8' -Body $body
$artId = $article.data._id
"A. created+submitted: status=$($article.data.status), author=$($article.data.author.name)"

$login = Invoke-RestMethod -Uri "$api/auth/login" -Method Post -ContentType 'application/json' -Body (@{email='admin@alwid.com'; password='Admin@123'} | ConvertTo-Json)
$aHeaders = @{ Authorization = "Bearer $($login.data.accessToken)" }
$pc = Invoke-RestMethod -Uri "$api/articles/pending-count" -Headers $aHeaders
"B. pending count: $($pc.data.count)"

$sw = [Diagnostics.Stopwatch]::StartNew()
$approve = Invoke-RestMethod -Uri "$api/articles/$artId/approve" -Method Post -Headers $aHeaders -ContentType 'application/json' -Body '{}' -TimeoutSec 30
$sw.Stop()
"C. approved in $($sw.ElapsedMilliseconds)ms - status: $($approve.data.status)"

$slug = $article.data.slug
$pub = Invoke-RestMethod -Uri "$api/articles/$([uri]::EscapeDataString($slug))"
"D. public fetch: author=$($pub.data.author.name), status=$($pub.data.status)"

# Reject flow test: new pending article then reject with note
$body2 = [Text.Encoding]::UTF8.GetBytes((@{
  title = ('اختبار الارجاع مع ملاحظات ' + (Get-Date -Format 'HHmmss'))
  content = $content
  category = $catId
  status = 'pending'
} | ConvertTo-Json))
$a2 = Invoke-RestMethod -Uri "$api/articles" -Method Post -Headers $wHeaders -ContentType 'application/json; charset=utf-8' -Body $body2
$rejBody = [Text.Encoding]::UTF8.GetBytes((@{ note = 'يرجى تدقيق الفقرة الثانية وإضافة مصادر' } | ConvertTo-Json))
$rej = Invoke-RestMethod -Uri "$api/articles/$($a2.data._id)/reject" -Method Post -Headers $aHeaders -ContentType 'application/json; charset=utf-8' -Body $rejBody
"E. rejected - status: $($rej.data.status)"
$mine = Invoke-RestMethod -Uri "$api/articles?mine=true&status=rejected" -Headers $wHeaders
"F. writer sees rejected article with note: $($mine.data[0].review.note.Length) chars"

# Resubmit after rejection
$resub = Invoke-RestMethod -Uri "$api/articles/$($a2.data._id)/submit" -Method Post -Headers $wHeaders
"G. resubmitted after rejection - status: $($resub.data.status)"

# Permission override
$writerId = $wlogin.data.user._id
$ovBody = @{ permissionOverrides = @{ 'articles.publish' = $true } } | ConvertTo-Json
$upd = Invoke-RestMethod -Uri "$api/users/$writerId" -Method Put -Headers $aHeaders -ContentType 'application/json' -Body $ovBody
"H. override set - writer publish permission: $($upd.data.permissions.'articles.publish')"

# Writer can now publish own pending article
$wlogin2 = Invoke-RestMethod -Uri "$api/auth/login" -Method Post -ContentType 'application/json' -Body (@{email='laila@altilgraf.com'; password='Writer@123'} | ConvertTo-Json)
$wHeaders2 = @{ Authorization = "Bearer $($wlogin2.data.accessToken)" }
$wpub = Invoke-RestMethod -Uri "$api/articles/$($a2.data._id)/publish" -Method Post -Headers $wHeaders2 -TimeoutSec 30
"I. writer with override published own article: $($wpub.success)"

# Revert override; writer publish should fail again
$revertBody = @{ permissionOverrides = @{} } | ConvertTo-Json
Invoke-RestMethod -Uri "$api/users/$writerId" -Method Put -Headers $aHeaders -ContentType 'application/json' -Body $revertBody | Out-Null
try {
  Invoke-RestMethod -Uri "$api/articles/$($a2.data._id)/unpublish" -Method Post -Headers $wHeaders2 -TimeoutSec 30 | Out-Null
  "J. ERROR: writer still has publish rights after revert"
} catch {
  "J. override reverted - writer blocked again: HTTP $($_.Exception.Response.StatusCode.value__)"
}

# cleanup: archive the two test articles
Invoke-RestMethod -Uri "$api/articles/$artId/archive" -Method Post -Headers $aHeaders -TimeoutSec 30 | Out-Null
Invoke-RestMethod -Uri "$api/articles/$($a2.data._id)/archive" -Method Post -Headers $aHeaders -TimeoutSec 30 | Out-Null
"K. test articles archived"
