const { Client, GatewayIntentBits } = require("discord.js");
const {
  joinVoiceChannel,
  VoiceConnectionStatus,
  entersState
} = require("@discordjs/voice");

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

let connection;

async function connectToVoice() {
  try {
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

    connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: guild.id,
      adapterCreator: guild.voiceAdapterCreator,
      selfDeaf: true,
      selfMute: false
    });

    connection.on(VoiceConnectionStatus.Disconnected, async () => {
      console.log("Disconnected. Trying to reconnect...");

      try {
        await Promise.race([
          entersState(connection, VoiceConnectionStatus.Signalling, 5000),
          entersState(connection, VoiceConnectionStatus.Connecting, 5000)
        ]);

        console.log("Reconnecting...");
      } catch {
        connection.destroy();

        setTimeout(() => {
          console.log("Trying to join voice channel again...");
          connectToVoice();
        }, 5000);
      }
    });

    await entersState(connection, VoiceConnectionStatus.Ready, 30000);

    console.log(`JHAYBOT joined: ${channel.name}`);
  } catch (error) {
    console.error("Voice connection error:", error);

    setTimeout(() => {
      connectToVoice();
    }, 5000);
  }
}

client.once("ready", () => {
  console.log(`JHAYBOT ONLINE: ${client.user.tag}`);
  connectToVoice();
});

client.login(process.env.TOKEN);
