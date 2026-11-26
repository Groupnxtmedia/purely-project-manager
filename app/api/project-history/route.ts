import {env} from 'cloudflare:workers';
import {getSession} from '../../../lib/session';
import {requestBoardId} from '../../../lib/gantts';
import {findGantt} from '../../../lib/gantt-store';
import {readBoard} from '../../../lib/board-store';
export const dynamic='force-dynamic';
const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(request:Request){
 if(!await getSession())return reply({error:'Sign in to view project history.'},401);
 try{
  if(!env.DB)throw Error('Database unavailable.');
  const url=new URL(request.url),projectId=url.searchParams.get('projectId'),offset=Number(url.searchParams.get('offset')??0);
  if(!Number.isSafeInteger(offset)||offset<0)return reply({error:'Invalid page.'},400);
  const boardId=requestBoardId(request);if(!boardId||!await findGantt(boardId))return reply({error:'Gantt board not found.'},404);
  if(!(await readBoard(boardId)).projects.some(p=>p.id===projectId))return reply({error:'Project not found.'},404);
  const [memory,logs,count]=await Promise.all([
   env.DB.prepare('SELECT project_id AS projectId,status,next_steps AS nextSteps,blockers,updated_at AS updatedAt,author,last_log_id AS lastLogId FROM project_memory WHERE project_id=?').bind(projectId).first(),
   env.DB.prepare('SELECT id,project_id AS projectId,project_title AS projectTitle,author,work_done AS workDone,status,next_steps AS nextSteps,blockers,created_at AS createdAt,turn_id AS turnId FROM project_logs WHERE project_id=? ORDER BY created_at DESC,id DESC LIMIT 20 OFFSET ?').bind(projectId,offset).all(),
   env.DB.prepare('SELECT count(*) AS count FROM project_logs WHERE project_id=?').bind(projectId).first<{count:number}>()
  ]);
  return reply({memory,logs:logs.results,total:count?.count??0});
 }catch{return reply({error:'Project history could not load. Please retry.'},500);}
}
