import { PlayerState } from "./playerState.js";

export class VoiceRouter {
  constructor() {
    this.state = new PlayerState();
  }

  startRound(guild) {
    const memberIds = guild.members.cache.map(
      (member) => member.id
    );

    this.state.startRound(memberIds);
  }

  setAlive(userId) {
    this.state.setAlive(userId);
  }

  setDead(userId) {
    this.state.setDead(userId);
  }

  entries() {
    return this.state.entries();
  }

  endRound() {
    this.state.clear();
  }
}