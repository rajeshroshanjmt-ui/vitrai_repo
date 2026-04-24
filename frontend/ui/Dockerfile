# Build stage
FROM node:22-alpine as builder

WORKDIR /app

COPY package*.json ./
RUN npm install --legacy-peer-deps

COPY . .

RUN npm run build

# Production stage
FROM node:22-alpine

WORKDIR /app

RUN apk add --no-cache curl && npm install -g http-server

COPY --from=builder /app/dist ./dist

EXPOSE 3000

CMD ["http-server", "dist", "-p", "3000", "--gzip", "--cors", "-f"]
