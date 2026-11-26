import {assignedOwner,assignedDb,privateReply,privateError,sameOrigin} from '../../../../lib/assigned-auth';
import {assignedViewQuery,readAssignedView} from '../../../../lib/assigned-store';
import {askAssignedDavid} from '../../../../lib/assigned-ai';
import type {AssignedTurn,CompletionProposal} from '../../../../lib/assigned-work';
export const dynamic='force-dynamic';
function turn(row:Record<string,unknown>):AssignedTurn{return {id:row.id,message:row.message,reply:row.reply,proposals:JSON.parse(row.proposals as string),status:row.status,createdAt:row.created_at,updatedAt:row.updated_at} as AssignedTurn;}
export async function GET(){try{const owner=await assignedOwner();const rows=await assignedDb().prepare('SELECT * FROM assigned_turns WHERE owner_id=? ORDER BY created_at DESC,id DESC LIMIT 40').bind(owner.userId).all<Record<string,unknown>>();return privateReply({turns:rows.results.reverse().map(turn)});}catch(e){return privateError(e);}}
export async function POST(request:Request){
 if(!sameOrigin(request))return privateReply({error:'Invalid request origin.'},403);
 try{
  const owner=await assignedOwner();const raw=await request.text();if(raw.length>12000)return privateReply({error:'Keep your message under 6,000 characters.'},413);
  let body;try{body=JSON.parse(raw);}catch{return privateReply({error:'Invalid request.'},400);}
  if(typeof body.id!=='string'||!/^[\da-f-]{36}$/i.test(body.id))return privateReply({error:'Invalid message reference.'},400);
  const db=assignedDb(),existing=await db.prepare('SELECT * FROM assigned_turns WHERE id=? AND owner_id=?').bind(body.id,owner.userId).first<Record<string,unknown>>();
  const readTurn=async()=>turn((await db.prepare('SELECT * FROM assigned_turns WHERE id=? AND owner_id=?').bind(body.id,owner.userId).first<Record<string,unknown>>())!);
  if(body.action==='dismiss'){
   if(!existing)return privateReply({error:'Draft not found.'},404);
   await db.prepare("UPDATE assigned_turns SET status='dismissed',updated_at=? WHERE id=? AND owner_id=? AND status='ready'").bind(new Date().toISOString(),body.id,owner.userId).run();return privateReply({turn:await readTurn()});
  }
  if(body.action==='confirm'){
   if(!existing)return privateReply({error:'Draft not found.'},404);
   if(existing.status==='confirmed')return privateReply({turn:turn(existing)});
   if(existing.status!=='ready')return privateReply({error:'This draft is no longer awaiting confirmation.'},409);
   // Only stored model proposals can be confirmed; client-supplied job IDs are ignored.
   const proposals=JSON.parse(existing.proposals as string) as CompletionProposal[];
   if(!proposals.length)return privateReply({error:'There are no jobs to complete in this draft.'},400);
   const now=new Date().toISOString(),confirmationId=crypto.randomUUID(),access=await assignedViewQuery(owner,'visible');
   const checks=proposals.map(()=> 'EXISTS(SELECT 1 FROM accessible_jobs WHERE id=? AND revision=? AND completed_at IS NULL)').join(' AND ');
   // Bind shared access once so a 20-job confirmation stays below D1's parameter limit.
   const statements=[db.prepare(`WITH accessible_jobs AS (SELECT id,revision,completed_at FROM assigned_jobs j WHERE ${access.where}) UPDATE assigned_turns SET status='confirming',confirmation_id=? WHERE id=? AND owner_id=? AND status='ready' AND ${checks}`).bind(...access.bindings,confirmationId,body.id,owner.userId,...proposals.flatMap(p=>[p.id,p.revision]))];
   for(const p of proposals)statements.push(db.prepare(`UPDATE assigned_jobs AS j SET completed_at=?,revision=revision+1,reminder_version=reminder_version+1,updated_at=? WHERE id=? AND revision=? AND completed_at IS NULL AND ${access.where} AND EXISTS(SELECT 1 FROM assigned_turns WHERE id=? AND owner_id=? AND status='confirming' AND confirmation_id=?)`).bind(now,now,p.id,p.revision,...access.bindings,body.id,owner.userId,confirmationId));
   statements.push(db.prepare("UPDATE assigned_turns SET status='confirmed',updated_at=? WHERE id=? AND owner_id=? AND status='confirming' AND confirmation_id=?").bind(now,body.id,owner.userId,confirmationId));
   await db.batch(statements);const saved=await readTurn();if(saved.status!=='confirmed')return privateReply({error:'A job changed since David proposed this. Discard this card and ask David again.'},409);
   return privateReply({turn:saved});
  }
  if(body.action!=='chat'||typeof body.message!=='string'||!body.message.trim()||body.message.length>6000)return privateReply({error:'Write a message of up to 6,000 characters.'},400);
  if(existing&&!['failed','processing'].includes(existing.status as string))return privateReply({turn:turn(existing)});
  if(existing?.status==='processing'&&Date.now()-Date.parse(existing.updated_at as string)<120000)return privateReply({error:'David is still responding. Please wait.'},409);
  const window=Math.floor(Date.now()/900000),rate=await db.prepare('INSERT INTO login_attempts (id,count,window) VALUES (?,1,?) ON CONFLICT(id) DO UPDATE SET count=CASE WHEN window=excluded.window THEN count+1 ELSE 1 END,window=excluded.window RETURNING count').bind('assigned-chat:'+owner.userId,window).first<{count:number}>();
  if((rate?.count??0)>30)return privateReply({error:'David has received many messages. Please try again in 15 minutes.'},429);
  const now=new Date().toISOString();
  if(existing){const claim=await db.prepare("UPDATE assigned_turns SET status='processing',reply='',updated_at=? WHERE id=? AND owner_id=? AND updated_at=?").bind(now,body.id,owner.userId,existing.updated_at).run();if(!claim.meta.changes)return privateReply({error:'This message is being handled. Please refresh.'},409);}
  else {const claim=await db.prepare('INSERT OR IGNORE INTO assigned_turns (id,owner_id,message,created_at,updated_at) VALUES (?,?,?,?,?)').bind(body.id,owner.userId,body.message.trim(),now,now).run();if(!claim.meta.changes)return privateReply({error:'This message is already being handled. Please refresh.'},409);}
  try{
   const [view,rows]=await Promise.all([readAssignedView(owner,owner.canViewAll?'everyone':'visible'),db.prepare("SELECT * FROM assigned_turns WHERE owner_id=? AND id<>? AND status NOT IN ('failed','processing') ORDER BY created_at DESC,id DESC LIMIT 16").bind(owner.userId,body.id).all<Record<string,unknown>>()]);
   const answer=await askAssignedDavid(existing?existing.message as string:body.message.trim(),view.jobs,view.briefs,rows.results.reverse().map(turn),owner.name);
   await db.prepare("UPDATE assigned_turns SET reply=?,proposals=?,status=?,updated_at=? WHERE id=? AND owner_id=? AND status='processing' AND updated_at=?").bind(answer.reply,JSON.stringify(answer.proposals),answer.proposals.length?'ready':'answered',new Date().toISOString(),body.id,owner.userId,now).run();return privateReply({turn:await readTurn()});
  }catch(e){const message=e instanceof Error&&e.message.startsWith('David')?e.message:'David could not finish this request. Please retry.';await db.prepare("UPDATE assigned_turns SET status='failed',reply=?,updated_at=? WHERE id=? AND owner_id=? AND status='processing' AND updated_at=?").bind(message,new Date().toISOString(),body.id,owner.userId,now).run();return privateReply({error:message},503);}
 }catch(e){return privateError(e);}
}
