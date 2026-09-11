/* ─── Lane FSM — discrete 0|1|2 with tweened screen X ──────────────────── */

class LaneSystem {
  constructor() {
    this.lane = 1;
    this.targetLane = 1;
    this.laneT = 1;
  }

  get effectiveLane() {
    if (this.laneT < 1) return this.laneT < 0.5 ? this.lane : this.targetLane;
    return this.lane;
  }

  change(dir) {
    var next = this.targetLane + dir;
    if (next < 0 || next > 2) return false;
    if (this.laneT < 1 && this.targetLane === next) return false;
    this.lane = this.laneT >= 1 ? this.targetLane : this.lane;
    this.targetLane = next;
    this.laneT = 0;
    return true;
  }

  update(dtMs) {
    if (this.laneT < 1) {
      this.laneT = Math.min(1, this.laneT + dtMs / CFG.LANE_CHANGE_MS);
      if (this.laneT >= 1) this.lane = this.targetLane;
    }
  }

  screenX(L) {
    var fromX = Perspective.laneScreenX(L, this.lane);
    var toX = Perspective.laneScreenX(L, this.targetLane);
    return Perspective.lerp(fromX, toX, Perspective.smoothstep(this.laneT));
  }
}
