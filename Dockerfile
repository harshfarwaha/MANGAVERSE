FROM nginx:alpine

WORKDIR /usr/share/nginx/html

RUN rm -rf ./*

COPY index.html styles.css app.js ./

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
