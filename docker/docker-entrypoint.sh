#!/bin/bash
log_with_style() {
  local level="$1"
  local message="$2"
  local timestamp=$(date '+%Y-%m-%d %H:%M:%S')

  printf "\n[%s] [%7s]  %s\n" "${timestamp}" "${level}" "${message}"
}

log_with_style "INFO" "🚀 容器初始化..."

log_with_style "INFO" "🔄  启动更新 nginx..."
nginx -s reload 2>/dev/null || nginx -c /etc/nginx/conf.d/default.conf

log_with_style "SUCCESS" "🎉 容器启动成功!"

exec "$@"
