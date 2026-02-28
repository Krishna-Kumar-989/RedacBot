const { EmbedBuilder } = require('discord.js');

// Color palette
const COLORS = {
  PRIMARY: 0x7c3aed,   // vibrant purple
  SUCCESS: 0x10b981,   // emerald green
  ERROR: 0xef4444,     // red
  INFO: 0x3b82f6,      // blue
  QUEUE: 0xf59e0b,     // amber
};

function buildNowPlaying(track) {
  return new EmbedBuilder()
    .setColor(COLORS.PRIMARY)
    .setTitle('🎶 Now Playing')
    .setDescription(`**[${track.title}](${track.url})**`)
    .addFields(
      { name: '⏱️ Duration', value: track.duration || 'Live', inline: true },
      { name: '📺 Channel', value: track.channel || 'Unknown', inline: true }
    )
    .setThumbnail(track.thumbnail)
    .setTimestamp();
}

function buildAddedToQueue(track, position) {
  return new EmbedBuilder()
    .setColor(COLORS.SUCCESS)
    .setTitle('✅ Added to Queue')
    .setDescription(`**[${track.title}](${track.url})**`)
    .addFields(
      { name: '⏱️ Duration', value: track.duration || 'Live', inline: true },
      { name: '#️⃣ Position', value: `${position}`, inline: true }
    )
    .setThumbnail(track.thumbnail)
    .setTimestamp();
}

function buildQueue(current, queue) {
  const embed = new EmbedBuilder()
    .setColor(COLORS.QUEUE)
    .setTitle('📜 Music Queue')
    .setTimestamp();

  if (current) {
    embed.addFields({
      name: '🎶 Now Playing',
      value: `**[${current.title}](${current.url})** — ${current.duration || 'Live'}`,
    });
  }

  if (queue.length === 0) {
    embed.setDescription(current ? '_No more songs in the queue._' : '_The queue is empty._');
  } else {
    const list = queue
      .slice(0, 10)
      .map((t, i) => `**${i + 1}.** [${t.title}](${t.url}) — ${t.duration || 'Live'}`)
      .join('\n');

    embed.addFields({ name: 'Up Next', value: list });

    if (queue.length > 10) {
      embed.setFooter({ text: `...and ${queue.length - 10} more` });
    }
  }

  return embed;
}

function buildError(message) {
  return new EmbedBuilder()
    .setColor(COLORS.ERROR)
    .setTitle('❌ Error')
    .setDescription(message)
    .setTimestamp();
}

function buildSuccess(message) {
  return new EmbedBuilder()
    .setColor(COLORS.SUCCESS)
    .setDescription(message)
    .setTimestamp();
}

function buildInfo(message) {
  return new EmbedBuilder()
    .setColor(COLORS.INFO)
    .setDescription(message)
    .setTimestamp();
}

module.exports = {
  buildNowPlaying,
  buildAddedToQueue,
  buildQueue,
  buildError,
  buildSuccess,
  buildInfo,
};
