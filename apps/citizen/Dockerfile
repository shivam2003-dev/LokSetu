FROM node:22-alpine AS build
WORKDIR /app
ARG VITE_API_BASE_URL=""
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
COPY package*.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/citizen/package.json apps/citizen/package.json
COPY services/api/package.json services/api/package.json
COPY tsconfig.base.json tsconfig.base.json
RUN npm install
COPY apps/citizen apps/citizen
RUN npm run build -w apps/citizen

FROM nginx:1.27-alpine
COPY --from=build /app/apps/citizen/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
