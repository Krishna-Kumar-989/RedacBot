const mongoose = require('mongoose');

// ─── MongoDB Schema ─────────────────────────────────────────────
const historySchema = new mongoose.Schema({
  timestamp:         { type: Date, default: Date.now, index: true },
  userId:            { type: String, index: true },
  username:          String,
  guildId:           { type: String, index: true },
  guildName:         String,
  query:             String,
  trackTitle:        String,
  trackUrl:          String,
  trackDuration:     String,
  trackChannel:      String,
  action:            { type: String, enum: ['play_start', 'skipped', 'completed', 'stopped'], index: true },
  listenDurationSec: { type: Number, default: 0 },
  wasQueued:         { type: Boolean, default: false },
  queuePosition:     { type: Number, default: 0 },
});

const History = mongoose.model('History', historySchema);

// ─── Connection ─────────────────────────────────────────────────
async function connectMongo() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('[HISTORY] ❌ No MONGO_URI found in .env — history logging disabled.');
    return;
  }

  try {
    await mongoose.connect(uri);
    console.log('[HISTORY] Connected to MongoDB ✅');
  } catch (err) {
    console.error('[HISTORY] MongoDB connection failed:', err.message);
  }
}

// ─── Logger ─────────────────────────────────────────────────────
function logEvent(data) {
  if (mongoose.connection.readyState !== 1) return;

  History.create({
    timestamp: new Date(),
    userId: data.userId,
    username: data.username,
    guildId: data.guildId,
    guildName: data.guildName,
    query: data.query,
    trackTitle: data.track?.title,
    trackUrl: data.track?.url,
    trackDuration: data.track?.duration,
    trackChannel: data.track?.channel,
    action: data.action,
    listenDurationSec: data.listenDurationSec ?? 0,
    wasQueued: data.wasQueued ?? false,
    queuePosition: data.queuePosition ?? 0,
  }).catch((err) => {
    console.error('[HISTORY] MongoDB write failed:', err.message);
  });

  console.log(`[HISTORY] ${data.action} | ${data.username} | ${data.track?.title}`);
}

module.exports = { logEvent, connectMongo };
