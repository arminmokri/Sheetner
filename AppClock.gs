/** Single authority for current time and calendar-date operations. */
class AppClock {
  constructor(options, timeZone) {
    this.fixedNow = options && options.fixedNow != null ? options.fixedNow : null;
    this.timeZone = timeZone;
    if (this.fixedNow !== null) {
      if (typeof this.fixedNow !== 'string' || !/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(this.fixedNow) || !Number.isFinite(Date.parse(this.fixedNow))) {
        throw new Error('clock.fixedNow must be null or an ISO timestamp with Z or a timezone offset.');
      }
    }
  }
  now() {
    // The only system-clock read in the application. Return a fresh Date each time.
    return this.fixedNow === null ? new Date() : new Date(this.fixedNow);
  }
  toDateKey(date) { return Utilities.formatDate(date, this.timeZone, 'yyyy-MM-dd'); }
  today() { return this.toDateKey(this.now()); }
  addDays(dateKey, days) {
    const date = new Date(dateKey + 'T12:00:00Z');
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
  }
  normalizeDate(value) {
    if (!value || typeof value !== 'string' || !Number.isFinite(Date.parse(value))) throw new Error('Missing or invalid exam date.');
    const key = /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : this.toDateKey(new Date(value));
    if (new Date(key + 'T12:00:00Z').toISOString().slice(0, 10) !== key) throw new Error('Invalid calendar date.');
    return key;
  }
}
