const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

class Element{
  constructor(tag='div'){this.tagName=tag.toUpperCase();this.children=[];this.value='';this._text='';this.hidden=false;this.disabled=false;}
  set textContent(value){this._text=String(value??'');this.children=[];}
  get textContent(){return this._text||this.children.map(x=>x.textContent).join('');}
  replaceChildren(...items){this.children=[...items];this._text='';if(this.tagName==='SELECT')this.value='';}
  append(...items){for(const item of items){this.children.push(item);if(this.tagName==='SELECT'&&this.children.length===1)this.value=item.value;}}
  focus(){}scrollIntoView(){}
}
const elements=new Map();
const document={hidden:false,getElementById(id){if(!elements.has(id))elements.set(id,new Element(['classId','history','fingerDevice','week','period'].includes(id)?'select':'div'));return elements.get(id);},createElement:tag=>new Element(tag)};
const get=id=>document.getElementById(id);
const classes=[],rosters=new Map();
function state(requested){
  const classId=classes.some(c=>c.id===requested)?requested:(classes[0]?.id||'');
  return {classId,classes:[...classes],setupRequired:!classes.length,devices:[],session:null,view:null,sessions:[],roster:rosters.get(classId)||[],students:[],fingerprints:[],commands:[],counts:{total:0,present:0,late:0,pending:0,absent:0,excused:0},weekly:[],weekDays:[],sheetUrl:'https://example.test/sheet',serverTime:'2026-11-06T10:00:00+07:00',revision:'1',storage:{cells:500,warning:false}};
}
const run={withSuccessHandler(handler){this.success=handler;return this;},withFailureHandler(handler){this.failure=handler;return this;},uiRequest(_token,method,args){
  try{
    let result;
    if(method==='uiState')result=state(args[0]);
    else if(method==='uiAddClass'){classes.push({id:args[0],name:args[1]});rosters.set(args[0],[]);result={classId:args[0]};}
    else if(method==='uiSaveStudent'){const code='HS000001';rosters.get(args[0]).push({studentId:code,code,name:args[3],active:true,stt:1});result={code};}
    else throw Error('Unexpected method '+method);
    this.success(result);
  }catch(error){this.failure(error);}
}};
const context={document,sessionStorage:{getItem:()=>null,removeItem(){},setItem(){}},google:{script:{run}},setInterval(){},console,Date,Intl};
vm.createContext(context);
const source=fs.readFileSync('Index.html','utf8');
vm.runInContext([...source.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)][0][1],context);

async function main(){
  vm.runInContext('render',context)(state());
  assert.equal(get('createClass').disabled,false);
  assert.equal(get('saveStudent').disabled,true);
  assert.match(get('setupNotice').textContent,/Chưa có lớp/);
  get('newClassId').value='10a2';
  await vm.runInContext('addClass()',context);
  assert.equal(get('classId').value,'10A2');
  assert.equal(get('saveStudent').disabled,false);
  get('studentName').value='Nguyễn Văn A';
  await vm.runInContext('saveStudent()',context);
  assert.equal(get('roster').children.length,1);
  get('search').value='Nguyễn';
  vm.runInContext('renderRoster()',context);
  assert.equal(get('roster').children.length,1);
  get('classSearch').value='10A';
  vm.runInContext('renderClassMatches()',context);
  assert.equal(get('classMatches').children.length,1);
  console.log('PASS: empty dashboard, create/select class, add student, class and student search');
}
main().catch(error=>{console.error(error);process.exitCode=1});
