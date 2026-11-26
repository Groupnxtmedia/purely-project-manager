import {eq} from 'drizzle-orm';
import {getDb} from '../db';
import {boardState} from '../db/schema';
import {seedProjects,type Board} from './board';
import {findGantt} from './gantt-store';
export async function readBoard(id='team'):Promise<Board> {
 const db=getDb();
 let row=await db.select().from(boardState).where(eq(boardState.id,id)).get();
 if(!row){if(!await findGantt(id))throw Error('Gantt board not found.');await db.insert(boardState).values({id,projects:JSON.stringify(id==='team'?seedProjects():[]),tasks:'[]',revision:0,updatedAt:new Date().toISOString()}).onConflictDoNothing();row=await db.select().from(boardState).where(eq(boardState.id,id)).get();}
 return {projects:JSON.parse(row!.projects),tasks:JSON.parse(row!.tasks),revision:row!.revision,updatedAt:row!.updatedAt};
}
