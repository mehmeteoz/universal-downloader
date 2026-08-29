FROM node:20-alpine AS build

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:20-alpine

# Install Python3, ffmpeg, and curl for yt-dlp binary management
RUN apk add --no-cache python3 ffmpeg curl ca-certificates

# Install yt-dlp
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp && \
    chmod a+rx /usr/local/bin/yt-dlp

WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY --from=build /app/dist ./dist

EXPOSE 5000
CMD ["npm", "start"]