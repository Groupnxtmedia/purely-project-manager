// Local integration checks: never connects to the hosted app or calls OpenAI.
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
const BASE='http://127.0.0.1:5173';
async function login(name){const r=await fetch(BASE+'/api/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,code:process.env.TEST_TEAM_ACCESS_CODE||'test-team-password'})});assert.equal(r.status,200);return r.headers.get('set-cookie').split(';')[0];}
async function call(path,cookie,body,origin=BASE){const r=await fetch(BASE+path,{method:body?'POST':'GET',headers:{Cookie:cookie??'','Content-Type':'application/json',Origin:origin},body:body?JSON.stringify(body):undefined});const raw=await r.text();let data;try{data=JSON.parse(raw);}catch{data={error:raw};}return {status:r.status,data};}
const cookies=Object.fromEntries(await Promise.all(['Dean','Matthew','Arjun','Keanu'].map(async name=>[name,await login(name)])));
const run=crypto.randomUUID(),prefix=`Local QA ${run.slice(0,8)}: `;
const dean=cookies.Dean,matthew=cookies.Matthew,arjun=cookies.Arjun;
const board=(await call('/api/board',dean)).data;
const project=board.projects.find(p=>p.id==='project-12');assert.ok(project);
const draft={recipient:'Matthew',projectId:project.id,taskId:null,deliverable:prefix+'Approve welcome email copy',reason:'Dean cannot schedule Email campaigns until the copy is approved.'};
function seed(id,notifications=[draft],updates=[]){
 const script=`import sqlite3,glob,json,sys\npayload=json.load(sys.stdin)\npaths=[p for p in glob.glob('.wrangler/state/v3/d1/**/*.sqlite',recursive=True) if not p.endswith('metadata.sqlite')]\nassert len(paths)==1\nc=sqlite3.connect(paths[0],timeout=10)\nc.execute("INSERT INTO manager_turns (id,author,message,reply,drafts,notification_drafts,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)",payload)\nc.commit()`;
 const now=new Date().toISOString();const r=spawnSync('python3',['-c',script],{input:JSON.stringify([id,'Dean',prefix+'Waiting on copy approval.','Please review the recipient and project before sending.',JSON.stringify(updates),JSON.stringify(notifications),'ready',now,now]),encoding:'utf8'});assert.equal(r.status,0,r.stderr);
}
const id=crypto.randomUUID();seed(id);
const count=async cookie=>(await call('/api/notifications',cookie)).data.notifications.filter(n=>n.deliverable.startsWith(prefix));
assert.equal((await call('/api/notifications','')).status,401);
assert.equal((await count(matthew)).length,0);
assert.equal((await call('/api/manager',arjun,{action:'confirm',id,updates:[],notifications:[draft]})).status,403);
assert.equal((await call('/api/manager',dean,{action:'confirm',id,updates:[],notifications:[{...draft,recipient:null}]})).status,400);
assert.equal((await call('/api/manager',dean,{action:'confirm',id,updates:[],notifications:[{...draft,taskId:'deleted-task'}]})).status,400);
const confirmed=await Promise.all([1,2].map(()=>call('/api/manager',dean,{action:'confirm',id,updates:[],notifications:[draft],sender:'Arjun'})));
confirmed.forEach(r=>assert.equal(r.status,200,JSON.stringify(r.data)));
let received=await count(matthew);assert.equal(received.length,1);assert.equal(received[0].sender,'Dean');assert.equal(received[0].readAt,null);
const nid=received[0].id;
assert.equal((await count(arjun)).length,0);assert.equal((await count(cookies.Keanu)).length,0);
assert.equal((await call('/api/notifications?recipient=Matthew',arjun)).data.notifications.some(n=>n.id===nid),false);
assert.equal((await call('/api/notifications',arjun,{action:'read',id:nid})).status,404);
assert.equal((await call('/api/notifications',dean,{action:'resolve',id:nid,note:'Spoofed'})).status,403);
assert.equal((await call('/api/notifications',matthew,{action:'resolve',id:nid,note:'CSRF'},'https://untrusted.example')).status,403);
assert.equal((await call('/api/notifications',matthew,{action:'read',id:nid})).status,200);
assert.ok((await count(matthew))[0].readAt);assert.equal((await count(matthew))[0].resolvedAt,null);
console.log('PASS: confirmation required; recipient isolation, authenticated sender, CSRF, and concurrent retry safety.');
const duplicateId=crypto.randomUUID();seed(duplicateId);
assert.equal((await call('/api/manager',dean,{action:'confirm',id:duplicateId,updates:[],notifications:[draft]})).status,200);
assert.equal((await count(matthew)).length,1);
const resolutions=await Promise.all([1,2].map(()=>call('/api/notifications',matthew,{action:'resolve',id:nid,note:'Copy approved; ready to schedule.'})));
resolutions.forEach(r=>assert.equal(r.status,200));
let sent=(await call('/api/notifications?view=sent',dean)).data;
const delivery=sent.notifications.find(n=>n.id===nid);assert.ok(delivery.resolvedAt);assert.equal(delivery.resolutionNote,'Copy approved; ready to schedule.');assert.equal(delivery.senderReadAt,null);
assert.equal((await call('/api/notifications',dean,{action:'read',id:nid})).status,200);
sent=(await call('/api/notifications?view=sent',dean)).data;assert.ok(sent.notifications.find(n=>n.id===nid).senderReadAt);
assert.equal((await call('/api/board',dean)).data.revision,board.revision);
console.log('PASS: duplicate open requests suppressed; recipient delivery persists, sender acknowledgement works, board progress untouched.');
const mixedId=crypto.randomUUID();const log={projectId:project.id,workDone:prefix+'Drafted welcome email.',status:null,nextSteps:null,blockers:'Waiting for copy approval.'};
seed(mixedId,[{...draft,deliverable:prefix+'Review follow-up email'}],[log]);
const historyBefore=(await call('/api/project-history?projectId='+project.id,dean)).data.total;
assert.equal((await call('/api/manager',dean,{action:'confirm',id:mixedId,updates:[log],notifications:[{...draft,projectId:'deleted'}]})).status,400);
assert.equal((await call('/api/project-history?projectId='+project.id,dean)).data.total,historyBefore);
assert.equal((await call('/api/manager',dean,{action:'confirm',id:mixedId,updates:[log],notifications:[{...draft,deliverable:prefix+'Review follow-up email'}]})).status,200);
assert.equal((await call('/api/project-history?projectId='+project.id,dean)).data.total,historyBefore+1);
const dismissedId=crypto.randomUUID();seed(dismissedId,[{...draft,deliverable:prefix+'Discarded request'}]);
assert.equal((await call('/api/manager',dean,{action:'dismiss',id:dismissedId})).status,200);
assert.equal((await call('/api/manager',dean,{action:'confirm',id:dismissedId,updates:[],notifications:[draft]})).status,409);
console.log('PASS: combined log/request validation is atomic; dismissed proposals cannot send.');
// Leave one local-only draft for the browser confirmation test.
const uiId=crypto.randomUUID();seed(uiId,[{...draft,deliverable:'Approve welcome email copy (local preview)',reason:'The welcome campaign is ready to schedule once the final copy is approved.'}]);
console.log('PASS: local integration checks complete. A separate local preview draft is ready for UI testing.');
