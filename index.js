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

const { spawn } = require("child_process");
const youtubedl = require("youtube-dl-exec");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates
  ]
});

let connection;
let currentProcess = null;

const player = createAudioPlayer({
  behaviors: {
    noSubscriber: NoSubscriberBehavior.Play
  }
});

// ==============================
// AFK + AUTO RECONNECT
// ==============================

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
        console.log("Disconnected. Reconnecting...");

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

          setTimeout(connectToVoice, 5000);
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
    console.error("VOICE ERROR:", error);

    setTimeout(connectToVoice, 5000);
  }
}

// ==============================
// MUSIC
// ==============================

async function playSong(query, message) {
  try {
    await message.reply("🔎 Searching/Loading...");

    // Search by name OR accept YouTube URL
    const target =
      query.startsWith("http://") ||
      query.startsWith("https://")
        ? query
        : `ytsearch1:${query}`;

    // Get song information first
    const info = await youtubedl(target, {
      dumpSingleJson: true,
      noWarnings: true,
      noPlaylist: true
    });

    let video = info;

    if (info.entries && info.entries.length > 0) {
      video = info.entries[0];
    }

    if (!video || !video.webpage_url) {
      throw new Error("Walang valid YouTube video na nahanap.");
    }

    const url = video.webpage_url;
    const title = video.title || "Unknown title";

    // Stop old yt-dlp process
    if (currentProcess) {
      try {
        currentProcess.kill();
      } catch {}

      currentProcess = null;
    }

    // Stream audio through yt-dlp stdout
    currentProcess = spawn(
      youtubedl.raw,
      [
        url,
        "-f",
        "bestaudio",
        "-o",
        "-",
        "--no-playlist",
        "--no-warnings",
        "--quiet"
      ],
      {
        stdio: ["ignore", "pipe", "pipe"]
      }
    );

    currentProcess.stderr.on("data", (data) => {
      console.log(
        "YT-DLP:",
        data.toString()
      );
    });

    currentProcess.on("error", (error) => {
      console.error(
        "YT-DLP PROCESS ERROR:",
        error
      );
    });

    const resource = createAudioResource(
      currentProcess.stdout,
      {
        inputType: StreamType.Arbitrary
      }
    );

    player.play(resource);

    if (connection) {
      connection.subscribe(player);
    }

    await message.reply(
      `🎵 Playing: **${title}**`
    );
  } catch (error) {
    console.error("PLAY ERROR:", error);

    await message.reply(
      "❌ Hindi ma-play ang kanta."
    );
  }
}

// ==============================
// BOT READY
// ==============================

client.once("ready", () => {
  console.log(
    `JHAYBOT ONLINE: ${client.user.tag}`
  );

  connectToVoice();
});

// ==============================
// COMMANDS
// ==============================

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  const content = message.content.trim();

  if (
    content.toLowerCase().startsWith("!play ")
  ) {
    const query = content.slice(6).trim();

    if (!query) {
      await message.reply(
        "❌ Gamitin: `!play pangalan/link`"
      );
      return;
    }

    await playSong(query, message);
  }

  if (content.toLowerCase() === "!pause") {
    const result = player.pause();

    await message.reply(
      result
        ? "⏸️ Paused."
        : "❌ Walang music."
    );
  }

  if (content.toLowerCase() === "!resume") {
    const result = player.unpause();

    await message.reply(
      result
        ? "▶️ Resumed."
        : "❌ Walang naka-pause."
    );
  }

  if (content.toLowerCase() === "!stop") {
    player.stop();

    if (currentProcess) {
      try {
        currentProcess.kill();
      } catch {}

      currentProcess = null;
    }

    await message.reply(
      "⏹️ Music stopped."
    );
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

// ==============================
// PLAYER EVENTS
// ==============================

player.on(AudioPlayerStatus.Playing, () => {
  console.log("Music is playing.");
});

player.on(AudioPlayerStatus.Idle, () => {
  console.log("Music finished.");

  if (currentProcess) {
    try {
      currentProcess.kill();
    } catch {}

    currentProcess = null;
  }
});

player.on("error", (error) => {
  console.error(
    "AUDIO PLAYER ERROR:",
    error
  );
});

client.login(process.env.TOKEN);
