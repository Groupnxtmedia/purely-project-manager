import type {Board,Person} from './board';
import {notificationSchema,type NotificationDraft} from './notifications';
export type ProjectUpdate={projectId:string|null;workDone:string;status:string|null;nextSteps:string|null;blockers:string|null};
export type ManagerTurn={id:string;author:Person;message:string;reply:string;drafts:ProjectUpdate[];notifications:NotificationDraft[];status:'processing'|'ready'|'answered'|'confirmed'|'dismissed'|'failed';createdAt:string;updatedAt:string};
export type ProjectLog=ProjectUpdate&{id:string;projectId:string;projectTitle:string;author:Person;createdAt:string;turnId:string};
export type ProjectMemory={projectId:string;status:string|null;nextSteps:string|null;blockers:string|null;updatedAt:string;author:Person;lastLogId:string};
export const updateSchema={type:'object',additionalProperties:false,properties:{projectId:{type:['string','null']},workDone:{type:'string'},status:{type:['string','null']},nextSteps:{type:['string','null']},blockers:{type:['string','null']}},required:['projectId','workDone','status','nextSteps','blockers']};
export const managerSchema={type:'object',additionalProperties:false,properties:{reply:{type:'string'},updates:{type:'array',items:updateSchema},notifications:{type:'array',items:notificationSchema},historySearch:{type:'array',items:{type:'object',additionalProperties:false,properties:{projectId:{type:['string','null']},query:{type:'string'}},required:['projectId','query']}}},required:['reply','updates','notifications','historySearch']};
export function validateUpdates(value:unknown,board:Board,requireProject=false):ProjectUpdate[]{
 if(!Array.isArray(value)||value.length>12)throw Error('Please report up to 12 projects at a time.');
 return value.map((item)=>{
  if(!item||typeof item!=='object')throw Error('Invalid project update.');
  const p=item as Record<string,unknown>;
  if(p.projectId!==null&&(typeof p.projectId!=='string'||!board.projects.some(x=>x.id===p.projectId)))throw Error('A project is no longer available. Refresh and choose another project.');
  if(requireProject&&!p.projectId)throw Error('Choose the correct project for every update before saving.');
  if(typeof p.workDone!=='string'||!p.workDone.trim()||p.workDone.length>3000)throw Error('Each update needs a description of up to 3,000 characters.');
  const field=(key:string)=>{const v=p[key];if(v===null)return null;if(typeof v!=='string'||v.length>2000)throw Error('Project details must be under 2,000 characters.');return v.trim();};
  return {projectId:p.projectId as string|null,workDone:p.workDone.trim(),status:field('status'),nextSteps:field('nextSteps'),blockers:field('blockers')};
 });
}
export function scheduledTheme(hour:number){return hour>=18||hour<6?'dark':'light';}
