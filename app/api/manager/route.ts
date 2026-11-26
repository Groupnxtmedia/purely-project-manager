import {env} from 'cloudflare:workers';
import {notificationColumns,requestIdentity,validateNotifications,type TeamNotification} from '../../../lib/notifications';
import {getSession} from '../../../lib/session';
import {requestBoardId} from '../../../lib/gantts';
import {findGantt} from '../../../lib/gantt-store';
import {readBoard} from '../../../lib/board-store';
import {askManager,type HistorySearch} from '../../../lib/manager-ai';
import {validateUpdates,type ManagerTurn,type ProjectLog,type ProjectMemory} from '../../../lib/manager';
export const dynamic='force-dynamic';
const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
const db=()=>{if(!env.DB)throw Error('Database unavailable.');return env.DB;};
function turn(row:Record<string,unknown>):ManagerTurn{return {id:row.id,author:row.author,message:row.message,reply:row.reply,drafts:JSON.parse(row.drafts as string),notifications:JSON.parse((row.notification_drafts as string)||'[]'),status:row.status,createdAt:row.created_at,updatedAt:row.updated_at} as ManagerTurn;}
const logColumns='id, project_id AS projectId, project_title AS projectTitle, author, work_done AS workDone, status, next_steps AS nextSteps, blockers, created_at AS createdAt, turn_id AS turnId';
async function historySearch(queries:HistorySearch[],activeProjectIds:string[]){return Promise.all(queries.map(async q=>{
 const terms=q.query.trim().split(/\s+/).filter(Boolean).slice(0,8);
 const activeClause=activeProjectIds.length?`project_id IN (${activeProjectIds.map(()=>'?').join(',')}) AND `:'0=1 AND ';
 const clause=activeClause+(q.projectId?'project_id = ? AND ':'')+(terms.length?terms.map(()=>"(work_done || ' ' || coalesce(status,'') || ' ' || coalesce(next_steps,'') || ' ' || coalesce(blockers,'') || ' ' || created_at || ' ' || author) LIKE ? ESCAPE '\\'").join(' AND '):'1=1');
 const bindings=[...activeProjectIds,...(q.projectId?[q.projectId]:[]),...terms.map(t=>'%'+t.replace(/[\\%_]/g,'\\$&')+'%')];
 const count=await db().prepare(`SELECT count(*) AS count FROM project_logs WHERE ${clause}`).bind(...bindings).first<{count:number}>();
 const logs=await db().prepare(`SELECT ${logColumns} FROM project_logs WHERE ${clause} ORDER BY created_at DESC,id DESC LIMIT 80`).bind(...bindings).all();
 return {query:q,totalMatches:count?.count??0,truncated:(count?.count??0)>80,logs:logs.results};
}));}
export async function GET(request:Request){
 const session=await getSession();if(!session)return reply({error:'Sign in to speak with David.'},401);
 try{const boardId=requestBoardId(request);if(!boardId||!await findGantt(boardId))return reply({error:'Gantt board not found.'},404);const rows=await db().prepare("SELECT * FROM manager_turns WHERE author=? AND board_id=? ORDER BY created_at DESC,id DESC LIMIT 40").bind(session.name,boardId).all<Record<string,unknown>>();return reply({turns:rows.results.reverse().map(turn)});}catch{return reply({error:'The conversation could not load. Please retry.'},500);}
}
export async function POST(request:Request){
 const session=await getSession();if(!session)return reply({error:'Your session ended. Sign in again.'},401);
 const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)return reply({error:'Invalid request origin.'},403);
 let body;try{const raw=await request.text();if(raw.length>65000)return reply({error:'This update is too long.'},413);body=JSON.parse(raw);}catch{return reply({error:'Invalid request.'},400);}
 if(!body||typeof body.id!=='string'||!/^[\da-f-]{36}$/i.test(body.id))return reply({error:'Invalid message reference.'},400);
 try{
  const boardId=requestBoardId(request),gantt=boardId?await findGantt(boardId):null;if(!boardId||!gantt)return reply({error:'Gantt board not found.'},404);
  const existing=await db().prepare('SELECT * FROM manager_turns WHERE id=?').bind(body.id).first<Record<string,unknown>>();
  if(existing&&existing.board_id!==boardId)return reply({error:'This conversation belongs to another Gantt board.'},403);
  if(existing&&existing.author!==session.name)return reply({error:'This conversation belongs to another teammate.'},403);
  if(body.action==='dismiss'){
   await db().prepare("UPDATE manager_turns SET status='dismissed',updated_at=? WHERE id=? AND author=? AND status='ready'").bind(new Date().toISOString(),body.id,session.name).run();return reply({ok:true});
  }
  if(body.action==='confirm'){
   if(!existing)return reply({error:'This draft no longer exists.'},404);
   if(existing.status==='confirmed')return reply({turn:turn(existing),alreadySaved:true});
   if(existing.status!=='ready')return reply({error:'This draft is no longer awaiting confirmation.'},409);
   const board=await readBoard(boardId);let updates,notifications;
   try{updates=validateUpdates(body.updates,board,true);notifications=validateNotifications(body.notifications??[],board,session.name,true);if(!(updates.length+notifications.length)||updates.length!==JSON.parse(existing.drafts as string).length||notifications.length!==JSON.parse((existing.notification_drafts as string)||'[]').length)throw Error('Review every project update and deliverable request in this draft.');}catch(e){return reply({error:(e as Error).message},400);}
   const now=new Date().toISOString(),confirmationId=crypto.randomUUID();
   // The entire confirmation is a single transaction. The gate checks both the
   // original author and every project against the current board, not a stale UI.
   // A board revision gate also protects linked tasks against concurrent deletion/moves.
   const statements=[db().prepare("UPDATE manager_turns SET status='confirming',confirmation_id=? WHERE id=? AND author=? AND status='ready' AND EXISTS(SELECT 1 FROM board_state WHERE id=? AND revision=?)").bind(confirmationId,body.id,session.name,boardId,board.revision)];
   updates.forEach((u,i)=>{
    const logId=`${body.id}-${i}`;
    statements.push(db().prepare(`INSERT INTO project_logs (id,project_id,project_title,author,work_done,status,next_steps,blockers,created_at,turn_id) SELECT ?,?,json_extract(value,'$.title'),?,?,?,?,?,?,? FROM board_state,json_each(board_state.projects) WHERE board_state.id=? AND json_extract(value,'$.id')=? AND EXISTS(SELECT 1 FROM manager_turns WHERE id=? AND status='confirming' AND confirmation_id=?)`).bind(logId,u.projectId,session.name,u.workDone,u.status,u.nextSteps,u.blockers,now,body.id,boardId,u.projectId,body.id,confirmationId));
    statements.push(db().prepare(`INSERT INTO project_memory (project_id,status,next_steps,blockers,updated_at,author,last_log_id) SELECT project_id,status,next_steps,blockers,created_at,author,id FROM project_logs WHERE id=? AND EXISTS(SELECT 1 FROM manager_turns WHERE id=? AND status='confirming' AND confirmation_id=?) ON CONFLICT(project_id) DO UPDATE SET status=coalesce(excluded.status,project_memory.status),next_steps=coalesce(excluded.next_steps,project_memory.next_steps),blockers=coalesce(excluded.blockers,project_memory.blockers),updated_at=excluded.updated_at,author=excluded.author,last_log_id=excluded.last_log_id`).bind(logId,body.id,confirmationId));
   });
   notifications.forEach((n,i)=>{
    const project=board.projects.find(p=>p.id===n.projectId)!,task=board.tasks.find(t=>t.id===n.taskId);
    // A unique active key makes retries and repeated open requests non-spamming.
    statements.push(db().prepare(`INSERT INTO notifications (board_id,id,recipient,sender,project_id,project_title,task_id,task_title,deliverable,reason,turn_id,active_key,created_at) SELECT ?,?,?,?,?,?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM manager_turns WHERE id=? AND status='confirming' AND confirmation_id=?) ON CONFLICT(active_key) DO NOTHING`).bind(boardId,`${body.id}-notification-${i}`,n.recipient,session.name,n.projectId,project.title,n.taskId,task?.title??null,n.deliverable,n.reason,body.id,requestIdentity(session.name,n),now,body.id,confirmationId));
   });
   statements.push(db().prepare("UPDATE manager_turns SET status='confirmed',drafts=?,notification_drafts=?,updated_at=? WHERE id=? AND status='confirming' AND confirmation_id=?").bind(JSON.stringify(updates),JSON.stringify(notifications),now,body.id,confirmationId));
   await db().batch(statements);
   const saved=await db().prepare('SELECT * FROM manager_turns WHERE id=?').bind(body.id).first<Record<string,unknown>>();
   if(saved?.status!=='confirmed')return reply({error:'The projects changed while you were confirming. Refresh and review your project choices.'},409);
   return reply({turn:turn(saved)});
  }
  if(body.action!=='chat'||typeof body.message!=='string'||!body.message.trim()||body.message.length>6000)return reply({error:'Enter a message of up to 6,000 characters.'},400);
  if(existing&&existing.message!==body.message.trim())return reply({error:'Retry the original message or send this as a new message.'},409);
  if(existing&&['ready','answered','confirmed','dismissed'].includes(existing.status as string))return reply({turn:turn(existing)});
  if(existing&&existing.status==='processing'&&Date.parse(existing.updated_at as string)>Date.now()-200000)return reply({turn:turn(existing)},202);
  const now=new Date().toISOString();
  if(!existing){
   const limit=await db().prepare('SELECT count(*) AS count FROM manager_turns WHERE author=? AND created_at>?').bind(session.name,new Date(Date.now()-600000).toISOString()).first<{count:number}>();
   if((limit?.count??0)>=20)return reply({error:'Please wait a few minutes before sending more messages.'},429);
  }
  const claim=existing?await db().prepare("UPDATE manager_turns SET status='processing',updated_at=? WHERE id=? AND updated_at=? AND status IN ('failed','processing')").bind(now,body.id,existing.updated_at).run():await db().prepare("INSERT INTO manager_turns (id,board_id,author,message,reply,drafts,status,created_at,updated_at) VALUES (?,?,?,?,'','[]','processing',?,?) ON CONFLICT(id) DO NOTHING").bind(body.id,boardId,session.name,body.message.trim(),now,now).run();
  if(!claim.meta.changes)return reply({error:'This message is already being processed. Refresh in a moment.'},409);
  try{
   const board=await readBoard(boardId);
   const [memory,logs,history,counts,requests]=await Promise.all([
    db().prepare('SELECT project_id AS projectId,status,next_steps AS nextSteps,blockers,updated_at AS updatedAt,author,last_log_id AS lastLogId FROM project_memory').all<ProjectMemory>(),
    db().prepare(`SELECT ${logColumns} FROM (SELECT *,row_number() OVER (PARTITION BY project_id ORDER BY created_at DESC,id DESC) AS rn FROM project_logs) WHERE rn<=6 ORDER BY created_at DESC`).all<ProjectLog>(),
    db().prepare("SELECT * FROM manager_turns WHERE author=? AND board_id=? AND id<>? AND status NOT IN ('failed','processing') ORDER BY created_at DESC,id DESC LIMIT 16").bind(session.name,boardId,body.id).all<Record<string,unknown>>(),
    db().prepare('SELECT project_id AS projectId,count(*) AS count FROM project_logs GROUP BY project_id').all<{projectId:string;count:number}>(),
    db().prepare(`SELECT ${notificationColumns} FROM notifications WHERE board_id=? AND (sender=? OR recipient=?) ORDER BY (resolved_at IS NULL) DESC,created_at DESC LIMIT 100`).bind(boardId,session.name,session.name).all<TeamNotification>()
   ]);
   const answer=await askManager({ganttName:gantt.name,notifications:requests.results,name:session.name,message:body.message.trim(),board,memory:memory.results.filter(m=>board.projects.some(p=>p.id===m.projectId)),logs:logs.results.filter(l=>board.projects.some(p=>p.id===l.projectId)),history:history.results.reverse().map(turn),logCounts:Object.fromEntries(counts.results.map(c=>[c.projectId,c.count])),search:queries=>historySearch(queries,board.projects.map(p=>p.id))});
   await db().prepare("UPDATE manager_turns SET reply=?,drafts=?,notification_drafts=?,status=?,updated_at=? WHERE id=? AND status='processing' AND updated_at=?").bind(answer.reply,JSON.stringify(answer.updates),JSON.stringify(answer.notifications),(answer.updates.length||answer.notifications.length)?'ready':'answered',new Date().toISOString(),body.id,now).run();
   return reply({turn:turn((await db().prepare('SELECT * FROM manager_turns WHERE id=?').bind(body.id).first<Record<string,unknown>>())!)});
  }catch(e){
   const message=e instanceof Error&&e.message.startsWith('David')?e.message:'David could not finish this request. Your message is retained; please retry.';
   await db().prepare("UPDATE manager_turns SET status='failed',reply=?,updated_at=? WHERE id=? AND status='processing' AND updated_at=?").bind(message,new Date().toISOString(),body.id,now).run();
   return reply({error:message},503);
  }
 }catch{console.error('Manager request failed');return reply({error:'The request could not finish. Refresh to check its status before retrying.'},500);}
}
