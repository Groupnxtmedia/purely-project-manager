export const PEOPLE = ['Arjun', 'Keanu', 'Matthew', 'Dean'] as const;
export const DEPARTMENTS = ['MB&A', 'Web & tech', 'Supply chain', 'Sales'] as const;
export const COLORS: Record<string, string> = {'MB&A':'#6381b4','Web & tech':'#23735d','Supply chain':'#ba5d3d','Sales':'#ad4a70'};
export type Person = typeof PEOPLE[number];
export type Department = typeof DEPARTMENTS[number];
export type Project = {id:string; title:string; department:Department; owners:Person[]; startWeek:string; deadlineWeek:string; manualProgress:number|null};
export type Task = {id:string; title:string; description:string; dependency:string|null; responsible:Person; hours:number; priority:'Low'|'Medium'|'High'|'Urgent'; projectId:string; weight:number; completed:boolean; completedAt:string|null};
export type Board = {projects:Project[]; tasks:Task[]; revision:number; updatedAt:string};
export function addDays(date:string, days:number) { const d=new Date(date+'T12:00:00Z'); d.setUTCDate(d.getUTCDate()+days); return d.toISOString().slice(0,10); }
export function weekOf(date:string) { const d=new Date(date+'T12:00:00Z'); return addDays(date,-d.getUTCDay()); }
export function dateLabel(date:string, opts:Intl.DateTimeFormatOptions={month:'short',day:'numeric'}) { return new Date(date+'T12:00:00Z').toLocaleDateString('en-US',{...opts,timeZone:'UTC'}); }
export function progress(project:Project,tasks:Task[]) { return project.manualProgress ?? Math.round(tasks.filter(t=>t.projectId===project.id && t.completed).reduce((n,t)=>n+t.weight,0)*10)/10; }
export function taskWeight(tasks:Task[]) {return Math.round(tasks.reduce((n,t)=>n+t.weight,0)*10)/10;}
export function seedProjects():Project[] {
 const rows:[string,Department,Person[],number][] = [
 ['KPI dashboards','Web & tech',['Arjun'],1],['Mobile app','Web & tech',['Arjun'],1],['Website phase I','MB&A',['Dean'],1],['Website phase II','MB&A',['Dean'],3],['New P1 boxes','Supply chain',['Matthew'],1],['Performance data sheets','MB&A',['Dean'],1],['Support agent (AI)','MB&A',['Matthew','Dean'],2],['Sales script v2','Sales',['Keanu'],1],['Bland AI sales agent','MB&A',['Matthew','Dean'],2],['Messaging','MB&A',['Matthew','Dean'],2],["Owner’s manuals",'MB&A',['Dean'],2],['Email campaigns','MB&A',['Matthew','Dean'],3],['SMS campaign','Sales',['Matthew'],2],['Testimonial / review system','Web & tech',['Arjun'],4],['Free-trial infrastructure','Web & tech',['Dean'],2],['Web app improvements','MB&A',['Dean'],3],['Inventory tracking sheet','Supply chain',['Keanu'],2],['Hire static content creator','MB&A',['Matthew','Dean'],3],['P-zero spec sheet','Supply chain',['Matthew','Dean'],2],['Data expansion (10 cities)','Web & tech',['Arjun'],3],['Media publications','MB&A',['Matthew'],5],['Media buying consulting agent','Web & tech',['Arjun'],4],['Referral program','MB&A',['Matthew'],2],['Hire a copywriter','MB&A',['Matthew'],3]
 ];
 return rows.map(([title,department,owners,weeks],i)=>({id:`project-${i+1}`,title,department,owners,startWeek:'2026-10-25',deadlineWeek:addDays('2026-10-25',(weeks-1)*7),manualProgress:null}));
}
export type Action = {type:string; [key:string]:unknown};
export function applyAction(board:Board, action:Action):Board {
 const next:Board=structuredClone(board);
 const fail=(message:string):never=>{throw new Error(message);};
 const text=(v:unknown,label:string,max=160)=>typeof v==='string' && v.trim() && v.trim().length<=max?v.trim():fail(`${label} is required (maximum ${max} characters).`);
 const number=(v:unknown,label:string,min:number,max:number)=>typeof v==='number' && Number.isFinite(v) && v>=min && v<=max?v:fail(`${label} must be between ${min} and ${max}.`);
 const date=(v:unknown)=>{if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v)||!Number.isFinite(Date.parse(v+'T12:00:00Z'))||new Date(v+'T12:00:00Z').toISOString().slice(0,10)!==v||v<'2020-01-01'||v>'2100-12-31')return fail('Enter a valid week between 2020 and 2100.'); return weekOf(v);};
 if(action.type==='saveProject') {
  const p=action.project as Project;
  if(!p)fail('Missing project.');
  const old=next.projects.find(x=>x.id===p.id);
  if(p.id && !old)fail('This project no longer exists. Refresh the board.');
  if(!DEPARTMENTS.includes(p.department))fail('Choose a department.');
  if(!Array.isArray(p.owners)||!p.owners.length||p.owners.some(x=>!PEOPLE.includes(x)))fail('Choose at least one owner.');
  const startWeek=date(p.startWeek),deadlineWeek=date(p.deadlineWeek);
  if(deadlineWeek<startWeek)fail('Deadline week must be on or after the start week.');
  const project:Project={id:old?.id??crypto.randomUUID(),title:text(p.title,'Project title'),department:p.department,owners:[...new Set(p.owners)],startWeek,deadlineWeek,manualProgress:old?.manualProgress??null};
  if(old)next.projects[next.projects.indexOf(old)]=project;else next.projects.push(project);
 } else if(action.type==='setProgress') {
  const p=next.projects.find(x=>x.id===action.id);if(!p)fail('Project not found.');
  p!.manualProgress=action.value===null?null:number(action.value,'Progress',0,100);
 } else if(action.type==='saveTask') {
  const t=action.task as Task;if(!t)fail('Missing task.');
  const old=next.tasks.find(x=>x.id===t.id);if(t.id && !old)fail('This task no longer exists. Refresh the board.');
  const id=old?.id??crypto.randomUUID();
  if(!next.projects.some(x=>x.id===t.projectId))fail('Choose a project.');
  if(!PEOPLE.includes(t.responsible))fail('Choose a responsible person.');
  if(!['Low','Medium','High','Urgent'].includes(t.priority))fail('Choose a priority.');
  const weight=number(t.weight,'Project weight',0.1,100);
  if(taskWeight(next.tasks.filter(x=>x.projectId===t.projectId && x.id!==id))+weight>100.00001)fail('Task weights for a project cannot exceed 100%.');
  if(typeof t.description!=='string'||t.description.length>5000)fail('Description must be under 5,000 characters.');
  const dependency=t.dependency||null;
  if(dependency) {
   const visited=new Set([id]);let current:string|null=dependency;
   while(current) {if(visited.has(current))fail('Dependencies cannot form a cycle.');visited.add(current);const dep=next.tasks.find(x=>x.id===current);if(!dep)fail('Dependency not found.');current=dep!.dependency;}
   if(old?.completed && !next.tasks.find(x=>x.id===dependency)?.completed)fail('A completed task cannot depend on an unfinished task.');
  }
  const task:Task={id,title:text(t.title,'Task title'),description:t.description.trim(),dependency,responsible:t.responsible,hours:number(t.hours,'Estimated duration',0.1,10000),priority:t.priority,projectId:t.projectId,weight,completed:old?.completed??false,completedAt:old?.completedAt??null};
  if(old)next.tasks[next.tasks.indexOf(old)]=task;else next.tasks.push(task);
 } else if(action.type==='toggleTask') {
  const t=next.tasks.find(x=>x.id===action.id);if(!t)fail('Task not found.');
  if(!t!.completed && t!.dependency && !next.tasks.find(x=>x.id===t!.dependency)?.completed)fail('Complete the dependency before finishing this task.');
  if(t!.completed && next.tasks.some(x=>x.dependency===t!.id && x.completed))fail('Reopen completed dependent tasks first.');
  t!.completed=!t!.completed;t!.completedAt=t!.completed?new Date().toISOString():null;
 } else if(action.type==='deleteTask') {
  if(!next.tasks.some(x=>x.id===action.id))fail('Task not found.');
  if(next.tasks.some(x=>x.dependency===action.id))fail('Remove this task’s dependencies before deleting it.');
  next.tasks=next.tasks.filter(x=>x.id!==action.id);
 } else if(action.type==='deleteProject') {
  if(!next.projects.some(x=>x.id===action.id))fail('Project not found.');
  const ids=new Set(next.tasks.filter(x=>x.projectId===action.id).map(x=>x.id));
  if(next.tasks.some(x=>x.projectId!==action.id&&x.dependency&&ids.has(x.dependency)))fail('Other projects depend on tasks here. Remove those dependencies first.');
  next.projects=next.projects.filter(x=>x.id!==action.id);next.tasks=next.tasks.filter(x=>x.projectId!==action.id);
 } else fail('Unknown action.');
 return {...next,revision:board.revision+1,updatedAt:new Date().toISOString()};
}
