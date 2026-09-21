FROM nginx:alpine

WORKDIR /usr/share/nginx/html

RUN rm -rf ./*

COPY index.html styles.css app.js free-manga.js upload.js reader.js reader.html public-domain.html public-domain.js manifest.json ./

# nginx config for SPA routing and CORS
RUN printf 'server {\n\
    listen 80;\n\
    server_name _;\n\
    root /usr/share/nginx/html;\n\
    index index.html;\n\
    location / {\n\
        try_files $uri $uri/ /index.html;\n\
        add_header Cache-Control "no-cache" always;\n\
    }\n\
    location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg|json)$ {\n\
        expires 1d;\n\
        add_header Cache-Control "public, max-age=86400";\n\
    }\n\
}\n' > /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
