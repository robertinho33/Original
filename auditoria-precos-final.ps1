$ErrorActionPreference = "Stop"

$sources = @(
    ".\data\catalog\sources\Brae.csv",
    ".\data\catalog\sources\EcoBelle.csv",
    ".\data\catalog\sources\Inovax.csv"
)

function Parse-AureaPrice {
    param([string]$Value)

    if ([string]::IsNullOrWhiteSpace($Value)) {
        return $null
    }

    $text = $Value.Trim()
    $text = $text -replace "R\$", ""
    $text = $text -replace "\s", ""
    $text = $text -replace "[^0-9,.\-]", ""

    if ([string]::IsNullOrWhiteSpace($text)) {
        return $null
    }

    $lastComma = $text.LastIndexOf(",")
    $lastDot = $text.LastIndexOf(".")

    if ($lastComma -ge 0 -and $lastDot -ge 0) {
        if ($lastComma -gt $lastDot) {
            $text = $text -replace "\.", ""
            $text = $text -replace ",", "."
        }
        else {
            $text = $text -replace ",", ""
        }
    }
    elseif ($lastComma -ge 0) {
        $decimalPart = $text.Substring($lastComma + 1)

        if ($decimalPart.Length -le 2) {
            $text = $text -replace "\.", ""
            $text = $text -replace ",", "."
        }
        else {
            $text = $text -replace ",", ""
        }
    }
    elseif ($lastDot -ge 0) {
        $decimalPart = $text.Substring($lastDot + 1)

        if ($decimalPart.Length -le 2) {
            $text = $text -replace ",", ""
        }
        else {
            $text = $text -replace "\.", ""
        }
    }

    $number = 0.0

    if ([double]::TryParse(
        $text,
        [Globalization.NumberStyles]::Float,
        [Globalization.CultureInfo]::InvariantCulture,
        [ref]$number
    )) {
        return [math]::Round($number, 2)
    }

    return $null
}

$results = @()

foreach ($file in $sources) {

    $rows = Import-Csv -Path $file -Delimiter ";"

    foreach ($row in $rows) {

        $sku = ([string]$row.sku).Trim()
        $name = ([string]$row.name).Trim()
        $rawPrice = ([string]$row.price).Trim()
        $category = ([string]$row.category).Trim()

        $metadata =
            [string]::IsNullOrWhiteSpace($sku) -and
            [string]::IsNullOrWhiteSpace($rawPrice) -and
            -not [string]::IsNullOrWhiteSpace($name) -and
            (
                $name.ToLower() -eq "inovax" -or
                $category -like "*categoria-id-23792243*"
            )

        $results += [PSCustomObject]@{
            Arquivo = Split-Path $file -Leaf
            SKU = $sku
            Produto = $name
            PrecoBruto = $rawPrice
            PrecoNumerico = Parse-AureaPrice $rawPrice
            Categoria = $category
            Metadata = $metadata
        }
    }
}

$comerciais = @(
    $results | Where-Object { -not $_.Metadata }
)

$comPreco = @(
    $comerciais | Where-Object { $null -ne $_.PrecoNumerico }
)

$semPreco = @(
    $comerciais | Where-Object { $null -eq $_.PrecoNumerico }
)

$min = ($comPreco | Measure-Object PrecoNumerico -Minimum).Minimum
$max = ($comPreco | Measure-Object PrecoNumerico -Maximum).Maximum
$avg = ($comPreco | Measure-Object PrecoNumerico -Average).Average

$top = @(
    $comPreco |
    Sort-Object PrecoNumerico -Descending |
    Select-Object -First 30
)

$acima2000 = @(
    $comPreco |
    Where-Object { $_.PrecoNumerico -gt 2000 } |
    Sort-Object PrecoNumerico -Descending
)

$relatorio = ".\AUDITORIA-FASE02-PRECOS-DEFINITIVA.txt"

@"
============================================================
AUREA — FASE 02 — AUDITORIA DEFINITIVA DE PREÇOS
NENHUMA GRAVAÇÃO EXECUTADA
============================================================

RESUMO
------------------------------------------------------------
Registros brutos     : $($results.Count)
Registros comerciais : $($comerciais.Count)
Metadados ignorados  : $(($results | Where-Object Metadata).Count)
Com preço            : $($comPreco.Count)
Sem preço            : $($semPreco.Count)

ESTATISTICA
------------------------------------------------------------
Menor preço : R$ $("{0:N2}" -f $min)
Maior preço : R$ $("{0:N2}" -f $max)
Preço médio : R$ $("{0:N2}" -f $avg)

30 MAIORES PREÇOS
------------------------------------------------------------
"@ | Set-Content $relatorio -Encoding utf8

foreach ($item in $top) {
    @"
Arquivo     : $($item.Arquivo)
SKU         : $($item.SKU)
Produto     : $($item.Produto)
Preço bruto : [$($item.PrecoBruto)]
Interpretado: R$ $("{0:N2}" -f $item.PrecoNumerico)
Categoria   : [$($item.Categoria)]
------------------------------------------------------------
"@ | Add-Content $relatorio -Encoding utf8
}

@"
PRODUTOS ACIMA DE R$ 2.000
------------------------------------------------------------
"@ | Add-Content $relatorio -Encoding utf8

foreach ($item in $acima2000) {
    "R$ $("{0:N2}" -f $item.PrecoNumerico) | $($item.SKU) | $($item.Produto) | bruto [$($item.PrecoBruto)]" |
        Add-Content $relatorio -Encoding utf8
}

@"
------------------------------------------------------------
PRODUTOS COMERCIAIS SEM PREÇO
------------------------------------------------------------
"@ | Add-Content $relatorio -Encoding utf8

foreach ($item in $semPreco) {
    "$($item.Arquivo) | SKU [$($item.SKU)] | Produto [$($item.Produto)] | bruto [$($item.PrecoBruto)]" |
        Add-Content $relatorio -Encoding utf8
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " AUREA — AUDITORIA DEFINITIVA" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Registros brutos     : $($results.Count)"
Write-Host "Registros comerciais : $($comerciais.Count)"
Write-Host "Metadados ignorados  : $(($results | Where-Object Metadata).Count)"
Write-Host "Com preço            : $($comPreco.Count)"
Write-Host "Sem preço            : $($semPreco.Count)"
Write-Host ""
Write-Host ("Menor preço : R$ {0:N2}" -f $min)
Write-Host ("Maior preço : R$ {0:N2}" -f $max)
Write-Host ("Preço médio : R$ {0:N2}" -f $avg)
Write-Host ""
Write-Host "============================================================" -ForegroundColor Yellow
Write-Host " 30 MAIORES PREÇOS" -ForegroundColor Yellow
Write-Host "============================================================"

foreach ($item in $top) {
    Write-Host ""
    Write-Host "SKU         : $($item.SKU)"
    Write-Host "Produto     : $($item.Produto)"
    Write-Host "Preço bruto : [$($item.PrecoBruto)]"
    Write-Host ("Interpretado: R$ {0:N2}" -f $item.PrecoNumerico)
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host "RELATORIO:" -ForegroundColor Green
Write-Host (Resolve-Path $relatorio)
Write-Host "============================================================" -ForegroundColor Green
Write-Host ""
Write-Host "NENHUMA GRAVACAO EXECUTADA." -ForegroundColor Green
