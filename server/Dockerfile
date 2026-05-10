FROM node:20-alpine AS deps

WORKDIR /app

COPY package*.json ./
COPY client/package.json client/package.json
COPY server/package.json server/package.json

RUN npm ci

FROM deps AS build

COPY server server

RUN npm run build --workspace=server

FROM node:20-alpine AS runtime

WORKDIR /app

ENV PORT=3001

COPY package*.json ./
COPY server/package.json server/package.json

RUN npm ci --omit=dev --workspace=server && npm cache clean --force

COPY --from=build /app/server/dist server/dist

EXPOSE 3001

USER node

CMD ["npm", "run", "start", "--workspace=server"]
