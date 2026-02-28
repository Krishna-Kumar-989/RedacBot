# RedacBot — Developer Guide

Technical documentation for setting up, running, and modifying RedacBot.

---

## Tech Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Runtime | Node.js 18+ | JavaScript runtime |
| Discord API | discord.js v14, @discordjs/voice | Bot framework & voice |
| YouTube Search | play-dl | Finding videos by text query |
| YouTube Download | yt-dlp (Python) | Reliable ad-free audio streaming |
| Audio Processing | ffmpeg-static (npm) | Transcoding audio to PCM for Discord |
| Encryption | libsodium-wrappers | Voice encryption (required by Discord) |
| Database | mongoose (MongoDB) | Storing user listening history |

---

## Setup

### Prerequisites

```bash
# Node.js 18+
node --version

# Python 3.8+ with yt-dlp
pip install yt-dlp
python -c "import shutil; print(shutil.which('yt-dlp'))"  # note this path
```

### Installation

```bash
git clone <repo-url>
cd muzic
npm install
```

### Configuration

Create `.env` in the project root:

```env
# From https://discord.com/developers/applications
DISCORD_TOKEN=your_bot_token
CLIENT_ID=your_application_id

# Absolute path to yt-dlp binary (from the python command above)
YTDLP_PATH=C:\Users\you\...\yt-dlp.EXE

# MongoDB connection string for listening history
MONGO_URI=mongodb://localhost:27017/redacbot
```

### Discord Developer Portal Setup

1. [Create a new application](https://discord.com/developers/applications)
2. **Bot** tab → Reset Token → copy it → paste in `.env`
3. Enable **Message Content Intent** under Privileged Gateway Intents
4. **OAuth2 → URL Generator**:
   - Scopes: `bot`, `applications.commands`
   - Permissions: `Connect`, `Speak`, `Send Messages`, `Embed Links`
5. Open the generated URL → invite bot to your server

### Running

```bash
npm run deploy   # register slash commands (first time / after changes)
npm start        # start the bot
```

### Running with Docker

Make sure your `.env` has `DISCORD_TOKEN` and `CLIENT_ID` set, then:

```bash
npm run deploy                # register slash commands (still needed once)
docker compose up -d          # starts bot + MongoDB
docker compose logs -f bot    # view bot logs
```

> **Note:** The `docker-compose.yml` automatically sets `MONGO_URI` and `YTDLP_PATH` — no extra config needed.

---

## Project Structure

```
muzic/
├── .env                      # Secrets & config (gitignored)
├── package.json              # Deps & scripts
├── README.md                 # User-facing docs
├── README.dev.md             # This file
└── src/
    ├── index.js              # Entry point — client setup, event routing
    ├── commands.js           # Slash command definitions & handler switch
    ├── player.js             # Core engine — search, stream, queue, voice
    ├── embed.js              # Discord embed builders (Now Playing, Queue, etc.)
    ├── history.js            # User listening history — logs to MongoDB
    └── deploy-commands.js    # One-time REST API command registration
```

---

## Architecture

```
User types /mzplay "song name"
        │
        ▼
  commands.js ──► Detects voice channel via guild.voiceStates cache
        │
        ▼
  player.js
    ├── search()     → play-dl searches YouTube, returns track metadata
    ├── play()       → Joins voice channel, adds to queue, starts playback
    │                   └── logs play_start to MongoDB via history.js
    └── _playTrack() → Spawns yt-dlp │ ffmpeg pipeline:
                         yt-dlp (downloads audio) → stdout
                                │
                         ffmpeg (converts to PCM s16le 48kHz stereo) → stdout
                                │
                         createAudioResource() → Discord voice player
                                │
                         on end/skip/stop → logs event to MongoDB via history.js
```

### Audio Pipeline

```
yt-dlp --bestudio -o - <url>  →  ffmpeg -i pipe:0 -f s16le -ar 48000 -ac 2 pipe:1  →  Discord
```

- **yt-dlp** downloads the best audio stream, outputs to stdout
- **ffmpeg** (via ffmpeg-static) converts to raw PCM (s16le, 48kHz, stereo)
- **@discordjs/voice** reads the raw PCM stream and sends it to Discord

---

## Adding a New Command

1. **Define** the command in `commands.js` (add a `SlashCommandBuilder` to the `commands` array)
2. **Handle** it in the `switch` block inside `handleCommand()`
3. **Re-deploy** with `npm run deploy`

---

##  Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| `0 server(s)` | Bot not invited | Use OAuth2 invite URL |
| `Used disallowed intents` | Privileged intent not enabled | Enable in Developer Portal → Bot → Intents |
| `yt-dlp` not found | Wrong path or not installed | Check `YTDLP_PATH` in `.env` |
| `403` / decipher errors | Outdated library | Don't use ytdl-core — yt-dlp handles this |
| Voice channel not detected | Stale cache | Bot uses `guild.voiceStates.cache` + REST fetch fallback |
| Connect timeout on deploy | Network issue | Retry or use VPN |
