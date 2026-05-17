Add-Type -AssemblyName System.IO.Compression.FileSystem

function Extract-DocxText($path) {
    $fullPath = Resolve-Path $path
    $zip = [System.IO.Compression.ZipFile]::OpenRead($fullPath)
    $entry = $zip.GetEntry('word/document.xml')
    $stream = $entry.Open()
    $reader = New-Object System.IO.StreamReader($stream)
    $xml = $reader.ReadToEnd()
    $reader.Close(); $stream.Close(); $zip.Dispose()
    $text = $xml -replace '<[^>]+>', ' ' -replace '\s+', ' '
    return $text.Trim()
}

function Extract-PptxText($path) {
    $fullPath = Resolve-Path $path
    $zip = [System.IO.Compression.ZipFile]::OpenRead($fullPath)
    $slides = $zip.Entries | Where-Object { $_.FullName -match 'ppt/slides/slide\d+\.xml' } | Sort-Object { [int]($_.FullName -replace '.*slide(\d+)\.xml', '$1') }
    $result = ''
    $n = 1
    foreach ($slide in $slides) {
        $stream = $slide.Open()
        $reader = New-Object System.IO.StreamReader($stream)
        $xml = $reader.ReadToEnd()
        $reader.Close(); $stream.Close()
        $text = $xml -replace '<[^>]+>', ' ' -replace '\s+', ' '
        $result += "=== Slide $n ===`n$text`n`n"
        $n++
    }
    $zip.Dispose()
    return $result.Trim()
}

Write-Output '=== 附件3：创AI案例征集指南 ==='
Extract-DocxText 'docs/附件3：创AI案例征集指南.docx'
Write-Output ''
Write-Output '=== 演示视频PPT模板 ==='
Extract-PptxText 'docs/演示视频PPT模板.pptx'
