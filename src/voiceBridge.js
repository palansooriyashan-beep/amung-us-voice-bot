import {
  joinVoiceChannel,
  VoiceConnectionStatus
} from "@discordjs/voice";

export class VoiceBridge {

  constructor() {
    this.aliveConnection = null;
    this.deadConnection = null;

    this.speakingHandler = null;
    this.speakingStopHandler = null;

    this.connected = false;
  }

  // ==========================================
  // CONNECT
  // ==========================================

  connect(guild, aliveChannelId, deadChannelId) {

    if (this.connected) {
      console.log(
        "ℹ️ Voice Bridge already connected."
      );

      return;
    }

    console.log(
      "🚀 Starting Voice Bridge..."
    );

    // ========================================
    // ALIVE CONNECTION
    // ========================================

    this.aliveConnection = joinVoiceChannel({
      channelId: aliveChannelId,
      guildId: guild.id,
      adapterCreator: guild.voiceAdapterCreator,

      // IMPORTANT FOR RECEIVE
      selfDeaf: false,
      selfMute: true,

      // Enable voice debugging
      debug: true
    });

    // ========================================
    // DEAD CONNECTION
    // ========================================

    this.deadConnection = joinVoiceChannel({
      channelId: deadChannelId,
      guildId: guild.id,
      adapterCreator: guild.voiceAdapterCreator,

      selfDeaf: false,
      selfMute: true,

      // Enable voice debugging
      debug: true
    });

    this.connected = true;

    // ========================================
    // ALIVE EVENTS
    // ========================================

    this.attachConnectionLogs(
      this.aliveConnection,
      "ALIVE"
    );

    // ========================================
    // DEAD EVENTS
    // ========================================

    this.attachConnectionLogs(
      this.deadConnection,
      "DEAD"
    );

    // ========================================
    // ALIVE READY
    // ========================================

    this.aliveConnection.on(
      VoiceConnectionStatus.Ready,
      () => {

        console.log(
          "======================================"
        );

        console.log(
          "🎙️ ALIVE CONNECTION READY"
        );

        console.log(
          "🎧 ALIVE RECEIVER AVAILABLE:",
          !!this.aliveConnection.receiver
        );

        console.log(
          "======================================"
        );

        this.setupReceiverDiagnostic();
      }
    );

    // ========================================
    // DEAD READY
    // ========================================

    this.deadConnection.on(
      VoiceConnectionStatus.Ready,
      () => {

        console.log(
          "======================================"
        );

        console.log(
          "💀 DEAD CONNECTION READY"
        );

        console.log(
          "🎧 DEAD RECEIVER AVAILABLE:",
          !!this.deadConnection.receiver
        );

        console.log(
          "======================================"
        );
      }
    );

    console.log(
      "🎙️ Voice Bridge connections created."
    );
  }

  // ==========================================
  // CONNECTION DEBUG LOGS
  // ==========================================

  attachConnectionLogs(
    connection,
    name
  ) {

    // ----------------------------------------
    // DEBUG
    // ----------------------------------------

    connection.on(
      "debug",
      message => {

        console.log(
          `🔍 [${name} VOICE DEBUG] ${message}`
        );
      }
    );

    // ----------------------------------------
    // ERROR
    // ----------------------------------------

    connection.on(
      "error",
      error => {

        console.error(
          `❌ [${name} VOICE ERROR]`,
          error
        );

        console.error(
          `❌ [${name} ERROR MESSAGE]`,
          error?.message
        );

        console.error(
          `❌ [${name} ERROR STACK]`,
          error?.stack
        );
      }
    );

    // ----------------------------------------
    // STATE CHANGE
    // ----------------------------------------

    connection.on(
      "stateChange",
      (
        oldState,
        newState
      ) => {

        console.log(
          `🔄 [${name}] Voice state:`,
          oldState.status,
          "→",
          newState.status
        );
      }
    );

    // ----------------------------------------
    // DAVE TRANSITION
    // ----------------------------------------

    connection.on(
      "transitioned",
      transitionId => {

        console.log(
          `🔐 [${name}] DAVE transitioned:`,
          transitionId
        );
      }
    );

    // ----------------------------------------
    // DISCONNECTED
    // ----------------------------------------

    connection.on(
      VoiceConnectionStatus.Disconnected,
      () => {

        console.log(
          `⚠️ [${name}] Voice connection DISCONNECTED`
        );
      }
    );
  }

  // ==========================================
  // RECEIVER DIAGNOSTIC
  // ==========================================

  setupReceiverDiagnostic() {

    if (!this.aliveConnection) {

      console.log(
        "❌ Alive connection does not exist."
      );

      return;
    }

    const receiver =
      this.aliveConnection.receiver;

    if (!receiver) {

      console.log(
        "❌ Voice receiver does not exist."
      );

      return;
    }

    console.log(
      "🎧 ======================================"
    );

    console.log(
      "🎧 VOICE RECEIVER DIAGNOSTIC"
    );

    console.log(
      "🎧 Receiver exists:",
      !!receiver
    );

    console.log(
      "🎧 Speaking map exists:",
      !!receiver.speaking
    );

    console.log(
      "🎧 Current subscriptions:",
      receiver.subscriptions.size
    );

    console.log(
      "🎧 Current SSRC map size:",
      receiver.ssrcMap.size
    );

    console.log(
      "🎧 Speaking start listeners BEFORE:",
      receiver.speaking.listenerCount(
        "start"
      )
    );

    console.log(
      "🎧 Speaking stop listeners BEFORE:",
      receiver.speaking.listenerCount(
        "end"
      )
    );

    console.log(
      "🎧 ======================================"
    );

    // ========================================
    // REMOVE OLD LISTENERS
    // ========================================

    if (this.speakingHandler) {

      receiver.speaking.off(
        "start",
        this.speakingHandler
      );
    }

    if (this.speakingStopHandler) {

      receiver.speaking.off(
        "end",
        this.speakingStopHandler
      );
    }

    // ========================================
    // SPEAKING START
    // ========================================

    this.speakingHandler =
      userId => {

        console.log(
          "🔥 ======================================"
        );

        console.log(
          "🔥 SPEAKING EVENT RECEIVED"
        );

        console.log(
          "👤 USER ID:",
          userId
        );

        console.log(
          "🔥 ======================================"
        );

        // ------------------------------------
        // IMPORTANT:
        // Subscribe to this user's Opus stream
        // ------------------------------------

        try {

          const stream =
            receiver.subscribe(
              userId,
              {
                end: {
                  behavior: "silence",
                  duration: 100
                }
              }
            );

          console.log(
            "📡 Audio subscription created for:",
            userId
          );

          let packetCount = 0;

          stream.on(
            "data",
            packet => {

              packetCount++;

              if (packetCount === 1) {

                console.log(
                  "📦 FIRST AUDIO PACKET RECEIVED"
                );

                console.log(
                  "👤 USER:",
                  userId
                );

                console.log(
                  "📦 PACKET TYPE:",
                  typeof packet
                );

                console.log(
                  "📦 BUFFER:",
                  Buffer.isBuffer(packet)
                );

                console.log(
                  "📦 PACKET SIZE:",
                  Buffer.isBuffer(packet)
                    ? packet.length
                    : "not-buffer"
                );
              }

              if (
                packetCount % 50 === 0
              ) {

                console.log(
                  `📦 ${packetCount} audio packets received from ${userId}`
                );
              }
            }
          );

          stream.on(
            "end",
            () => {

              console.log(
                `📡 Audio stream ended: ${userId} | packets: ${packetCount}`
              );
            }
          );

          stream.on(
            "error",
            error => {

              console.error(
                `❌ Audio stream error for ${userId}:`,
                error
              );

              console.error(
                "❌ Audio stream error message:",
                error?.message
              );
            }
          );

        } catch (error) {

          console.error(
            "❌ Could not subscribe to user audio:",
            error
          );

          console.error(
            "❌ Subscribe error message:",
            error?.message
          );
        }
      };

    // ========================================
    // SPEAKING STOP
    // ========================================

    this.speakingStopHandler =
      userId => {

        console.log(
          `🛑 SPEAKING STOP: ${userId}`
        );
      };

    // ========================================
    // ATTACH LISTENERS
    // ========================================

    receiver.speaking.on(
      "start",
      this.speakingHandler
    );

    receiver.speaking.on(
      "end",
      this.speakingStopHandler
    );

    console.log(
      "🎧 Speaking start listener attached."
    );

    console.log(
      "🎧 Speaking end listener attached."
    );

    console.log(
      "🎧 Speaking start listeners AFTER:",
      receiver.speaking.listenerCount(
        "start"
      )
    );

    console.log(
      "🎧 Speaking end listeners AFTER:",
      receiver.speaking.listenerCount(
        "end"
      )
    );

    console.log(
      "🎧 Receiver diagnostic READY."
    );
  }

  // ==========================================
  // DESTROY
  // ==========================================

  destroy() {

    console.log(
      "🛑 Stopping Voice Bridge..."
    );

    // ========================================
    // ALIVE RECEIVER CLEANUP
    // ========================================

    if (
      this.aliveConnection &&
      this.aliveConnection.receiver &&
      this.speakingHandler
    ) {

      try {

        this.aliveConnection
          .receiver
          .speaking
          .off(
            "start",
            this.speakingHandler
          );

        if (this.speakingStopHandler) {

          this.aliveConnection
            .receiver
            .speaking
            .off(
              "end",
              this.speakingStopHandler
            );
        }

      } catch (error) {

        console.log(
          "ℹ️ Receiver cleanup:",
          error.message
        );
      }
    }

    this.speakingHandler = null;
    this.speakingStopHandler = null;

    // ========================================
    // ALIVE CONNECTION
    // ========================================

    if (this.aliveConnection) {

      try {

        if (
          this.aliveConnection.state.status !==
          VoiceConnectionStatus.Destroyed
        ) {

          this.aliveConnection.destroy();
        }

      } catch (error) {

        console.log(
          "ℹ️ Alive connection already destroyed:",
          error.message
        );
      }

      this.aliveConnection = null;
    }

    // ========================================
    // DEAD CONNECTION
    // ========================================

    if (this.deadConnection) {

      try {

        if (
          this.deadConnection.state.status !==
          VoiceConnectionStatus.Destroyed
        ) {

          this.deadConnection.destroy();
        }

      } catch (error) {

        console.log(
          "ℹ️ Dead connection already destroyed:",
          error.message
        );
      }

      this.deadConnection = null;
    }

    this.connected = false;

    console.log(
      "🛑 Voice Bridge stopped."
    );
  }
}