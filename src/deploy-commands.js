require('dotenv').config();
const { REST, Routes } = require('discord.js');
const { commands } = require('./commands');

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;

if (!token || token === 'YOUR_BOT_TOKEN_HERE') {
  console.error('❌ No bot token! Edit .env first.');
  process.exit(1);
}
if (!clientId || clientId === 'YOUR_CLIENT_ID_HERE') {
  console.error('❌ No client ID! Edit .env first.');
  process.exit(1);
}

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
  try {
    console.log('🔄 Registering slash commands...');

    await rest.put(Routes.applicationCommands(clientId), {
      body: commands.map((cmd) => cmd.toJSON()),
    });

    console.log('✅ Slash commands registered successfully!');
  } catch (error) {
    console.error('❌ Failed to register commands:', error);
  }
})();
