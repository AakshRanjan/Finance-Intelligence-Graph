FROM node:22-alpine AS build

COPY Services/FIG-UI/package.json Services/FIG-UI/package-lock.json /opt/Services/FIG-UI/
WORKDIR /opt/Services/FIG-UI
RUN npm ci
COPY Services/FIG-UI /opt/Services/FIG-UI
RUN npm run build

FROM nginx:1.27-alpine
COPY Services/FIG-UI/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /opt/Services/FIG-UI/dist /usr/share/nginx/html
EXPOSE 80
