FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/citizen/package.json apps/citizen/package.json
COPY services/api/package.json services/api/package.json
COPY tsconfig.base.json tsconfig.base.json
RUN npm install
COPY services/api services/api
RUN npm run build -w services/api

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
COPY apps/web/package.json apps/web/package.json
COPY services/api/package.json services/api/package.json
RUN npm install --omit=dev
COPY --from=build /app/services/api/dist services/api/dist
EXPOSE 8080
CMD ["npm", "run", "start", "-w", "services/api"]
