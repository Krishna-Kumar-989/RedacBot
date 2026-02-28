const { SlashCommandBuilder } = require('discord.js');
const player = require('./player');
const { buildAddedToQueue, buildQueue, buildError, buildSuccess, buildInfo, buildNowPlaying } = require('./embed');

// ─── Command definitions ────────────────────────────────────────
const commands = [
  new SlashCommandBuilder()
    .setName('mzplay')
    .setDescription('Play a song from YouTube')
    .addStringOption((opt) =>
      opt.setName('query').setDescription('Song name or YouTube URL').setRequired(true)
    ),

  new SlashCommandBuilder().setName('mzskip').setDescription('Skip the current song'),

  new SlashCommandBuilder().setName('mzstop').setDescription('Stop music and leave the channel'),

  new SlashCommandBuilder().setName('mzqueue').setDescription('Show the current queue'),

  new SlashCommandBuilder().setName('mzpause').setDescription('Pause the current song'),

  new SlashCommandBuilder().setName('mzresume').setDescription('Resume the current song'),

  new SlashCommandBuilder().setName('mznp').setDescription('Show what\'s currently playing'),
];

// ─── Command handler ────────────────────────────────────────────
async function handleCommand(interaction) {
  const { commandName, guildId } = interaction;

  // Try multiple ways to get the user's voice channel
  let voiceChannel = null;

  // Method 1: Direct from interaction member
  voiceChannel = interaction.member?.voice?.channel;

  // Method 2: Fetch member via REST API (works without privileged intent)
  if (!voiceChannel && interaction.guild) {
    try {
      const fetchedMember = await interaction.guild.members.fetch({ user: interaction.user.id, force: true });
      voiceChannel = fetchedMember?.voice?.channel;
    } catch (err) {
      console.error('Member fetch failed:', err.message);
    }
  }

  // Method 3: Check voice states cache
  if (!voiceChannel && interaction.guild) {
    const vs = interaction.guild.voiceStates.cache.get(interaction.user.id);
    voiceChannel = vs?.channel;
  }

  console.log(`[CMD] /${commandName} | Voice: ${voiceChannel ? voiceChannel.name : 'NONE (all methods failed)'}`);

  switch (commandName) {
    case 'mzplay': {
      if (!voiceChannel) {
        return interaction.reply({
          embeds: [buildError('You need to be in a voice channel to play music!')],
          ephemeral: true,
        });
      }

      await interaction.deferReply();
      const query = interaction.options.getString('query');

      const userContext = {
        userId: interaction.user.id,
        username: interaction.user.username,
        guildName: interaction.guild?.name || 'Unknown',
      };

      try {
        const track = await player.play(guildId, voiceChannel, interaction.channel, query, userContext);

        if (!track) {
          return interaction.editReply({
            embeds: [buildError(`No results found for **${query}**`)],
          });
        }

        const { queue } = player.getQueue(guildId);
        if (queue.length > 0) {
          return interaction.editReply({
            embeds: [buildAddedToQueue(track, queue.length)],
          });
        } else {
          return interaction.editReply({
            embeds: [buildSuccess(`🎶 Playing **[${track.title}](${track.url})**`)],
          });
        }
      } catch (error) {
        console.error('Play error:', error);
        return interaction.editReply({
          embeds: [buildError('Something went wrong while trying to play that track.')],
        });
      }
    }

    case 'mzskip': {
      const skipped = player.skip(guildId);
      if (skipped) {
        return interaction.reply({ embeds: [buildSuccess('⏭️ Skipped!')] });
      }
      return interaction.reply({ embeds: [buildInfo('Nothing is playing right now.')] });
    }

    case 'mzstop': {
      player.destroy(guildId);
      return interaction.reply({ embeds: [buildSuccess('⏹️ Stopped and left the channel.')] });
    }

    case 'mzqueue': {
      const { current, queue } = player.getQueue(guildId);
      return interaction.reply({ embeds: [buildQueue(current, queue)] });
    }

    case 'mzpause': {
      const paused = player.pause(guildId);
      if (paused) {
        return interaction.reply({ embeds: [buildSuccess('⏸️ Paused.')] });
      }
      return interaction.reply({ embeds: [buildInfo('Nothing is playing right now.')] });
    }

    case 'mzresume': {
      const resumed = player.resume(guildId);
      if (resumed) {
        return interaction.reply({ embeds: [buildSuccess('▶️ Resumed!')] });
      }
      return interaction.reply({ embeds: [buildInfo('Nothing is paused right now.')] });
    }

    case 'mznp': {
      const track = player.getNowPlaying(guildId);
      if (track) {
        return interaction.reply({ embeds: [buildNowPlaying(track)] });
      }
      return interaction.reply({ embeds: [buildInfo('Nothing is playing right now.')] });
    }

    default:
      return interaction.reply({ embeds: [buildError('Unknown command.')], ephemeral: true });
  }
}

module.exports = { commands, handleCommand };
