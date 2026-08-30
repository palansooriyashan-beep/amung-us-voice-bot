export class PlayerState {
  constructor() {
    this.players = new Map();
  }

  startRound(memberIds = []) {
    this.players.clear();

    for (const id of memberIds) {
      this.players.set(id, "alive");
    }
  }

  setAlive(userId) {
    this.players.set(userId, "alive");
  }

  setDead(userId) {
    this.players.set(userId, "dead");
  }

  get(userId) {
    return this.players.get(userId) ?? "alive";
  }

  isAlive(userId) {
    return this.get(userId) === "alive";
  }

  isDead(userId) {
    return this.get(userId) === "dead";
  }

  entries() {
    return this.players.entries();
  }

  clear() {
    this.players.clear();
  }
}