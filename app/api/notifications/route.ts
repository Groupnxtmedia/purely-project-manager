import {env} from 'cloudflare:workers';
import {requestBoardId} from '../../../lib/gantts';
import {findGantt} from '../../../lib/gantt-store';
import {getSession} from '../../../lib/session';
import {notificationColumns,type TeamNotification} from '../../../lib/notifications';
export const dynamic='force-dynamic';
const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});

export async function GET(request:Request){
 const session=await getSession();if(!session)return reply({error:'Sign in to see your notifications.'},401);
 try{
  const boardId=requestBoardId(request);if(!boardId||!await findGantt(boardId))return reply({error:'Gantt board not found.'},404);
  const url=new URL(request.url),sent=url.searchParams.get('view')==='sent',offset=Math.max(0,Math.min(100000,Number(url.searchParams.get('offset'))||0));
  const db=env.DB!,column=sent?'sender':'recipient',unreadOrder=sent?'(resolved_at IS NOT NULL AND sender_read_at IS NULL)':'(read_at IS NULL)';
  const [rows,count,unread]=await Promise.all([
   db.prepare(`SELECT ${notificationColumns} FROM notifications WHERE ${column}=? AND board_id=? ORDER BY ${unreadOrder} DESC,(resolved_at IS NULL) DESC,created_at DESC,id DESC LIMIT 30 OFFSET ?`).bind(session.name,boardId,Math.floor(offset)).all<TeamNotification>(),
   db.prepare(`SELECT count(*) AS total FROM notifications WHERE ${column}=? AND board_id=?`).bind(session.name,boardId).first<{total:number}>(),
   db.prepare('SELECT sum(CASE WHEN recipient=? AND read_at IS NULL THEN 1 ELSE 0 END) AS inbox, sum(CASE WHEN sender=? AND resolved_at IS NOT NULL AND sender_read_at IS NULL THEN 1 ELSE 0 END) AS sent FROM notifications WHERE board_id=? AND (recipient=? OR sender=?)').bind(session.name,session.name,boardId,session.name,session.name).first<{inbox:number;sent:number}>()
  ]);
  return reply({notifications:rows.results,total:count?.total??0,unread:(unread?.inbox??0)+(unread?.sent??0),inboxUnread:unread?.inbox??0,sentUnread:unread?.sent??0});
 }catch{return reply({error:'Notifications could not load. Please retry.'},500);}
}
export async function POST(request:Request){
 const session=await getSession();if(!session)return reply({error:'Sign in to update notifications.'},401);
 if(request.headers.get('origin')&&request.headers.get('origin')!==new URL(request.url).origin)return reply({error:'Invalid request origin.'},403);
 let body;try{const raw=await request.text();if(raw.length>4000)return reply({error:'This message is too long.'},413);body=JSON.parse(raw);}catch{return reply({error:'Invalid request.'},400);}
 if(!body||!['read','resolve'].includes(body.action)||typeof body.id!=='string'||body.id.length>100)return reply({error:'Invalid notification action.'},400);
 try{
  const boardId=requestBoardId(request);if(!boardId||!await findGantt(boardId))return reply({error:'Gantt board not found.'},404);
  const db=env.DB!,row=await db.prepare(`SELECT ${notificationColumns} FROM notifications WHERE id=? AND board_id=? AND (recipient=? OR sender=?)`).bind(body.id,boardId,session.name,session.name).first<TeamNotification>();
  if(!row)return reply({error:'Notification not found.'},404);
  const now=new Date().toISOString();
  if(body.action==='read'){
   if(row.recipient===session.name)await db.prepare('UPDATE notifications SET read_at=coalesce(read_at,?) WHERE id=? AND recipient=?').bind(now,row.id,session.name).run();
   else await db.prepare('UPDATE notifications SET sender_read_at=coalesce(sender_read_at,?) WHERE id=? AND sender=? AND resolved_at IS NOT NULL').bind(now,row.id,session.name).run();
  }else{
   if(row.recipient!==session.name)return reply({error:'Only the requested teammate can mark this delivered.'},403);
   if(typeof body.note!=='string'||body.note.length>1000)return reply({error:'Keep the delivery note under 1,000 characters.'},400);
   await db.prepare('UPDATE notifications SET resolved_at=?,resolution_note=?,read_at=coalesce(read_at,?),sender_read_at=NULL,active_key=NULL WHERE id=? AND recipient=? AND resolved_at IS NULL').bind(now,body.note.trim(),now,row.id,session.name).run();
  }
  return reply({ok:true});
 }catch{return reply({error:'The notification could not update. Please retry.'},500);}
}
