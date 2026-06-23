#!/bin/sh
# Quita el deploy de dyck del VPS (ahora vive en GitHub Pages)
BK=$(ls -t /opt/client-sites/nginx.conf.bak-dyck-* 2>/dev/null | head -1)
if [ -n "$BK" ]; then cp "$BK" /opt/client-sites/nginx.conf && echo "nginx.conf restaurado desde $BK"; fi
rm -f /etc/easypanel/traefik/config/custom-dyck.yaml && echo "traefik dyck removido"
rm -rf /opt/client-sites/dyck && echo "carpeta dyck removida"
C=$(docker ps -qf name=client-sites)
docker exec "$C" nginx -t && docker exec "$C" nginx -s reload && echo NGINX_OK
echo "referencias dyck restantes en nginx.conf:"; grep -c "dyck.stnflow" /opt/client-sites/nginx.conf || true
