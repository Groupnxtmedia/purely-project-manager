import {getSession} from '../../../lib/session';
import {chinaId,chinaName,chinaTaskInput,chinaPatch} from '../../../lib/china';
import {chinaDb,chinaReply,chinaOrigin,readChina,findChinaTask} from '../../../lib/china-store';
export const dynamic='force-dynamic';
export async function GET(request:Request){const user=await getSession();if(!user)return chinaReply({error:'Sign in to open China Gantt.'},401);try{return chinaReply(await readChina(user.name,new URL(request.url).searchParams.get('archived')==='1'));}catch{return chinaReply({error:'China Gantt could not load. Please try again.'},500);}}
export async function POST(request:Request){
 const user=await getSession();if(!user)return chinaReply({error:'Sign in again to save your changes.'},401);
 if(!chinaOrigin(request))return chinaReply({error:'Invalid request origin.'},403);
 let body;try{const raw=await request.text();if(raw.length>16000)return chinaReply({error:'The request is too large.'},413);body=JSON.parse(raw);if(!body||typeof body!=='object'||Array.isArray(body))throw Error();}catch{return chinaReply({error:'Invalid request.'},400);}
 if(!chinaId(body.id))return chinaReply({error:'Invalid reference.'},400);
 const db=chinaDb(),now=new Date().toISOString();
 try{
  if(body.action==='createTable'||body.action==='renameTable'){
   const name=chinaName(body.name);
   if(body.action==='createTable'){
    const result=await db.prepare('INSERT OR IGNORE INTO china_tables (id,name,created_by,created_at,updated_at) SELECT ?,?,?,?,? WHERE (SELECT count(*) FROM china_tables)<100').bind(body.id,name,user.name,now,now).run();
    if(!result.meta.changes){const existing=await db.prepare('SELECT name FROM china_tables WHERE id=?').bind(body.id).first<{name:string}>();if(existing?.name!==name)return chinaReply({error:'The table could not be created. Use a new name or check the 100-table limit.'},409);}
   }else{
    if(!Number.isSafeInteger(body.revision)||body.revision<0)return chinaReply({error:'Refresh this table before renaming it.'},400);
    const r=await db.prepare('UPDATE china_tables SET name=?,revision=revision+1,updated_at=? WHERE id=? AND revision=?').bind(name,now,body.id,body.revision).run();if(!r.meta.changes)return chinaReply({error:'This table changed. Refresh and try again.'},409);
   }
  }else if(body.action==='saveTask'||body.action==='patchTask'){
   const old=await findChinaTask(body.id);
   if(old?.archivedAt)return chinaReply({error:'This task is archived. Restore it before editing.'},409);
   if(body.action==='patchTask'&&!old)return chinaReply({error:'Task not found.'},404);
   const input=body.action==='patchTask'?chinaPatch(old!,body.field,body.value):chinaTaskInput(body.task);
   if(!await db.prepare('SELECT id FROM china_tables WHERE id=?').bind(input.tableId).first())return chinaReply({error:'Table not found.'},404);
   if(body.revision===null&&body.action==='saveTask'){
    if(old){if(!Object.entries(input).every(([key,value])=>old[key as keyof typeof old]===value))return chinaReply({error:'This task already exists with different details.'},409);}
    else {const r=await db.prepare('INSERT OR IGNORE INTO china_tasks (id,table_id,title,progress,priority,status,assignee,notes,deadline,created_by,created_at,updated_at) SELECT ?,?,?,?,?,?,?,?,?,?,?,? WHERE (SELECT count(*) FROM china_tasks)<5000').bind(body.id,input.tableId,input.title,input.progress,input.priority,input.status,input.assignee,input.notes,input.deadline,user.name,now,now).run();if(!r.meta.changes)return chinaReply({error:'Could not add this task. Refresh and check the 5,000-task limit.'},409);}
   }else{
    if(!Number.isSafeInteger(body.revision)||body.revision<0)return chinaReply({error:'Refresh this task before editing.'},400);
    const r=await db.prepare('UPDATE china_tasks SET table_id=?,title=?,progress=?,priority=?,status=?,assignee=?,notes=?,deadline=?,revision=revision+1,updated_at=? WHERE id=? AND revision=? AND archived_at IS NULL').bind(input.tableId,input.title,input.progress,input.priority,input.status,input.assignee,input.notes,input.deadline,now,body.id,body.revision).run();
    if(!r.meta.changes)return chinaReply({error:'A teammate changed this task. Refresh and try again.'},409);
   }
  }else if(body.action==='archiveTask'||body.action==='restoreTask'){
   if(!Number.isSafeInteger(body.revision)||body.revision<0)return chinaReply({error:'Refresh this task before updating it.'},400);
   const archive=body.action==='archiveTask';
   const statements=[db.prepare(`UPDATE china_tasks SET archived_at=?,revision=revision+1,updated_at=? WHERE id=? AND revision=? AND archived_at IS ${archive?'':'NOT '}NULL`).bind(archive?now:null,now,body.id,body.revision)];
   if(archive)statements.push(db.prepare("UPDATE china_messages SET status='failed',body='This response stopped when the task was archived.',updated_at=? WHERE task_id=? AND status='processing' AND EXISTS(SELECT 1 FROM china_tasks WHERE id=? AND archived_at=?)").bind(now,body.id,body.id,now));
   const results=await db.batch(statements);if(!results[0].meta.changes)return chinaReply({error:'This task changed. Refresh and try again.'},409);
  }else return chinaReply({error:'Unknown action.'},400);
  return chinaReply({ok:true});
 }catch(e){const message=e instanceof Error?e.message:'';if(/^(Enter|Choose|Progress|Notes)/.test(message))return chinaReply({error:message},400);console.error('China workspace save failed');return chinaReply({error:'Unable to save. Refresh and try again.'},500);}
}
