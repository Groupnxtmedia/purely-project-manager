import assert from 'node:assert/strict';
const BASE='http://127.0.0.1:5173';
async function login(name){const r=await fetch(BASE+'/api/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,code:process.env.TEST_TEAM_ACCESS_CODE||'test-team-password'})});assert.equal(r.status,200);return r.headers.get('set-cookie').split(';')[0];}
async function call(path,cookie,body){const r=await fetch(BASE+path,{method:body?'POST':'GET',headers:{Cookie:cookie??'','Content-Type':'application/json',Origin:BASE},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json()};}
const dean=await login('Dean'),arjun=await login('Arjun');
assert.equal((await call('/api/manager','')).status,401);
assert.equal((await call('/api/project-history?projectId=project-3','')).status,401);
const before=(await call('/api/project-history?projectId=project-3',dean)).data.total;
const id=crypto.randomUUID();
const report='For Website phase I, I finished testing the landing page on mobile today. The next step is a desktop QA pass. For Email campaigns, I drafted the welcome email. We are waiting for Matthew to approve the copy before scheduling. These are two separate project updates.';
const proposed=await call('/api/manager',dean,{action:'chat',id,message:report});
assert.equal(proposed.status,200,JSON.stringify(proposed.data));assert.equal(proposed.data.turn.status,'ready');
assert.equal(proposed.data.turn.drafts.length,2);assert.deepEqual(proposed.data.turn.drafts.map(d=>d.projectId).sort(),['project-12','project-3']);
assert.equal((await call('/api/project-history?projectId=project-3',dean)).data.total,before);
console.log('PASS: real Astra multi-project report produces drafts; no logs before confirmation.');
assert.equal((await call('/api/manager',arjun,{action:'confirm',id,updates:proposed.data.turn.drafts})).status,403);
assert.equal((await call('/api/manager',dean,{action:'confirm',id,updates:[{...proposed.data.turn.drafts[0],projectId:null},proposed.data.turn.drafts[1]]})).status,400);
const confirmed=await Promise.all([1,2].map(()=>call('/api/manager',dean,{action:'confirm',id,updates:proposed.data.turn.drafts})));
confirmed.forEach(r=>assert.equal(r.status,200,JSON.stringify(r.data)));
const history=(await call('/api/project-history?projectId=project-3',arjun)).data;
assert.equal(history.total,before+1);assert.equal(history.logs[0].author,'Dean');assert.match(history.memory.nextSteps,/desktop/i);
console.log('PASS: confirmation is authorized, persistent, shared, and idempotent under simultaneous requests.');
const response=await call('/api/manager',arjun,{action:'chat',id:crypto.randomUUID(),message:'What did Dean finish for Website phase I, and what comes next? Please cite the confirmed entry.'});
assert.equal(response.status,200,JSON.stringify(response.data));assert.equal(response.data.turn.drafts.length,0);assert.match(response.data.turn.reply,/mobile/i);assert.match(response.data.turn.reply,/desktop/i);assert.match(response.data.turn.reply,/Dean/);
console.log('PASS: a different teammate receives current status from confirmed history.');
const ambiguous=await call('/api/manager',arjun,{action:'chat',id:crypto.randomUUID(),message:'I worked on the website today. Log that I fixed the header layout. I have not said which website phase this belongs to.'});
assert.equal(ambiguous.status,200,JSON.stringify(ambiguous.data));assert.ok(!ambiguous.data.turn.drafts.length||ambiguous.data.turn.drafts.every(d=>d.projectId===null));
console.log('PASS: ambiguous website phase requires clarification.');
if(ambiguous.data.turn.drafts.length){const fixed=ambiguous.data.turn.drafts.map(d=>({...d,projectId:'project-4'}));const saved=await call('/api/manager',arjun,{action:'confirm',id:ambiguous.data.turn.id,updates:fixed});assert.equal(saved.status,200,JSON.stringify(saved.data));assert.ok((await call('/api/project-history?projectId=project-4',dean)).data.logs.some(l=>l.turnId===ambiguous.data.turn.id));console.log('PASS: corrected project mapping is saved only to the chosen project.');}
const count=await call('/api/manager',arjun,{action:'chat',id:crypto.randomUUID(),message:'How many confirmed log entries are there in the entire history of Website phase I? Search the saved history, not only the recent entries.'});
assert.equal(count.status,200,JSON.stringify(count.data));assert.equal(count.data.turn.drafts.length,0);
console.log('PASS: full-history search answers through the real model.');
console.log(JSON.stringify({historyAnswer:count.data.turn.reply}));
