const {
  Client,
  GatewayIntentBits
} = require("discord.js");

const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  entersState,
  NoSubscriberBehavior
} = require("@discordjs/voice");

const play = require("play-dl");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates
  ]
});

let connection;

const player = createAudioPlayer({
  behaviors: {
    noSubscriber: NoSubscriberBehavior.Play
  }
});

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

    connection.subscribe(player);

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
        } catch {
          try {
            connection.destroy();
          } catch {}

          setTimeout(() => {
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

    connection.subscribe(player);

    console.log(`JHAYBOT joined: ${channel.name}`);
  } catch (error) {
    console.error("Voice connection error:", error);

    setTimeout(() => {
      connectToVoice();
    }, 5000);
  }
}

async function playSong(query, message) {
  try {
    let url = query;

    const validation = play.yt_validate(query);

    if (validation !== "video") {
      const results = await play.search(query, {
        limit: 1,
        source: {
          youtube: "video"
        }
      });

      if (!results.length) {
        await message.reply("❌ Walang nahanap na kanta.");
        return;
      }

      url = results[0].url;

      await message.reply(
        `🎵 Playing: **${results[0].title}**`
      );
    } else {
      await message.reply("🎵 Loading music...");
    }

    const stream = await play.stream(url);

    const resource = createAudioResource(
      stream.stream,
      {
        inputType: stream.type
      }
    );

    player.play(resource);

    if (connection) {
      connection.subscribe(player);
    }
  } catch (error) {
    console.error("PLAY ERROR:", error);

    await message.reply(
      "❌ Hindi ma-play ang kanta."
    );
  }
}

client.once("ready", () => {
  console.log(`JHAYBOT ONLINE: ${client.user.tag}`);

  connectToVoice();
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  const content = message.content.trim();

  if (content.toLowerCase().startsWith("!play ")) {
    const query = content.slice(6).trim();

    if (!query) {
      await message.reply(
        "❌ Gamitin: `!play pangalan ng kanta`"
      );
      return;
    }

    await playSong(query, message);
  }

  if (content.toLowerCase() === "!pause") {
    const paused = player.pause();

    await message.reply(
      paused
        ? "⏸️ Paused."
        : "❌ Walang music na naka-play."
    );
  }

  if (content.toLowerCase() === "!resume") {
    const resumed = player.unpause();

    await message.reply(
      resumed
        ? "▶️ Resumed."
        : "❌ Walang naka-pause na music."
    );
  }

  if (content.toLowerCase() === "!stop") {
    player.stop();

    await message.reply("⏹️ Music stopped.");
  }

  if (content.toLowerCase() === "!help") {
    await message.reply(
      "**JHAYBOT Commands**\n" +
      "`!play <song name or YouTube URL>`\n" +
      "`!pause`\n" +
      "`!resume`\n" +
      "`!stop`\n" +
      "`!help`"
    );
  }
});

player.on(AudioPlayerStatus.Playing, () => {
  console.log("Music is playing.");
});

player.on(AudioPlayerStatus.Idle, () => {
  console.log("Music finished.");
});

player.on("error", (error) => {
  console.error("Audio player error:", error);
});

client.login(process.env.TOKEN);
