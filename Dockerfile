FROM nginx:alpine

# Template processado automaticamente pelo nginx (usa $PORT do Railway)
COPY nginx.conf /etc/nginx/templates/default.conf.template

# Arquivos estáticos
COPY index.html /usr/share/nginx/html/
COPY js/ /usr/share/nginx/html/js/
COPY css/ /usr/share/nginx/html/css/
COPY data/ /usr/share/nginx/html/data/

# Fallback caso PORT não esteja definido
ENV PORT=8080

EXPOSE 8080
