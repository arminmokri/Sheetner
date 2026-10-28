/** Reads study-tab names fresh for each server request; no cache or redeploy needed. */
class SheetListRepository {
  constructor(config) { this.config = config; }
  readNames() {
    const source = this.config.sheetList;
    if (!source || typeof source.sheetName !== 'string' || !source.sheetName.trim() ||
        typeof source.columnName !== 'string' || !source.columnName.trim()) {
      throw new Error('Configure sheetList.sheetName and sheetList.columnName.');
    }
    const spreadsheet = SpreadsheetApp.openById(this.config.spreadsheetId);
    const sheet = spreadsheet.getSheetByName(source.sheetName);
    if (!sheet) throw new Error('Sheet-list tab not found: ' + source.sheetName);
    const width = sheet.getLastColumn();
    if (!width) throw new Error('Add the header ' + source.columnName + ' to row 1 of ' + source.sheetName + '.');
    const headers = sheet.getRange(1, 1, 1, width).getDisplayValues()[0].map(h => h.trim());
    const matches = headers.map((name, i) => name === source.columnName ? i : -1).filter(i => i >= 0);
    if (matches.length !== 1) throw new Error('Expected one ' + source.columnName + ' header in row 1 of ' + source.sheetName + '.');
    if (sheet.getLastRow() < 2) return [];
    const values = sheet.getRange(2, matches[0] + 1, sheet.getLastRow() - 1, 1).getDisplayValues();
    const names = [...new Set(values.map(row => row[0].trim()).filter(Boolean))];
    if (names.includes(source.sheetName)) throw new Error('Do not include the sheet-list tab itself: ' + source.sheetName);
    for (const name of names) {
      if (!spreadsheet.getSheetByName(name)) throw new Error('Listed study tab not found: ' + name + '. Update ' + source.sheetName + '.');
    }
    return names;
  }
}
