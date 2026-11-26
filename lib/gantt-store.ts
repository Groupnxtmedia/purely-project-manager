import {env} from 'cloudflare:workers';
import {TEAM_GANTT,CHINA_GANTT,type Gantt} from './gantts';
const columns='id,name,start_week AS startWeek,end_week AS endWeek,first_week_number AS firstWeekNumber';
async function ensureGantts(){
 const now=new Date().toISOString();
 await env.DB!.batch([TEAM_GANTT,CHINA_GANTT].map(g=>env.DB!.prepare('INSERT INTO gantt_boards (id,name,name_key,start_week,end_week,first_week_number,created_by,created_at) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT DO NOTHING').bind(g.id,g.name,g.name.toLowerCase(),g.startWeek,g.endWeek,g.firstWeekNumber,'Dean',now)));
}
export async function readGantts(){await ensureGantts();return (await env.DB!.prepare(`SELECT ${columns} FROM gantt_boards ORDER BY CASE id WHEN 'team' THEN 0 WHEN 'china' THEN 1 ELSE 2 END,created_at,id`).all<Gantt>()).results;}
export async function findGantt(id:string){await ensureGantts();return env.DB!.prepare(`SELECT ${columns} FROM gantt_boards WHERE id=?`).bind(id).first<Gantt>();}
