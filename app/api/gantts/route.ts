import {env} from 'cloudflare:workers';
import {getSession} from '../../../lib/session';
import {findGantt,readGantts} from '../../../lib/gantt-store';
import {validateGantt} from '../../../lib/gantts';
export const dynamic='force-dynamic';
const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(){
 if(!await getSession())return reply({error:'Sign in to view your Gantt boards.'},401);
 try{return reply({gantts:await readGantts()});}catch{return reply({error:'Your Gantt boards could not load. Please retry.'},500);}
}
export async function POST(request:Request){
 const session=await getSession();if(!session)return reply({error:'Sign in to create a Gantt board.'},401);
 if(request.headers.get('origin')&&request.headers.get('origin')!==new URL(request.url).origin)return reply({error:'Invalid request origin.'},403);
 let body;try{const raw=await request.text();if(raw.length>2000)return reply({error:'Request too large.'},413);body=JSON.parse(raw);}catch{return reply({error:'Invalid request.'},400);}
 let value;try{value=validateGantt(body);}catch(e){return reply({error:(e as Error).message},400);}
 if(typeof body.id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.id))return reply({error:'Invalid board reference.'},400);
 try{
  const existing=await findGantt(body.id);
  if(existing)return existing.name===value.name&&existing.startWeek===value.startWeek&&existing.endWeek===value.endWeek?reply({gantt:existing}):reply({error:'This board was already created with different details.'},409);
  const duplicate=await env.DB!.prepare('SELECT id FROM gantt_boards WHERE name_key=?').bind(value.name.toLowerCase()).first();
  if(duplicate)return reply({error:'A Gantt board already has that name. Choose another name.'},409);
  const now=new Date().toISOString();
  await env.DB!.batch([
   env.DB!.prepare('INSERT INTO gantt_boards (id,name,name_key,start_week,end_week,first_week_number,created_by,created_at) VALUES (?,?,?,?,?,1,?,?)').bind(body.id,value.name,value.name.toLowerCase(),value.startWeek,value.endWeek,session.name,now),
   env.DB!.prepare("INSERT INTO board_state (id,projects,tasks,revision,updated_at) VALUES (?,'[]','[]',0,?)").bind(body.id,now)
  ]);
  return reply({gantt:{id:body.id,...value,firstWeekNumber:1}},201);
 }catch{
  const saved=await findGantt(body.id).catch(()=>null);
  if(saved&&saved.name===value.name&&saved.startWeek===value.startWeek&&saved.endWeek===value.endWeek)return reply({gantt:saved});
  return reply({error:'The board could not be created. Its name may already be in use; review it and retry.'},409);
 }
}
