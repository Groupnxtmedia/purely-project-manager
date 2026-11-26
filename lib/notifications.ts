import {PEOPLE,type Board,type Person} from './board';

export type NotificationDraft={recipient:Person|null;projectId:string|null;taskId:string|null;deliverable:string;reason:string};
export type TeamNotification=Omit<NotificationDraft,'recipient'|'projectId'>&{id:string;recipient:Person;projectId:string;sender:Person;projectTitle:string;taskTitle:string|null;createdAt:string;readAt:string|null;resolvedAt:string|null;resolutionNote:string|null;senderReadAt:string|null};
export const notificationSchema={type:'object',additionalProperties:false,properties:{recipient:{type:['string','null'],enum:[...PEOPLE,null]},projectId:{type:['string','null']},taskId:{type:['string','null']},deliverable:{type:'string'},reason:{type:'string'}},required:['recipient','projectId','taskId','deliverable','reason']};

export function validateNotifications(value:unknown,board:Board,sender:Person,confirm=false):NotificationDraft[]{
 if(!Array.isArray(value)||value.length>12)throw Error('Send up to 12 deliverable requests at a time.');
 const seen=new Set<string>();
 return value.map(item=>{
  if(!item||typeof item!=='object')throw Error('Invalid deliverable request.');
  const n=item as Record<string,unknown>;
  if(n.recipient!==null&&!PEOPLE.includes(n.recipient as Person))throw Error('Choose a teammate to notify.');
  if(n.recipient===sender)throw Error('Choose another teammate for this request.');
  if(n.projectId!==null&&!board.projects.some(p=>p.id===n.projectId))throw Error('This project is no longer available.');
  if(confirm&&(!n.recipient||!n.projectId))throw Error('Choose the recipient and project for every request.');
  if(n.taskId!==null&&!board.tasks.some(t=>t.id===n.taskId&&t.projectId===n.projectId))throw Error('The linked task must belong to this project.');
  if(typeof n.deliverable!=='string'||!n.deliverable.trim()||n.deliverable.length>1000)throw Error('Describe the deliverable in up to 1,000 characters.');
  if(typeof n.reason!=='string'||!n.reason.trim()||n.reason.length>2000)throw Error('Explain what is waiting in up to 2,000 characters.');
  const draft={recipient:n.recipient as Person|null,projectId:n.projectId as string|null,taskId:n.taskId as string|null,deliverable:n.deliverable.trim(),reason:n.reason.trim()};
  const key=requestIdentity(sender,draft);
  if(seen.has(key))throw Error('Combine duplicate requests for the same deliverable.');
  seen.add(key);return draft;
 });
}
export function requestIdentity(sender:Person,n:NotificationDraft){return JSON.stringify([sender,n.recipient,n.projectId,n.taskId,n.deliverable.toLowerCase().replace(/\s+/g,' ').trim()]);}
export const notificationColumns='id,recipient,sender,project_id AS projectId,project_title AS projectTitle,task_id AS taskId,task_title AS taskTitle,deliverable,reason,created_at AS createdAt,read_at AS readAt,resolved_at AS resolvedAt,resolution_note AS resolutionNote,sender_read_at AS senderReadAt';
