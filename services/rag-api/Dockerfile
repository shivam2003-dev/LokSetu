FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/citizen/package.json apps/citizen/package.json
COPY services/api/package.json services/api/package.json
COPY services/rag-api/package.json services/rag-api/package.json
COPY tsconfig.base.json tsconfig.base.json
RUN npm install
COPY services/rag-api services/rag-api
RUN npm run build -w services/rag-api

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
COPY services/rag-api/package.json services/rag-api/package.json
RUN npm install --omit=dev
COPY --from=build /app/services/rag-api/dist services/rag-api/dist
COPY services/rag-api/migrations services/rag-api/migrations
COPY services/rag-api/fixtures services/rag-api/fixtures
EXPOSE 8090
CMD ["npm", "run", "start", "-w", "services/rag-api"]
