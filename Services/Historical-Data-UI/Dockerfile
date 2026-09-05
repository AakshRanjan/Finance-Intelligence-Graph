FROM node:22-alpine AS build

COPY Services/Historical-Data-UI/package.json Services/Historical-Data-UI/package-lock.json /opt/Services/Historical-Data-UI/
WORKDIR /opt/Services/Historical-Data-UI
RUN npm ci
COPY Services/Historical-Data-UI /opt/Services/Historical-Data-UI
RUN npm run build

FROM nginx:1.27-alpine
COPY Services/Historical-Data-UI/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /opt/Services/Historical-Data-UI/dist /usr/share/nginx/html
EXPOSE 80
