// Google Apps Script: bind to the attendance spreadsheet, run setupAttendanceSheets,
// then deploy this project as a web app. The old script_google_sheet.h is legacy.
const H = {
  LOP: ["Định danh lớp","Tên lớp","Tab danh sách","Đang dùng","Phiên bản","Mã lớp hiển thị"],
  BUOIDIEMDANH: ['Mã buổi','Mã lớp','Ngày','Buổi','Bắt đầu','Hạn đúng giờ','Kết thúc','Trạng thái'],
  CHITIET_BUOI: ["Mã buổi","Mã lớp","Ngày","Định danh học sinh","Mã học sinh","Họ tên","Trạng thái","Giờ vào máy chủ","Lý do"],
  DIEMDANH: ['Mã lượt quét','Mã buổi','Mã lớp','Định danh học sinh','Giờ nhận máy chủ','Trạng thái','Mã thiết bị'],
  TONG_TUAN: ['Tuần','Tuần bắt đầu','Tuần kết thúc','Lớp','Số buổi','Lượt có mặt','Lượt vắng','Tên học sinh vắng','Lượt trễ','Tên học sinh trễ','Vắng có phép','Tỷ lệ có mặt'],
  TUAN_7_NGAY: ['Tuần','Lớp','Mã HS','Họ tên','Thứ 2','Thứ 3','Thứ 4','Thứ 5','Thứ 6','Thứ 7','Chủ nhật','Có mặt','Vắng','Trễ','Có phép','STT theo tên A–Z'],
  DSVANG: ['Ngày','Buổi','Lớp','Mã HS','Họ tên','Trạng thái'],
  THIETBI: ["Mã thiết bị","Lớp được giao","Liên hệ gần nhất","Thông báo","Lớp đã đồng bộ","Cho phép hoạt động","Tên thiết bị","Chế độ","Phiên bản đã đồng bộ"],
  LENH: ['Mã lệnh','Mã lớp','Mã học sinh','Thao tác','Trạng thái','Thông báo','Cập nhật','Mã thiết bị'],
  NHATKY: ['Thời gian','Người thực hiện','Thao tác','Đối tượng','Nội dung'],
  VANTAY: ['Mã thiết bị','Mã lớp','Mã học sinh','Số ngón đã đăng ký','Lần xác nhận']
};
const ROSTER = ['Định danh học sinh','Mã học sinh','Họ tên','Đang học','STT theo tên A–Z','Số ngón tay đã xác nhận'];
function compareStudent_(a,b){
  const name=x=>String(x.name||'').trim().replace(/\s+/g,' '),an=name(a),bn=name(b);
  return an.split(' ').pop().localeCompare(bn.split(' ').pop(),'vi',{sensitivity:'base'})||an.localeCompare(bn,'vi',{sensitivity:'base'})||String(a.code).localeCompare(String(b.code));
}
function sortedRosterRows_(rows){return rows.slice().sort((a,b)=>compareStudent_({name:a[2],code:a[1]},{name:b[2],code:b[1]})).map((r,i)=>[r[0],r[1],r[2],yes_(r[3]),i+1]);}
function fingerprintSummary_(classId){
  const devices=data_('THIETBI',H.THIETBI).map(r=>r[0]).filter(id=>props_().getProperty('FINGERPRINT_COUNTS_'+id));
  const counts=new Map(data_('VANTAY',H.VANTAY).filter(r=>r[1]===classId).map(r=>[r[0]+'|'+r[2],Number(r[3])]));
  return code=>devices.length?devices.map(id=>id+': '+(counts.get(id+'|'+code)||0)+' ngón').join('; '):'Chưa có dữ liệu từ thiết bị';
}
function writeRoster_(cl,rows){
  const classId=cl.classId||data_('LOP',H.LOP).find(r=>r[2]===cl.name)?.[0]||'DEFAULT';
  const summary=fingerprintSummary_(classId);
  const sheet=replace_(cl.name,ROSTER,sortedRosterRows_(rows.filter(r=>r[0]&&r[1])).map(r=>[...r,summary(r[1])]));
  protectSheet_(sheet,classId);
  return sheet;
}
function allocateStudentCodes_(count){
  if(!count)return [];
  let last=Number(props_().getProperty('STUDENT_SEQUENCE'))||0;
  data_('LOP',H.LOP).filter(cl=>SpreadsheetApp.getActiveSpreadsheet().getSheetByName(cl[2])).forEach(cl=>data_(cl[2],ROSTER).forEach(r=>{for(const code of [r[0],r[1]]){const m=/^HS(\d+)$/.exec(code);if(m)last=Math.max(last,Number(m[1]));}}));
  const next=last+count;if(!Number.isSafeInteger(next))throw Error('Bộ đếm mã học sinh vượt giới hạn');
  props_().setProperty('STUDENT_SEQUENCE',String(next));return Array.from({length:count},(_,i)=>'HS'+String(last+i+1).padStart(6,'0'));
}
function nextStudentCode_(){return allocateStudentCodes_(1)[0];}
const TZ = 'Asia/Bangkok';
const LABELS_={PENDING:'Chưa điểm danh',PRESENT:'Đúng giờ',LATE:'Đi học trễ',ABSENT:'Vắng không phép',EXCUSED:'Vắng có phép',OPEN:'Đang mở',CLOSED:'Đã kết thúc',ENROLL:'Đăng ký vân tay',DELETE:'Xóa vân tay',RUNNING:'Đang thực hiện',DONE:'Hoàn thành',FAILED:'Thất bại'};
const PERIODS_={SANG:'Sáng',CHIEU:'Chiều',TOI:'Tối',NGAY:'Cả ngày (cũ)'};
function sessionRow_(r){return {sessionId:r[0],classId:r[1],day:r[2],period:r[3],startTime:r[4],lateAfter:r[5],endTime:r[6],status:r[7]};}
function props_(){return PropertiesService.getScriptProperties();}
function bump_(){props_().setProperty('REVISION',Utilities.getUuid());}
function revision_(){return (props_().getProperty('REVISION')||'0')+'|'+classCatalogVersion_();}
function audit_(action,target,note){add_('NHATKY',H.NHATKY,[[stamp_(),'Quản trị dashboard',action,target,String(note||'')]]);bump_();}
function requireSetupOwner_(){const active=Session.getActiveUser().getEmail(),owner=Session.getEffectiveUser().getEmail();if(!active||active!==owner)throw Error('Chạy thiết lập trực tiếp trong trình soạn thảo bằng tài khoản chủ triển khai');}
function uiLogin(password){
  const cache=CacheService.getScriptCache(),attempts=Number(cache.get('loginAttempts')||0);
  if(attempts>=15)throw Error('Tạm khóa đăng nhập, thử lại sau 5 phút');
  const secret=props_().getProperty('ADMIN_PASSWORD');
  if(!secret||secret.length<12)throw Error('Chủ triển khai cần đặt ADMIN_PASSWORD tối thiểu 12 ký tự trong Script Properties');
  if(hash_(String(password))!==hash_(secret)){cache.put('loginAttempts',String(attempts+1),300);throw Error('Mật khẩu không đúng');}
  const token=Utilities.getUuid()+Utilities.getUuid();cache.put('admin:'+hash_(token),'1',3600);return {token};
}
function hash_(text){return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,String(text)).map(b=>(b&255).toString(16).padStart(2,'0')).join('');}
function uiRequest(token,method,args){
  if(!token||!CacheService.getScriptCache().get('admin:'+hash_(token)))throw Error('Phiên đăng nhập hết hạn, vui lòng đăng nhập lại');
  const routes={uiState:uiState_,uiRevision:uiRevision_,uiSelectClass:uiSelectClass_,uiStartSession:uiStartSession_,uiCloseSession:uiCloseSession_,uiAddClass:uiAddClass_,uiStudentRows:uiStudentRows_,uiSaveStudent:uiSaveStudent_,uiDeactivateStudent:uiDeactivateStudent_,uiImportRoster:uiImportRoster_,uiFingerprintCommand:uiFingerprintCommand_,devices:uiDeviceSave_,view:uiSessionView_,excuse:p=>excuse_(p)};
  if(!routes[method])throw Error('Thao tác không được phép');
  const result=routes[method](...(args||[]));
  if(!['uiState','uiRevision','uiStudentRows'].includes(method))bump_();return result;
}
function uiDeviceSave_(id,label,enabled,rotate,mode){return lock_(()=>{
  id=id_(id);const rows=data_('THIETBI',H.THIETBI),i=rows.findIndex(r=>r[0]===id);let key='';
  mode=mode||(i>=0?rows[i][7]:'CONG')||'CONG';if(!['LOP','CONG'].includes(mode))throw Error('Chế độ thiết bị không hợp lệ');
  if(i<0)add_('THIETBI',H.THIETBI,[[id,'DEFAULT','','Chưa kết nối','',!!enabled,String(label||id),mode,0]]);
  else sh_('THIETBI',H.THIETBI).getRange(i+2,6,1,2).setValues([[!!enabled,sheetText_(String(label||id))]]);
  if(i>=0)sh_('THIETBI',H.THIETBI).getRange(i+2,8).setValue(mode);
  if(i<0||rotate){key=Utilities.getUuid()+Utilities.getUuid();props_().setProperty('DEVICE_KEY_'+id,hash_(key));}
  audit_('Cấu hình thiết bị',id,enabled?'Cho phép hoạt động':'Tạm dừng');return {deviceId:id,key};
});}
function authenticateDevice_(p){const d=device_(id_(p.deviceId));if(!d.enabled)throw Error('Thiết bị đã tạm dừng');const expected=props_().getProperty('DEVICE_KEY_'+d.deviceId);if(!expected||!p.deviceKey||hash_(p.deviceKey)!==expected)throw Error('Khóa thiết bị không hợp lệ');return d;}
function control_(p,d){return lock_(()=>{
  const rows=data_('THIETBI',H.THIETBI),i=rows.findIndex(r=>r[0]===d.deviceId);
  sh_('THIETBI',H.THIETBI).getRange(i+2,3,1,3).setValues([[stamp_(),sheetText_(String(p.message||'Đã kết nối').slice(0,120)),sheetText_(String(p.currentClass||'').slice(0,32))]]);
  sh_('THIETBI',H.THIETBI).getRange(i+2,9).setValue(Number(p.currentVersion)||0);
  if(p.fingerprints!==undefined)syncFingerprintCounts_(p,d);
  return {classId:d.classId,mode:d.mode,rosterVersion:deviceVersion_(d),session:session_(d.classId),sessions:deviceSessions_(d),command:pendingCommand_(d.classId,d.deviceId,d.mode)};
});}
function deviceClasses_(d){return data_('LOP',H.LOP).filter(r=>yes_(r[3])&&SpreadsheetApp.getActiveSpreadsheet().getSheetByName(r[2])&&(d.mode==='CONG'||r[0]===d.classId));}
function deviceVersion_(d){const classes=deviceClasses_(d);return d.mode==='CONG'?classes.reduce((n,r)=>n+(Number(r[4])||1),0):(classes.length?Number(classes[0][4])||1:0);}
function deviceSessions_(d){const result={};deviceClasses_(d).forEach(r=>{const open=session_(r[0]);if(open)result[r[0]]=open;});return result;}
function deviceReady_(d,classId){return d.enabled&&d.online&&(d.mode==='CONG'?d.syncedVersion===deviceVersion_(d):d.classId===classId&&d.actualClassId===classId);}
function deviceRoster_(d){const students=deviceClasses_(d).flatMap(r=>roster_(r[0]));if(students.length>200)throw Error('Bản ESP32 này đồng bộ tối đa 200 học sinh đang học; hãy giảm danh sách hoặc dùng chế độ theo lớp');return {version:deviceVersion_(d),students};}
function syncFingerprintCounts_(p,d){
  const counts=p.fingerprints;if(!counts||typeof counts!=='object'||Array.isArray(counts))throw Error('Danh sách vân tay không hợp lệ');
  const entries=Object.entries(counts);if(entries.length>200)throw Error('Quá nhiều ánh xạ vân tay');
  const rows=entries.map(([key,count])=>{const parts=key.split('|');if(parts.length!==2||!Number.isInteger(count)||count<1||count>1000)throw Error('Số ngón tay không hợp lệ');return [d.deviceId,id_(parts[0]),id_(parts[1]),count,stamp_()];});
  const signature=hash_(JSON.stringify(entries.sort((a,b)=>a[0].localeCompare(b[0]))));
  if(props_().getProperty('FINGERPRINT_COUNTS_'+d.deviceId)===signature)return;
  replace_('VANTAY',H.VANTAY,[...data_('VANTAY',H.VANTAY).filter(r=>r[0]!==d.deviceId),...rows]);
  props_().setProperty('FINGERPRINT_COUNTS_'+d.deviceId,signature);
  data_('LOP',H.LOP).filter(cl=>SpreadsheetApp.getActiveSpreadsheet().getSheetByName(cl[2])).forEach(cl=>{const students=data_(cl[2],ROSTER),summary=fingerprintSummary_(cl[0]);if(students.length)sh_(cl[2],ROSTER).getRange(2,6,students.length,1).setValues(students.map(r=>[summary(r[1])]));});bump_();
}
function uiSessionView_(sessionId){
  const session=data_('BUOIDIEMDANH',H.BUOIDIEMDANH).find(r=>r[0]===sessionId);if(!session)throw Error('Không tìm thấy buổi');
  const rows=data_('CHITIET_BUOI',H.CHITIET_BUOI).filter(r=>r[0]===sessionId).sort((a,b)=>compareStudent_({name:a[5],code:a[4]},{name:b[5],code:b[4]})).map(r=>[r[2],PERIODS_[session[3]]||session[3],r[1],r[4],r[5],LABELS_[r[6]]||r[6],r[7]?r[7].slice(11,19):'',r[8]]);
  replace_('XEM_BUOI',['STT','Ngày','Buổi','Lớp','Mã học sinh','Họ tên','Trạng thái','Giờ vào (không sửa)','Lý do'],rows.map((r,i)=>[i+1,...r]));protectSheets_();return {count:rows.length};
}
function protectSheets_(){
  const ss=SpreadsheetApp.getActiveSpreadsheet();
  const classes=new Map(data_('LOP',H.LOP).map(r=>[r[2],r[0]]));
  ss.getSheets().forEach(s=>{
    if(!H[s.getName()]&&!/^LOP_/.test(s.getName())&&s.getName()!=='XEM_BUOI'&&s.getName()!=='DANHSACH')return;
    protectSheet_(s,classes.get(s.getName()));
  });
}
function protectSheet_(s,classId){
  const protections=s.getProtections(SpreadsheetApp.ProtectionType.SHEET),p=protections[0]||s.protect();
  p.setDescription(classId?'Chỉ nhập tên học sinh ở vùng trống cột C; mã và STT do hệ thống cấp':'Hệ thống điểm danh: nhập và sửa qua dashboard');
  p.setWarningOnly(false);
  const owner=Session.getEffectiveUser(),ownerEmail=owner.getEmail();
  p.addEditor(owner);
  const otherEditors=ownerEmail?p.getEditors().filter(editor=>editor.getEmail()!==ownerEmail):[];
  if(otherEditors.length)p.removeEditors(otherEditors);
  if(p.canDomainEdit())p.setDomainEdit(false);
  if(classId){
    const registered=data_(s.getName(),ROSTER).filter(r=>r[0]&&r[1]).length;
    const first=registered+2;
    if(s.getMaxRows()<first){capacity_();s.insertRowsAfter(s.getMaxRows(),first-s.getMaxRows());}
    const input=s.getRange(first,3,s.getMaxRows()-first+1,1);
    input.setNumberFormat('@');
    p.setUnprotectedRanges(session_(classId)?[]:[input]);
  }else p.setUnprotectedRanges([]);
  if(['BUOIDIEMDANH','CHITIET_BUOI','DIEMDANH','LENH','THIETBI','NHATKY','LOP','VANTAY'].includes(s.getName())&&!s.isSheetHidden())s.hideSheet();
}
function installRosterEditTrigger_(){
  if(!ScriptApp.getProjectTriggers().some(t=>t.getHandlerFunction()==='handleRosterEdit'))
    ScriptApp.newTrigger('handleRosterEdit').forSpreadsheet(SpreadsheetApp.getActiveSpreadsheet()).onEdit().create();
}
function materializePendingNames_(cl){
  if(session_(cl.classId))return 0;
  const rows=data_(cl.name,ROSTER),pending=rows.filter(r=>!r[0]&&!r[1]&&String(r[2]||'').trim());
  if(!pending.length)return 0;
  if(pending.length>500)throw Error('Mỗi lần chỉ nhập tối đa 500 học sinh');
  const names=pending.map(r=>String(r[2]).trim().replace(/\s+/g,' '));
  if(names.some(name=>name.length>120))throw Error('Họ tên tối đa 120 ký tự');
  const codes=allocateStudentCodes_(names.length);
  const registered=rows.filter(r=>r[0]&&r[1]);
  names.forEach((name,i)=>registered.push([codes[i],codes[i],sheetText_(name),true]));
  writeRoster_(cl,registered);
  bumpVersion_(cl.classId);
  audit_('Nhập tên trực tiếp trong Sheet',cl.classId,names.length+' học sinh');
  return names.length;
}
function handleRosterEdit(e){
  if(!e||!e.range)return;
  const range=e.range,s=range.getSheet();
  if(range.getColumn()!==3||range.getNumColumns()!==1||range.getRow()<2)return;
  const row=data_('LOP',H.LOP).find(r=>r[2]===s.getName()&&yes_(r[3]));
  if(!row)return;
  try{
    lock_(()=>{
      const cl={classId:row[0],name:row[2]};
      if(session_(cl.classId))throw Error('Kết thúc buổi trước khi thêm học sinh trong Sheet');
      const count=materializePendingNames_(cl);
      if(count)SpreadsheetApp.getActiveSpreadsheet().toast('Đã cấp mã cho '+count+' học sinh của '+cl.classId,'Danh sách lớp',5);
    });
  }catch(error){
    SpreadsheetApp.getActiveSpreadsheet().toast(String(error.message||error),'Chưa thể cấp mã',10);
    throw error;
  }
}
function storage_(){const ss=SpreadsheetApp.getActiveSpreadsheet();const cells=ss.getSheets().reduce((n,s)=>n+s.getMaxRows()*s.getMaxColumns(),0);return {cells,limit:10000000,warning:cells>=7000000};}
function capacity_(){if(storage_().cells>=8500000)throw Error('Tệp gần đầy. Hãy tạo bản sao lưu và mở tệp cho năm học mới trước khi tạo buổi');}
function stamp_() { return Utilities.formatDate(new Date(), TZ, "yyyy-MM-dd'T'HH:mm:ssXXX"); }
function today_() { return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd'); }
function id_(value) {
  const id = String(value || '').trim();
  if (!/^[A-Za-z0-9_-]{1,32}$/.test(id)) throw Error('Mã không hợp lệ: ' + id);
  return id;
}
function yes_(v) { return v === true || String(v).toUpperCase() === 'TRUE' || String(v) === '1'; }
function sh_(name, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let s = ss.getSheetByName(name);
  if (!s) s = ss.insertSheet(name);
  if (s.getLastRow() === 0) {
    s.getRange(1,1,1,headers.length).setValues([headers]);
    s.getRange(1,1,1,headers.length).setFontWeight('bold').setBackground('#183B5B').setFontColor('#ffffff');
    s.setFrozenRows(1);
  }
  return s;
}
function data_(name, headers) {
  const s = sh_(name,headers);
  return s.getLastRow() < 2 ? [] : s.getRange(2,1,s.getLastRow()-1,headers.length).getDisplayValues();
}
function add_(name, headers, rows) {
  if (!rows.length) return;
  const s = sh_(name,headers);
  const needed=s.getLastRow()+rows.length;
  if(needed>s.getMaxRows()) {
    capacity_();s.insertRowsAfter(s.getMaxRows(),needed-s.getMaxRows());
  }
  s.getRange(s.getLastRow()+1,1,rows.length,headers.length).setNumberFormat('@').setValues(rows.map(r=>r.map(sheetText_)));
}
function sheetText_(v){return typeof v==='string'&&/^[=+@]/.test(v)?"'"+v:v;}
function replace_(name, headers, rows) {
  const s = sh_(name,headers);
  if (s.getLastRow() > 1) s.getRange(2,1,s.getLastRow()-1,headers.length).clearContent();
  add_(name,headers,rows);
  return s;
}
function lock_(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try { return fn(); } finally { lock.releaseLock(); }
}
function reply_(body) { return ContentService.createTextOutput(JSON.stringify(body)).setMimeType(ContentService.MimeType.JSON); }
function class_(value) {
  const classId = id_(value);
  const row = data_('LOP',H.LOP).find(r => r[0] === classId && yes_(r[3]));
  if (!row) throw Error('Không tìm thấy lớp: ' + classId);
  const name = row[2];
  if (!/^LOP_[A-Za-z0-9_-]+$/.test(name) || !SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name)) throw Error('Sheet lớp không tồn tại');
  return { classId, displayCode:row[5]||row[0], name, version:Number(row[4])||1 };
}
function bumpVersion_(classId) {
  const rows=data_('LOP',H.LOP),i=rows.findIndex(r=>r[0]===classId);
  if(i<0) throw Error('Không tìm thấy lớp');
  const version=(Number(rows[i][4])||1)+1;
  sh_('LOP',H.LOP).getRange(i+2,5).setValue(version);
  return version;
}
function roster_(value) {
  const cl = class_(value);
  const found = new Set(), codes = new Set();
  return data_(cl.name,ROSTER).filter(r => yes_(r[3])).map(r => {
    const studentId = id_(r[0]), code = id_(r[1]);
    if (found.has(studentId) || codes.has(code) || !r[2]) throw Error('Trùng mã hoặc thiếu tên: ' + studentId);
    found.add(studentId); codes.add(code);
    return { studentId, code, name:r[2], classId:cl.classId };
  }).sort(compareStudent_);
}
function setupAttendanceSheets() {
  ScriptApp.requireAllScopes(ScriptApp.AuthMode.FULL);
  requireSetupOwner_();
  Object.keys(H).forEach(name => sh_(name,H[name]).getRange(1,1,1,H[name].length).setValues([H[name]]));
  if(!data_('LOP',H.LOP).some(r=>r[0]==='DEFAULT')) {
    sh_('LOP_DEFAULT',ROSTER);
    add_('LOP',H.LOP,[['DEFAULT','Lớp mặc định','LOP_DEFAULT',true,1,'DEFAULT']]);
  }
  // Recover a class tab created before an interrupted request updated LOP.
  const registered=data_('LOP',H.LOP),knownIds=new Set(registered.map(r=>r[0])),knownTabs=new Set(registered.map(r=>r[2]));
  SpreadsheetApp.getActiveSpreadsheet().getSheets().forEach(sheet=>{
    const tab=sheet.getName();
    if(!/^LOP_[A-Za-z0-9_-]{1,32}$/.test(tab)||knownTabs.has(tab))return;
    const id=tab.slice(4);
    if(knownIds.has(id))return;
    add_('LOP',H.LOP,[[id,'Lớp '+id,tab,true,1,id]]);
    knownIds.add(id);knownTabs.add(tab);
  });
  const old=SpreadsheetApp.getActiveSpreadsheet().getSheetByName('DANHSACH');
  const target=SpreadsheetApp.getActiveSpreadsheet().getSheetByName('LOP_DEFAULT');
  if(old && target && old.getLastRow()>1 && target.getLastRow()===1) {
    const records=old.getRange(2,2,old.getLastRow()-1,2).getDisplayValues()
      .filter(r=>r[0]&&r[1]).map(r=>[id_(r[0]),id_(r[0]),String(r[1]).trim(),true]);
    writeRoster_({name:'LOP_DEFAULT'},records);
    if(records.length) bumpVersion_('DEFAULT');
  }
  if (!data_('THIETBI',H.THIETBI).length) add_('THIETBI',H.THIETBI,[['ESP01','DEFAULT','','Chưa kết nối','']]);
  const devices=data_('THIETBI',H.THIETBI);if(devices.length===1&&!devices[0][7])sh_('THIETBI',H.THIETBI).getRange(2,8).setValue('CONG');
  data_('LOP',H.LOP).forEach(r=>{
    const sheet=SpreadsheetApp.getActiveSpreadsheet().getSheetByName(r[2]);
    if(!sheet)return;
    sheet.getRange(1,1,1,ROSTER.length).setValues([ROSTER]);
    const cl={classId:r[0],name:r[2]};
    const rows=data_(cl.name,ROSTER);
    if(session_(cl.classId)&&rows.some(student=>!student[0]&&!student[1]&&student[2])){
      protectSheet_(sh_(cl.name,ROSTER),cl.classId);
      return;
    }
    if(!materializePendingNames_(cl))writeRoster_(cl,rows);
  });
  protectSheets_();
  installRosterEditTrigger_();
  return 'Đã bảo vệ bảng và cài tự cấp mã khi nhập tên vào cột C của tab lớp. Đặt ADMIN_PASSWORD trong Script Properties trước khi triển khai.';
}
function device_(id) {
  const rows=data_('THIETBI',H.THIETBI),r=id?rows.find(r=>r[0]===id):rows[0];
  if(!r) throw Error('Không tìm thấy thiết bị');
  const age=new Date().getTime()-Date.parse(r[2]);
  return {deviceId:r[0],classId:r[1],lastSeen:r[2],message:r[3],actualClassId:r[4],enabled:r[5]===''||yes_(r[5]),label:r[6]||r[0],mode:r[7]||'LOP',syncedVersion:Number(r[8])||0,fingerprintsKnown:!!props_().getProperty('FINGERPRINT_COUNTS_'+r[0]),expectedVersion:r[7]==='CONG'?availableClassRows_().reduce((n,r)=>n+(Number(r[4])||1),0):0,online:Number.isFinite(age)&&age>=0&&age<45000};
}
function availableClassRows_(){const ss=SpreadsheetApp.getActiveSpreadsheet();return data_('LOP',H.LOP).filter(r=>yes_(r[3])&&ss.getSheetByName(r[2]));}
function classCatalogVersion_(){return hash_(JSON.stringify(availableClassRows_().map(r=>[r[0],r[1],r[2],r[5]||r[0]])));}

function uiState_(classId,sessionId) {
  const devices=data_('THIETBI',H.THIETBI).map(r=>device_(r[0]));
  const classRows=availableClassRows_();
  const classes=[...classRows.filter(r=>r[0]!=='DEFAULT').reverse(),...classRows.filter(r=>r[0]==='DEFAULT')].map(r=>({id:r[0],code:r[5]||r[0],name:r[1]}));
  const selected=classes.some(r=>r.id===classId)?classId:(classes[0]?.id||'');
  if(selected&&!session_(selected)&&data_(class_(selected).name,ROSTER).some(r=>!r[0]&&!r[1]&&r[2]))lock_(()=>materializePendingNames_(class_(selected)));
  const sessions=selected?data_('BUOIDIEMDANH',H.BUOIDIEMDANH).filter(r=>r[1]===selected).map(sessionRow_).reverse():[];
  const open=selected?session_(selected):null,view=sessionId?sessions.find(r=>r.sessionId===sessionId):(open||sessions[0]||null);
  const details=view?data_('CHITIET_BUOI',H.CHITIET_BUOI).filter(r=>r[0]===view.sessionId):[];
  const students=details.map(r=>({id:r[3],code:r[4],name:r[5],status:r[6],time:r[7],note:r[8]})).sort(compareStudent_).map((r,i)=>({...r,stt:i+1}));
  const roster=selected?uiStudentRows_(selected):[],commands=selected?data_('LENH',H.LENH).filter(r=>r[1]===selected).slice(-8).reverse():[];
  return {classId:selected,classes,setupRequired:!data_('LOP',H.LOP).length,classCatalogVersion:classCatalogVersion_(),devices,session:open,view,sessions,roster,students,fingerprints:selected?data_('VANTAY',H.VANTAY).filter(r=>r[1]===selected).map(r=>({deviceId:r[0],code:r[2],count:Number(r[3]),updatedAt:r[4]})):[],
    commands:commands.map(r=>({id:r[0],code:r[2],action:r[3],status:r[4],message:r[5],deviceId:r[7]||'ESP01'})),
    counts:{total:students.length,present:students.filter(r=>r.status==='PRESENT').length,late:students.filter(r=>r.status==='LATE').length,pending:students.filter(r=>r.status==='PENDING').length,absent:students.filter(r=>r.status==='ABSENT').length,excused:students.filter(r=>r.status==='EXCUSED').length},
    weekly:data_('TONG_TUAN',H.TONG_TUAN).filter(r=>r[3]===selected).slice(-52).reverse(),
    weekDays:data_('TUAN_7_NGAY',H.TUAN_7_NGAY).filter(r=>r[1]===selected),sheetUrl:SpreadsheetApp.getActiveSpreadsheet().getUrl(),serverTime:stamp_(),revision:revision_(),storage:storage_()};
}

function uiRevision_(){return {revision:revision_(),classCatalogVersion:classCatalogVersion_(),devices:data_('THIETBI',H.THIETBI).map(r=>device_(r[0])),serverTime:stamp_()};}

function uiSelectClass_(classId,deviceId){return setClass_(classId,deviceId);}

function setClass_(classId,deviceId) {
  const cl=class_(classId);return lock_(()=>{
    const current=device_(deviceId),rows=data_('THIETBI',H.THIETBI),i=rows.findIndex(r=>r[0]===current.deviceId);
    if(current.classId!==cl.classId && session_(current.classId))throw Error('Kết thúc buổi lớp cũ trước khi giao lớp mới');
    if(data_('LENH',H.LENH).some(r=>(r[7]||'ESP01')===current.deviceId&&['PENDING','RUNNING'].includes(r[4])))throw Error('Thiết bị đang xử lý vân tay');
    sh_('THIETBI',H.THIETBI).getRange(i+2,2).setValue(cl.classId);audit_('Giao lớp',current.deviceId,cl.classId);return {classId:cl.classId};
  });
}

function uiStartSession_(classId,period,lateAfter){return start_({classId,period,lateAfter,requireOnline:true});}

function uiCloseSession_(sessionId){return close_({sessionId});}

function uiAddClass_(classId,className){const created=addClass_(classId,className);protectSheets_();return {classId:created.classId,code:created.code};}

function uiRoster_(classId) { return roster_(classId); }
function uiStudentRows_(classId) {
  const cl=class_(classId);
  return data_(cl.name,ROSTER).filter(r=>r[0]).map(r=>({studentId:r[0],code:r[1],name:r[2],active:yes_(r[3])})).sort(compareStudent_).map((r,i)=>({...r,stt:i+1}));
}
function uiFingerprintCommand_(classId,studentCode,action,deviceId) {
  const cl=class_(classId),code=id_(studentCode);
  if(action!=='ENROLL'&&action!=='DELETE') throw Error('Lệnh vân tay không hợp lệ');
  return lock_(()=>{
    const device=device_(deviceId);
    if(!device.online||!device.enabled)throw Error('Thiết bị chưa trực tuyến hoặc đã tạm dừng');
    if(!deviceReady_(device,cl.classId)) throw Error('Hãy chờ ESP32 đồng bộ danh sách trước');
    const student=data_(cl.name,ROSTER).find(r=>r[1]===code);
    if(!student || (action==='ENROLL'&&!yes_(student[3]))) throw Error('Mã học sinh không thuộc lớp đang hoạt động');
    expireCommands_();
    if(data_('LENH',H.LENH).some(r=>(r[7]||'ESP01')===device.deviceId&&(r[4]==='PENDING'||r[4]==='RUNNING'))) throw Error('Thiết bị đang xử lý một lệnh vân tay');
    const commandId=Utilities.getUuid();
    add_('LENH',H.LENH,[[commandId,cl.classId,code,action,'PENDING','Đang chờ thiết bị',stamp_(),device.deviceId]]);
    return {commandId,status:'PENDING'};
  });
}
function expireCommands_() {
  const rows=data_('LENH',H.LENH),sheet=sh_('LENH',H.LENH),now=new Date().getTime();
  rows.forEach((r,i)=>{
    if((r[4]==='PENDING'||r[4]==='RUNNING') && now-Date.parse(r[6])>5*60*1000)
      {sheet.getRange(i+2,5,1,3).setValues([['FAILED','Thiết bị không xác nhận trong 5 phút',stamp_()]]);bump_();}
  });
}
function pendingCommand_(classId,deviceId,mode) {
  expireCommands_();
  const row=data_('LENH',H.LENH).find(r=>(mode==='CONG'||r[1]===classId)&&(r[7]||'ESP01')===(deviceId||'ESP01')&&r[4]==='PENDING');
  return row?{id:row[0],classId:row[1],code:row[2],action:row[3]}:null;
}
function commandUpdate_(p) {
  return lock_(()=>{
    const status=String(p.status||'');
    if(!['RUNNING','DONE','FAILED'].includes(status)) throw Error('Trạng thái lệnh không hợp lệ');
    const rows=data_('LENH',H.LENH),i=rows.findIndex(r=>r[0]===p.commandId);
    if(i<0 || (p.deviceId&&(rows[i][7]||'ESP01')!==p.deviceId)) throw Error('Không tìm thấy lệnh của thiết bị');
    if(rows[i][4]==='DONE'||rows[i][4]==='FAILED') return {status:rows[i][4]};
    sh_('LENH',H.LENH).getRange(i+2,5,1,3).setValues([[status,sheetText_(String(p.message||'').slice(0,160)),stamp_()]]);
    bump_();
    return {status};
  });
}
function uiSaveStudent_(classId,studentId,code,name,active) {
  const cl=class_(classId),studentName=String(name||'').trim().replace(/\s+/g,' ');
  if(!studentName) throw Error('Hãy nhập họ tên');
  return lock_(()=>{
    if(session_(cl.classId)) throw Error('Hãy kết thúc buổi trước khi sửa danh sách');
    materializePendingNames_(cl);
    const rows=data_(cl.name,ROSTER);let id,studentCode;
    if(studentId){const existing=rows.find(r=>r[0]===studentId);if(!existing)throw Error('Không tìm thấy học sinh; mã mới chỉ do hệ thống cấp');if(code!==existing[1])throw Error('Mã học sinh cố định, không được sửa');id=existing[0];studentCode=existing[1];}
    else {if(code)throw Error('Không nhập mã thủ công; hệ thống tự cấp mã học sinh');id=studentCode=nextStudentCode_();}
    const i=rows.findIndex(r=>r[0]===id),row=[id,studentCode,sheetText_(studentName),!!active];
    if(i>=0)rows[i]=row;else rows.push(row);writeRoster_(cl,rows);audit_(i>=0?'Sửa hồ sơ':'Cấp mã học sinh',cl.classId+'|'+studentCode,studentName);
    return {classId:cl.classId,studentId:id,code:studentCode,version:bumpVersion_(cl.classId)};
  });
}
function uiDeactivateStudent_(classId,studentId) {
  const cl=class_(classId),id=id_(studentId);
  return lock_(()=>{
    if(session_(cl.classId)) throw Error('Hãy kết thúc buổi trước khi sửa danh sách');
    const rows=data_(cl.name,ROSTER),i=rows.findIndex(r=>r[0]===id);
    if(i<0) throw Error('Không tìm thấy học sinh');
    sh_(cl.name,ROSTER).getRange(i+2,4).setValue(false);
    return {classId:cl.classId,version:bumpVersion_(cl.classId)};
  });
}
function parseCsv_(text) {
  const rows=[]; let row=[],cell='',quoted=false;
  text=String(text||'').replace(/^\uFEFF/,'');
  for(let i=0;i<text.length;i++) {
    const ch=text[i];
    if(ch==='"') {
      if(quoted && text[i+1]==='"') {cell+='"';i++;} else quoted=!quoted;
    } else if(ch===',' && !quoted) {row.push(cell);cell='';}
    else if((ch==='\n'||ch==='\r') && !quoted) {
      if(ch==='\r' && text[i+1]==='\n') i++;
      row.push(cell);if(row.some(x=>x.trim()))rows.push(row);row=[];cell='';
    } else cell+=ch;
  }
  if(quoted) throw Error('CSV thiếu dấu đóng ngoặc kép');
  row.push(cell);if(row.some(x=>x.trim()))rows.push(row);
  return rows;
}
function uiImportRoster_(classId,csvText) {
  const cl=class_(classId),input=parseCsv_(csvText);if(input.length<2)throw Error('File không có học sinh');
  const headers=input.shift().map(x=>x.trim().toLowerCase());
  const col=(...names)=>names.map(n=>headers.indexOf(n)).find(i=>i>=0);
  const nameCol=col('studentname','ho_ten'),codeCol=col('studentcode','ma_hoc_sinh'),idCol=col('studentid'),classCol=col('classid','ma_lop'),activeCol=col('active');
  if(nameCol===undefined)throw Error('Thiếu cột ho_ten');if(input.length>500)throw Error('Tối đa 500 học sinh mỗi lần nhập');
  return lock_(()=>{
    if(session_(cl.classId))throw Error('Hãy kết thúc buổi trước khi thay danh sách');
    materializePendingNames_(cl);
    const rows=data_(cl.name,ROSTER),seen=new Set();
    // Validate the entire file before allocating codes or updating a student.
    const planned=input.map((r,i)=>{
      const name=String(r[nameCol]||'').trim().replace(/\s+/g,' '),code=codeCol===undefined?'':String(r[codeCol]||'').trim(),id=idCol===undefined?'':String(r[idCol]||'').trim();
      if(!name)throw Error('Dòng '+(i+2)+' thiếu họ tên');
      if(classCol!==undefined&&!([cl.classId,cl.displayCode].includes(String(r[classCol]||'').trim())))throw Error('Dòng '+(i+2)+' khác lớp đang nhập');
      let existing=null;if(code||id){existing=rows.find(x=>(!code||x[1]===code)&&(!id||x[0]===id));if(!existing)throw Error('Mã mới do hệ thống tự cấp; bỏ cột mã khi thêm học sinh');if(seen.has(existing[0]))throw Error('File trùng mã học sinh');seen.add(existing[0]);}
      return {name,existing,active:activeCol===undefined?(existing?yes_(existing[3]):true):yes_(r[activeCol])};
    });
    const allocated=allocateStudentCodes_(planned.filter(p=>!p.existing).length);let next=0;
    for(const p of planned){if(p.existing){const i=rows.findIndex(r=>r[0]===p.existing[0]);rows[i]=[p.existing[0],p.existing[1],p.name,p.active];}else{const code=allocated[next++];rows.push([code,code,p.name,p.active]);}}
    writeRoster_(cl,rows);audit_('Nhập học sinh',cl.classId,planned.length+' dòng');return {count:planned.length,classId:cl.classId,version:bumpVersion_(cl.classId)};
  });
}

function addClass_(classId, className) {
  return lock_(() => {
    const code=id_(classId),label=sheetText_(String(className||'Lớp '+code).trim()||'Lớp '+code);
    const rows=data_('LOP',H.LOP);
    if(rows.some(r=>(r[5]||r[0])===code&&yes_(r[3])&&SpreadsheetApp.getActiveSpreadsheet().getSheetByName(r[2])))throw Error('Lớp đã tồn tại');
    let id=code;
    if(rows.some(r=>r[0]===id)){
      for(let version=2;version<10000;version++){
        const suffix='_V'+version,candidate=code.slice(0,32-suffix.length)+suffix;
        if(!rows.some(r=>r[0]===candidate)&&!SpreadsheetApp.getActiveSpreadsheet().getSheetByName('LOP_'+candidate)){id=candidate;break;}
      }
      if(id===code)throw Error('Không cấp được định danh cho lần tạo lớp mới');
    }
    const name='LOP_'+id;
    sh_(name,ROSTER);
    add_('LOP',H.LOP,[[id,label,name,true,1,code]]);
    audit_('Tạo lớp mới',id,'Mã hiển thị '+code);
    return {classId:id,code,name};
  });
}
// Optional one-time migration; original DANHSACH and fingerprint templates stay intact.
function migrateLegacyRoster() {
  setupAttendanceSheets();
  const old = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('DANHSACH');
  if (!old) throw Error('Không có DANHSACH');
  if (!data_('LOP',H.LOP).some(r => r[0] === 'DEFAULT')) addClass_('DEFAULT','Lớp cũ');
  const target = sh_('LOP_DEFAULT',ROSTER);
  if (target.getLastRow() > 1) return 0;
  if (old.getLastRow() < 2) return 0;
  const rows = old.getRange(2,2,old.getLastRow()-1,2).getDisplayValues()
    .filter(r => r[0] && r[1]).map(r => [id_(r[0]),id_(r[0]),r[1],true]);
  writeRoster_({name:'LOP_DEFAULT'},rows);
  if(rows.length) bumpVersion_('DEFAULT');
  return rows.length;
}
function session_(classId){const r=data_('BUOIDIEMDANH',H.BUOIDIEMDANH).find(r=>r[1]===classId&&r[7]==='OPEN');return r?sessionRow_(r):null;}

function start_(p) {
  return lock_(() => {
    const cl = class_(p.classId), day = String(p.day || today_()), period = id_(p.period || 'SANG');
    const late = String(p.lateAfter || '07:15');
    if(!['SANG','CHIEU','TOI'].includes(period))throw Error('Chọn buổi sáng, chiều hoặc tối');
    if(day!==today_())throw Error('Chỉ mở buổi của ngày hiện tại');
    materializePendingNames_(cl);
    if(p.requireOnline&&!data_('THIETBI',H.THIETBI).some(r=>deviceReady_(device_(r[0]),cl.classId)))throw Error('Cần thiết bị trực tuyến đã đồng bộ đúng lớp');
    capacity_();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(late)) throw Error('Ngày/giờ không hợp lệ');
    const sessionId = cl.classId + '-' + day.replace(/-/g,'') + '-' + period;
    const sessions = data_('BUOIDIEMDANH',H.BUOIDIEMDANH);
    if (sessions.some(r => r[0] === sessionId) || session_(cl.classId)) throw Error('Buổi đã tồn tại hoặc còn buổi đang mở');
    const students = roster_(cl.classId);
    if (!students.length) throw Error('Lớp chưa có học sinh');
    add_('CHITIET_BUOI',H.CHITIET_BUOI,students.map(s => [sessionId,cl.classId,day,s.studentId,s.code,s.name,'PENDING','','']));
    SpreadsheetApp.flush();
    add_('BUOIDIEMDANH',H.BUOIDIEMDANH,[[sessionId,cl.classId,day,period,stamp_(),day+'T'+late+':00+07:00','','OPEN']]);
    protectSheet_(sh_(cl.name,ROSTER),cl.classId);
    audit_('Mở buổi',sessionId,late);bump_();
    return {sessionId,classId:cl.classId,status:'OPEN',count:students.length};
  });
}
function scan_(p) {
  return lock_(() => {
    const cl = class_(p.classId), open = session_(cl.classId);
    if (!open) throw Error('Chưa mở buổi điểm danh');
    if(open.day!==today_())throw Error('Buổi đã sang ngày khác, cần kết thúc buổi cũ');
    if(p.sessionId!==open.sessionId)throw Error('Thiết bị chưa đồng bộ đúng buổi');
    const studentId = id_(p.studentId), rows = data_('CHITIET_BUOI',H.CHITIET_BUOI);
    const i = rows.findIndex(r => r[0] === open.sessionId && r[3] === studentId);
    if (i < 0) throw Error('Học sinh không thuộc buổi này');
    if (rows[i][6] !== 'PENDING') return {status:rows[i][6],duplicate:true,sessionId:open.sessionId};
    const time = stamp_(), status = Date.parse(time) <= Date.parse(open.lateAfter) ? 'PRESENT' : 'LATE';
    const eventId = open.sessionId + '-' + studentId;
    sh_('CHITIET_BUOI',H.CHITIET_BUOI).getRange(i+2,7,1,2).setValues([[status,time]]);
    add_('DIEMDANH',H.DIEMDANH,[[eventId,open.sessionId,cl.classId,studentId,time,status,p.deviceId||'ESP01']]);
    bump_();return {status,duplicate:false,sessionId:open.sessionId,name:rows[i][5],time};
  });
}
function close_(p) {
  return lock_(() => {
    const id = String(p.sessionId || '');
    const sessions = data_('BUOIDIEMDANH',H.BUOIDIEMDANH);
    const i = sessions.findIndex(r => r[0] === id);
    if (i < 0) throw Error('Không tìm thấy buổi');
    if (sessions[i][7] === 'CLOSED') return {status:'CLOSED',duplicate:true};
    if (sessions[i][7] !== 'OPEN') throw Error('Buổi không mở');
    const rows = data_('CHITIET_BUOI',H.CHITIET_BUOI), sh = sh_('CHITIET_BUOI',H.CHITIET_BUOI);
    let absent = 0;
    rows.forEach((r,n) => { if (r[0] === id && r[6] === 'PENDING') { sh.getRange(n+2,7).setValue('ABSENT'); absent++; } });
    sh_('BUOIDIEMDANH',H.BUOIDIEMDANH).getRange(i+2,7,1,2).setValues([[stamp_(),'CLOSED']]);
    const cl=class_(sessions[i][1]);
    try{materializePendingNames_(cl);}catch(error){audit_('Tên nhập Sheet chưa được cấp mã',cl.classId,String(error.message||error));}
    protectSheet_(sh_(cl.name,ROSTER),cl.classId);
    audit_('Kết thúc buổi',id,'Chốt vắng: '+absent);bump_();reports_();
    return {status:'CLOSED',sessionId:id,absent};
  });
}
function excuse_(p) {
  return lock_(() => {
    const note = String(p.note || '').trim();
    if (!note) throw Error('Cần lý do vắng có phép');
    const sessions = data_('BUOIDIEMDANH',H.BUOIDIEMDANH);
    if (!sessions.some(r => r[0] === p.sessionId && r[7] === 'CLOSED')) throw Error('Buổi chưa kết thúc');
    const rows = data_('CHITIET_BUOI',H.CHITIET_BUOI);
    const i = rows.findIndex(r => r[0] === p.sessionId && r[3] === p.studentId && r[6] === 'ABSENT');
    if (i < 0) throw Error('Không tìm thấy lượt vắng');
    sh_('CHITIET_BUOI',H.CHITIET_BUOI).getRange(i+2,7).setValue('EXCUSED');
    sh_('CHITIET_BUOI',H.CHITIET_BUOI).getRange(i+2,9).setValue(sheetText_(note));
    audit_('Duyệt phép',p.sessionId+' / '+p.studentId,note);bump_();reports_();
    return {status:'EXCUSED'};
  });
}
function dateAdd_(day,n) {
  const d = new Date(day+'T12:00:00Z'); d.setUTCDate(d.getUTCDate()+n);
  return Utilities.formatDate(d,'UTC','yyyy-MM-dd');
}
function monday_(day) {
  const d = new Date(day+'T12:00:00Z');
  return dateAdd_(day,-((d.getUTCDay()+6)%7));
}
function weekLabel_(monday) {
  const d = new Date(monday+'T12:00:00Z');
  const thursday = new Date(d); thursday.setUTCDate(d.getUTCDate()+3);
  const year = thursday.getUTCFullYear();
  const first = new Date(Date.UTC(year,0,4,12));
  first.setUTCDate(first.getUTCDate()-((first.getUTCDay()+6)%7));
  return 'Tuần '+year+'-W'+String(1+Math.round((d-first)/604800000)).padStart(2,'0');
}
function reports_() {
  const closed = new Set(data_('BUOIDIEMDANH',H.BUOIDIEMDANH).filter(r => r[7] === 'CLOSED').map(r => r[0]));
  const rows = data_('CHITIET_BUOI',H.CHITIET_BUOI).filter(r => closed.has(r[0]));
  const weeks = new Map(), days = new Map(), absent = [], studentWeeks = new Map();
  rows.forEach(r => {
    const [sessionId,classId,day,studentId,code,name,status,time] = r;
    if (!days.has(day)) days.set(day,[]);
    days.get(day).push([classId,sessionId,code,name,status,time ? time.slice(11,19) : '']);
    if (status === 'ABSENT' || status === 'EXCUSED') absent.push([day,PERIODS_[sessionId.split('-').pop()]||sessionId,classId,code,name,LABELS_[status]]);
    const week = monday_(day), key = week+'|'+classId;
    const studentKey = key+'|'+studentId;
    if (!studentWeeks.has(studentKey)) studentWeeks.set(studentKey,{week,classId,code,name,days:Array.from({length:7},()=>[]),present:0,absent:0,late:0,excused:0});
    const sw = studentWeeks.get(studentKey);
    const offset = Math.round((new Date(day+'T12:00:00Z')-new Date(week+'T12:00:00Z'))/86400000);
    const period=sessionId.split('-').pop();sw.days[offset].push((PERIODS_[period]||period)+': '+(LABELS_[status]||status));
    if (status === 'PRESENT' || status === 'LATE') sw.present++;
    if (status === 'ABSENT') sw.absent++;
    if (status === 'LATE') sw.late++;
    if (status === 'EXCUSED') sw.excused++;
    if (!weeks.has(key)) weeks.set(key,{week,classId,ss:new Set(),total:0,present:0,absent:0,late:0,excused:0,absentNames:new Map(),lateNames:new Map()});
    const w = weeks.get(key); w.ss.add(sessionId); w.total++;
    if (status === 'PRESENT' || status === 'LATE') w.present++;
    if (status === 'ABSENT') { w.absent++; const old=w.absentNames.get(studentId)||{name,count:0}; old.count++; w.absentNames.set(studentId,old); }
    if (status === 'LATE') { w.late++; const old=w.lateNames.get(studentId)||{name,count:0}; old.count++; w.lateNames.set(studentId,old); }
    if (status === 'EXCUSED') w.excused++;
  });
  replace_('DSVANG',H.DSVANG,absent.sort((a,b) => a[0].localeCompare(b[0])));
  const names = m => [...m.values()].map(x => x.name+' ('+x.count+')').join(', ');
  const summary = [...weeks.values()].sort((a,b) => a.week.localeCompare(b.week)||a.classId.localeCompare(b.classId)).map(w =>
    [weekLabel_(w.week),w.week,dateAdd_(w.week,6),w.classId,w.ss.size,w.present,w.absent,names(w.absentNames),w.late,names(w.lateNames),w.excused,w.total ? w.present/w.total : 0]);
  const weekSheet = replace_('TONG_TUAN',H.TONG_TUAN,summary);
  if (summary.length) weekSheet.getRange(2,12,summary.length,1).setNumberFormat('0.0%');
  const positions=new Map();
  const detail = [...studentWeeks.values()].sort((a,b) => a.week.localeCompare(b.week)||a.classId.localeCompare(b.classId)||compareStudent_(a,b))
    .map(s => {const key=s.week+'|'+s.classId,stt=(positions.get(key)||0)+1;positions.set(key,stt);return [weekLabel_(s.week),s.classId,s.code,s.name,...s.days.map(x => x.join('/')),s.present,s.absent,s.late,s.excused,stt];});
  replace_('TUAN_7_NGAY',H.TUAN_7_NGAY,detail);
  return {days:days.size,weeks:summary.length};
}
function refreshReports_() { return lock_(reports_); }
function webPage_() {
  // Apps Script file names are case-sensitive; accept both editor naming styles.
  try { return HtmlService.createHtmlOutputFromFile('Index').setTitle('Điểm danh vân tay'); }
  catch (error) { return HtmlService.createHtmlOutputFromFile('index').setTitle('Điểm danh vân tay'); }
}
function doGet(e){try{if(e?.parameter?.sts)throw Error('API thiết bị chỉ nhận POST có khóa xác thực');return webPage_();}catch(e){return reply_({ok:false,error:e.message});}}

function doPost(e){try{
  const p=JSON.parse(e.postData.contents||'{}'),device=authenticateDevice_(p);
  if(p.action==='control')return reply_({ok:true,...control_(p,device)});
  if(p.classId&&device.mode!=='CONG'&&p.classId!==device.classId)throw Error('Thiết bị không được giao lớp này');
  const actions={read:()=>deviceRoster_(device),classes:()=>({classes:deviceClasses_(device).map(r=>({id:r[0],name:r[1]}))}),session:()=>({session:session_(device.classId),sessions:deviceSessions_(device)}),checkin:()=>scan_(p),commandUpdate:()=>commandUpdate_(p)};
  if(!actions[p.action])throw Error('Thiết bị không có quyền thực hiện thao tác này');
  return reply_({ok:true,...actions[p.action]()});
}catch(e){return reply_({ok:false,error:String(e.message||e)});}}
