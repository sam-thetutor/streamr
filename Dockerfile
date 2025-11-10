FROM node:20-alpine AS build
WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
COPY packages/streamer/package.json packages/streamer/package.json
COPY packages/streamer/package-lock.json packages/streamer/package-lock.json
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app

# Copy built assets
COPY --from=build /app/dist ./dist

# Install a lightweight static file server
RUN npm install -g serve

ENV PORT=3000
EXPOSE 3000

CMD ["sh", "-c", "serve -s dist -l $PORT"]


