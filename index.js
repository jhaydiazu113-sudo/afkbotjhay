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
  NoSubscriberBehavior,
  StreamType
} = require("@discordjs/voice");

const { Innertube } = require("youtubei.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates
  ]
});

let connection;
let youtube;

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

function getVideoId(input) {
  try {
    const url = new URL(input);

    if (url.hostname.includes("youtu.be")) {
      return url.pathname.slice(1);
    }

    return url.searchParams.get("v");
  } catch {
    return input;
  }
}

async function playSong(query, message) {
  try {
    let videoId;
    let title;

    if (
      query.includes("youtube.com") ||
      query.includes("youtu.be")
    ) {
      videoId = getVideoId(query);

      const info = await youtube.getInfo(videoId);
      title = info.basic_info.title || "YouTube Video";
    } else {
      const search = await youtube.search(query, {
        type: "video"
      });

      const video = search.videos[0];

      if (!video) {
        await message.reply("❌ Walang nahanap na kanta.");
        return;
      }

      videoId = video.id;
      title = video.title.text || video.title;
    }

    await message.reply(`🎵 Playing: **${title}**`);

    const stream = await youtube.download(videoId, {
      type: "audio",
      quality: "best"
    });

    const resource = createAudioResource(
      stream,
      {
        inputType: StreamType.Arbitrary
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

client.once("ready", async () => {
  console.log(`JHAYBOT ONLINE: ${client.user.tag}`);

  youtube = await Innertube.create();

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
