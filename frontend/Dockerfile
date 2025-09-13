FROM node:20-alpine as build
WORKDIR /app
COPY package.json package-lock.json* /app/
RUN npm ci
COPY src /app/src
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist/ /usr/share/nginx/html/
# no-cache headers so demos don’t stick
RUN printf "server { listen 80; root /usr/share/nginx/html; index index.html; location / { add_header Cache-Control \"no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0\"; try_files \$uri /index.html; } }\n" > /etc/nginx/conf.d/default.conf
