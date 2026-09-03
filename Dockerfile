FROM node:20-slim AS web-build

WORKDIR /web
COPY grocery-web/package.json grocery-web/package-lock.json ./
RUN npm ci
COPY grocery-web ./
RUN npm run build

FROM node:20-slim

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY src ./src
COPY public ./public
COPY --from=web-build /web/dist ./public/app

ENV NODE_ENV=production
CMD ["npm", "start"]
