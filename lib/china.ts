import {PEOPLE,type Person} from './board';
export const CHINA_PRIORITIES=['Low','Medium','High','Urgent'] as const;
export const CHINA_STATUSES=['Not started','In progress','Blocked','Done'] as const;
export type ChinaPriority=typeof CHINA_PRIORITIES[number];
export type ChinaStatus=typeof CHINA_STATUSES[number];
export type ChinaTable={id:string;name:string;revision:number;createdBy:Person;createdAt:string;updatedAt:string};
export type ChinaTask={id:string;tableId:string;title:string;progress:number;priority:ChinaPriority;status:ChinaStatus;assignee:Person|null;notes:string;deadline:string|null;revision:number;archivedAt:string|null;createdBy:Person;createdAt:string;updatedAt:string;messageCount:number};
export type ChinaMessage={id:string;taskId:string;author:string;kind:'team'|'david';body:string;status:'ready'|'processing'|'failed';replyTo:string|null;requestDavid:number;createdAt:string;updatedAt:string};
export type ChinaData={tables:ChinaTable[];tasks:ChinaTask[];archivedCount:number;viewer:{name:Person}};
export function chinaId(value:unknown):value is string{return typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);}
export function chinaName(value:unknown,max=80){if(typeof value!=='string'||!value.trim()||value.trim().length>max)throw Error(`Enter a name between 1 and ${max} characters.`);return value.trim();}
export type ChinaTaskInput=Pick<ChinaTask,'tableId'|'title'|'progress'|'priority'|'status'|'assignee'|'notes'|'deadline'>;
export function chinaTaskInput(value:unknown):ChinaTaskInput{
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Enter the task details.');
 const v=value as Record<string,unknown>;
 if(!chinaId(v.tableId))throw Error('Choose a table.');
 if(!Number.isInteger(v.progress)||Number(v.progress)<0||Number(v.progress)>100)throw Error('Progress must be a whole percentage from 0 to 100.');
 if(!CHINA_PRIORITIES.includes(v.priority as ChinaPriority))throw Error('Choose a priority.');
 if(!CHINA_STATUSES.includes(v.status as ChinaStatus))throw Error('Choose a status.');
 if(v.assignee!==null&&!PEOPLE.includes(v.assignee as Person))throw Error('Choose a team member or Unassigned.');
 if(typeof v.notes!=='string'||v.notes.length>10000)throw Error('Notes must be under 10,000 characters.');
 if(v.deadline!==null&&(typeof v.deadline!=='string'||!/^20\d\d-\d{2}-\d{2}$/.test(v.deadline)||!Number.isFinite(Date.parse(v.deadline+'T12:00:00Z'))||new Date(v.deadline+'T12:00:00Z').toISOString().slice(0,10)!==v.deadline))throw Error('Choose a valid deadline.');
 let progress=Number(v.progress),status=v.status as ChinaStatus;
 if(status==='Done'||progress===100){progress=100;status='Done';}
 else if(status==='Not started'&&progress>0)status='In progress';
 return {tableId:v.tableId,title:chinaName(v.title,160),progress,priority:v.priority as ChinaPriority,status,assignee:v.assignee as Person|null,notes:v.notes.trim(),deadline:v.deadline as string|null};
}
// Inline changes normalize the companion field when reopening completed work.
export function chinaPatch(task:ChinaTaskInput,field:unknown,value:unknown){
 if(!['title','progress','priority','status','assignee','notes','deadline'].includes(String(field)))throw Error('Choose a valid task field.');
 const next={...task,[String(field)]:value};
 if(field==='progress'&&task.status==='Done'&&value!==100)next.status=Number(value)>0?'In progress':'Not started';
 if(field==='status'&&value!=='Done'&&task.progress===100)next.progress=value==='Not started'?0:99;
 if(field==='status'&&value==='Not started')next.progress=0;
 return chinaTaskInput(next);
}
export function chinaDate(value:string|null){return value?new Date(value+'T12:00:00Z').toLocaleDateString('en-CA',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'}):'No deadline';}
