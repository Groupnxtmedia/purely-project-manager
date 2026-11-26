// Run against the local preview only; creates and removes its own disposable jobs.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readdirSync} from 'node:fs';
import {resolve} from 'node:path';
const base='http://127.0.0.1:8787';
const dir=resolve('.wrangler/state/v3/d1/miniflare-D1DatabaseObject');
const sqlite=readdirSync(dir).filter(f=>f.endsWith('.sqlite')).map(f=>resolve(dir,f)).find(path=>execFileSync('python3',['-c',"import sqlite3,sys; print(sqlite3.connect(sys.argv[1]).execute(\"SELECT count(*) FROM sqlite_master WHERE name='assigned_jobs'\").fetchone()[0])",path],{encoding:'utf8'}).trim()==='1');
assert.ok(sqlite,'Local Assigned Work database required');
function sql(query,args=[]){return JSON.parse(execFileSync('python3',['-c',"import sqlite3,json,sys; x=json.load(sys.stdin); db=sqlite3.connect(x['path']); db.row_factory=sqlite3.Row; c=db.execute(x['query'],x['args']); rows=[dict(r) for r in c.fetchall()]; db.commit(); print(json.dumps(rows))"],{input:JSON.stringify({path:sqlite,query,args}),encoding:'utf8'}));}
async function call(path,cookie,body){const r=await fetch(base+path,{method:body?'POST':'GET',headers:{Cookie:cookie??'','Content-Type':'application/json',Origin:base},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};}
const people=['Dean','Arjun','Keanu','Matthew'],cookies={},ownerIds={},jobs=[],turnIds=[];
const view=async(name,scope)=>(await call('/api/assigned-work?scope='+scope,cookies[name])).data;
const find=async(name,scope,id)=>(await view(name,scope)).jobs.find(j=>j.id===id);
const status=(name,job,action)=>call('/api/assigned-work',cookies[name],{action,id:job.id,revision:job.revision});
function makeTurn(name,proposals){const id=crypto.randomUUID();turnIds.push(id);const now=new Date().toISOString();sql("INSERT INTO assigned_turns (id,owner_id,message,reply,proposals,status,created_at,updated_at) VALUES (?,?,'QA done','QA proposal',?,'ready',?,?)",[id,ownerIds[name],JSON.stringify(proposals.map(j=>({id:j.id,revision:j.revision,title:j.title,assignee:j.assignee}))),now,now]);return id;}
const confirm=(name,id,extra={})=>call('/api/assigned-work/chat',cookies[name],{action:'confirm',id,...extra});
try{
 assert.equal((await call('/api/assigned-work?scope=received')).status,401);
 for(const name of people){const r=await call('/api/session',null,{name,code:process.env.TEST_TEAM_ACCESS_CODE||'test-team-password'});assert.equal(r.status,200);cookies[name]=r.cookie;}
 for(let i=0;i<people.length;i++){
  const owner=people[i],recipient=people[(i+1)%people.length],id=crypto.randomUUID();jobs.push({id,owner,recipient});
  const r=await call('/api/assigned-work',cookies[owner],{action:'save',id,revision:null,job:{title:'QA recipient '+id,assignee:recipient,brief:'Local test brief',deadline:'2026-12-20'}});assert.equal(r.status,200,JSON.stringify(r.data));
  const mine=await find(owner,'mine',id),received=await find(recipient,'received',id);ownerIds[owner]=mine.ownerId;
  assert.equal(mine.id,received.id);assert.equal(received.assignedBy,owner);assert.equal(received.canManage,false);assert.equal(mine.canManage,true);assert.equal(received.canUpdateStatus,true);assert.equal(mine.canUpdateStatus,true);
  assert.equal(await find(recipient,'mine',id),undefined);
  for(const other of people.filter(p=>p!==recipient))assert.equal(await find(other,'received',id),undefined);
  for(const other of people.filter(p=>p!==recipient&&p!==owner))assert.equal((await status(other,received,'complete')).status,409);
  const done=await status(recipient,received,'complete');assert.equal(done.status,200,JSON.stringify(done.data));assert.ok(done.data.job.completedAt);
  assert.equal((await find(owner,'mine',id)).completedAt,done.data.job.completedAt);
  assert.equal((await status(owner,mine,'reopen')).status,409); // stale revisions cannot overwrite a recipient's change
  const reopened=await status(recipient,done.data.job,'reopen');assert.equal(reopened.status,200);assert.equal((await find(owner,'mine',id)).completedAt,null);
  assert.equal((await call('/api/assigned-work',cookies[recipient],{action:'save',id,revision:reopened.data.job.revision,job:{title:'Unauthorized',assignee:recipient,brief:'',deadline:'2026-12-20'}})).status,409);
 }
 assert.equal((await call('/api/assigned-work?scope=everyone',cookies.Dean)).status,403);
 assert.equal((await call('/api/assigned-work?scope=visible',cookies.Dean)).status,400);
 const team=(await view('Matthew','everyone')).jobs;
 for(const job of jobs){const row=team.find(j=>j.id===job.id);assert.equal(row.canManage,job.owner==='Matthew');assert.equal(row.canUpdateStatus,job.owner==='Matthew'||job.recipient==='Matthew');}
 // Existing mixed-case recipient names have the same status permissions as inbox matching.
 const job=jobs[0];sql('UPDATE assigned_jobs SET assignee=? WHERE id=?',['  aRjUn  ',job.id]);let current=await find('Arjun','received',job.id);assert.equal(current.canUpdateStatus,true);
 const fileId=crypto.randomUUID();const form=new FormData();form.set('id',fileId);form.set('jobId',job.id);form.set('file',new File(['QA shared attachment'],'recipient-brief.txt',{type:'text/plain'}));
 const upload=await fetch(base+'/api/assigned-work/brief',{method:'POST',headers:{Cookie:cookies.Dean,Origin:base},body:form});assert.equal(upload.status,200);
 const recipientUpload=await fetch(base+'/api/assigned-work/brief',{method:'POST',headers:{Cookie:cookies.Arjun,Origin:base},body:form});assert.notEqual(recipientUpload.status,200);
 const download=async(name)=>fetch(base+'/api/assigned-work/brief?id='+fileId,{headers:{Cookie:cookies[name]}});
 assert.equal(await (await download('Arjun')).text(),'QA shared attachment');assert.equal((await download('Keanu')).status,404);assert.equal((await download('Matthew')).status,200);
 assert.ok((await view('Arjun','received')).briefs.some(f=>f.id===fileId));
 // Recipient completion stops the assigner's reminders, including already-saved reminders.
 const now=new Date().toISOString();sql('INSERT INTO assigned_reminders (id,owner_id,job_id,reminder_version,kind,reminder_date,created_at) VALUES (?,?,?,?,?,?,?)',[crypto.randomUUID(),current.ownerId,current.id,current.reminderVersion,'due_today','2026-12-20',now]);
 assert.ok((await view('Dean','mine')).reminders.some(r=>r.jobId===job.id));
 let result=await status('Arjun',current,'complete');assert.equal(result.status,200);assert.ok(!(await view('Dean','mine')).reminders.some(r=>r.jobId===job.id));
 result=await status('Arjun',result.data.job,'reopen');assert.equal(result.status,200);current=result.data.job;
 const oldDraft=makeTurn('Arjun',[current]);
 // Reassignment revokes the old recipient's status/brief access, even with the new revision.
 const changed=await call('/api/assigned-work',cookies.Dean,{action:'save',id:job.id,revision:current.revision,job:{title:'QA reassigned '+job.id,assignee:'Keanu',brief:'Updated brief',deadline:'2026-12-23'}});assert.equal(changed.status,200);current=changed.data.job;
 assert.equal(await find('Arjun','received',job.id),undefined);assert.equal((await download('Arjun')).status,404);assert.equal((await download('Keanu')).status,200);
 assert.equal((await status('Arjun',current,'complete')).status,409);assert.equal((await status('Matthew',current,'complete')).status,409);assert.equal((await status('Matthew',current,'reopen')).status,409);
 assert.equal((await confirm('Arjun',oldDraft)).status,409);
 // David confirms recipient-owned drafts and rejects unrelated jobs / mixed unauthorized batches atomically.
 const unrelated=await find('Arjun','mine',jobs[1].id),mixed=makeTurn('Keanu',[current,await find('Matthew','mine',jobs[3].id)]);
 assert.equal((await confirm('Keanu',mixed)).status,409);assert.equal((await find('Dean','mine',job.id)).completedAt,null);
 const matthewDraft=makeTurn('Matthew',[current]);assert.equal((await confirm('Matthew',matthewDraft)).status,409);
 const recipientDraft=makeTurn('Keanu',[current]);assert.equal((await confirm('Dean',recipientDraft)).status,404);
 const confirmed=await confirm('Keanu',recipientDraft,{proposals:[{id:unrelated.id,revision:unrelated.revision}]});assert.equal(confirmed.status,200,JSON.stringify(confirmed.data));
 const done=await find('Keanu','received',job.id);assert.ok(done.completedAt);assert.equal((await find('Dean','mine',job.id)).completedAt,done.completedAt);assert.equal((await find('Arjun','mine',unrelated.id)).completedAt,null);
 assert.equal((await confirm('Keanu',recipientDraft)).status,200);assert.equal((await find('Dean','mine',job.id)).revision,done.revision);
 result=await status('Dean',done,'reopen');assert.equal(result.status,200);
 const stale=makeTurn('Keanu',[result.data.job]);const ownerDraft=makeTurn('Dean',[result.data.job]);assert.equal((await confirm('Dean',ownerDraft)).status,200);assert.equal((await confirm('Keanu',stale)).status,409);
 // The maximum 20-job David card can include received jobs from multiple creators.
 const batch=[];
 for(let i=0;i<20;i++){
  const id=crypto.randomUUID(),owner=i%2?'Dean':'Arjun';jobs.push({id});
  const saved=await call('/api/assigned-work',cookies[owner],{action:'save',id,revision:null,job:{title:'QA batch '+id,assignee:'Matthew',brief:'',deadline:'2026-12-20'}});assert.equal(saved.status,200);batch.push(saved.data.job);
 }
 const batchDraft=makeTurn('Matthew',batch);assert.equal((await confirm('Matthew',batchDraft)).status,200);
 const batchView=(await view('Matthew','received')).jobs;for(const j of batch)assert.ok(batchView.find(x=>x.id===j.id).completedAt);
 // Self-assigned work appears once in each view; external staff stay in the assigner's view.
 for(const assignee of ['Dean','External QA staff']){const id=crypto.randomUUID();jobs.push({id});assert.equal((await call('/api/assigned-work',cookies.Dean,{action:'save',id,revision:null,job:{title:'QA '+id,assignee,brief:'',deadline:'2026-12-20'}})).status,200);assert.ok(await find('Dean','mine',id));assert.equal(!!await find('Dean','received',id),assignee==='Dean');}
 console.log('PASS: four assignees complete/reopen with shared status; creator-only edits/uploads; reminder suppression; case matching; reassignment; Matthew boundaries; atomic, private, revision-checked David confirmations; inbox/brief access.');
}finally{
 for(const id of turnIds)sql('DELETE FROM assigned_turns WHERE id=?',[id]);
 for(const {id} of jobs){sql('DELETE FROM assigned_reminders WHERE job_id=?',[id]);sql('DELETE FROM assigned_briefs WHERE job_id=?',[id]);sql('DELETE FROM assigned_jobs WHERE id=?',[id]);}
}
