FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY src ./src
COPY AGENT_PROMPT.md ./AGENT_PROMPT.md
ENV NODE_ENV=production
CMD ["node", "src/server.js"]
