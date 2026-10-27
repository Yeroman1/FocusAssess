FROM node:20-slim AS builder

WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 && rm -rf /var/lib/apt/lists/*

COPY package.json tsconfig.json ./
COPY src ./src

RUN npm install
RUN npm run build

FROM node:20-slim

WORKDIR /app
# Install Python 3 runtime
RUN apt-get update && apt-get install -y --no-install-recommends python3 && rm -rf /var/lib/apt/lists/*

# Create unprivileged runner user
RUN groupadd -r pyrunner && useradd -r -g pyrunner -m -d /home/pyrunner pyrunner

COPY package.json ./
RUN npm install --omit=dev

COPY --from=builder /app/dist ./dist

# Set file permissions
RUN chown -R pyrunner:pyrunner /app /home/pyrunner

USER pyrunner
ENV NODE_ENV=production
ENV RUNNER_PORT=5001

EXPOSE 5001

CMD ["node", "dist/index.js"]
