class Card {
  constructor(sheetName, rowNumber, fields, rawMetadata) {
    this.sheetName = sheetName; this.rowNumber = rowNumber; this.fields = fields;
    this.initialized = String(rawMetadata || '').trim() !== '';
    let m = {};
    if (this.initialized) {
      try { m = JSON.parse(rawMetadata); }
      catch (_) { throw new Error('Invalid metadata JSON at ' + sheetName + ':' + rowNumber); }
      if (!m || typeof m !== 'object' || Array.isArray(m)) throw new Error('Metadata must be an object.');
    }
    // Only current scheduling state is retained. Older history/revision/counters are ignored.
    this.metadata = {box: m.box === undefined ? null : m.box, nextReviewAt: m.nextReviewAt || null};
  }
  toDTO() { return {sheetName: this.sheetName, rowNumber: this.rowNumber, fields: this.fields, initialized: this.initialized, metadata: this.metadata}; }
}
