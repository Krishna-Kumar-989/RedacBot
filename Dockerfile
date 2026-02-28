FROM node:20-slim

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    python3 \
    ffmpeg \
    curl \
    ca-certificates && \
    update-ca-certificates && \
    curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp && \
    chmod a+rx /usr/local/bin/yt-dlp && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

ENV YTDLP_PATH=/usr/local/bin/yt-dlp

CMD ["node", "src/index.js"]