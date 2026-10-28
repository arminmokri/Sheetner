class ReviewService {
  constructor(repository, scheduler, config, clock) {
    this.repository = repository; this.scheduler = scheduler; this.config = config;
    this.clock = clock || new AppClock(config.clock, config.timeZone);
  }
  cards_() { return this.repository.readAll().map(c => this.scheduler.normalize(c)); }
  find_(input) {
    if (!input || typeof input.sheetName !== 'string' || !Number.isInteger(input.rowNumber) || input.rowNumber < 2) throw new Error('Invalid card location.');
    const card = this.cards_().find(c => c.sheetName === input.sheetName && c.rowNumber === input.rowNumber);
    if (!card) throw new Error('Card no longer exists.');
    return card;
  }
  load() {
    const now = this.clock.now(), cards = this.cards_();
    return {
      dailyCards: cards.filter(c => this.scheduler.isDaily(c, now)).map(c => c.toDTO()),
      examCards: cards.filter(c => this.scheduler.isDue(c, now))
        .sort((a, b) => (this.config.examOrder === 'ascending' ? 1 : -1) *
          (this.scheduler.boxes.findIndex(box => box.name === a.metadata.box) - this.scheduler.boxes.findIndex(box => box.name === b.metadata.box)))
        .map(c => c.toDTO()),
      questionField: this.config.questionField, showFields: this.config.showFields, notesField: this.config.notesField,
      showSheetName: this.config.showSheetName, examOrder: this.config.examOrder, boxes: this.scheduler.boxes,
      timeZone: this.config.timeZone, today: this.scheduler.today(now)
    };
  }
  initialize(input) {
    const card = this.find_(input);
    if (card.initialized) return {card: card.toDTO(), alreadyInitialized: true};
    this.scheduler.initialize(card, this.clock.now());
    this.repository.saveMetadata(card.sheetName, card.rowNumber, card.metadata);
    return {card: card.toDTO(), alreadyInitialized: false};
  }
  grade(input) {
    if (!input || input.mode !== 'exam' || typeof input.passed !== 'boolean') throw new Error('Invalid exam result.');
    const card = this.find_(input), now = this.clock.now();
    // Locked re-read and due check prevent a second submission after rescheduling.
    if (!this.scheduler.isDue(card, now)) throw new Error('Card is no longer due. Reload to get current progress.');
    this.scheduler.apply(card, input.passed, now);
    this.repository.saveMetadata(card.sheetName, card.rowNumber, card.metadata);
    return {card: card.toDTO(), passed: input.passed};
  }
  saveNotes(input) {
    if (!input || typeof input.value !== 'string' || input.value.length > 40000 || typeof input.expectedValue !== 'string') throw new Error('Invalid notes (maximum 40,000 characters).');
    const card = this.find_(input);
    const field = card.fields.find(f => f.name === this.config.notesField);
    if (!field) throw new Error('Notes column not found.');
    if (field.value === input.value) return {card: card.toDTO()};
    if (field.value !== input.expectedValue) throw new Error('Notes changed in another session. Your draft is kept; copy it before reloading.');
    this.repository.saveNotes(card.sheetName, card.rowNumber, input.value);
    field.value = input.value;
    return {card: card.toDTO()};
  }
  simplifyMetadata() {
    const cards = this.cards_();
    let count = 0;
    cards.filter(c => c.initialized).forEach(c => {
      this.repository.saveMetadata(c.sheetName, c.rowNumber, c.metadata); count += 1;
    });
    return {updated: count};
  }
}
