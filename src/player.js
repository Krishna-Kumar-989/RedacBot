const ffmpegPath = require('ffmpeg-static');
const { logEvent } = require('./history');
require('dotenv').config();
const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  entersState,
  StreamType,
} = require('@discordjs/voice');
const { spawn, execSync } = require('child_process');
const play = require('play-dl');

// Absolute path to yt-dlp
const YTDLP = process.env.YTDLP_PATH;

class MusicPlayer {
  constructor() {
    this.guilds = new Map();
  }

  getState(guildId) {
    if (!this.guilds.has(guildId)) {
      this.guilds.set(guildId, {
        queue: [],
        connection: null,
        player: null,
        currentTrack: null,
        textChannel: null,
        // History tracking fields
        playStartTime: null,
        userContext: null,   // { userId, username, guildName }
      });
    }
    return this.guilds.get(guildId);
  }

  async search(query) {
    try {
      // Text search using play-dl (still works for searching)
      const isUrl = query.startsWith('http://') || query.startsWith('https://');

      if (isUrl) {
        // Use yt-dlp to get video info for URLs
        try {
          const result = execSync(
            `"${YTDLP}" --no-playlist --print "%(title)s|||%(webpage_url)s|||%(duration_string)s|||%(thumbnail)s|||%(channel)s" "${query}"`,
            { encoding: 'utf-8', timeout: 15000, stdio: ['pipe', 'pipe', 'pipe'] }
          ).trim();
          const parts = result.split('\n')[0].split('|||');
          return {
            title: parts[0] || 'Unknown',
            url: parts[1] || query,
            duration: parts[2] || '?:??',
            thumbnail: parts[3] || null,
            channel: parts[4] || 'Unknown',
          };
        } catch (e) {
          console.error('yt-dlp info error:', e.message);
          return null;
        }
      }

      // Search using play-dl
      const results = await play.search(query, { limit: 1 });
      if (!results || results.length === 0) return null;

      const video = results[0];
      return {
        title: video.title || 'Unknown',
        url: video.url,
        duration: video.durationRaw || 'Live',
        thumbnail: video.thumbnails?.[0]?.url || null,
        channel: video.channel?.name || 'Unknown',
      };
    } catch (error) {
      console.error('Search error:', error.message);
      return null;
    }
  }

  async play(guildId, voiceChannel, textChannel, query, userContext) {
    const track = await this.search(query);
    if (!track) return null;

    const state = this.getState(guildId);
    state.textChannel = textChannel;
    state.userContext = userContext || state.userContext;

    track._query = query;
    const wasQueued = !!(state.currentTrack || (state.player && state.player.state.status === AudioPlayerStatus.Playing));
    const queuePosition = wasQueued ? state.queue.length + 1 : 0;
    track._wasQueued = wasQueued;
    track._queuePosition = queuePosition;

    state.queue.push(track);

    // Log play_start
    logEvent({
      userId: userContext?.userId,
      username: userContext?.username,
      guildId,
      guildName: userContext?.guildName,
      query,
      track,
      action: 'play_start',
      listenDurationSec: 0,
      wasQueued,
      queuePosition,
    });

    if (!state.connection) {
      state.connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: guildId,
        adapterCreator: voiceChannel.guild.voiceAdapterCreator,
      });

      state.player = createAudioPlayer();
      state.connection.subscribe(state.player);

      state.player.on(AudioPlayerStatus.Idle, () => {
        // Log completed event
        this._logTrackEnd(guildId, 'completed');
        state.currentTrack = null;
        this._killProcesses(guildId);
        this._playNext(guildId);
      });

      state.player.on('error', (error) => {
        console.error('Player error:', error.message);
        state.currentTrack = null;
        this._killProcesses(guildId);
        this._playNext(guildId);
      });

      state.connection.on(VoiceConnectionStatus.Disconnected, async () => {
        try {
          await Promise.race([
            entersState(state.connection, VoiceConnectionStatus.Signalling, 5_000),
            entersState(state.connection, VoiceConnectionStatus.Connecting, 5_000),
          ]);
        } catch {
          this.destroy(guildId);
        }
      });

      await this._playTrack(guildId, state.queue.shift());
    } else if (state.player.state.status === AudioPlayerStatus.Idle) {
      await this._playTrack(guildId, state.queue.shift());
    }

    return track;
  }

  async _playTrack(guildId, track) {
    if (!track) return;
    const state = this.getState(guildId);

    try {
      console.log(`[STREAM] Streaming via yt-dlp: ${track.title}`);

      // yt-dlp outputs raw audio → ffmpeg converts to PCM for Discord
      const ytdlpProc = spawn(YTDLP, [
        '-f', 'bestaudio',
        '--no-playlist',
        '-o', '-',
        '--quiet',
        track.url,
      ], { stdio: ['pipe', 'pipe', 'pipe'] });

      const ffmpegProc = spawn(ffmpegPath, [
        '-i', 'pipe:0',
        '-analyzeduration', '0',
        '-loglevel', '0',
        '-f', 's16le',
        '-ar', '48000',
        '-ac', '2',
        'pipe:1',
      ], { stdio: ['pipe', 'pipe', 'pipe'] });

      // Pipe: yt-dlp stdout → ffmpeg stdin
      ytdlpProc.stdout.pipe(ffmpegProc.stdin);

      // Handle errors gracefully
      ytdlpProc.stderr.on('data', (d) => { /* suppress */ });
      ffmpegProc.stderr.on('data', (d) => { /* suppress */ });
      ytdlpProc.stdout.on('error', () => {});
      ffmpegProc.stdin.on('error', () => {});
      ytdlpProc.on('error', (e) => console.error('yt-dlp error:', e.message));
      ffmpegProc.on('error', (e) => console.error('ffmpeg error:', e.message));

      state.ytdlpProc = ytdlpProc;
      state.ffmpegProc = ffmpegProc;

      const resource = createAudioResource(ffmpegProc.stdout, {
        inputType: StreamType.Raw,
      });

      state.currentTrack = track;
      state.playStartTime = Date.now();
      state.player.play(resource);

      const { buildNowPlaying } = require('./embed');
      if (state.textChannel) {
        try {
          await state.textChannel.send({ embeds: [buildNowPlaying(track)] });
        } catch (e) { /* ignore */ }
      }
    } catch (error) {
      console.error('Stream error:', error.message);
      this._playNext(guildId);
    }
  }

  _killProcesses(guildId) {
    const state = this.getState(guildId);
    if (state.ytdlpProc) {
      try { state.ytdlpProc.kill('SIGKILL'); } catch {}
      state.ytdlpProc = null;
    }
    if (state.ffmpegProc) {
      try { state.ffmpegProc.kill('SIGKILL'); } catch {}
      state.ffmpegProc = null;
    }
  }

  _playNext(guildId) {
    const state = this.getState(guildId);
    if (state.queue.length > 0) {
      this._playTrack(guildId, state.queue.shift());
    } else {
      setTimeout(() => {
        const s = this.getState(guildId);
        if (!s.currentTrack && s.queue.length === 0) {
          this.destroy(guildId);
        }
      }, 120_000);
    }
  }

  skip(guildId) {
    const state = this.getState(guildId);
    if (state.player) {
      this._logTrackEnd(guildId, 'skipped');
      this._killProcesses(guildId);
      state.player.stop();
      return true;
    }
    return false;
  }

  pause(guildId) {
    const state = this.getState(guildId);
    if (state.player && state.player.state.status === AudioPlayerStatus.Playing) {
      state.player.pause();
      return true;
    }
    return false;
  }

  resume(guildId) {
    const state = this.getState(guildId);
    if (state.player && state.player.state.status === AudioPlayerStatus.Paused) {
      state.player.unpause();
      return true;
    }
    return false;
  }

  getQueue(guildId) {
    const state = this.getState(guildId);
    return { current: state.currentTrack, queue: [...state.queue] };
  }

  getNowPlaying(guildId) {
    return this.getState(guildId).currentTrack;
  }

  destroy(guildId) {
    const state = this.getState(guildId);
    this._logTrackEnd(guildId, 'stopped');
    this._killProcesses(guildId);
    if (state.connection) {
      state.connection.destroy();
    }
    this.guilds.delete(guildId);
  }

  /**
   * Log a track-end event (completed, skipped, or stopped) with listen duration.
   */
  _logTrackEnd(guildId, action) {
    const state = this.guilds.get(guildId);
    if (!state || !state.currentTrack) return;

    const listenDurationSec = state.playStartTime
      ? Math.round((Date.now() - state.playStartTime) / 1000)
      : 0;

    logEvent({
      userId: state.userContext?.userId,
      username: state.userContext?.username,
      guildId,
      guildName: state.userContext?.guildName,
      query: state.currentTrack._query || '',
      track: state.currentTrack,
      action,
      listenDurationSec,
      wasQueued: state.currentTrack._wasQueued || false,
      queuePosition: state.currentTrack._queuePosition || 0,
    });

    state.playStartTime = null;
  }
}

module.exports = new MusicPlayer();
