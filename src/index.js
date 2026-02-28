require('dotenv').config();
const { Client, GatewayIntentBits, Events } = require('discord.js');
const { handleCommand } = require('./commands');
const { connectMongo } = require('./history');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
  ],
});

client.once(Events.ClientReady, (c) => {
  console.log(`✅ Ready! Logged in as ${c.user.tag}`);
  console.log(`🎵 RedacBot is online in ${c.guilds.cache.size} server(s)`);

  if (c.guilds.cache.size === 0) {
    const clientId = process.env.CLIENT_ID || c.user.id;
    const perms = 3145728; // Connect + Speak
    const invite = `https://discord.com/oauth2/authorize?client_id=${clientId}&permissions=${perms}&scope=bot%20applications.commands`;
    console.log('');
    console.log('⚠️  Bot is not in any server! Invite it using this link:');
    console.log(`🔗 ${invite}`);
    console.log('');
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  console.log(`[CMD] ${interaction.user.tag} used /${interaction.commandName}`);

  try {
    await handleCommand(interaction);
  } catch (error) {
    console.error('Command error:', error);
    try {
      const reply = { content: '❌ Something went wrong!', ephemeral: true };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(reply);
      } else {
        await interaction.reply(reply);
      }
    } catch (e) {
      console.error('Failed to send error reply:', e.message);
    }
  }
});

// Login
const token = process.env.DISCORD_TOKEN;
if (!token || token === 'YOUR_BOT_TOKEN_HERE') {
  console.error('❌ No bot token found! Edit .env and add your DISCORD_TOKEN.');
  process.exit(1);
}

// Connect to MongoDB (if configured), then login to Discord
connectMongo().then(() => {
  client.login(token);
});
