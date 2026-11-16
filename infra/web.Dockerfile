FROM node:24-alpine AS build
WORKDIR /app
COPY . .
RUN npm ci && npm run build -w @commerceos/web
FROM nginxinc/nginx-unprivileged:1.28-alpine
COPY infra/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
