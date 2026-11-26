import {env} from 'cloudflare:workers';
import {getSession,issueSession,digest,codeMatches,COOKIE,secrets} from '../../../lib/session';
import {PEOPLE} from '../../../lib/board';
export const dynamic='force-dynamic';
const reply=(data:unknown,status=200,headers:Record<string,string>={})=>Response.json(data,{status,headers:{'Cache-Control':'no-store',...headers}});
function originValid(request:Request){return !request.headers.get('origin')||request.headers.get('origin')===new URL(request.url).origin;}
function cookie(request:Request,value:string,age:number){return `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${new URL(request.url).protocol==='https:'?'; Secure':''}`;}
export async function GET(){return reply({session:await getSession()});}
export async function DELETE(request:Request){if(!originValid(request))return reply({error:'Invalid origin.'},403);return reply({ok:true},200,{'Set-Cookie':cookie(request,'',0)});}
export async function POST(request:Request){
 if(!originValid(request))return reply({error:'Invalid origin.'},403);
 if(!secrets().key||!secrets().code)return reply({error:'Team access is being set up. Please try again shortly.'},503);
 let body;try{const raw=await request.text();if(raw.length>1000)return reply({error:'Invalid request.'},400);body=JSON.parse(raw);}catch{return reply({error:'Invalid request.'},400);}
 if(!body||typeof body!=='object'||Array.isArray(body)||!PEOPLE.includes(body.name))return reply({error:'Choose your name to open the workspace.'},400);
 const ip=await digest(request.headers.get('cf-connecting-ip')??'shared');const window=Math.floor(Date.now()/900000);
 const row=await env.DB!.prepare('INSERT INTO login_attempts (id, count, window) VALUES (?, 1, ?) ON CONFLICT(id) DO UPDATE SET count = CASE WHEN window = excluded.window THEN count + 1 ELSE 1 END, window = excluded.window RETURNING count').bind(ip,window).first<{count:number}>();
 if(row!.count>20)return reply({error:'Too many attempts. Try again in 15 minutes.'},429);
 if(typeof body.code!=='string'||!await codeMatches(body.code))return reply({error:'Incorrect password. Please try again.'},401);
 return reply({session:{name:body.name}},200,{'Set-Cookie':cookie(request,await issueSession(body.name),604800)});
}
