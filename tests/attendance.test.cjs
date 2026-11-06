const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const sheets = new Map();
class Sheet {
  constructor(name) { this.name=name; this.cells=[]; this.maxRows=100; this.protection=null; }
  getLastRow() { for(let i=this.cells.length-1;i>=0;i--)if(this.cells[i].some(x=>x!==''&&x!==undefined&&x!==null))return i+1;return 0; }
  getRange(row,col,height=1,width=1) {
    const self=this;
    return {
      getSheet(){return self;},getRow(){return row;},getColumn(){return col;},getNumRows(){return height;},getNumColumns(){return width;},
      getDisplayValues() { return Array.from({length:height},(_,i)=>Array.from({length:width},(_,j)=>String(self.cells[row+i-1]?.[col+j-1]??''))); },
      setValues(values) { for(let i=0;i<height;i++){const target=row+i-1;while(self.cells.length<=target)self.cells.push([]);for(let j=0;j<width;j++)self.cells[target][col+j-1]=values[i][j];} return this; },
      setValue(value) { return this.setValues([[value]]); },
      clearContent() { for(let i=0;i<height;i++)for(let j=0;j<width;j++)if(self.cells[row+i-1])self.cells[row+i-1][col+j-1]='';return this; },
      setFontWeight() {return this;},setBackground() {return this;},setFontColor() {return this;},setNumberFormat() {return this;}
    };
  }
  setFrozenRows() {}
  getName(){return this.name;} getMaxRows(){return Math.max(this.maxRows,this.cells.length);} getMaxColumns(){return 15;}
  insertRowsAfter(_,count){this.maxRows+=count;}
  getProtections(){return this.protection?[this.protection]:[];}
  protect(){if(!this.protection)this.protection={setDescription(){},setWarningOnly(){},addEditor(){},getEditors(){return [];},removeEditors(){},canDomainEdit(){return false;},setUnprotectedRanges(ranges){this.unprotectedRanges=ranges;}};return this.protection;}
  isSheetHidden(){return false;} hideSheet(){}
}
const spreadsheet = {
  getSheetByName(name) {return sheets.get(name)||null;},
  insertSheet(name) {const s=new Sheet(name);sheets.set(name,s);return s;},
  getSheets(){return [...sheets.values()];},
  getUrl() {return 'https://example.test/sheet';},toast(){}
};
const format=(date,zone,pattern)=>{
  const options={timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'};
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',options).formatToParts(date).map(p=>[p.type,p.value]));
  const day=`${parts.year}-${parts.month}-${parts.day}`;
  if(pattern==='yyyy-MM-dd')return day;
  return `${day}T${parts.hour}:${parts.minute}:${parts.second}+07:00`;
};
let fakeClock='2026-11-05T00:20:00Z';
class FixedDate extends Date {
  constructor(...args) { super(...(args.length?args:[fakeClock])); }
}
const properties=new Map(),cache=new Map();let uuid=0,scopeChecks=0;
const triggers=[];
const context={
  Session:{getActiveUser:()=>({getEmail:()=> 'owner@example.test'}),getEffectiveUser:()=>({getEmail:()=> 'owner@example.test'})},
  PropertiesService:{getScriptProperties:()=>({getProperty:k=>properties.get(k)||null,setProperty:(k,v)=>properties.set(k,v)})},
  CacheService:{getScriptCache:()=>({get:k=>cache.get(k)||null,put:(k,v)=>cache.set(k,v)})},
  SpreadsheetApp:{getActiveSpreadsheet:()=>spreadsheet,flush(){},ProtectionType:{SHEET:'sheet'}},
  ScriptApp:{AuthMode:{FULL:'FULL'},requireAllScopes(mode){assert.equal(mode,'FULL');scopeChecks++;},getProjectTriggers:()=>triggers,newTrigger:handler=>({forSpreadsheet(){return this;},onEdit(){return this;},create(){triggers.push({getHandlerFunction:()=>handler});}})},
  LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},
  Utilities:{formatDate:format,getUuid:()=>`key-${++uuid}`,DigestAlgorithm:{SHA_256:'sha256'},computeDigest:(_,v)=>[...require('crypto').createHash('sha256').update(v).digest()]},
  ContentService:{MimeType:{JSON:'json'},createTextOutput:body=>({body,setMimeType(){return this;}})},
  HtmlService:{createHtmlOutputFromFile:name=>{if(context.lowercaseOnly && name==='Index')throw Error('No HTML file named Index was found.');return {name,setTitle(){return this;}}}},
  Date:FixedDate,Map,Set,Error,JSON,String,Math
};
vm.createContext(context);
vm.runInContext(fs.readFileSync('Code.gs','utf8'),context);
const manifest=JSON.parse(fs.readFileSync('appsscript.json','utf8'));
for(const scope of ['spreadsheets','script.scriptapp','userinfo.email'])assert.ok(manifest.oauthScopes.some(x=>x.endsWith('/'+scope)));
assert.equal(context.uiState_().setupRequired,true);
assert.equal(context.uiState_().classId,'');
spreadsheet.insertSheet('LOP_10X1').getRange(2,3).setValue('Tên nhập trước khi thiết lập xong');

context.setupAttendanceSheets();
assert.equal(scopeChecks,1);
assert.equal(context.uiState_('10X1').roster[0].name,'Tên nhập trước khi thiết lập xong');
assert.match(context.uiState_('10X1').roster[0].code,/^HS\d{6,}$/);
assert.equal(triggers.length,1);
assert.equal(sheets.get('LOP_DEFAULT').protection.unprotectedRanges[0].getRow(),2);
assert.equal(sheets.get('LOP').protection.unprotectedRanges.length,0);
context.setupAttendanceSheets();assert.equal(triggers.length,1);
properties.set('ADMIN_PASSWORD','example-test-password');
assert.throws(()=>context.uiRequest('bad','uiState',[]),/hết hạn/);
assert.throws(()=>context.uiLogin('wrong'),/không đúng/);
const token=context.uiLogin('example-test-password').token;
const ui=(name,...args)=>context.uiRequest(token,name,args);
assert.equal(ui('uiState','MISSING').classId,'10X1');
// Chuẩn bị lớp và nhập học sinh phải hoạt động trước khi ESP32 được kết nối.
assert.equal(ui('uiState','DEFAULT').devices[0].online,false);
ui('uiAddClass','OFFLINE','Lớp chưa có mạch');
const offlineStudent=ui('uiSaveStudent','OFFLINE','','','Học sinh nhập thủ công',true);
assert.match(offlineStudent.code,/^HS\d{6,}$/);
assert.equal(ui('uiState','OFFLINE').roster[0].name,'Học sinh nhập thủ công');
assert.throws(()=>ui('uiFingerprintCommand','OFFLINE',offlineStudent.code,'ENROLL','ESP01'),/trực tuyến/);
const offlineSheet=sheets.get('LOP_OFFLINE');
assert.equal(offlineSheet.protection.unprotectedRanges[0].getRow(),3);
assert.equal(offlineSheet.protection.unprotectedRanges[0].getColumn(),3);
offlineSheet.getRange(3,3).setValue('Trần Văn B');
context.handleRosterEdit({range:offlineSheet.getRange(3,3)});
const sheetAdded=ui('uiStudentRows','OFFLINE').find(x=>x.name==='Trần Văn B');
assert.match(sheetAdded.code,/^HS\d{6,}$/);
assert.notEqual(sheetAdded.code,offlineStudent.code);
assert.equal(offlineSheet.protection.unprotectedRanges[0].getRow(),4);
offlineSheet.getRange(4,3,2,1).setValues([['Lê Văn C'],['Đỗ Văn D']]);
context.handleRosterEdit({range:offlineSheet.getRange(4,3,2,1)});
assert.equal(ui('uiStudentRows','OFFLINE').length,4);
assert.equal(offlineSheet.protection.unprotectedRanges[0].getRow(),6);
// Seed pre-upgrade IDs to verify existing fingerprints/history remain compatible.
const legacyStudent=(cl,id,code,name,active)=>{context.add_('LOP_'+cl,['id','code','name','active','stt'],[[id||code,code,name,active,1]]);context.bumpVersion_(cl);};
ui('uiAddClass','10A2','Lớp 10A2');
legacyStudent('10A2','A1','A1','Nguyễn Văn A',true);
legacyStudent('10A2','B2','B2','Trần B',true);
const d1=ui('devices','ESP01','Cổng 1',true,true,'LOP'),d2=ui('devices','ESP02','Cổng 2',true,true,'LOP');
ui('uiSelectClass','10A2','ESP01');ui('uiSelectClass','10A2','ESP02');
assert.throws(()=>ui('uiStartSession','10A2','SANG','07:15'),/trực tuyến/);
const api=(device,action,extra={})=>JSON.parse(context.doPost({postData:{contents:JSON.stringify({deviceId:device.deviceId,deviceKey:device.key,action,...extra})}}).body);
assert.equal(api({...d1,key:'invalid'},'control').ok,false);
assert.equal(api(d1,'control',{currentClass:'10A2'}).ok,true);
assert.equal(api(d2,'control',{currentClass:'10A2'}).ok,true);
const morning=ui('uiStartSession','10A2','SANG','07:15');
assert.equal(sheets.get('LOP_10A2').protection.unprotectedRanges.length,0);
assert.throws(()=>ui('uiSaveStudent','10A2','A1','A1','Đổi tên',true),/kết thúc/);
assert.equal(api(d1,'start',{classId:'10A2'}).ok,false);
assert.equal(api(d1,'checkin',{classId:'10A2',studentId:'A1',sessionId:'old'}).ok,false);
const scan=api(d1,'checkin',{classId:'10A2',studentId:'A1',sessionId:morning.sessionId});
assert.equal(scan.status,'LATE');
const originalTime=sheets.get('CHITIET_BUOI').cells[1][7];
assert.equal(api(d2,'checkin',{classId:'10A2',studentId:'A1',sessionId:morning.sessionId}).duplicate,true);
assert.equal(sheets.get('CHITIET_BUOI').cells[1][7],originalTime);
assert.equal(ui('uiCloseSession',morning.sessionId).absent,1);
assert.equal(sheets.get('LOP_10A2').protection.unprotectedRanges.length,1);
assert.equal(sheets.get('TONG_TUAN').cells[1][7],'Trần B (1)');
ui('excuse',{sessionId:morning.sessionId,studentId:'B2',note:'Phụ huynh xin phép'});
assert.equal(sheets.get('CHITIET_BUOI').cells[2][6],'EXCUSED');
assert.ok(sheets.get('NHATKY').getLastRow()>1);
const afternoon=ui('uiStartSession','10A2','CHIEU','13:15');
assert.equal(api(d2,'checkin',{classId:'10A2',studentId:'A1',sessionId:afternoon.sessionId}).status,'PRESENT');
ui('uiCloseSession',afternoon.sessionId);
assert.equal(sheets.get('BUOIDIEMDANH').getLastRow(),3);
assert.equal([...sheets.keys()].some(n=>n.startsWith('DD_')),false);
ui('view',morning.sessionId);const size=sheets.size;ui('view',afternoon.sessionId);assert.equal(sheets.size,size);
assert.ok(sheets.get('TUAN_7_NGAY').cells[1].join(' ').includes('Sáng: Đi học trễ'));
assert.ok(sheets.get('TUAN_7_NGAY').cells[1].join(' ').includes('Chiều: Đúng giờ'));
const cmd=ui('uiFingerprintCommand','10A2','A1','ENROLL','ESP02');
assert.equal(api(d1,'control',{currentClass:'10A2'}).command,null);
assert.equal(api(d2,'control',{currentClass:'10A2'}).command.id,cmd.commandId);
assert.equal(api(d1,'commandUpdate',{commandId:cmd.commandId,status:'DONE'}).ok,false);
assert.equal(api(d2,'commandUpdate',{commandId:cmd.commandId,status:'DONE'}).ok,true);
ui('devices','ESP02','Cổng 2',false,false);assert.equal(api(d2,'control').ok,false);
assert.throws(()=>ui('uiImportRoster','10A2','studentId,studentCode,studentName,active\nC3,C3,Khác,true'),/hệ thống tự cấp/);
assert.equal(context.doGet({parameter:{sts:'read',classId:'10A2'}}).body.includes('false'),true);
assert.equal(ui('uiState','10A2').devices.length,2);
ui('uiAddClass','10B1','Lớp 10B1');
legacyStudent('10B1','X1','X1','Học sinh đúng giờ',true);
legacyStudent('10B1','X2','X2','Học sinh trễ',true);
ui('uiSelectClass','10B1','ESP01');
fakeClock='2026-11-05T03:00:00Z';
api(d1,'control',{currentClass:'10B1'});
const boundary=ui('uiStartSession','10B1','SANG','10:00');
assert.equal(api(d1,'control',{currentClass:'10B1'}).session.sessionId,boundary.sessionId);
assert.equal(api(d1,'checkin',{classId:'10B1',studentId:'X1',sessionId:boundary.sessionId}).status,'PRESENT');
fakeClock='2026-11-05T03:00:01Z';
assert.equal(api(d1,'checkin',{classId:'10B1',studentId:'X2',sessionId:boundary.sessionId,scannedAt:'2026-11-05T07:00:00+07:00'}).status,'LATE');
ui('uiCloseSession',boundary.sessionId);
fakeClock='2026-11-05T03:01:00Z';
assert.equal(ui('uiState','10B1').devices.find(d=>d.deviceId==='ESP01').online,false);
assert.throws(()=>ui('uiStartSession','10B1','CHIEU','13:15'),/trực tuyến/);
const historyCount=sheets.get('CHITIET_BUOI').getLastRow();context.setupAttendanceSheets();assert.equal(sheets.get('CHITIET_BUOI').getLastRow(),historyCount);
// Một ESP32, học sinh hai lớp quét xen kẽ, hai buổi trong ngày.
fakeClock='2026-11-06T00:00:00Z';
ui('uiAddClass','10C1','Lớp 10C1');ui('uiAddClass','10C2','Lớp 10C2');
legacyStudent('10C1','','HS001','Học sinh lớp C1',true);
legacyStudent('10C2',null,'HS001','Học sinh lớp C2',true);
assert.equal(ui('uiStudentRows','10C1')[0].studentId,'HS001');
assert.equal(ui('uiStudentRows','10C2')[0].code,'HS001');
ui('devices','ESP01','Cổng chung KHKT',true,false,'CONG');
const gateVersion=api(d1,'control',{currentClass:'10B1',currentVersion:0}).rosterVersion;
assert.throws(()=>ui('uiStartSession','10C1','SANG','07:15'),/trực tuyến/);
api(d1,'control',{currentClass:'10B1',currentVersion:gateVersion});
const gateRoster=api(d1,'read');
assert.ok(gateRoster.students.some(s=>s.classId==='10C1'&&s.code==='HS001'));
assert.ok(gateRoster.students.some(s=>s.classId==='10C2'&&s.code==='HS001'));
for(const period of ['SANG','CHIEU']){
  if(period==='CHIEU'){fakeClock='2026-11-06T06:00:00Z';api(d1,'control',{currentClass:'10B1',currentVersion:gateVersion});}
  const c1=ui('uiStartSession','10C1',period,period==='SANG'?'07:15':'13:15');
  const c2=ui('uiStartSession','10C2',period,period==='SANG'?'07:15':'13:15');
  const shared=api(d1,'control',{currentClass:'10B1',currentVersion:gateVersion});
  assert.equal(shared.sessions['10C1'].sessionId,c1.sessionId);
  assert.equal(shared.sessions['10C2'].sessionId,c2.sessionId);
  assert.equal(api(d1,'checkin',{classId:'10C2',studentId:'HS001',sessionId:c2.sessionId}).ok,true);
  assert.equal(api(d1,'checkin',{classId:'10C1',studentId:'HS001',sessionId:c1.sessionId}).ok,true);
  assert.equal(api(d1,'checkin',{classId:'10C1',studentId:'HS001',sessionId:c2.sessionId}).ok,false);
  ui('uiCloseSession',c1.sessionId);ui('uiCloseSession',c2.sessionId);
}
const gateCommand=ui('uiFingerprintCommand','10C2','HS001','ENROLL','ESP01');
assert.equal(api(d1,'control',{currentClass:'10B1',currentVersion:gateVersion}).command.classId,'10C2');
assert.equal(api(d1,'commandUpdate',{commandId:gateCommand.commandId,status:'DONE'}).ok,true);
assert.equal(sheets.get('BUOIDIEMDANH').cells.filter(r=>r[1]==='10C1').length,2);
assert.equal(sheets.get('BUOIDIEMDANH').cells.filter(r=>r[1]==='10C2').length,2);
// Mã tự cấp, khóa chỉnh sửa, sắp tên tiếng Việt và STT không làm đổi mã cũ.
ui('uiAddClass','AUTO','Lớp tự cấp mã');
assert.throws(()=>ui('uiSaveStudent','AUTO','','MANUAL','Không cho nhập mã',true),/tự cấp/);
const binh=ui('uiSaveStudent','AUTO','','','Nguyễn Văn Bình',true);
const an=ui('uiSaveStudent','AUTO','','','Trần Văn An',true);
assert.match(binh.code,/^HS\d{6,}$/);assert.notEqual(binh.code,an.code);
let alphabetical=ui('uiStudentRows','AUTO');
assert.equal(alphabetical[0].name,'Trần Văn An');assert.equal(alphabetical[0].stt,1);
assert.equal(sheets.get('LOP_AUTO').cells[1][1],an.code);assert.equal(sheets.get('LOP_AUTO').cells[1][4],1);
assert.throws(()=>ui('uiSaveStudent','AUTO',binh.studentId,'CHANGED','Nguyễn Văn Bình',true),/không được sửa/);
ui('uiSaveStudent','AUTO',binh.studentId,binh.code,'Nguyễn Văn Anh',true);
assert.equal(ui('uiStudentRows','AUTO').find(x=>x.studentId===binh.studentId).code,binh.code);
const other=ui('uiSaveStudent','10C1','','','Một học sinh khác',true);assert.notEqual(other.code,an.code);
ui('uiImportRoster','AUTO','ho_ten\nLê Văn Cường\nĐỗ Văn Dũng');
assert.equal(ui('uiStudentRows','AUTO').length,4);
assert.throws(()=>ui('uiImportRoster','AUTO','ma_hoc_sinh,ho_ten\nFAKE,Không có mã'),/tự cấp/);
ui('uiImportRoster','AUTO','ma_hoc_sinh,ho_ten\n'+an.code+',Trần Văn An');
assert.equal(ui('uiStudentRows','AUTO').length,4);
assert.throws(()=>ui('uiImportRoster','AUTO','ma_hoc_sinh,ho_ten\n'+an.code+',Tên không được ghi\nFAKE,Mã giả'),/tự cấp/);
assert.equal(ui('uiStudentRows','AUTO').find(x=>x.code===an.code).name,'Trần Văn An');
const codesBefore=ui('uiStudentRows','AUTO').map(x=>x.code).sort().join(',');context.setupAttendanceSheets();assert.equal(ui('uiStudentRows','AUTO').map(x=>x.code).sort().join(','),codesBefore);
// Nhiều ngón cùng một người: telemetry là số tuyệt đối, không tạo thêm học sinh.
const key='AUTO|'+an.code,counts={[key]:2};
assert.equal(api(d1,'control',{currentClass:'10B1',fingerprints:counts}).ok,true);
let fingerState=ui('uiState','AUTO');assert.equal(fingerState.fingerprints.find(x=>x.code===an.code).count,2);
assert.ok(sheets.get('LOP_AUTO').cells.find(r=>r[1]===an.code)[5].includes('ESP01: 2 ngón'));
assert.equal(fingerState.roster.length,4);
api(d1,'control',{currentClass:'10B1',fingerprints:counts});assert.equal(sheets.get('VANTAY').getLastRow(),2);
api(d1,'control',{currentClass:'10B1',fingerprints:{[key]:3}});assert.equal(ui('uiState','AUTO').fingerprints[0].count,3);
assert.equal(api(d1,'control',{currentClass:'10B1',fingerprints:{[key]:-1}}).ok,false);
assert.equal(ui('uiState','AUTO').fingerprints[0].count,3);
api(d1,'control',{currentClass:'10B1',fingerprints:{}});assert.equal(ui('uiState','AUTO').fingerprints.length,0);
assert.ok(sheets.get('LOP_AUTO').cells.find(r=>r[1]===an.code)[5].includes('ESP01: 0 ngón'));
const latestVersion=api(d1,'control',{currentClass:'10B1'}).rosterVersion;
api(d1,'control',{currentClass:'10B1',currentVersion:latestVersion});
const fingerSession=ui('uiStartSession','AUTO','CHIEU','13:15');
assert.equal(api(d1,'checkin',{classId:'AUTO',studentId:an.studentId,sessionId:fingerSession.sessionId,fingerId:10}).duplicate,false);
assert.equal(api(d1,'checkin',{classId:'AUTO',studentId:an.studentId,sessionId:fingerSession.sessionId,fingerId:11}).duplicate,true);
ui('uiCloseSession',fingerSession.sessionId);ui('view',fingerSession.sessionId);
assert.equal(sheets.get('XEM_BUOI').cells[1][0],1);
assert.equal(sheets.get('XEM_BUOI').cells[1][5],'Trần Văn An');
// Xóa tab lớp trong Google Sheet phải làm lớp biến mất khỏi web, không tự tạo lại.
const beforeDelete=ui('uiRevision').revision;
sheets.delete('LOP_10X1');
assert.notEqual(ui('uiRevision').revision,beforeDelete);
assert.equal(ui('uiState','10X1').classes.some(c=>c.id==='10X1'),false);
assert.notEqual(ui('uiState','10X1').classId,'10X1');
context.setupAttendanceSheets();
assert.equal(sheets.has('LOP_10X1'),false);
ui('uiSaveStudent','OFFLINE','','','Thêm sau khi xóa lớp khác',true);
assert.equal(sheets.has('LOP_10X1'),false);
const newInstance=ui('uiAddClass','10X1','Lớp mới cùng mã');
assert.notEqual(newInstance.classId,'10X1');
assert.equal(newInstance.code,'10X1');
assert.equal(sheets.has('LOP_10X1'),false);
assert.equal(sheets.has('LOP_'+newInstance.classId),true);
ui('uiImportRoster',newInstance.classId,'ma_lop,ten_lop,ho_ten\n10X1,Lớp mới cùng mã,Học sinh lớp mới');
assert.equal(ui('uiStudentRows',newInstance.classId)[0].name,'Học sinh lớp mới');
assert.equal(ui('uiState',newInstance.classId).classes.find(c=>c.id===newInstance.classId).code,'10X1');
assert.equal(ui('uiState',newInstance.classId).sessions.length,0);
console.log('PASS: direct Sheet name entry and protected input area, automatic immutable codes, Vietnamese order/STT, migration, CSV, multiple fingers, shared gate, attendance reports');
