import {env} from 'cloudflare:workers';
import type {Person} from './board';
import type {ChinaTask,ChinaTable} from './china';
export const chinaDb=()=>{if(!env.DB)throw Error('Database unavailable.');return env.DB;};
export const chinaReply=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store',Vary:'Cookie'}});
export const chinaTaskColumns='t.id,t.table_id AS tableId,t.title,t.progress,t.priority,t.status,t.assignee,t.notes,t.deadline,t.revision,t.archived_at AS archivedAt,t.created_by AS createdBy,t.created_at AS createdAt,t.updated_at AS updatedAt';
export const chinaMessageColumns='id,task_id AS taskId,author,kind,body,status,reply_to AS replyTo,request_david AS requestDavid,created_at AS createdAt,updated_at AS updatedAt';
export async function findChinaTask(id:string){return chinaDb().prepare(`SELECT ${chinaTaskColumns},(SELECT count(*) FROM china_messages m WHERE m.task_id=t.id) AS messageCount FROM china_tasks t WHERE t.id=?`).bind(id).first<ChinaTask>();}
export async function readChina(name:Person,archived=false){
 const [tables,tasks,count]=await Promise.all([
  chinaDb().prepare('SELECT id,name,revision,created_by AS createdBy,created_at AS createdAt,updated_at AS updatedAt FROM china_tables ORDER BY created_at,id').all<ChinaTable>(),
  chinaDb().prepare(`SELECT ${chinaTaskColumns},(SELECT count(*) FROM china_messages m WHERE m.task_id=t.id) AS messageCount FROM china_tasks t WHERE archived_at IS ${archived?'NOT ':''}NULL ORDER BY ${archived?'archived_at DESC,':''}created_at,id`).all<ChinaTask>(),
  chinaDb().prepare('SELECT count(*) AS n FROM china_tasks WHERE archived_at IS NOT NULL').first<{n:number}>()
 ]);
 return {tables:tables.results,tasks:tasks.results,archivedCount:count?.n??0,viewer:{name}};
}
export function chinaOrigin(request:Request){return !request.headers.get('origin')||request.headers.get('origin')===new URL(request.url).origin;}
