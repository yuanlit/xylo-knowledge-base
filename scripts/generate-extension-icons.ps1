param(
    [string]$OutputDirectory = (Join-Path $PSScriptRoot "..\extension\icons")
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing
[xml]$brand = Get-Content -LiteralPath (Join-Path $PSScriptRoot "..\extension\icons\brand.svg") -Raw
$culture = [System.Globalization.CultureInfo]::InvariantCulture

function New-XyloIcon {
    param([int]$Size, [string]$Path)

    $scale = 8
    $canvasSize = $Size * $scale
    $bitmap = [System.Drawing.Bitmap]::new($canvasSize, $canvasSize, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.Clear([System.Drawing.Color]::Transparent)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    foreach ($polygon in $brand.svg.polygon) {
        $points = [System.Drawing.PointF[]]@(
            foreach ($point in $polygon.points.Split(" ", [System.StringSplitOptions]::RemoveEmptyEntries)) {
                $coordinates = $point.Split(",")
                [System.Drawing.PointF]::new(
                    [single]::Parse($coordinates[0], $culture) * $canvasSize / 64,
                    [single]::Parse($coordinates[1], $culture) * $canvasSize / 64
                )
            }
        )
        $brush = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml($polygon.fill))
        try { $graphics.FillPolygon($brush, $points) } finally { $brush.Dispose() }
    }

    $output = [System.Drawing.Bitmap]::new($Size, $Size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $outputGraphics = [System.Drawing.Graphics]::FromImage($output)
    $outputGraphics.Clear([System.Drawing.Color]::Transparent)
    $outputGraphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $outputGraphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $outputGraphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $outputGraphics.DrawImage($bitmap, 0, 0, $Size, $Size)
    $output.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
    $outputGraphics.Dispose()
    $output.Dispose()
    $graphics.Dispose()
    $bitmap.Dispose()
}

$resolvedOutput = [System.IO.Path]::GetFullPath($OutputDirectory)
[System.IO.Directory]::CreateDirectory($resolvedOutput) | Out-Null
foreach ($size in @(16, 32, 48, 128)) {
    New-XyloIcon -Size $size -Path (Join-Path $resolvedOutput "icon-$size.png")
}
Write-Host "Generated Xylo brand icons in $resolvedOutput"
