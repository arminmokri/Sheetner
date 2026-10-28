class LeitnerScheduler {
  constructor(config, clock) {
    this.config = config;
    this.clock = clock || new AppClock(config.clock, config.timeZone);
    this.boxes = Object.entries(config.boxes).map(([name, days]) => ({name, days}));
  }
  today(now) { return this.clock.toDateKey(now); }
  addDays(dateKey, days) { return this.clock.addDays(dateKey, days); }
  normalize(card) {
    if (!card.initialized) return card;
    let box = card.metadata.box;
    // Migrate earlier numeric box values by their configured order.
    if (Number.isInteger(box)) box = this.boxes[Math.max(box, 1) - 1]?.name;
    if (!this.boxes.some(b => b.name === box)) throw new Error('Unknown box for ' + card.sheetName + ':' + card.rowNumber);
    let date;
    try { date = this.clock.normalizeDate(card.metadata.nextReviewAt); }
    catch (error) { throw new Error(card.sheetName + ':' + card.rowNumber + ': ' + error.message); }
    card.metadata = {box, nextReviewAt: date};
    return card;
  }
  isDue(card, now) { return card.initialized && card.metadata.nextReviewAt <= this.today(now); }
  isDaily(card, now) { return !card.initialized || (card.metadata.box === this.boxes[0].name && !this.isDue(card, now)); }
  initialize(card, now) {
    if (card.initialized) return card;
    card.initialized = true;
    card.metadata = {box: this.boxes[0].name, nextReviewAt: this.addDays(this.today(now), this.boxes[0].days)};
    return card;
  }
  apply(card, passed, now) {
    const current = this.boxes.findIndex(b => b.name === card.metadata.box);
    const next = passed ? Math.min(current + 1, this.boxes.length - 1) : 0;
    card.metadata = {box: this.boxes[next].name, nextReviewAt: this.addDays(this.today(now), this.boxes[next].days)};
    return card;
  }
}
