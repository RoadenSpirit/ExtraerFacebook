#!/bin/bash

# Script de monitoreo para el microservicio de Facebook
# Verifica si el servicio está activo en port 3050 y lo reinicia si es necesario

SERVICE_URL="http://localhost:3050/health"
LOG_FILE="/tmp/facebook_scraper_monitor.log"

log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" >> "$LOG_FILE"
}

check_service() {
    curl -s -f "$SERVICE_URL" > /dev/null 2>&1
}

start_service() {
    log "Iniciando microservicio Facebook scraper..."
    cd /data/tmp_post/ExtraerFacebook
    pkill -9 -f 'node.*server.js' > /dev/null 2>&1 || true
    sleep 1
    nohup node server.js > /tmp/facebook_scraper.log 2>&1 &
    sleep 2
    if check_service; then
        log "Microservicio iniciado correctamente."
    else
        log "Error al iniciar el microservicio"
    fi
}

# Verificar si el servicio está corriendo cada 10 segundos
while true; do
    if ! check_service; then
        log "Servicio no disponible en 3050. Reiniciando..."
        start_service
    fi
    sleep 10
done
