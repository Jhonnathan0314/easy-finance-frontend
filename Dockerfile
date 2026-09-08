FROM node:22-alpine AS build
WORKDIR /workspace
ENV NODE_OPTIONS=--max-old-space-size=4096

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build -- --configuration production

FROM nginx:1.27-alpine
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /workspace/dist/easy-finance-frontend/browser /usr/share/nginx/html

EXPOSE 80
