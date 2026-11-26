import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readdirSync} from 'node:fs';
import {resolve} from 'node:path';
const base='http://127.0.0.1:8787';
const dir=resolve('.wrangler/state/v3/d1/miniflare-D1DatabaseObject');
const sqlite=resolve(dir,readdirSync(dir).find(f=>f.endsWith('.sqlite')));
function sql(query,args=[]){return JSON.parse(execFileSync('python3',['-c',"import sqlite3,json,sys; x=json.load(sys.stdin); db=sqlite3.connect(x['path']); db.row_factory=sqlite3.Row; c=db.execute(x['query'],x['args']); rows=[dict(r) for r in c.fetchall()]; db.commit(); print(json.dumps(rows))"],{input:JSON.stringify({path:sqlite,query,args}),encoding:'utf8'}));}
async function call(path,cookie,body){const r=await fetch(base+path,{method:body?'POST':'GET',headers:{Cookie:cookie??'','Content-Type':'application/json',Origin:base},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};}
const ids=[crypto.randomUUID(),crypto.randomUUID()],turns=[crypto.randomUUID(),crypto.randomUUID(),crypto.randomUUID()];let projectId;
try{
 assert.equal((await call('/api/gantts')).status,401);assert.equal((await call('/api/board?board=china')).status,401);
 const people={};for(const name of ['Dean','Matthew','Arjun','Keanu']){const r=await call('/api/session',null,{name,code:process.env.TEST_TEAM_ACCESS_CODE||'test-team-password'});assert.equal(r.status,200);people[name]=r.cookie;}
 const dean=people.Dean,team=(await call('/api/board',dean)).data;
 const initial=(await call('/api/gantts',dean)).data.gantts;assert.ok(initial.some(g=>g.id==='team'));assert.ok(initial.some(g=>g.id==='china'));
 const china=(await call('/api/board?board=china',dean)).data;assert.equal(china.projects.length,0);assert.equal(china.tasks.length,0);assert.equal(china.gantt.startWeek,'2026-11-08');assert.equal(china.gantt.endWeek,'2026-12-27');assert.equal(china.gantt.firstWeekNumber,3);
 const spec={id:ids[0],name:'QA Gantt '+ids[0],startDate:'2026-11-10',endDate:'2026-12-31'};
 const created=await Promise.all([call('/api/gantts',dean,spec),call('/api/gantts',dean,spec)]);assert.ok(created.every(r=>[200,201].includes(r.status)),JSON.stringify(created));assert.equal((await call('/api/gantts',dean)).data.gantts.filter(g=>g.id===ids[0]).length,1);
 assert.equal((await call('/api/gantts',dean,{...spec,id:crypto.randomUUID(),name:spec.name.toLowerCase()})).status,409);
 assert.equal((await call('/api/gantts',dean,{...spec,id:crypto.randomUUID(),endDate:'2026-11-01'})).status,400);
 assert.equal((await call('/api/gantts',dean,{...spec,id:ids[1],name:'QA Gantt '+ids[1]})).status,201);
 assert.equal((await call('/api/board?board=missing',dean)).status,404);
 const path='/api/board?board='+ids[0];let b=(await call(path,dean)).data;assert.equal(b.projects.length,0);assert.equal(b.gantt.startWeek,'2026-11-08');
 async function mutate(action){const r=await call(path,dean,{revision:b.revision,action});assert.equal(r.status,200,JSON.stringify(r.data));b=r.data;return b;}
 await mutate({type:'saveProject',project:{title:'QA isolated project',department:'MB&A',owners:['Dean'],startWeek:'2026-11-08',deadlineWeek:'2026-12-27'}});projectId=b.projects[0].id;
 assert.equal((await call('/api/board?board='+ids[1],dean)).data.projects.length,0);
 assert.equal((await call('/api/board?board='+ids[1],dean,{revision:0,action:{type:'setProgress',id:projectId,value:50}})).status,400);
 await mutate({type:'saveTask',task:{title:'QA isolated task',description:'Local QA',dependency:null,responsible:'Keanu',hours:2,priority:'High',projectId,weight:100}});
 const stale=b.revision;await mutate({type:'toggleTask',id:b.tasks[0].id});assert.equal(b.tasks[0].completed,true);
 assert.equal((await call(path,dean,{revision:stale,action:{type:'setProgress',id:projectId,value:50}})).status,409);
 for(const cookie of Object.values(people))assert.equal((await call(path,cookie)).data.tasks[0].completed,true);
 const update={projectId,workDone:'QA confirmed work',status:'Ready',nextSteps:'Review',blockers:null};
 const notification={recipient:'Keanu',projectId,taskId:null,deliverable:'QA test deliverable',reason:'QA test follow-up'};
 const now=new Date().toISOString();
 sql("INSERT INTO manager_turns (id,board_id,author,message,reply,drafts,notification_drafts,status,created_at,updated_at) VALUES (?,?,?,'QA report','QA draft',?,?,'ready',?,?)",[turns[0],ids[0],'Dean',JSON.stringify([update]),JSON.stringify([notification]),now,now]);
 sql("INSERT INTO manager_turns (id,board_id,author,message,reply,status,created_at,updated_at) VALUES (?,?,'Dean','Other board','QA reply','answered',?,?)",[turns[1],ids[1],now,now]);
 sql("INSERT INTO manager_turns (id,author,message,reply,status,created_at,updated_at) VALUES (?,'Dean','Legacy team record','QA reply','answered',?,?)",[turns[2],now,now]);
 const mine=(await call('/api/manager?board='+ids[0],dean)).data.turns;assert.deepEqual(mine.map(t=>t.id),[turns[0]]);assert.ok((await call('/api/manager',dean)).data.turns.some(t=>t.id===turns[2]));
 const confirm={action:'confirm',id:turns[0],updates:[update],notifications:[notification]};
 assert.equal((await call('/api/manager?board='+ids[1],dean,confirm)).status,403);
 assert.equal((await call('/api/manager?board='+ids[0],people.Arjun,confirm)).status,403);
 assert.equal((await call('/api/manager?board='+ids[0],dean,{...confirm,updates:[{...update,projectId:'project-1'}]})).status,400);
 const saved=await call('/api/manager?board='+ids[0],dean,confirm);assert.equal(saved.status,200,JSON.stringify(saved.data));assert.equal(saved.data.turn.status,'confirmed');
 assert.equal((await call('/api/manager?board='+ids[0],dean,confirm)).status,200);
 const history=(await call('/api/project-history?board='+ids[0]+'&projectId='+projectId,people.Arjun));assert.equal(history.status,200);assert.equal(history.data.total,1);assert.equal(history.data.memory.nextSteps,'Review');
 assert.equal((await call('/api/project-history?board='+ids[1]+'&projectId='+projectId,dean)).status,404);
 const notices=(await call('/api/notifications?board='+ids[0],people.Keanu));assert.equal(notices.status,200,JSON.stringify(notices.data));assert.equal(notices.data.notifications.length,1);assert.equal(notices.data.unread,1);
 assert.equal((await call('/api/notifications?board='+ids[1],people.Keanu)).data.notifications.length,0);
 const note=notices.data.notifications[0];assert.equal((await call('/api/notifications?board='+ids[1],people.Keanu,{action:'resolve',id:note.id,note:'done'})).status,404);
 assert.equal((await call('/api/notifications?board='+ids[0],people.Keanu,{action:'resolve',id:note.id,note:'done'})).status,200);
 assert.deepEqual((await call('/api/board',dean)).data,team);
 for(const id of ids){const r=await fetch(base+'/gantt/'+id);assert.equal(r.status,200);}
 console.log('PASS: blank China board, date horizons, all four users, idempotent creation, duplicate names, separate projects/tasks/revisions, scoped David confirmations/logs/memory/notifications, legacy Team data preserved.');
}finally{
 for(const id of ids){sql('DELETE FROM notifications WHERE board_id=?',[id]);sql('DELETE FROM board_state WHERE id=?',[id]);sql('DELETE FROM gantt_boards WHERE id=?',[id]);}
 for(const id of turns){sql('DELETE FROM project_logs WHERE turn_id=?',[id]);sql('DELETE FROM manager_turns WHERE id=?',[id]);}
 if(projectId)sql('DELETE FROM project_memory WHERE project_id=?',[projectId]);
}
