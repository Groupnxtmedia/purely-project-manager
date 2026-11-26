import {assignedOwner,assignedDb,privateReply,privateError,sameOrigin} from '../../../lib/assigned-auth';
import {jobInput,type AssignedJob} from '../../../lib/assigned-work';
import {assignedViewQuery,jobColumns,readAssignedView,readAssignedReminders,runAssignedReminders} from '../../../lib/assigned-store';
export const dynamic='force-dynamic';
export async function GET(request:Request){try{
 const user=await assignedOwner(),scope=new URL(request.url).searchParams.get('scope')??'mine';
 if(!['mine','received','everyone'].includes(scope))return privateReply({error:'Choose a valid Assigned Work view.'},400);
 const view=await readAssignedView(user,scope);await runAssignedReminders(user.userId);
 const reminders=await readAssignedReminders(user.userId);
 return privateReply({...view,reminders,viewer:{name:user.name,canViewAll:user.canViewAll},scope});
}catch(e){return privateError(e);}}
export async function POST(request:Request){
 if(!sameOrigin(request))return privateReply({error:'Invalid request origin.'},403);
 try{
  const user=await assignedOwner();const raw=await request.text();if(raw.length>15000)return privateReply({error:'The brief notes are too long.'},413);
  let body;try{body=JSON.parse(raw);}catch{return privateReply({error:'Invalid request.'},400);}
  if(body.action==='readReminder'){
   if(typeof body.id!=='string')return privateReply({error:'Choose a reminder.'},400);
   await assignedDb().prepare('UPDATE assigned_reminders SET read_at=coalesce(read_at,?) WHERE id=? AND owner_id=?').bind(new Date().toISOString(),body.id,user.userId).run();return privateReply({ok:true});
  }
  if(typeof body.id!=='string'||!/^[a-f\d-]{36}$/i.test(body.id))return privateReply({error:'Invalid job reference.'},400);
  const now=new Date().toISOString();
  if(body.action==='save'){
   let input;try{input=jobInput(body.job);}catch(e){return privateReply({error:(e as Error).message},400);}
   if(body.revision===null){
    const count=await assignedDb().prepare('SELECT count(*) AS n FROM assigned_jobs WHERE owner_id=?').bind(user.userId).first<{n:number}>();
    if((count?.n??0)>=1000)return privateReply({error:'Your workspace has reached its 1,000-job limit.'},400);
    const inserted=await assignedDb().prepare('INSERT OR IGNORE INTO assigned_jobs (id,owner_id,title,assignee,brief,deadline,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)').bind(body.id,user.userId,input.title,input.assignee,input.brief,input.deadline,now,now).run();
    if(!inserted.meta.changes){
     const prior=await assignedDb().prepare('SELECT title,assignee,brief,deadline FROM assigned_jobs WHERE id=? AND owner_id=?').bind(body.id,user.userId).first<typeof input>();
     if(!prior||Object.keys(input).some(key=>prior[key as keyof typeof input]!==input[key as keyof typeof input]))return privateReply({error:'This job was already saved with different details. Close the editor and reopen it to make changes.'},409);
    }
   }else{
    if(!Number.isSafeInteger(body.revision)||body.revision<0)return privateReply({error:'Refresh this job before editing.'},400);
    const result=await assignedDb().prepare(`UPDATE assigned_jobs SET title=?,assignee=?,brief=?,reminder_version=reminder_version+CASE WHEN deadline<>? THEN 1 ELSE 0 END,deadline=?,revision=revision+1,updated_at=? WHERE id=? AND owner_id=? AND revision=?`).bind(input.title,input.assignee,input.brief,input.deadline,input.deadline,now,body.id,user.userId,body.revision).run();
    if(!result.meta.changes)return privateReply({error:'This job changed elsewhere. Refresh and try again.'},409);
   }
  }else if(body.action==='complete'||body.action==='reopen'){
   if(!Number.isSafeInteger(body.revision)||body.revision<0)return privateReply({error:'Refresh this job before updating it.'},400);
   // Recheck the current assignee in the same write as the revision check.
   const access=await assignedViewQuery(user,'visible');
   const job=await assignedDb().prepare(`UPDATE assigned_jobs AS j SET completed_at=?,revision=revision+1,reminder_version=reminder_version+1,updated_at=? WHERE id=? AND revision=? AND ${access.where} RETURNING ${jobColumns}`).bind(body.action==='complete'?now:null,now,body.id,body.revision,...access.bindings).first<AssignedJob>();
   if(!job)return privateReply({error:'This job changed or is no longer assigned to you. Refresh and try again.'},409);
   await runAssignedReminders(job.ownerId);return privateReply({job});
  }else return privateReply({error:'Unknown action.'},400);
  const job=await assignedDb().prepare(`SELECT ${jobColumns} FROM assigned_jobs WHERE id=? AND owner_id=?`).bind(body.id,user.userId).first();
  if(!job)return privateReply({error:'Job not found.'},404);
  await runAssignedReminders(user.userId);return privateReply({job});
 }catch(e){return privateError(e);}
}
