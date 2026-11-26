// Disposable local preview only. No production mutations or OpenAI calls.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readdirSync} from 'node:fs';
import {resolve} from 'node:path';
const base='http://127.0.0.1:8787', dir=resolve('.wrangler/state/v3/d1/miniflare-D1DatabaseObject');
const sqlite=readdirSync(dir).filter(f=>f.endsWith('.sqlite')).map(f=>resolve(dir,f)).find(path=>execFileSync('python3',['-c',"import sqlite3,sys; print(sqlite3.connect(sys.argv[1]).execute(\"SELECT count(*) FROM sqlite_master WHERE name='china_tasks'\").fetchone()[0])",path],{encoding:'utf8'}).trim()==='1');
assert.ok(sqlite);
function sql(query,args=[]){return JSON.parse(execFileSync('python3',['-c',"import sqlite3,json,sys; x=json.load(sys.stdin); db=sqlite3.connect(x['path']); db.row_factory=sqlite3.Row; c=db.execute(x['query'],x['args']); rows=[dict(r) for r in c.fetchall()]; db.commit(); print(json.dumps(rows))"],{input:JSON.stringify({path:sqlite,query,args}),encoding:'utf8'}));}
async function call(path,cookie,body,origin=base){const r=await fetch(base+path,{method:body?'POST':'GET',headers:{Cookie:cookie??'','Content-Type':'application/json',Origin:origin},body:body?JSON.stringify(body):undefined});return{status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};}
const tables=[crypto.randomUUID(),crypto.randomUUID()],tasks=[crypto.randomUUID(),crypto.randomUUID()],cookies={};
const workspace=async(name='Dean',archive=false)=>(await call('/api/china'+(archive?'?archived=1':''),cookies[name])).data;
const task=async(id,archive=false)=>(await workspace('Dean',archive)).tasks.find(t=>t.id===id);
const mutate=(name,body)=>call('/api/china',cookies[name],body);
const chat=(name,id,body)=>call('/api/china/chat',cookies[name],{taskId:id,...body});
const history=(name,id,before='')=>call('/api/china/chat?taskId='+id+(before?'&before='+encodeURIComponent(before):''),cookies[name]);
try{
 assert.equal((await call('/api/china')).status,401);assert.equal((await history('Dean',tasks[0])).status,401);
 for(const name of ['Dean','Matthew','Arjun','Keanu']){const r=await call('/api/session',null,{name,code:process.env.TEST_TEAM_ACCESS_CODE||'test-team-password'});assert.equal(r.status,200);cookies[name]=r.cookie;}
 const priorTeam=await call('/api/board',cookies.Dean);
 assert.equal((await call('/api/china',cookies.Dean,{action:'createTable',id:tables[0],name:'QA'},'https://other.invalid')).status,403);
 for(let i=0;i<2;i++){
  const table={action:'createTable',id:tables[i],name:'QA China table '+i};assert.equal((await mutate('Dean',table)).status,200);assert.equal((await mutate('Dean',table)).status,200);
  const entry={action:'saveTask',id:tasks[i],revision:null,task:{tableId:tables[i],title:'QA China task '+i,progress:20,priority:'High',status:'In progress',assignee:i?'Dean':'Matthew',notes:'Only task '+i+' notes',deadline:'2026-12-03'}};
  assert.equal((await mutate('Dean',entry)).status,200);assert.equal((await mutate('Dean',entry)).status,200);
 }
 assert.equal((await workspace('Keanu')).tasks.filter(t=>tasks.includes(t.id)).length,2);
 let current=await task(tasks[0]);assert.equal((await mutate('Matthew',{action:'patchTask',id:current.id,revision:current.revision,field:'status',value:'Done'})).status,200);
 assert.equal((await mutate('Arjun',{action:'patchTask',id:current.id,revision:current.revision,field:'notes',value:'Stale overwrite'})).status,409);current=await task(tasks[0]);assert.equal(current.progress,100);
 assert.equal((await mutate('Arjun',{action:'patchTask',id:current.id,revision:current.revision,field:'progress',value:45})).status,200);assert.equal((await task(tasks[0])).status,'In progress');
 const message=crypto.randomUUID(),payload={action:'send',id:message,message:'Samples are approved only for this task.',askDavid:false,author:'Matthew'};
 assert.equal((await chat('Dean',tasks[0],payload)).status,200);assert.equal((await chat('Dean',tasks[0],payload)).status,200);assert.equal((await chat('Matthew',tasks[0],payload)).status,409);
 let first=await history('Matthew',tasks[0]);assert.equal(first.data.messages.length,1);assert.equal(first.data.messages[0].author,'Dean');assert.equal((await history('Dean',tasks[1])).data.messages.length,0);
 assert.equal((await chat('Dean',tasks[1],payload)).status,409);
 const other=crypto.randomUUID();assert.equal((await chat('Arjun',tasks[1],{action:'send',id:other,message:'Other task private context.',askDavid:false})).status,200);
 assert.ok(!(await history('Dean',tasks[0])).data.messages.some(m=>m.body.includes('private context')));
 // Move tasks between tables without creating a new thread.
 current=await task(tasks[0]);assert.equal((await mutate('Dean',{action:'saveTask',id:current.id,revision:current.revision,task:{...current,tableId:tables[1]}})).status,200);assert.equal((await history('Matthew',tasks[0])).data.messages[0].id,message);
 // Pending David replies are stopped by archive and cannot resume on archived tasks.
 const pending=crypto.randomUUID(),now=new Date().toISOString();sql("INSERT INTO china_messages(id,task_id,author,kind,body,request_david,created_at,updated_at) VALUES (?,?,'Dean','team','Please advise',1,?,?)",[pending,tasks[0],now,now]);
 sql("INSERT INTO china_messages(id,task_id,author,kind,body,status,reply_to,created_at,updated_at) VALUES (?,?,'David','david','','processing',?,?,?)",[pending+':david',tasks[0],pending,now,now]);
 current=await task(tasks[0]);assert.equal((await mutate('Keanu',{action:'archiveTask',id:current.id,revision:current.revision})).status,200);assert.equal(await task(tasks[0]),undefined);
 const archived=await task(tasks[0],true);assert.ok(archived.archivedAt);assert.equal(archived.messageCount,3);
 const preserved=await history('Arjun',tasks[0]);assert.ok(preserved.data.messages.some(m=>m.id===message));assert.equal(preserved.data.messages.find(m=>m.id===pending+':david').status,'failed');
 assert.equal((await chat('Dean',tasks[0],{...payload,id:crypto.randomUUID()})).status,409);assert.equal((await chat('Dean',tasks[0],{action:'retry',id:pending})).status,409);
 assert.equal((await mutate('Dean',{action:'patchTask',id:archived.id,revision:archived.revision,field:'notes',value:'not allowed'})).status,409);
 assert.equal((await mutate('Matthew',{action:'restoreTask',id:archived.id,revision:archived.revision})).status,200);assert.equal((await task(tasks[0])).archivedAt,null);
 assert.equal((await chat('Matthew',tasks[0],{action:'send',id:crypto.randomUUID(),message:'Restored follow-up',askDavid:false})).status,200);
 // Full history can be paged without crossing task boundaries.
 for(let i=0;i<43;i++){const time=new Date(Date.now()+i*1000).toISOString();sql("INSERT INTO china_messages(id,task_id,author,body,created_at,updated_at) VALUES (?,?,'Dean',?,?,?)",[crypto.randomUUID(),tasks[0],'Pagination message '+i,time,time]);}
 const page1=(await history('Dean',tasks[0])).data;assert.equal(page1.messages.length,40);assert.ok(page1.olderCursor);const page2=(await history('Dean',tasks[0],page1.olderCursor)).data;assert.equal(page2.messages.length,7);assert.equal(page2.olderCursor,null);assert.equal(new Set([...page1.messages,...page2.messages].map(m=>m.id)).size,47);assert.ok([...page1.messages,...page2.messages].every(m=>m.taskId===tasks[0]));
 assert.deepEqual((await call('/api/board',cookies.Dean)).data,priorTeam.data);
 console.log('PASS: shared tables/tasks, assignee completion, revisions, idempotency, authorship, task chat isolation, move preservation, archive/read-only/restore, pending reply cancellation, history pagination, authentication and origin protection; Team Gantt unchanged.');
}finally{
 for(const id of tasks){sql('DELETE FROM china_messages WHERE task_id=?',[id]);sql('DELETE FROM china_tasks WHERE id=?',[id]);}
 for(const id of tables)sql('DELETE FROM china_tables WHERE id=?',[id]);
}
