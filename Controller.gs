function doGet() {
  return HtmlService.createTemplateFromFile('Index').evaluate()
    .setTitle('Sheetner').addMetaTag('viewport', 'width=device-width, initial-scale=1');
}
function include_(name) { return HtmlService.createHtmlOutputFromFile(name).getContent(); }
function validateConfig_(config) {
  const names = config.sheetNames;
  if (!Array.isArray(names) || names.some(n => typeof n !== 'string' || !n.trim()) || new Set(names).size !== names.length) {
    throw new Error('Resolved study-tab names must be unique nonempty strings.');
  }
  for (const key of ['questionField', 'metadataField', 'notesField']) {
    if (typeof config[key] !== 'string' || !config[key].trim()) throw new Error('Configure ' + key + '.');
  }
  if (!Array.isArray(config.showFields) || !config.showFields.length ||
      config.showFields.some(f => typeof f !== 'string' || !f.trim()) || new Set(config.showFields).size !== config.showFields.length) {
    throw new Error('Configure showFields as unique nonempty column names.');
  }
  if (config.metadataField === config.questionField || config.showFields.includes(config.metadataField) || config.showFields.includes(config.questionField)) {
    throw new Error('Question, showFields and metadata must be separate columns.');
  }
  if (!config.boxes || typeof config.boxes !== 'object' || Array.isArray(config.boxes)) throw new Error('Configure boxes as name: interval pairs.');
  if (!['ascending', 'descending'].includes(config.examOrder)) throw new Error('examOrder must be ascending or descending.');
  if ([config.questionField, config.metadataField].includes(config.notesField)) throw new Error('notesField must be separate from question and metadata.');
  const entries = Object.entries(config.boxes);
  if (!entries.length || entries.some(([name, days], i) => !name.trim() || /^\d+$/.test(name) || !Number.isInteger(days) || days <= 0 || (i > 0 && days <= entries[i - 1][1]))) {
    throw new Error('Box names must be nonempty, nonnumeric strings with increasing positive day intervals.');
  }
  if (entries[0][1] !== 1) throw new Error('First box must have a 1-day interval.');
  if (typeof config.showSheetName !== 'boolean') throw new Error('showSheetName must be true or false.');
  try { new AppClock(config.clock, config.timeZone).today(); }
  catch (error) { throw new Error('Invalid clock or timeZone: ' + error.message); }
}
function service_() {
  const config = getConfig_();
  config.sheetNames = new SheetListRepository(config).readNames();
  validateConfig_(config);
  const clock = new AppClock(config.clock, config.timeZone);
  return new ReviewService(new SheetCardRepository(config), new LeitnerScheduler(config, clock), config, clock);
}
function apiLoad() { return service_().load(); }
function apiGrade(input) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try { return service_().grade(input); }
  finally { lock.releaseLock(); }
}

function apiInitialize(input) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try { return service_().initialize(input); }
  finally { lock.releaseLock(); }
}

// Optional one-time editor function: remove legacy history, revisions and counters.
// Validate all metadata before writing. Empty cells stay empty.
function simplifyMetadata() {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try { return service_().simplifyMetadata(); }
  finally { lock.releaseLock(); }
}

function apiSaveNotes(input) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try { return service_().saveNotes(input); }
  finally { lock.releaseLock(); }
}
