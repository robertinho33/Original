Set-Location "C:\Users\sou_r\Desktop\Loja\Original"

$ErrorActionPreference = "Stop"

$Sources = @(
    "data\catalog\sources\Brae.csv",
    "data\catalog\sources\EcoBelle.csv",
    "data\catalog\sources\Inovax.csv"
)

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " AUREA — FASE 02 — AUDITORIA REAL DOS CSVs" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

$all = foreach ($file in $Sources) {

    if (-not (Test-Path $file)) {
        throw "Arquivo não encontrado: $file"
    }

    $rows = Import-Csv -Path $file -Delimiter ";" -Encoding UTF8

    foreach ($row in $rows) {

        [PSCustomObject]@{
            Source   = Split-Path $file -Leaf
            SKU      = ([string]$row.sku).Trim()
            Name     = ([string]$row.name).Trim()
            Weight   = ([string]$row.weight).Trim()
            Price    = ([string]$row.price).Trim()
            Category = ([string]$row.category).Trim()
            Stock    = ([string]$row.stock).Trim()
        }
    }
}

Write-Host ""
Write-Host "[01/06] Registros lidos: $($all.Count)" -ForegroundColor Green

# ------------------------------------------------------------
# PREÇOS
# ------------------------------------------------------------

function Convert-Price {
    param([string]$Value)

    if ([string]::IsNullOrWhiteSpace($Value)) {
        return $null
    }

    $raw = $Value.Trim()
    $raw = $raw -replace "R\$", ""
    $raw = $raw -replace "\s", ""
    $raw = $raw -replace "[^\d,.\-]", ""

    if (-not $raw) {
        return $null
    }

    $commas = ([regex]::Matches($raw, ",")).Count
    $dots   = ([regex]::Matches($raw, "\.")).Count

    if ($commas -gt 0 -and $dots -gt 0) {

        if ($raw.LastIndexOf(",") -gt $raw.LastIndexOf(".")) {
            $raw = $raw -replace "\.", ""
            $raw = $raw -replace ",", "."
        }
        else {
            $raw = $raw -replace ",", ""
        }
    }
    elseif ($commas -gt 0) {

        $parts = $raw.Split(",")

        if ($parts.Count -eq 2 -and $parts[1].Length -le 2) {
            $raw = "$($parts[0]).$($parts[1])"
        }
        else {
            $raw = $raw -replace ",", ""
        }
    }
    elseif ($dots -gt 0) {

        $parts = $raw.Split(".")

        if ($parts.Count -eq 2 -and $parts[1].Length -le 2) {
            $raw = "$($parts[0]).$($parts[1])"
        }
        else {
            $raw = $raw -replace "\.", ""
        }
    }

    $number = 0.0

    if ([double]::TryParse(
        $raw,
        [Globalization.NumberStyles]::Float,
        [Globalization.CultureInfo]::InvariantCulture,
        [ref]$number
    )) {
        return $number
    }

    return $null
}

$prices = foreach ($row in $all) {

    $value = Convert-Price $row.Price

    if ($null -ne $value) {

        [PSCustomObject]@{
            Source   = $row.Source
            SKU      = $row.SKU
            Name     = $row.Name
            Original = $row.Price
            Price    = $value
        }
    }
}

Write-Host ""
Write-Host "[02/06] PREÇOS" -ForegroundColor Cyan

$prices |
    Sort-Object Price -Descending |
    Select-Object -First 20 Source,SKU,Name,Original,Price |
    Format-Table -AutoSize

$min = ($prices | Measure-Object Price -Minimum).Minimum
$max = ($prices | Measure-Object Price -Maximum).Maximum
$avg = ($prices | Measure-Object Price -Average).Average

Write-Host ""
Write-Host "Menor preço : R$ $("{0:N2}" -f $min)"
Write-Host "Maior preço : R$ $("{0:N2}" -f $max)"
Write-Host "Preço médio : R$ $("{0:N2}" -f $avg)"

# ------------------------------------------------------------
# ESTRUTURA
# ------------------------------------------------------------

$missingSku = @($all | Where-Object {
    [string]::IsNullOrWhiteSpace($_.SKU)
})

$missingName = @($all | Where-Object {
    [string]::IsNullOrWhiteSpace($_.Name)
})

$missingPrice = @($all | Where-Object {
    [string]::IsNullOrWhiteSpace($_.Price)
})

$missingWeight = @($all | Where-Object {
    [string]::IsNullOrWhiteSpace($_.Weight)
})

$missingStock = @($all | Where-Object {
    [string]::IsNullOrWhiteSpace($_.Stock)
})

$duplicateSku = @(
    $all |
    Where-Object {
        -not [string]::IsNullOrWhiteSpace($_.SKU)
    } |
    Group-Object SKU |
    Where-Object {
        $_.Count -gt 1
    }
)

Write-Host ""
Write-Host "[03/06] ESTRUTURA" -ForegroundColor Cyan
Write-Host "SKU ausente     : $($missingSku.Count)"
Write-Host "Nome ausente    : $($missingName.Count)"
Write-Host "Preço ausente   : $($missingPrice.Count)"
Write-Host "Peso ausente    : $($missingWeight.Count)"
Write-Host "Estoque ausente : $($missingStock.Count)"
Write-Host "SKU duplicado   : $($duplicateSku.Count)"

# ------------------------------------------------------------
# DISTRIBUIÇÃO
# ------------------------------------------------------------

Write-Host ""
Write-Host "[04/06] PRODUTOS POR FONTE" -ForegroundColor Cyan

$all |
    Group-Object Source |
    Select-Object Name,Count |
    Format-Table -AutoSize

Write-Host ""
Write-Host "[05/06] CATEGORIAS" -ForegroundColor Cyan

$all |
    Group-Object Category |
    Sort-Object Count -Descending |
    Select-Object -First 30 Name,Count |
    Format-Table -AutoSize

# ------------------------------------------------------------
# RELATÓRIO
# ------------------------------------------------------------

$report = @"
AUREA — FASE 02 — AUDITORIA FINAL

Data: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")

REGISTROS BRUTOS: $($all.Count)

PREÇOS VÁLIDOS: $($prices.Count)
MENOR PREÇO: R$ $("{0:N2}" -f $min)
MAIOR PREÇO: R$ $("{0:N2}" -f $max)
PREÇO MÉDIO: R$ $("{0:N2}" -f $avg)

SKU AUSENTE: $($missingSku.Count)
NOME AUSENTE: $($missingName.Count)
PREÇO AUSENTE: $($missingPrice.Count)
PESO AUSENTE: $($missingWeight.Count)
ESTOQUE AUSENTE: $($missingStock.Count)
SKU DUPLICADO: $($duplicateSku.Count)

CSV OFICIAIS ALTERADOS: NÃO
FIRESTORE ALTERADO: NÃO
"@

$report |
    Set-Content `
        -Path "DIAGNOSTICO-FASE02-PRODUTOS-FINAL.txt" `
        -Encoding UTF8

Write-Host ""
Write-Host "[06/06] RELATÓRIO GERADO" -ForegroundColor Green

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " AUDITORIA CONCLUÍDA — NENHUMA GRAVAÇÃO EXECUTADA" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Cyan
