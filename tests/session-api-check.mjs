// Run only against a local preview with the matching test environment values.
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
const base='http://127.0.0.1:8787';
const code=process.env.TEST_TEAM_ACCESS_CODE||'test-team-password';
const key=process.env.TEST_SESSION_SECRET||'local-session-test-key-not-for-production';
const runIp=`session-test-${Date.now()}`;
async function call(path,{body,cookie,method,origin=base,ip=runIp}={}){
 const r=await fetch(base+path,{method:method??(body===undefined?'GET':'POST'),headers:{'Content-Type':'application/json',Origin:origin,'cf-connecting-ip':ip,...(cookie?{Cookie:cookie}:{})},body:body===undefined?undefined:JSON.stringify(body)});
 return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')};
}
function signed(payload){const value=Buffer.from(JSON.stringify(payload)).toString('base64');return `purely_team=${value}.${createHmac('sha256',key).update(value).digest('hex')}`;}
assert.equal((await call('/api/session')).data.session,null);
for(const path of ['/api/board','/api/gantts','/api/assigned-work?scope=received'])assert.equal((await call(path)).status,401);
for(const body of [null,{},[],{name:'Unknown'},{name:123}])assert.equal((await call('/api/session',{body})).status,400);
assert.equal((await call('/api/session',{body:{name:'Dean',code},origin:'https://other.example'})).status,403);
for(const badCode of [undefined,null,123,'','wrong-password']){
 const denied=await call('/api/session',{body:{name:'Dean',code:badCode}});assert.equal(denied.status,401);assert.equal(denied.cookie,null);
}
// A correctly signed old name-only cookie must not bypass the restored password.
const old=signed({name:'Dean',expires:Date.now()+86400000});
assert.equal((await call('/api/session',{cookie:old})).data.session,null);
for(const path of ['/api/board','/api/gantts','/api/assigned-work?scope=received'])assert.equal((await call(path,{cookie:old})).status,401);
assert.equal((await call('/api/board',{cookie:signed({name:'Dean',authVersion:2,expires:Date.now()-1000})})).status,401);
for(const name of ['Arjun','Keanu','Matthew','Dean']){
 const opened=await call('/api/session',{body:{name,code}});assert.equal(opened.status,200,JSON.stringify(opened.data));assert.equal(opened.data.session.name,name);
 assert.match(opened.cookie,/HttpOnly/);assert.match(opened.cookie,/SameSite=Strict/);
 const cookie=opened.cookie.split(';')[0];assert.equal((await call('/api/session',{cookie})).data.session.name,name);
 assert.equal((await call('/api/board',{cookie})).status,200);
 assert.equal((await call('/api/assigned-work?scope=received',{cookie})).data.viewer.name,name);
 const changed=cookie.slice(0,-1)+(cookie.endsWith('0')?'1':'0');assert.equal((await call('/api/board',{cookie:changed})).status,401);
 assert.equal((await call('/api/board',{cookie:cookie+'.extra'})).status,401);
 const closed=await call('/api/session',{cookie,method:'DELETE'});assert.equal(closed.status,200);assert.match(closed.cookie,/Max-Age=0/);
}
for(let i=0;i<20;i++)assert.equal((await call('/api/session',{body:{name:'Dean',code:'wrong'},ip:runIp+'-limit'})).status,401);
assert.equal((await call('/api/session',{body:{name:'Dean',code},ip:runIp+'-limit'})).status,429);
console.log('PASS: password required, four profiles, old/expired/tampered sessions denied, protected data, CSRF, cookie flags, sign-out and login rate limit.');
