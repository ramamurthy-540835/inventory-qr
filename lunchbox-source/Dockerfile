FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:22-alpine AS grocery-deps
WORKDIR /grocery
COPY grocery-web/package*.json ./
RUN npm ci

FROM grocery-deps AS grocery-builder
COPY grocery-web ./
ENV VITE_APP_BASE=/grocery-app/
RUN npm run build

FROM node:22-alpine AS builder
WORKDIR /app
ARG NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyCOK803TF9qC8ayyHtul1VQSI-le_q1Frg
ARG NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=chennaifood.firebaseapp.com
ARG NEXT_PUBLIC_FIREBASE_PROJECT_ID=chennaifood
ARG NEXT_PUBLIC_FIREBASE_APP_ID=1:827633400219:web:54ba01d66b7db025a1493e
ARG NEXT_PUBLIC_ENABLE_PHONE_AUTH=true
ENV NEXT_PUBLIC_FIREBASE_API_KEY=$NEXT_PUBLIC_FIREBASE_API_KEY
ENV NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=$NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
ENV NEXT_PUBLIC_FIREBASE_PROJECT_ID=$NEXT_PUBLIC_FIREBASE_PROJECT_ID
ENV NEXT_PUBLIC_FIREBASE_APP_ID=$NEXT_PUBLIC_FIREBASE_APP_ID
ENV NEXT_PUBLIC_ENABLE_PHONE_AUTH=$NEXT_PUBLIC_ENABLE_PHONE_AUTH
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder /app/public ./public
COPY --from=grocery-builder /grocery/dist ./public/grocery-app
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 8080
CMD ["node", "server.js"]
