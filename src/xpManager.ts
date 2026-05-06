export class XpManager {
  private pendingXp: number;
  private readonly XP_PER_CAPTURE = 500;
  private onCaptureTrigger: () => void;

  constructor(initialPendingXp: number, onCaptureTrigger: () => void) {
    this.pendingXp = initialPendingXp;
    this.onCaptureTrigger = onCaptureTrigger;
  }

  addXp(amount: number): void {
    this.pendingXp += amount;
    if (this.pendingXp >= this.XP_PER_CAPTURE) {
      this.pendingXp -= this.XP_PER_CAPTURE;
      this.onCaptureTrigger();
    }
  }

  getPendingXp(): number {
    return this.pendingXp;
  }

  getProgress(): number {
    return this.pendingXp / this.XP_PER_CAPTURE; // 0..1
  }

  setPendingXp(xp: number): void {
    this.pendingXp = xp;
  }
}
