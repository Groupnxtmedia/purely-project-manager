import type {Person} from './board';
export const ASSIGNED_TIMEZONE='America/Toronto';
export const MAX_BRIEF_BYTES=20*1024*1024;
export type AssignedJob={id:string;ownerId:string;title:string;assignee:string;brief:string;deadline:string;completedAt:string|null;revision:number;reminderVersion:number;createdAt:string;updatedAt:string};
export type AssignedScope='mine'|'received'|'everyone';
export type AssignedJobView=AssignedJob & {assignedBy:Person;canManage:boolean;canUpdateStatus:boolean};
export type AssignedWorkData={jobs:AssignedJobView[];briefs:AssignedBrief[];reminders:AssignedReminder[];viewer:{name:Person;canViewAll:boolean}|null;scope:AssignedScope};
export type AssignedBrief={id:string;jobId:string;filename:string;size:number;contentType:string;createdAt:string};
export type AssignedReminder={id:string;jobId:string;kind:'two_days'|'due_today';reminderDate:string;createdAt:string;readAt:string|null;title:string;assignee:string;deadline:string};
export type CompletionProposal={id:string;revision:number;title:string;assignee:string};
export type AssignedTurn={id:string;message:string;reply:string;proposals:CompletionProposal[];status:'processing'|'ready'|'answered'|'confirmed'|'dismissed'|'failed';createdAt:string;updatedAt:string};
export function localDay(now=new Date()){
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:ASSIGNED_TIMEZONE,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'}).formatToParts(now);
 const get=(type:string)=>parts.find(p=>p.type===type)!.value;
 return {date:`${get('year')}-${get('month')}-${get('day')}`,hour:Number(get('hour'))};
}
export function shiftDate(date:string,days:number){return new Date(Date.parse(date+'T12:00:00Z')+days*86400000).toISOString().slice(0,10);}
export function validDeadline(value:unknown):value is string{return typeof value==='string'&&/^20\d\d-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T12:00:00Z'))&&new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value;}
export function jobInput(value:unknown){
 const v=value as Record<string,unknown>;if(!v||typeof v!=='object')throw Error('Enter the job details.');
 const field=(key:string,max:number,required=true)=>{const x=v[key];if(typeof x!=='string'||x.length>max||(required&&!x.trim()))throw Error(`Enter a valid ${key} (up to ${max.toLocaleString()} characters).`);return x.trim();};
 if(!validDeadline(v.deadline))throw Error('Choose a valid deadline date.');
 return {title:field('title',160),assignee:field('assignee',120),brief:field('brief',10000,false),deadline:v.deadline};
}
export function reminderKind(job:Pick<AssignedJob,'completedAt'|'deadline'>,now=new Date()):AssignedReminder['kind']|null{
 const {date,hour}=localDay(now);if(job.completedAt||hour<9)return null;
 return job.deadline===date?'due_today':job.deadline===shiftDate(date,2)?'two_days':null;
}
export function reminderMessage(r:Pick<AssignedReminder,'kind'|'title'|'assignee'>){return `${r.title} is due ${r.kind==='due_today'?'today':'in two days'}. Check in with ${r.assignee} to make sure the work is on track.`;}
export const briefTypes:Record<string,string>={pdf:'application/pdf',doc:'application/msword',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',txt:'text/plain',md:'text/plain',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp'};
