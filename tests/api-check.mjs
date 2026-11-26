import assert from 'node:assert/strict';
const base='http://127.0.0.1:5173';
async function request(path,body,cookie,origin=base){const r=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{...(body===undefined?{}:{'Content-Type':'application/json',Origin:origin}),...(cookie?{Cookie:cookie}:{})},body:body===undefined?undefined:JSON.stringify(body)});const raw=await r.text();let data;try{data=JSON.parse(raw);}catch{data={error:raw};}return {status:r.status,data,cookie:r.headers.get('set-cookie')?.split(';')[0]};}
assert.equal((await request('/api/board')).status,401);
assert.equal((await request('/api/session',{})).status,400);
assert.equal((await request('/api/session',{name:'Unknown'})).status,400);
const users={};for(const name of ['Arjun','Keanu','Matthew','Dean']){const r=await request('/api/session',{name,code:process.env.TEST_TEAM_ACCESS_CODE||'test-team-password'});assert.equal(r.status,200);users[name]=r.cookie;assert.equal((await request('/api/session',undefined,r.cookie)).data.session.name,name);}
let b=(await request('/api/board',undefined,users.Dean)).data;assert.equal(b.projects.length,24);
assert.equal((await request('/api/board',undefined,users.Arjun)).data.revision,b.revision);
assert.equal((await request('/api/board',{revision:b.revision,action:{type:'setProgress',id:'project-1',value:50}},users.Dean,'https://wrong.example')).status,403);
async function mutate(action){const r=await request('/api/board',{revision:b.revision,action},users.Dean);assert.equal(r.status,200,JSON.stringify(r.data));b=r.data;return b;}
await mutate({type:'saveProject',project:{title:'QA API project',owners:['Dean','Matthew'],department:'MB&A',startWeek:'2026-10-28',deadlineWeek:'2026-11-04'}});
const projectId=b.projects.at(-1).id;
const stale=b.revision-1;assert.equal((await request('/api/board',{revision:stale,action:{type:'setProgress',id:projectId,value:50}},users.Arjun)).status,409);
await mutate({type:'saveTask',task:{title:'QA API task',description:'Persisted task',responsible:'Keanu',priority:'High',hours:2.5,projectId,weight:60,dependency:null}});
const task=b.tasks.at(-1);await mutate({type:'toggleTask',id:task.id});
const other=(await request('/api/board',undefined,users.Matthew)).data;assert.equal(other.tasks.find(t=>t.id===task.id).completed,true);
await mutate({type:'setProgress',id:projectId,value:80});assert.equal(b.projects.at(-1).manualProgress,80);
await mutate({type:'setProgress',id:projectId,value:null});assert.equal(b.projects.at(-1).manualProgress,null);
const concurrent=await Promise.all([request('/api/board',{revision:b.revision,action:{type:'setProgress',id:projectId,value:40}},users.Arjun),request('/api/board',{revision:b.revision,action:{type:'setProgress',id:projectId,value:50}},users.Keanu)]);assert.deepEqual(concurrent.map(r=>r.status).sort(),[200,409]);
b=(await request('/api/board',undefined,users.Dean)).data;await mutate({type:'deleteProject',id:projectId});
for(const t of b.tasks.filter(t=>t.title.startsWith('QA:')))await mutate({type:'deleteTask',id:t.id});await mutate({type:'setProgress',id:'project-1',value:null});
assert.equal(b.projects.length,24);assert.equal(b.tasks.length,0);
const tampered=users.Dean.slice(0,-1)+(users.Dean.endsWith('0')?'1':'0');assert.equal((await request('/api/board',undefined,tampered)).status,401);
console.log('PASS: access gate, four team identities, shared persistence, project/task CRUD, progress overrides, CSRF, tampered cookie rejection, stale and concurrent save protection. Test records removed.');
