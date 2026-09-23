$ErrorActionPreference = "Stop"

$file = ".\js\admin\products-importer.js"

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " AUREA — FASE 02 — VALIDAÇÃO + IMPORTAÇÃO" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

$content = Get-Content $file -Raw -Encoding UTF8

Write-Host ""
Write-Host "[01/04] Verificando parser..." -ForegroundColor Yellow

if (-not $content.Contains("function parsePrice")) {
    throw "parsePrice não encontrada."
}

if (-not $content.Contains("number = number / 100")) {
    throw "Regra Brae não encontrada."
}

if (-not $content.Contains("parsePrice(row.price, source)")) {
    throw "normalizeProduct ainda não envia source para parsePrice."
}

Write-Host "PASS — parser Brae configurado." -ForegroundColor Green

Write-Host ""
Write-Host "[02/04] Validando JavaScript..." -ForegroundColor Yellow

node --check $file

if ($LASTEXITCODE -ne 0) {
    throw "products-importer.js possui erro de sintaxe."
}

Write-Host "PASS — JavaScript válido." -ForegroundColor Green

Write-Host ""
Write-Host "[03/04] Conferindo arquivos da Fase 02..." -ForegroundColor Yellow

$required = @(
    ".\data\catalog\sources\Brae.csv",
    ".\data\catalog\sources\EcoBelle.csv",
    ".\data\catalog\sources\Inovax.csv",
    ".\js\admin\product-model.js",
    ".\js\admin\product-repository.js",
    ".\js\admin\products-importer.js",
    ".\pages\admin-products-import.html"
)

foreach ($item in $required) {

    if (-not (Test-Path $item)) {
        throw "Arquivo obrigatório não encontrado: $item"
    }

    Write-Host "PASS | $item" -ForegroundColor Green
}

Write-Host ""
Write-Host "[04/04] Preparando importação dos 522 produtos..." -ForegroundColor Yellow

$rows = @()

foreach ($csv in @(
    ".\data\catalog\sources\Brae.csv",
    ".\data\catalog\sources\EcoBelle.csv",
    ".\data\catalog\sources\Inovax.csv"
)) {

    $items = Import-Csv -Path $csv -Delimiter ";"

    foreach ($item in $items) {

        $sku = ([string]$item.sku).Trim()
        $name = ([string]$item.name).Trim()
        $price = ([string]$item.price).Trim()

        $metadata =
            [string]::IsNullOrWhiteSpace($sku) -and
            [string]::IsNullOrWhiteSpace($price) -and
            $name.ToLower() -eq "inovax"

        if (-not $metadata) {
            $rows += $item
        }
    }
}

if ($rows.Count -ne 522) {
    throw "Quantidade inesperada. Esperado: 522 | Encontrado: $($rows.Count)"
}

Write-Host "PASS — 522 produtos comerciais encontrados." -ForegroundColor Green

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " FASE 02 VALIDADA" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Produtos comerciais : 522"
Write-Host "CSV original        : PRESERVADO"
Write-Host "JavaScript           : VALIDO"
Write-Host "Parser Brae          : ATIVO"
Write-Host "Firestore            : AINDA NAO ALTERADO"
Write-Host ""
Write-Host "PRONTO PARA IMPORTAR OS 522 PRODUTOS." -ForegroundColor Green
