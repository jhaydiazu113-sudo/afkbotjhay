const {
  Client,
  GatewayIntentBits
} = require("discord.js");

const {
  joinVoiceChannel,
  VoiceConnectionStatus,
  entersState
} = require("@discordjs/voice");

const { GoogleGenAI } = require("@google/genai");

// =========================
// DISCORD
// =========================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// =========================
// GEMINI AI
// =========================

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

let connection;

// =========================
// VOICE / AFK
// =========================

async function connectToVoice() {
  try {
    const guild = client.guilds.cache.get(process.env.GUILD_ID);

    if (!guild) {
      console.log("ERROR: Hindi makita ang Discord server.");
      return;
    }

    const channel = guild.channels.cache.get(
      process.env.VOICE_CHANNEL_ID
    );

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

    connection.on(
      VoiceConnectionStatus.Disconnected,
      async () => {
        console.log("Disconnected. Trying to reconnect...");

        try {
          await Promise.race([
            entersState(
              connection,
              VoiceConnectionStatus.Signalling,
              5000
            ),
            entersState(
              connection,
              VoiceConnectionStatus.Connecting,
              5000
            )
          ]);

          console.log("Reconnecting...");
        } catch {
          connection.destroy();

          setTimeout(() => {
            console.log("Trying to join voice channel again...");
            connectToVoice();
          }, 5000);
        }
      }
    );

    await entersState(
      connection,
      VoiceConnectionStatus.Ready,
      30000
    );

    console.log(`JHAYBOT joined: ${channel.name}`);

  } catch (error) {
    console.error("Voice connection error:", error);

    setTimeout(() => {
      connectToVoice();
    }, 5000);
  }
}

// =========================
// AI COMMAND
// =========================

client.on("messageCreate", async (message) => {

  if (message.author.bot) return;

  if (!message.content.toLowerCase().startsWith("!question")) {
    return;
  }

  const question = message.content
    .slice("!question".length)
    .trim();

  if (!question) {
    return message.reply(
      "❓ Gamitin: `!question <question>`"
    );
  }

  try {

    await message.channel.sendTyping();

    console.log(
      `AI Question from ${message.author.tag}: ${question}`
    );

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: question
    });

    const answer = response.text;

    if (!question) {
      return message.reply(
        "❌ No answer was formed."
      );
    }

    // Discord message limit
    const maxLength = 1900;

    for (let i = 0; i < answer.length; i += maxLength) {
      const chunk = answer.slice(i, i + maxLength);

      await message.reply(chunk);
    }

  } catch (error) {

    console.error("GEMINI ERROR:", error);

    await message.reply(
      "❗Something went wrong, please try again."
    );
  }
});

// =========================
// BOT READY
// =========================

client.once("clientReady", () => {
  console.log(`JHAYBOT ONLINE: ${client.user.tag}`);

  connectToVoice();
});

// =========================
// LOGIN
// =========================

client.login(process.env.TOKEN);
