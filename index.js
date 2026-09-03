const { Client, GatewayIntentBits } = require("discord.js");
const {
  joinVoiceChannel,
  VoiceConnectionStatus,
  entersState
} = require("@discordjs/voice");

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

client.once("ready", async () => {
  console.log(`JHAYBOT ONLINE: ${client.user.tag}`);

  const guild = client.guilds.cache.get(process.env.GUILD_ID);

  if (!guild) {
    console.log("ERROR: Hindi makita ang Discord server.");
    return;
  }

  const channel = guild.channels.cache.get(process.env.VOICE_CHANNEL_ID);

  if (!channel || !channel.isVoiceBased()) {
    console.log("ERROR: Hindi makita ang voice channel.");
    return;
  }

  const connection = joinVoiceChannel({
    channelId: channel.id,
    guildId: guild.id,
    adapterCreator: guild.voiceAdapterCreator,
    selfDeaf: true,
    selfMute: false
  });

  try {
    await entersState(connection, VoiceConnectionStatus.Ready, 30_000);
    console.log(`JHAYBOT joined: ${channel.name}`);
  } catch (error) {
    console.error("Failed to connect to voice channel:", error);
  }
});

client.login(process.env.TOKEN);
