FROM node:22-alpine AS build
WORKDIR /app
ARG VITE_API_BASE_URL=""
ARG VITE_GOOGLE_MAPS_API_KEY=""
ARG VITE_CITIZEN_APP_URL=""
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_GOOGLE_MAPS_API_KEY=$VITE_GOOGLE_MAPS_API_KEY
ENV VITE_CITIZEN_APP_URL=$VITE_CITIZEN_APP_URL
COPY package*.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/citizen/package.json apps/citizen/package.json
COPY services/api/package.json services/api/package.json
COPY tsconfig.base.json tsconfig.base.json
RUN npm install
COPY apps/web apps/web
RUN npm run build -w apps/web

FROM nginx:1.27-alpine
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
