import {findGantt} from '../../../lib/gantt-store';
import {requestBoardId} from '../../../lib/gantts';
import {readBoard} from '../../../lib/board-store';
import {eq, and} from 'drizzle-orm';
import {getDb} from '../../../db';
import {boardState} from '../../../db/schema';
import {getSession} from '../../../lib/session';
import {applyAction,type Board} from '../../../lib/board';
export const dynamic='force-dynamic';
const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(request:Request){
 if(!await getSession())return reply({error:'Sign in to access your team’s projects.'},401);
 const id=requestBoardId(request);if(!id)return reply({error:'Invalid Gantt board.'},400);
 try{const gantt=await findGantt(id);if(!gantt)return reply({error:'Gantt board not found.'},404);return reply({...await readBoard(id),gantt});}catch(e){console.error('Board load failed',e);return reply({error:'The board could not load. Please try again.'},500);}
}
export async function POST(request:Request){
 if(!await getSession())return reply({error:'Your session ended. Sign in again to save.'},401);
 const origin=request.headers.get('origin');if(origin && origin!==new URL(request.url).origin)return reply({error:'Invalid request origin.'},403);
 let body;try{const raw=await request.text();if(raw.length>20000)return reply({error:'Request too large.'},413);body=JSON.parse(raw);}catch{return reply({error:'Invalid request.'},400);}
 try{
  if(!body||typeof body!=='object'||!Number.isInteger(body.revision)||!body.action||typeof body.action!=='object')return reply({error:'Invalid change.'},400);
  const id=requestBoardId(request);if(!id)return reply({error:'Invalid Gantt board.'},400);if(!await findGantt(id))return reply({error:'Gantt board not found.'},404);
  const current=await readBoard(id);
  if(body.revision!==current.revision)return reply({error:'A teammate updated the board. The latest version has loaded; review and save your changes again.',board:current},409);
  let next;try{next=applyAction(current,body.action);}catch(e){return reply({error:e instanceof Error?e.message:'Invalid change.'},400);}
  const rows=await getDb().update(boardState).set({projects:JSON.stringify(next.projects),tasks:JSON.stringify(next.tasks),revision:next.revision,updatedAt:next.updatedAt}).where(and(eq(boardState.id,id),eq(boardState.revision,current.revision))).returning({id:boardState.id});
  if(!rows.length)return reply({error:'A teammate just saved a change. Please review and save again.',board:await readBoard(id)},409);
  return reply(next);
 }catch(e){console.error('Board save failed',e);return reply({error:'Unable to save. Your changes have not been applied; please try again.'},500);}
}
