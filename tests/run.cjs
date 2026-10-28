const fs=require('fs'),vm=require('vm'),path=require('path');
const root=path.join(__dirname,'..'),ctx=vm.createContext({console,Date,Intl});
ctx.Utilities={formatDate:(d,t)=>new Intl.DateTimeFormat('en-CA',{timeZone:t,year:'numeric',month:'2-digit',day:'2-digit'}).format(d)};
for(const f of fs.readdirSync(root).filter(f=>f.endsWith('.gs')))new vm.Script(fs.readFileSync(path.join(root,f),'utf8')).runInContext(ctx);
for(const f of ['ApiClient','ReviewModel','ReviewView','ClipboardService','ReviewController'])new vm.Script(fs.readFileSync(path.join(root,f+'.html'),'utf8').replace(/^<script>\s*|\s*<\/script>\s*$/g,'')).runInContext(ctx);
vm.runInContext(`
const config={spreadsheetId:'test',sheetNames:['Book 1','Book 2'],questionField:'Word',showFields:['Meaning'],metadataField:'Progress',notesField:'My Sentence',showSheetName:true,examOrder:'descending',timeZone:'America/Toronto',boxes:{'Learning':1,'Familiar':3,'Strong':7,'Confident':14,'Mastered':30}};
validateConfig_(config);
let now=new Date('2026-10-26T03:00:00Z');
const scheduler=new LeitnerScheduler(config),stored=new Map(),writes=[];
const repo={readAll:()=>['Book 1','Book 2'].map(name=>new Card(name,2,[{name:'Word',value:name},{name:'Meaning',value:'meaning'}],stored.get(name)||'')),saveMetadata:(name,row,m)=>{stored.set(name,JSON.stringify(m));writes.push({name,row,m});}};
const service=new ReviewService(repo,scheduler,config,{now:()=>now});
function check(ok,msg){if(!ok)throw Error(msg)}
let data=service.load();check(data.dailyCards.length===2&&data.examCards.length===0&&writes.length===0,'Unread daily only');
service.initialize({sheetName:'Book 1',rowNumber:2});
check(JSON.stringify(JSON.parse(stored.get('Book 1')))===JSON.stringify({box:'Learning',nextReviewAt:'2026-10-26'}),'Minimal initial metadata');
service.initialize({sheetName:'Book 1',rowNumber:2});check(writes.length===1,'Repeated reveal must not write');
now=new Date('2026-10-26T11:00:00Z');data=service.load();
check(data.dailyCards.length===1&&data.examCards.length===1&&data.dailyCards[0].sheetName==='Book 2','Due word must be exam only');
const input={sheetName:'Book 1',rowNumber:2,mode:'exam',passed:true};
service.grade(input);data=service.load();check(data.dailyCards.length===1&&data.examCards.length===0,'Passed later stage excluded from daily');
check(JSON.parse(stored.get('Book 1')).box==='Familiar'&&JSON.parse(stored.get('Book 1')).nextReviewAt==='2026-10-29','Named next box interval');
let blocked=false;try{service.grade(input)}catch(e){blocked=true}check(blocked,'Duplicate grade blocked by due check');
now=new Date('2026-10-29T12:00:00Z');service.grade({...input,passed:false});data=service.load();
check(data.dailyCards.length===2&&data.examCards.length===0,'Failed word returns daily immediately');
check(JSON.parse(stored.get('Book 1')).box==='Learning'&&JSON.parse(stored.get('Book 1')).nextReviewAt==='2026-10-30','Failure calendar reset');
now=new Date('2026-10-30T12:00:00Z');data=service.load();check(data.dailyCards.length===1&&data.examCards.length===1,'Failed word moves out of daily when due');
const model=new ReviewModel();model.load(data);model.switchMode('exam');
const failed={...data.examCards[0],metadata:{box:'Learning',nextReviewAt:'2026-10-31'}};
model.complete(failed);check(model.dailyCards.length===2&&model.examCards.length===0,'UI failure return');
model.examCards=[failed];model.complete(failed);check(model.dailyCards.length===2,'No duplicate daily');
const old=JSON.stringify({box:3,nextReviewAt:'2026-11-01',history:[{}],revision:8,correctCount:5});stored.set('Book 2',old);
check(service.load().dailyCards.every(c=>c.sheetName!=='Book 2'),'Legacy numeric box migration');
service.simplifyMetadata();const cleaned=JSON.parse(stored.get('Book 2'));check(cleaned.box==='Strong'&&Object.keys(cleaned).length===2,'Legacy cleanup');
check(scheduler.addDays('2026-11-01',1)==='2026-11-02','DST calendar');
`,ctx);
const elements={};function el(){return {hidden:false,children:[],classList:{toggle(){}},setAttribute(){},replaceChildren(){this.children=[]},append(...x){this.children.push(...x)}}}
ctx.document={getElementById:id=>elements[id]||(elements[id]=el()),querySelectorAll:()=>[],createElement:()=>el()};
vm.runInContext(`const view=new ReviewView();const ui=new ReviewModel();ui.load({...config,boxes:scheduler.boxes,dailyCards:[],examCards:[{sheetName:'Book 1',rowNumber:2,initialized:true,fields:[{name:'Word',value:'one'},{name:'Meaning',value:'first'}],metadata:{box:'Strong',nextReviewAt:'2026-10-30'}}]});ui.switchMode('exam');view.render(ui);check(view.el('levels').children.some(b=>b.textContent==='Strong: 7d (1 word)'),'Named box badge and count');check(view.el('navigation').hidden&&view.el('grading').hidden,'Exam gate');ui.revealed=true;view.render(ui);check(!view.el('grading').hidden,'Reveal grading');`,ctx);
console.log('PASS: exclusive queues at calendar rollover, initialization once, named box advancement, failure return, compact JSON, legacy cleanup, duplicate due checks, UI box labels and reveal gate, DST.');

vm.runInContext(`
const frozen=new AppClock({fixedNow:'2026-10-25T23:00:00-04:00'},'America/Toronto');
check(frozen.today()==='2026-10-25','Frozen local day');
const returned=frozen.now();returned.setUTCFullYear(2000);check(frozen.today()==='2026-10-25','Clock returns fresh Date');
check(new AppClock({fixedNow:'2026-10-26T07:00:00-04:00'},'America/Toronto').today()==='2026-10-26','Next fixed date');
const fixedService=new ReviewService(repo,new LeitnerScheduler(config,frozen),config,frozen);
check(fixedService.load().today==='2026-10-25','Service uses clock object');
let invalid=false;try{new AppClock({fixedNow:'2026-10-25'},'America/Toronto')}catch(e){invalid=true}check(invalid,'Explicit test timezone required');
const loop=new ReviewModel();loop.load({dailyCards:[{id:1},{id:2},{id:3}],examCards:[],boxes:scheduler.boxes});
loop.revealed=true;loop.move(-1);check(loop.index===2&&!loop.revealed,'First to last hides answer');loop.move(1);check(loop.index===0,'Last to first');
loop.switchMode('exam');loop.move(1);check(loop.index===0,'Exam has no navigation');
loop.switchMode('daily');loop.dailyCards=[];loop.move(-1);check(loop.index===0,'Empty queue');loop.dailyCards=[{}];loop.move(-1);check(loop.index===0,'Single card');
`,ctx);
console.log('PASS: injectable fixed clock, fresh Date objects, timezone validation, service clock integration and circular Daily navigation.');
// Guard against accidentally adding system-clock reads outside AppClock.
for(const file of fs.readdirSync(root).filter(f=>/\.(gs|html)$/.test(f)&&f!=='AppClock.gs')) {
 const source=fs.readFileSync(path.join(root,file),'utf8');
 if(/new Date\s*\(\s*\)|Date\.now\s*\(/.test(source))throw Error('System clock read outside AppClock: '+file);
}
vm.runInContext(`
const make=(name,row)=>new Card('Book 1',row,[{name:'Word',value:'word '+row},{name:'Meaning',value:'meaning'}],JSON.stringify({box:name,nextReviewAt:'2026-10-25'}));
const mixed=[make('Learning',2),make('Mastered',3),make('Strong',4),make('Mastered',5),make('Familiar',6)];
const priorityService=new ReviewService({readAll:()=>mixed},new LeitnerScheduler(config),config,{now:()=>new Date('2026-10-26T12:00:00Z')});
const sorted=priorityService.load();
check(sorted.examCards.map(c=>c.metadata.box).join(',')==='Mastered,Mastered,Strong,Familiar,Learning','Server high-box-first');
const priorityModel=new ReviewModel();priorityModel.load({...sorted,examCards:sorted.examCards.slice().reverse()});priorityModel.switchMode('exam');
check(priorityModel.current.metadata.box==='Mastered','Client high-box-first');
view.render(priorityModel);
check(view.el('levels').children[4].textContent==='Mastered: 30d (2 words)','Highest badge first and count');
const passedCard={...priorityModel.current,metadata:{box:'Mastered',nextReviewAt:'2026-11-25'}};
priorityModel.complete(passedCard);view.render(priorityModel);
check(view.el('levels').children[4].textContent==='Mastered: 30d (1 word)','Counts decrease after pass');
check(priorityModel.current.metadata.box==='Mastered','Finish current highest box');
priorityModel.complete({...priorityModel.current,metadata:{box:'Learning',nextReviewAt:'2026-10-27'}});view.render(priorityModel);
check(view.el('levels').children[4].textContent==='Mastered: 30d (0 words)'&&priorityModel.current.metadata.box==='Strong','Proceed to next box');
check(priorityModel.dailyCards.length===1,'Failed high-box word returns daily');
priorityModel.examCards=[];view.render(priorityModel);check(view.el('levels').children.length===5&&!view.el('levels').hidden,'Empty exam still shows counts');
priorityModel.switchMode('daily');view.render(priorityModel);check(view.el('levels').hidden&&view.el('progress').textContent==='Word 1 of 1','Daily counter');
`,ctx);
const markup=fs.readFileSync(path.join(root,'Index.html'),'utf8');
const nav=markup.match(/<nav id="navigation"[\s\S]*?<\/nav>/)[0];
if(!(nav.indexOf('id="previous"')<nav.indexOf('id="progress"')&&nav.indexOf('id="progress"')<nav.indexOf('id="next"')))throw Error('Counter not between navigation buttons');
if(!/<header[^>]*>[\s\S]*Sheetner[\s\S]*id="reload"[\s\S]*<\/header>/.test(markup))throw Error('Reload not beside brand');
for(const file of ['Index.html','ReviewView.html']) {
 const content=fs.readFileSync(path.join(root,file),'utf8');
 for(const removed of ['words left to validate','day interval','Recall the answer, reveal it','Study new and first-stage words','A little progress every day','id="subtitle"','id="level"'])if(content.includes(removed))throw Error('Removed UI copy remains: '+removed);
}
console.log('PASS: server/client highest-box ordering, live remaining counts, zero-count badges, current-box completion, failed daily return, counter placement, header reload and removed copy.');
const currentMarkup=fs.readFileSync(path.join(root,'Index.html'),'utf8');
if(!(currentMarkup.indexOf('id="levels"')<currentMarkup.indexOf('id="empty"')&&currentMarkup.indexOf('id="status"')>currentMarkup.indexOf('</article>')))throw Error('Badge or feedback placement');
if(fs.readFileSync(path.join(root,'ReviewController.html'),'utf8').includes('First-stage exam date:'))throw Error('Initialization note remains');
const uiFlow = (async()=>{
 await vm.runInContext(`(async()=>{
 const card=(value,row,initialized)=>({sheetName:'Book 1',rowNumber:row,initialized,fields:[{name:'Word',value},{name:'Meaning',value:'meaning'}],metadata:{box:initialized?'Learning':null,nextReviewAt:initialized?'2026-10-27':null}});
 const local=new ReviewModel(),localView=new ReviewView();let initCalls=0;
 const api={initialize:async()=>{initCalls++;return {card:card('alpha',2,true)}},grade:async()=>({passed:true,card:{...card('alpha',2,true),metadata:{box:'Familiar',nextReviewAt:'2026-10-29'}}})};
 local.load({...config,boxes:scheduler.boxes,today:'2026-10-26',dailyCards:[card('alpha',2,false),card('beta',3,true)],examCards:[]});
 const controller=new ReviewController(local,localView,api);
 controller.move(1);check(localView.el('status').textContent.includes('Skipped “alpha”')&&initCalls===0,'Skipped unread warning, no initialization');
 controller.move(-1);check(localView.el('status').textContent==='','Read word navigation clears warning');
 await controller.reveal();check(initCalls===1&&localView.el('status').textContent==='','First reveal no date message');
 await controller.reveal();await controller.reveal();check(initCalls===1,'Repeat toggle no initialization');
 local.examCards=[card('alpha',2,true)];local.switchMode('exam');local.revealed=true;
 await controller.grade(true,'pass');
 check(localView.el('status').textContent.includes('You marked “alpha” as known. It is now in Familiar. Its next exam is on 2026-10-29.'),'Exam note identifies submitted word');
 })()`,ctx);
 console.log('PASS: skipped-unread warning without writes, no first-reveal date note, word-specific exam feedback, feedback below card and badges above empty state.');
})().catch(e=>{console.error(e);process.exitCode=1;});

vm.runInContext(`
for (const order of ['ascending','descending']) {
 const options={...config,examOrder:order};
 const result=new ReviewService({readAll:()=>mixed},new LeitnerScheduler(options),options,{now:()=>new Date('2026-10-26T12:00:00Z')}).load();
 const expected=order==='ascending'?'Learning,Familiar,Strong,Mastered,Mastered':'Mastered,Mastered,Strong,Familiar,Learning';
 check(result.examCards.map(c=>c.metadata.box).join(',')===expected,'Server '+order);
 const m=new ReviewModel();m.load({...result,examCards:result.examCards.slice().reverse()});m.switchMode('exam');view.render(m);
 check(m.examCards.map(c=>c.metadata.box).join(',')===expected,'Client '+order);
 check(view.el('levels').children[0].textContent.startsWith('Learning:')&&view.el('levels').children[4].textContent.startsWith('Mastered:'),'Badges always small to big');
}
let badOrder=false;try{validateConfig_({...config,examOrder:'random'})}catch(e){badOrder=true}check(badOrder,'Invalid order rejected');
`,ctx);
console.log('PASS: configurable ascending/descending server and client exam order, always-ascending badge order and Sheetner branding.');
vm.runInContext(`
const noteMeta=JSON.stringify({box:'Learning',nextReviewAt:'2026-11-01'});
let noteText='Original sentence',notesWrites=0;
const noteRepo={readAll:()=>[new Card('Book 2',7,[{name:'Word',value:'note word'},{name:'Meaning',value:'meaning'},{name:'My Sentence',value:noteText}],noteMeta)],saveNotes:(sheet,row,value)=>{check(sheet==='Book 2'&&row===7,'Notes target');notesWrites++;noteText=value;},saveMetadata:()=>{throw Error('Notes must not write metadata')}};
const noteService=new ReviewService(noteRepo,new LeitnerScheduler(config),config,{now:()=>now});
const updated=noteService.saveNotes({sheetName:'Book 2',rowNumber:7,value:'My new sentence',expectedValue:'Original sentence'});
check(updated.card.fields.find(f=>f.name==='My Sentence').value==='My new sentence'&&notesWrites===1,'Save changed note');
noteService.saveNotes({sheetName:'Book 2',rowNumber:7,value:'My new sentence',expectedValue:'Original sentence'});check(notesWrites===1,'Notes retry no extra write');
let noteConflict=false;try{noteService.saveNotes({sheetName:'Book 2',rowNumber:7,value:'Overwrite',expectedValue:'Original sentence'})}catch(e){noteConflict=true}check(noteConflict,'Concurrent notes conflict');
const noteModel=new ReviewModel();noteModel.load({...config,boxes:scheduler.boxes,dailyCards:[updated.card],examCards:[]});noteModel.revealed=true;
view.render(noteModel);check(view.el('saveNotes').disabled,'Unchanged save disabled');
noteModel.setNote('Draft sentence');view.render(noteModel);check(!view.el('saveNotes').disabled,'Changed save enabled');
noteModel.setNote('My new sentence');view.render(noteModel);check(view.el('saveNotes').disabled,'Reverting disables save');
noteModel.setNote('Draft sentence');noteModel.load({...config,boxes:scheduler.boxes,dailyCards:[updated.card],examCards:[]});check(noteModel.noteValue()==='Draft sentence','Draft survives reload within page');
noteModel.notesSaved({...updated.card,fields:updated.card.fields.map(f=>f.name==='My Sentence'?{...f,value:'Draft sentence'}:f)});check(!noteModel.notesDirty(),'Saved draft clean');
`,ctx);
// Test literal notes and named-cell targeting in the real repository.
ctx.SpreadsheetApp={openById:()=>({getSheetByName:()=>({getName:()=> 'Book 2',getLastRow:()=>7,getLastColumn:()=>4,getRange:(row,col,n,w)=>({getDisplayValues:()=>[['Progress','My Sentence','Meaning','Word']],setValue:v=>{if(row!==7||col!==2||v!=="'=SUM(1,2)")throw Error('Unsafe or wrong notes write');}})})}),flush:()=>{}};
vm.runInContext(`new SheetCardRepository(config).saveNotes('Book 2',7,'=SUM(1,2)');`,ctx);
console.log('PASS: notes column targeting, metadata isolation, save dirty-state/revert, drafts, retry safety, concurrent change detection and formula-like literal text.');
let listRows=[['Other','sheetsa'],['ignore',' Book 1 '],['',''],['','Book 2'],['','Book 1']];
let listPresent=true;
ctx.SpreadsheetApp={openById:()=>({getSheetByName:name=>name==='db'?(listPresent?{getLastColumn:()=>listRows[0].length,getLastRow:()=>listRows.length,getRange:(r,c,n,w)=>({getDisplayValues:()=>listRows.slice(r-1,r-1+n).map(row=>row.slice(c-1,c-1+w))})}:null):(['Book 1','Book 2','Book 3'].includes(name)?{}:null)})};
vm.runInContext(`const listing=new SheetListRepository({spreadsheetId:'test',sheetList:{sheetName:'db',columnName:'sheetsa'}});check(listing.readNames().join(',')==='Book 1,Book 2','Named list header, trim and dedup');`,ctx);
listRows=[['sheetsa','Other'],['Book 3',''],['Book 1','']];
vm.runInContext(`check(listing.readNames().join(',')==='Book 3,Book 1','List reread immediately reflects add/remove and column move');`,ctx);
listRows=[['sheetsa']];
vm.runInContext(`check(listing.readNames().length===0,'Empty list supported');validateConfig_({...config,sheetNames:[]});`,ctx);
for(const rows of [[['wrong']],[['sheetsa','sheetsa']],[['sheetsa'],['Missing tab']],[['sheetsa'],['db']]]){
 listRows=rows;
 vm.runInContext(`{let rejected=false;try{listing.readNames()}catch(e){rejected=true}check(rejected,'Bad list rejected');}`,ctx);
}
listPresent=false;
vm.runInContext(`{let rejected=false;try{listing.readNames()}catch(e){rejected=true}check(rejected,'Missing db rejected');}`,ctx);
console.log('PASS: sheet-backed study list, named movable header, blank/duplicate handling, fresh add/remove, empty list, missing-tab/header and self-reference checks.');

(async()=>{
 await uiFlow;
 await vm.runInContext(`(async()=>{
 const m=new ReviewModel();m.load({...config,boxes:scheduler.boxes,dailyCards:[{sheetName:'Book 1',rowNumber:2,initialized:false,fields:[{name:'Word',value:'Full question?\\nخط دوم'},{name:'Meaning',value:'meaning'}],metadata:{}}],examCards:[]});
 let copied=null;const v=new ReviewView();const c=new ReviewController(m,v,{}, {copy:async text=>{copied=text;}});
 await c.copyQuestion();check(copied===m.current.fields[0].value,'Copy full question exactly');check(v.el('status').textContent==='Question copied to clipboard.','Copy feedback');check(!m.current.initialized,'Copy does not initialize');
 m.switchMode('exam');m.examCards=m.dailyCards.slice();copied=null;await c.copyQuestion();check(copied===m.current.fields[0].value,'Exam copy');
 const bad=new ReviewController(m,v,{}, {copy:async()=>{throw Error('Clipboard blocked')}});await bad.copyQuestion();check(v.el('status').textContent==='Clipboard blocked','Copy failure feedback');
 })()`,ctx);
 let clipText;ctx.navigator={clipboard:{writeText:async text=>{clipText=text;}}};
 await vm.runInContext(`new ClipboardService().copy('full text')`,ctx);if(clipText!=='full text')throw Error('Clipboard API');
 console.log('PASS: full-question copying in both modes, no metadata initialization, success/failure feedback and Clipboard API.');
})().catch(e=>{console.error(e);process.exitCode=1;});
