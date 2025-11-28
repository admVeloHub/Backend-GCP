# VERSION: v1.0.0 | DATE: 2025-01-30 | AUTHOR: VeloHub Development Team
# Script PowerShell para configurar CORS no bucket GCS

Write-Host "Configurando CORS no bucket do GCS..." -ForegroundColor Cyan
Write-Host ""

# Verificar se gsutil esta instalado
$gsutilPath = Get-Command gsutil -ErrorAction SilentlyContinue

if ($gsutilPath) {
    Write-Host "gsutil encontrado. Configurando CORS via gsutil..." -ForegroundColor Green
    Write-Host ""
    
    # Usar arquivo cors-config.json existente
    $corsConfigFile = Join-Path $PSScriptRoot "..\cors-config.json"
    
    if (Test-Path $corsConfigFile) {
        Write-Host "Usando arquivo: $corsConfigFile" -ForegroundColor Yellow
        
        try {
            Write-Host "Executando: gsutil cors set $corsConfigFile gs://qualidade_audio_envio" -ForegroundColor Yellow
            Write-Host ""
            
            $result = & gsutil cors set $corsConfigFile gs://qualidade_audio_envio 2>&1
            
            if ($LASTEXITCODE -eq 0) {
                Write-Host "CORS configurado com sucesso!" -ForegroundColor Green
            } else {
                Write-Host "Erro ao configurar CORS:" -ForegroundColor Red
                Write-Host $result
            }
        } catch {
            Write-Host "Erro ao executar gsutil: $_" -ForegroundColor Red
        }
    } else {
        Write-Host "Arquivo cors-config.json nao encontrado em: $corsConfigFile" -ForegroundColor Red
    }
} else {
    Write-Host "gsutil nao encontrado." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "OPCAO RECOMENDADA: Via Console do GCP" -ForegroundColor Cyan
    Write-Host "1. Acesse: https://console.cloud.google.com/storage/browser/qualidade_audio_envio" -ForegroundColor White
    Write-Host "2. Clique no bucket: qualidade_audio_envio" -ForegroundColor White
    Write-Host "3. Va em 'Permissions' -> 'CORS'" -ForegroundColor White
    Write-Host "4. Clique em 'Edit'" -ForegroundColor White
    Write-Host "5. Abra o arquivo cors-config.json e cole o conteudo" -ForegroundColor White
    Write-Host "6. Clique em 'Save'" -ForegroundColor White
    Write-Host ""
    Write-Host "Arquivo cors-config.json esta em: $corsConfigFile" -ForegroundColor Gray
}

Write-Host ""
Write-Host "Mais informacoes em: CONFIGURE_CORS.md" -ForegroundColor Gray
