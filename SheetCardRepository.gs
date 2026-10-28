class SheetCardRepository {
  constructor(config) { this.config = config; }
  spreadsheet_() { return SpreadsheetApp.openById(this.config.spreadsheetId); }
  sheet_(spreadsheet, name) {
    if (!this.config.sheetNames.includes(name)) throw new Error('Sheet is not configured.');
    const sheet = spreadsheet.getSheetByName(name);
    if (!sheet) throw new Error('Sheet not found: ' + name);
    return sheet;
  }
  headers_(sheet) {
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0].map(x => x.trim());
    if (headers.some(x => !x) || new Set(headers).size !== headers.length) {
      throw new Error(sheet.getName() + ': headers must be unique and nonempty.');
    }
    for (const field of [this.config.questionField, ...this.config.showFields, this.config.metadataField, this.config.notesField]) {
      if (!headers.includes(field)) throw new Error(sheet.getName() + ': missing column ' + field);
    }
    return headers;
  }
  readAll() {
    const spreadsheet = this.spreadsheet_();
    return this.config.sheetNames.reduce((all, name) => {
      const sheet = this.sheet_(spreadsheet, name);
      const headers = this.headers_(sheet);
      if (sheet.getLastRow() < 2) return all;
      const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getDisplayValues();
      const metadataIndex = headers.indexOf(this.config.metadataField);
      const contentIndexes = headers.map((_, i) => i).filter(i => i !== metadataIndex);
      rows.forEach((row, index) => {
        if (row.every(x => x === '')) return;
        if (!row[headers.indexOf(this.config.questionField)].trim()) {
          throw new Error(name + ': missing question at row ' + (index + 2));
        }
        const fields = contentIndexes.map(i => ({name: headers[i], value: row[i]}));
        all.push(new Card(name, index + 2, fields, row[metadataIndex]));
      });
      return all;
    }, []);
  }
  saveMetadata(sheetName, rowNumber, metadata) {
    const sheet = this.sheet_(this.spreadsheet_(), sheetName);
    if (!Number.isInteger(rowNumber) || rowNumber < 2 || rowNumber > sheet.getLastRow()) throw new Error('Invalid card row. Reload.');
    // Resolve the named metadata column on every write; its position may differ by tab.
    const headers = this.headers_(sheet);
    sheet.getRange(rowNumber, headers.indexOf(this.config.metadataField) + 1).setValue(JSON.stringify(metadata));
    SpreadsheetApp.flush();
  }
  saveNotes(sheetName, rowNumber, value) {
    const sheet = this.sheet_(this.spreadsheet_(), sheetName);
    if (!Number.isInteger(rowNumber) || rowNumber < 2 || rowNumber > sheet.getLastRow()) throw new Error('Invalid notes row.');
    const headers = this.headers_(sheet);
    // Treat notes as literal text, including strings beginning with =.
    sheet.getRange(rowNumber, headers.indexOf(this.config.notesField) + 1).setValue(value.startsWith('=') || value.startsWith("'") ? "'" + value : value);
    SpreadsheetApp.flush();
  }

}
