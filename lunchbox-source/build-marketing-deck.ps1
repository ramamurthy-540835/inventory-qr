$ErrorActionPreference = 'Stop'

$outputPath = 'C:\Users\Malathy\Food\launch\LunchBox-Marketing-Strategy.pptx'
$ppLayoutBlank = 12
$ppSaveAsOpenXMLPresentation = 24
$msoFalse = 0
$msoTrue = -1
$msoTextOrientationHorizontal = 1
$msoShapeRectangle = 1
$msoShapeRoundedRectangle = 5
$msoShapeOval = 9

$green = 0x304017
$deepGreen = 0x2B3717
$orange = 0x3BA6F2
$cream = 0xE0EEF8
$white = 0xFFFFFF
$muted = 0x66766C
$lightGreen = 0xE8F2EC
$red = 0x375CD4
$blue = 0xA55621

function Add-TextBox {
  param($Slide, [float]$Left, [float]$Top, [float]$Width, [float]$Height, [string]$Text,
    [float]$Size = 18, [int]$Color = $deepGreen, [bool]$Bold = $false,
    [string]$Font = 'Aptos', [int]$Align = 1)
  $shape = $Slide.Shapes.AddTextbox($msoTextOrientationHorizontal, $Left, $Top, $Width, $Height)
  $shape.TextFrame.TextRange.Text = $Text
  $shape.TextFrame.MarginLeft = 0
  $shape.TextFrame.MarginRight = 0
  $shape.TextFrame.MarginTop = 0
  $shape.TextFrame.MarginBottom = 0
  $range = $shape.TextFrame.TextRange
  $range.Font.Name = $Font
  $range.Font.Size = $Size
  $range.Font.Color.RGB = $Color
  $range.Font.Bold = if ($Bold) { $msoTrue } else { $msoFalse }
  $range.ParagraphFormat.Alignment = $Align
  return $shape
}

function Add-Rect {
  param($Slide, [float]$Left, [float]$Top, [float]$Width, [float]$Height,
    [int]$Fill, [int]$Line = $Fill, [float]$Radius = 0)
  $type = if ($Radius -gt 0) { $msoShapeRoundedRectangle } else { $msoShapeRectangle }
  $shape = $Slide.Shapes.AddShape($type, $Left, $Top, $Width, $Height)
  $shape.Fill.ForeColor.RGB = $Fill
  $shape.Line.ForeColor.RGB = $Line
  if ($Line -eq $Fill) { $shape.Line.Visible = $msoFalse }
  return $shape
}

function Add-Title {
  param($Slide, [string]$Kicker, [string]$Title, [string]$Subtitle = '')
  Add-TextBox $Slide 48 28 850 18 $Kicker.ToUpper() 10 $orange $true | Out-Null
  Add-TextBox $Slide 48 52 850 52 $Title 28 $deepGreen $true | Out-Null
  if ($Subtitle) { Add-TextBox $Slide 48 108 850 34 $Subtitle 13 $muted $false | Out-Null }
  Add-Rect $Slide 48 510 864 2 $orange | Out-Null
  Add-TextBox $Slide 48 516 260 14 'LUNCHBOX · LAUNCH STRATEGY 2026' 8 $muted $true | Out-Null
}

function Add-BulletList {
  param($Slide, [float]$Left, [float]$Top, [float]$Width, [float]$Height,
    [string[]]$Items, [float]$Size = 17, [int]$Color = $deepGreen)
  $text = ($Items | ForEach-Object { "•  $_" }) -join "`r"
  $shape = Add-TextBox $Slide $Left $Top $Width $Height $text $Size $Color $false
  $shape.TextFrame.TextRange.ParagraphFormat.SpaceAfter = 9
  return $shape
}

function Add-Card {
  param($Slide, [float]$Left, [float]$Top, [float]$Width, [float]$Height,
    [string]$Heading, [string]$Body, [string]$Metric = '')
  Add-Rect $Slide $Left $Top $Width $Height $white 0xDCE6DF 8 | Out-Null
  if ($Metric) {
    Add-TextBox $Slide ($Left + 16) ($Top + 13) ($Width - 32) 34 $Metric 24 $orange $true | Out-Null
    Add-TextBox $Slide ($Left + 16) ($Top + 51) ($Width - 32) 22 $Heading 13 $deepGreen $true | Out-Null
    Add-TextBox $Slide ($Left + 16) ($Top + 76) ($Width - 32) ($Height - 86) $Body 10.5 $muted $false | Out-Null
  } else {
    Add-TextBox $Slide ($Left + 16) ($Top + 14) ($Width - 32) 24 $Heading 14 $orange $true | Out-Null
    Add-TextBox $Slide ($Left + 16) ($Top + 45) ($Width - 32) ($Height - 55) $Body 11.5 $deepGreen $false | Out-Null
  }
}

function Add-Table {
  param($Slide, [float]$Left, [float]$Top, [float]$Width, [float]$Height,
    [string[]]$Headers, [object[][]]$Rows, [float]$FontSize = 11)
  $tableShape = $Slide.Shapes.AddTable($Rows.Count + 1, $Headers.Count, $Left, $Top, $Width, $Height)
  $table = $tableShape.Table
  for ($c = 1; $c -le $Headers.Count; $c++) {
    $cell = $table.Cell(1, $c).Shape
    $cell.Fill.ForeColor.RGB = $green
    $cell.TextFrame.TextRange.Text = $Headers[$c - 1]
    $cell.TextFrame.TextRange.Font.Name = 'Aptos'
    $cell.TextFrame.TextRange.Font.Size = $FontSize
    $cell.TextFrame.TextRange.Font.Bold = $msoTrue
    $cell.TextFrame.TextRange.Font.Color.RGB = $white
    $cell.TextFrame.MarginLeft = 8; $cell.TextFrame.MarginRight = 6
  }
  for ($r = 1; $r -le $Rows.Count; $r++) {
    for ($c = 1; $c -le $Headers.Count; $c++) {
      $cell = $table.Cell($r + 1, $c).Shape
      $cell.Fill.ForeColor.RGB = if ($r % 2 -eq 0) { 0xF6FAF7 } else { $white }
      $cell.TextFrame.TextRange.Text = [string]$Rows[$r - 1][$c - 1]
      $cell.TextFrame.TextRange.Font.Name = 'Aptos'
      $cell.TextFrame.TextRange.Font.Size = $FontSize
      $cell.TextFrame.TextRange.Font.Color.RGB = $deepGreen
      $cell.TextFrame.MarginLeft = 8; $cell.TextFrame.MarginRight = 6
    }
  }
  return $tableShape
}

$powerPoint = New-Object -ComObject PowerPoint.Application
$powerPoint.Visible = $msoTrue
$presentation = $powerPoint.Presentations.Add()
$presentation.PageSetup.SlideWidth = 960
$presentation.PageSetup.SlideHeight = 540

try {
  # 1 — Cover
  $s = $presentation.Slides.Add(1, $ppLayoutBlank)
  $s.Background.Fill.ForeColor.RGB = $green
  Add-Rect $s 0 410 960 130 $cream | Out-Null
  Add-Rect $s 700 0 260 540 $orange | Out-Null
  Add-Rect $s 48 42 46 46 $orange $orange 8 | Out-Null
  Add-TextBox $s 60 50 24 28 'L' 20 $deepGreen $true 'Aptos Display' 2 | Out-Null
  Add-TextBox $s 108 48 250 34 'LunchBox' 22 $white $true | Out-Null
  Add-TextBox $s 48 150 610 112 "Market Launch &`rGoogle Ads Strategy" 35 $white $true 'Aptos Display' | Out-Null
  Add-TextBox $s 48 282 580 65 'A focused route from school pilot to repeatable growth for vegetarian student lunches in Tamil Nadu.' 16 0xE4F1E9 $false | Out-Null
  Add-TextBox $s 48 464 540 24 'LAUNCH BLUEPRINT · 5 AUGUST 2026' 11 $deepGreen $true | Out-Null

  # 2 — Recommendation
  $s = $presentation.Slides.Add(2, $ppLayoutBlank); Add-Title $s 'Executive recommendation' 'Win one neighbourhood before four cities.' 'Start with a controlled Chennai B2B2C pilot, prove repeat ordering, then expand.'
  Add-Card $s 48 160 202 132 'Pilot schools' 'One kitchen and one compact service area.' '2–3'
  Add-Card $s 266 160 202 132 'Initial students' 'Enough volume to validate without overextension.' '50–100'
  Add-Card $s 484 160 202 132 'Validation period' 'Track repeat orders, experience and reliability.' '4–6 weeks'
  Add-Card $s 702 160 210 132 'Ads test ceiling' 'Validation budget—not a scale budget.' '₹30k'
  Add-Rect $s 48 316 864 146 $cream $cream 8 | Out-Null
  Add-TextBox $s 68 334 824 26 'THE COMMERCIAL REALITY' 11 $orange $true | Out-Null
  Add-TextBox $s 68 368 824 72 'At ₹39 per meal, paid acquisition for a single order is unlikely to work. Marketing must lead parents toward weekly plans and schools toward campus-wide partnerships.' 19 $deepGreen $true | Out-Null

  # 3 — Readiness
  $s = $presentation.Slides.Add(3, $ppLayoutBlank); Add-Title $s 'Launch readiness' 'Do not pay for traffic to a demo.' 'Replace unverified claims and make fulfilment, trust, compliance and measurement real.'
  Add-Card $s 48 156 202 228 'Product' "Real schools`rWorking checkout/payment`rRequest-my-school flow`rCorrect broken characters`rMobile testing"
  Add-Card $s 266 156 202 228 'Trust' "Real food photography`rVerified testimonials only`rSupport contact`rRefund and delivery terms`rPrivacy policy"
  Add-Card $s 484 156 202 228 'Food operations' "Applicable FSSAI status`rIngredients and allergens`rTemperature/packing SOPs`rTraceability and recall`rClaims review"
  Add-Card $s 702 156 210 228 'Measurement' "Google Ads + Analytics`rOrder value captured`rCampaign attribution`rTest orders excluded`rWeekly dashboard"
  Add-Rect $s 48 405 864 72 0xEAF0FF 0xEAF0FF 8 | Out-Null
  Add-TextBox $s 66 420 830 40 'Remove placeholder ratings, “2,000+ parents,” school names and nutrition claims unless each is documented and defensible.' 15 $red $true | Out-Null

  # 4 — B2B2C
  $s = $presentation.Slides.Add(4, $ppLayoutBlank); Add-Title $s 'Go-to-market model' 'Schools create access. Parents create recurring revenue.'
  $steps = @(
    @('1','Acquire the campus','Decision-maker meeting, tasting and written pilot scope.'),
    @('2','Activate parents','School-specific landing page, QR code and official parent communication.'),
    @('3','Sell weekly plans','Use one-meal trials to lead toward 3-day, 5-day and monthly plans.'),
    @('4','Retain and refer','Weekly menus, reliable service and margin-safe parent referrals.')
  )
  for ($i=0; $i -lt $steps.Count; $i++) {
    $top = 142 + ($i * 86)
    Add-Rect $s 48 $top 58 58 $orange $orange 29 | Out-Null
    Add-TextBox $s 48 ($top+12) 58 30 $steps[$i][0] 22 $deepGreen $true 'Aptos' 2 | Out-Null
    Add-TextBox $s 128 ($top+2) 250 24 $steps[$i][1] 16 $deepGreen $true | Out-Null
    Add-TextBox $s 128 ($top+29) 720 38 $steps[$i][2] 12 $muted $false | Out-Null
  }

  # 5 — Offers and channels
  $s = $presentation.Slides.Add(5, $ppLayoutBlank); Add-Title $s 'Commercial design' 'Bundle meals and diversify acquisition.'
  Add-Table $s 48 142 414 210 @('Offer','Price','Role') @(
    @('One-meal trial','₹39','First-purchase entry'),
    @('Three-day plan','₹117','Flexible bundle'),
    @('Five-day plan','₹195','Primary weekly plan'),
    @('Four-week plan','₹780*','Predictable demand')
  ) 10.5 | Out-Null
  Add-Table $s 486 142 426 210 @('Channel','Effort','Purpose') @(
    @('School partnerships','35%','Campus access'),
    @('Parent referrals','20%','Lower-cost acquisition'),
    @('WhatsApp / CRM','20%','Retention'),
    @('Google Search','15%','Capture demand'),
    @('Tastings / events','10%','Build confidence')
  ) 10.5 | Out-Null
  Add-Rect $s 48 378 864 94 $cream $cream 8 | Out-Null
  Add-TextBox $s 68 394 824 22 'REFERRAL CONCEPT' 10 $orange $true | Out-Null
  Add-TextBox $s 68 423 824 34 'Both families receive one complimentary meal after each completes a five-meal order—only after margin validation.' 15 $deepGreen $true | Out-Null

  # 6 — Ads architecture
  $s = $presentation.Slides.Add(6, $ppLayoutBlank); Add-Title $s 'Google Ads architecture' 'Start with high-intent Search, split by buyer.' 'Delay Display, YouTube and Performance Max until tracking and economics are proven.'
  Add-Table $s 48 154 864 150 @('Campaign','Daily budget','Primary goal','Landing page') @(
    @('Parents · Chennai','₹700','Weekly meal order','School/location menu'),
    @('Schools · Chennai','₹300','Qualified enquiry','Partnership page'),
    @('Month-one ceiling','₹30,000','Validated economics','—')
  ) 12 | Out-Null
  Add-BulletList $s 48 334 410 136 @('Search Network only','Serviceable neighbourhoods only','Presence-based location targeting','Separate English and Tamil campaigns') 13 | Out-Null
  Add-BulletList $s 500 334 412 136 @('Start with Maximize Clicks','Move to conversion bidding later','Target parents and decision-makers','Never personalize toward children') 13 | Out-Null

  # 7 — Keywords
  $s = $presentation.Slides.Add(7, $ppLayoutBlank); Add-Title $s 'Search strategy' 'Match the query to the buyer.'
  Add-Card $s 48 142 410 230 'Parent keywords' "“school lunch delivery”`r“school lunch service chennai”`r“vegetarian school meals”`r“kids lunch delivery chennai”`r“school meal subscription”`r“weekly school lunch plan”"
  Add-Card $s 502 142 410 230 'School keywords' "“school meal provider chennai”`r“school catering service chennai”`r“school lunch catering”`r“student meal provider”`r“vegetarian school caterer”"
  Add-Rect $s 48 397 864 76 0xF4F7F5 0xDCE6DF 8 | Out-Null
  Add-TextBox $s 66 411 130 20 'NEGATIVES' 10 $orange $true | Out-Null
  Add-TextBox $s 66 437 824 22 'free · government · midday meal scheme · jobs · recipe · tiffin box · office lunch · franchise · wholesale' 12 $deepGreen $false | Out-Null

  # 8 — Parent ad
  $s = $presentation.Slides.Add(8, $ppLayoutBlank); Add-Title $s 'Parent Search campaign' 'Responsive ad assets built for local intent.'
  Add-Rect $s 48 132 864 92 $white 0xD6DEDA 8 | Out-Null
  Add-TextBox $s 66 145 820 15 'yourdomain.in › school-lunch › chennai' 10 0x477026 $false | Out-Null
  Add-TextBox $s 66 166 820 28 'School Lunches in Chennai | Vegetarian Meals From ₹39' 17 $blue $false | Out-Null
  Add-TextBox $s 66 197 820 18 'Pre-order vegetarian school lunches for grades 6–12. Check your school today.' 11 0x444F48 $false | Out-Null
  Add-Card $s 48 246 410 218 'Headlines' "School Lunches in Chennai`rVegetarian Meals From ₹39`rWeekly School Meal Plans`rLunch Delivered to School`rMade for Grades 6–12`rCheck If Your School Is Listed"
  Add-Card $s 502 246 410 218 'Descriptions' "Pre-order vegetarian school lunches for grades 6–12. Meals start from ₹39.`r`rLabelled meals delivered to participating schools. Check your school today.`r`rChoose one day or the full week."

  # 9 — School ad
  $s = $presentation.Slides.Add(9, $ppLayoutBlank); Add-Title $s 'School partnership campaign' 'Lead with a controlled pilot and operational clarity.'
  Add-Rect $s 48 132 864 92 $white 0xD6DEDA 8 | Out-Null
  Add-TextBox $s 66 145 820 15 'yourdomain.in › schools › partnerships' 10 0x477026 $false | Out-Null
  Add-TextBox $s 66 166 820 28 'School Meal Partner Chennai | Request a School Tasting' 17 $blue $false | Out-Null
  Add-TextBox $s 66 197 820 18 'Explore a structured vegetarian lunch pilot with coordinated campus delivery.' 11 0x444F48 $false | Out-Null
  Add-Card $s 48 246 410 218 'Headlines' "School Meal Partner Chennai`rLunch Programs for Schools`rVegetarian Campus Meals`rLabelled Student Meal Packs`rRequest a School Tasting`rTalk to the LunchBox Team"
  Add-Card $s 502 246 410 218 'Lead qualification' "School and area`rDecision-maker role`rApproximate student count`rCurrent lunch arrangement`rPreferred meeting date`rConsent to contact"

  # 10 — Measurement
  $s = $presentation.Slides.Add(10, $ppLayoutBlank); Add-Title $s 'Measurement and economics' 'Optimize for retained families—not cheap clicks.'
  Add-Table $s 48 140 864 206 @('Event','Use','Value') @(
    @('order_completed','Primary conversion','Actual order value'),
    @('weekly_plan_ordered','Primary conversion','Actual plan value'),
    @('school_lead_submitted','School conversion','Qualified lead estimate'),
    @('school_check / request','Secondary signal','No bidding value initially'),
    @('checkout_started','Diagnostic','Funnel measurement'),
    @('repeat_order','Business KPI','Actual order value')
  ) 10.5 | Out-Null
  Add-Rect $s 48 372 864 96 $cream $cream 8 | Out-Null
  Add-TextBox $s 68 387 824 18 'MAXIMUM ACQUISITION COST' 10 $orange $true | Out-Null
  Add-TextBox $s 68 416 824 34 'Gross profit per meal × expected meals per parent − fulfilment/support allowance − target profit' 16 $deepGreen $true | Out-Null

  # 11 — Roadmap
  $s = $presentation.Slides.Add(11, $ppLayoutBlank); Add-Title $s '90-day roadmap' 'Move from readiness to controlled growth.'
  Add-Table $s 48 138 864 326 @('Period','Focus','Exit condition') @(
    @('Days 1–14','Schools, compliance, payment, policies, analytics and testing','Real orders can be fulfilled and measured'),
    @('Days 15–30','Tastings, 50 trial families and delivery validation','Pilot quality targets are met'),
    @('Days 31–60','Search launch, weekly plans and funnel optimization','Acquisition economics are understood'),
    @('Days 61–90','Retention, referrals and 2–3 more schools','Onboarding and demand are repeatable')
  ) 12 | Out-Null

  # 12 — Decision
  $s = $presentation.Slides.Add(12, $ppLayoutBlank)
  $s.Background.Fill.ForeColor.RGB = $green
  Add-TextBox $s 48 40 850 20 'RECOMMENDED DECISION' 11 $orange $true | Out-Null
  Add-TextBox $s 48 78 820 94 'Approve a Chennai pilot—after the readiness gate.' 32 $white $true 'Aptos Display' | Out-Null
  Add-BulletList $s 48 190 760 150 @('2–3 real schools in one delivery cluster','Weekly plans as the primary parent conversion','Search Ads as demand capture—not the growth engine','Expand only after reliable delivery and positive economics') 17 0xE5F1EA | Out-Null
  Add-Rect $s 48 393 864 2 $orange | Out-Null
  Add-TextBox $s 48 416 864 48 'Next step: complete the product and compliance checklist, select the Chennai pilot area, and confirm unit economics before activating ads.' 16 $white $true | Out-Null
  Add-TextBox $s 48 498 850 16 'Sources: Google Ads Help · Google Advertising Policies · FSSAI Advertising and Claims Regulations' 8 0xC9DDD1 $false | Out-Null

  $presentation.SaveAs($outputPath, $ppSaveAsOpenXMLPresentation)
}
finally {
  if ($presentation) { $presentation.Close() }
  $powerPoint.Quit()
  [System.Runtime.InteropServices.Marshal]::ReleaseComObject($presentation) | Out-Null
  [System.Runtime.InteropServices.Marshal]::ReleaseComObject($powerPoint) | Out-Null
  [GC]::Collect(); [GC]::WaitForPendingFinalizers()
}

Get-Item -LiteralPath $outputPath | Select-Object FullName, Length, LastWriteTime
