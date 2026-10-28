function getConfig_() {
  return {
    spreadsheetId: 'PASTE_SPREADSHEET_ID_HERE',
    sheetList: {sheetName: 'db', columnName: 'sheetsa'},
    questionField: 'Word',
    // Reveal these columns in this order. Other columns are ignored by the UI.
    showFields: ['Meaning', 'Example'],
    metadataField: 'Metadata',
    notesField: 'My Sentence', // exact header of your editable notes column
    showSheetName: true,
    timeZone: 'America/Toronto',
    // null = real time. Example test time: '2026-10-25T23:00:00-04:00'
    clock: {fixedNow: null},
    examOrder: 'descending', // 'descending': big to small; 'ascending': small to big
    boxes: {
      'Box 1': 1,
      'Box 2': 3,
      'Box 3': 7,
      'Box 4': 14,
      'Box 5': 30
    }
  };
}
