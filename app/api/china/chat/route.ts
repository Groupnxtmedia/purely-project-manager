import {getSession} from '../../../../lib/session';
import {chinaId,type ChinaMessage} from '../../../../lib/china';
import {chinaDb,chinaReply,chinaOrigin,findChinaTask,chinaMessageColumns} from '../../../../lib/china-store';
import {askChinaDavid} from '../../../../lib/china-ai';
export const dynamic='force-dynamic';
export async function GET(request:Request){
 if(!await getSession())return chinaReply({error:'Sign in to read task conversations.'},401);
 const url=new URL(request.url),id=url.searchParams.get('taskId');if(!chinaId(id))return chinaReply({error:'Choose a task.'},400);
 try{
  const task=await findChinaTask(id);if(!task)return chinaReply({error:'Task not found.'},404);
  const cursor=url.searchParams.get('before');let where='',args:string[]=[];
  if(cursor){const parts=cursor.split('|');if(parts.length!==2||!/^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/.test(parts[0])||!/^[-a-f0-9:]+$/.test(parts[1])||cursor.length>120)return chinaReply({error:'Invalid conversation page.'},400);where=' AND (created_at<? OR (created_at=? AND id<?))';args=[parts[0],parts[0],parts[1]];}
  const rows=(await chinaDb().prepare(`SELECT ${chinaMessageColumns} FROM china_messages WHERE task_id=?${where} ORDER BY created_at DESC,id DESC LIMIT 41`).bind(id,...args).all<ChinaMessage>()).results;
  const hasMore=rows.length>40,page=rows.slice(0,40).reverse();
  return chinaReply({task,messages:page,olderCursor:hasMore?`${page[0].createdAt}|${page[0].id}`:null});
 }catch{return chinaReply({error:'This conversation could not load. Please retry.'},500);}
}
export async function POST(request:Request){
 const user=await getSession();if(!user)return chinaReply({error:'Sign in again to send a message.'},401);
 if(!chinaOrigin(request))return chinaReply({error:'Invalid request origin.'},403);
 let body;try{const raw=await request.text();if(raw.length>8000)return chinaReply({error:'Keep your message under 6,000 characters.'},413);body=JSON.parse(raw);if(!body||typeof body!=='object'||Array.isArray(body))throw Error();}catch{return chinaReply({error:'Invalid request.'},400);}
 if(!chinaId(body.taskId)||!chinaId(body.id)||!['send','retry'].includes(body.action))return chinaReply({error:'Invalid message reference.'},400);
 const db=chinaDb();
 try{
  const task=await findChinaTask(body.taskId);if(!task)return chinaReply({error:'Task not found.'},404);
  if(task.archivedAt)return chinaReply({error:'This task’s conversation is archived and read-only. Restore the task to continue.'},409);
  const existing=await db.prepare(`SELECT ${chinaMessageColumns} FROM china_messages WHERE id=?`).bind(body.id).first<ChinaMessage>();
  if(existing&&(existing.taskId!==task.id||existing.kind!=='team'))return chinaReply({error:'This message belongs to another conversation.'},409);
  let wantsDavid=false;
  if(body.action==='send'){
   if(typeof body.message!=='string'||!body.message.trim()||body.message.length>6000||typeof body.askDavid!=='boolean')return chinaReply({error:'Write a message of up to 6,000 characters.'},400);
   wantsDavid=body.askDavid;
   if(existing&&(existing.author!==user.name||existing.body!==body.message.trim()||Boolean(existing.requestDavid)!==wantsDavid))return chinaReply({error:'This message was already sent with different content.'},409);
   if(existing)return chinaReply({ok:true});
  }else{
   if(!existing?.requestDavid)return chinaReply({error:'David request not found.'},404);
   wantsDavid=true;
  }
  if(wantsDavid){const window=Math.floor(Date.now()/900000),rate=await db.prepare('INSERT INTO login_attempts (id,count,window) VALUES (?,1,?) ON CONFLICT(id) DO UPDATE SET count=CASE WHEN window=excluded.window THEN count+1 ELSE 1 END,window=excluded.window RETURNING count').bind('china-david:'+user.name,window).first<{count:number}>();if((rate?.count??0)>30)return chinaReply({error:'David has received many requests. Please try again in 15 minutes.'},429);}
  const now=new Date().toISOString(),replyId=body.id+':david';
  if(body.action==='send'){
   const statements=[db.prepare("INSERT OR IGNORE INTO china_messages (id,task_id,author,kind,body,request_david,created_at,updated_at) SELECT ?,?,?,'team',?,?,?,? WHERE EXISTS(SELECT 1 FROM china_tasks WHERE id=? AND archived_at IS NULL)").bind(body.id,task.id,user.name,body.message.trim(),wantsDavid?1:0,now,now,task.id)];
   if(wantsDavid)statements.push(db.prepare("INSERT OR IGNORE INTO china_messages (id,task_id,author,kind,body,status,reply_to,created_at,updated_at) SELECT ?,?,'David','david','','processing',?,?,? WHERE EXISTS(SELECT 1 FROM china_messages WHERE id=? AND task_id=?) AND EXISTS(SELECT 1 FROM china_tasks WHERE id=? AND archived_at IS NULL)").bind(replyId,task.id,body.id,now,now,body.id,task.id,task.id));
   const results=await db.batch(statements);if(!results[0].meta.changes)return chinaReply({error:'The task changed while sending. Reload the conversation.'},409);
   if(!wantsDavid)return chinaReply({ok:true});
   if(!results[1].meta.changes)return chinaReply({error:'The task was archived. Your message is saved.'},409);
  }else{
   const cutoff=new Date(Date.now()-120000).toISOString();
   const claimed=await db.prepare("UPDATE china_messages SET status='processing',body='',updated_at=? WHERE id=? AND task_id=? AND (status='failed' OR (status='processing' AND updated_at<?)) AND EXISTS(SELECT 1 FROM china_tasks WHERE id=? AND archived_at IS NULL)").bind(now,replyId,task.id,cutoff,task.id).run();
   if(!claimed.meta.changes)return chinaReply({error:'David is still replying, or this response is already complete. Refresh the conversation.'},409);
  }
  try{
   const [table,rows]=await Promise.all([db.prepare('SELECT name FROM china_tables WHERE id=?').bind(task.tableId).first<{name:string}>(),db.prepare(`SELECT ${chinaMessageColumns} FROM china_messages WHERE task_id=? AND status='ready' AND (created_at<? OR (created_at=? AND id<=?)) ORDER BY created_at DESC,id DESC LIMIT 40`).bind(task.id,existing?.createdAt??now,existing?.createdAt??now,body.id).all<ChinaMessage>()]);
   const answer=await askChinaDavid(task,table?.name??'China Gantt',rows.results.reverse());
   await db.prepare("UPDATE china_messages SET body=?,status='ready',updated_at=? WHERE id=? AND task_id=? AND status='processing' AND updated_at=? AND EXISTS(SELECT 1 FROM china_tasks WHERE id=? AND archived_at IS NULL)").bind(answer,new Date().toISOString(),replyId,task.id,now,task.id).run();
   return chinaReply({ok:true});
  }catch(e){const error=e instanceof Error&&e.message.startsWith('David')?e.message:'David could not respond. Your message is saved; please retry.';
   await db.prepare("UPDATE china_messages SET body=?,status='failed',updated_at=? WHERE id=? AND task_id=? AND status='processing' AND updated_at=? AND EXISTS(SELECT 1 FROM china_tasks WHERE id=? AND archived_at IS NULL)").bind(error,new Date().toISOString(),replyId,task.id,now,task.id).run();return chinaReply({ok:true,davidError:error});}
 }catch{console.error('China conversation failed');return chinaReply({error:'The message could not be sent. Please reload and retry.'},500);}
}
