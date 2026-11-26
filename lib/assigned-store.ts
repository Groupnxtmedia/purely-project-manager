import {assignedDb,assignedReadOwners,type AssignedViewer} from './assigned-auth';
import {localDay,reminderKind,type AssignedJob,type AssignedBrief,type AssignedReminder} from './assigned-work';
export const jobColumns='id,owner_id AS ownerId,title,assignee,brief,deadline,completed_at AS completedAt,revision,reminder_version AS reminderVersion,created_at AS createdAt,updated_at AS updatedAt';
export async function readAssignedJobs(ownerId:string){return (await assignedDb().prepare(`SELECT ${jobColumns} FROM assigned_jobs WHERE owner_id=? ORDER BY (completed_at IS NOT NULL),deadline,created_at,id`).bind(ownerId).all<AssignedJob>()).results;}
export async function readAssignedBriefs(ownerId:string){return (await assignedDb().prepare('SELECT id,job_id AS jobId,filename,size,content_type AS contentType,created_at AS createdAt FROM assigned_briefs WHERE owner_id=? ORDER BY created_at').bind(ownerId).all<AssignedBrief>()).results;}
// Every view reads the same job row. Recipient access follows the current assignee,
// so reassignment immediately moves both the job and its attachments to that person.
export async function assignedViewQuery(user:AssignedViewer,scope:string){
 const owners=await assignedReadOwners(user,scope),ids=owners.map(o=>o.userId);
 let where=`j.owner_id IN (${ids.map(()=>'?').join(',')})`;
 const bindings:string[]=[...ids];
 if(scope==='received'){where+=' AND lower(trim(j.assignee))=?';bindings.push(user.name.toLowerCase());}
 if(scope==='visible'){where+=' AND (j.owner_id=? OR lower(trim(j.assignee))=?)';bindings.push(user.userId,user.name.toLowerCase());}
 return {owners,where,bindings};
}
export async function readAssignedView(user:AssignedViewer,scope='mine'){
 const {owners,where,bindings}=await assignedViewQuery(user,scope);
 const [jobs,briefs]=await Promise.all([
  assignedDb().prepare(`SELECT ${jobColumns} FROM assigned_jobs j WHERE ${where} ORDER BY (completed_at IS NOT NULL),deadline,created_at,id`).bind(...bindings).all<AssignedJob>(),
  assignedDb().prepare(`SELECT b.id,b.job_id AS jobId,b.filename,b.size,b.content_type AS contentType,b.created_at AS createdAt FROM assigned_briefs b WHERE EXISTS(SELECT 1 FROM assigned_jobs j WHERE j.id=b.job_id AND j.owner_id=b.owner_id AND ${where}) ORDER BY b.created_at`).bind(...bindings).all<AssignedBrief>()
 ]);
 return {jobs:jobs.results.map(job=>({...job,assignedBy:owners.find(o=>o.userId===job.ownerId)!.name,canManage:job.ownerId===user.userId,canUpdateStatus:job.ownerId===user.userId||job.assignee.trim().toLowerCase()===user.name.toLowerCase()})),briefs:briefs.results};
}
export async function readAssignedReminders(ownerId:string){return (await assignedDb().prepare(`SELECT r.id,r.job_id AS jobId,r.kind,r.reminder_date AS reminderDate,r.created_at AS createdAt,r.read_at AS readAt,j.title,j.assignee,j.deadline FROM assigned_reminders r JOIN assigned_jobs j ON j.id=r.job_id AND j.owner_id=r.owner_id WHERE r.owner_id=? AND j.completed_at IS NULL AND j.reminder_version=r.reminder_version ORDER BY r.created_at DESC,r.id DESC LIMIT 100`).bind(ownerId).all<AssignedReminder>()).results;}
export async function runAssignedReminders(ownerId:string,now=new Date()){
 const {date,hour}=localDay(now);let created=0;
 if(hour>=9){
  const jobs=await readAssignedJobs(ownerId);
  for(const job of jobs){
   const kind=reminderKind(job,now);if(!kind)continue;
   // The insert rechecks current state so a concurrent completion/reschedule wins.
   const r=await assignedDb().prepare(`INSERT OR IGNORE INTO assigned_reminders (id,owner_id,job_id,reminder_version,kind,reminder_date,created_at) SELECT ?,owner_id,id,reminder_version,?,?,? FROM assigned_jobs WHERE id=? AND owner_id=? AND completed_at IS NULL AND reminder_version=? AND deadline=?`).bind(`${job.id}:${job.reminderVersion}:${kind}`,kind,date,now.toISOString(),job.id,ownerId,job.reminderVersion,job.deadline).run();
   created+=r.meta.changes;
  }
 }
 await assignedDb().prepare('INSERT INTO assigned_reminder_runs (id,owner_id,ran_at,created_count) VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET ran_at=excluded.ran_at,created_count=excluded.created_count').bind(ownerId,ownerId,now.toISOString(),created).run();
 return {created,date,timeZone:'America/Toronto',beforeReminderTime:hour<9};
}
