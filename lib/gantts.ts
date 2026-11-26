import {addDays,weekOf} from './board';
export type Gantt={id:string;name:string;startWeek:string;endWeek:string;firstWeekNumber:number};
export const TEAM_GANTT:Gantt={id:'team',name:'Team Gantt',startWeek:'2026-10-25',endWeek:'2026-11-29',firstWeekNumber:1};
export const CHINA_GANTT:Gantt={id:'china',name:'China Gantt',startWeek:'2026-11-08',endWeek:'2026-12-27',firstWeekNumber:3};
export function weekCount(gantt:Gantt){return Math.round((Date.parse(gantt.endWeek)-Date.parse(gantt.startWeek))/604800000)+1;}
export function ganttHref(id:string){return id==='team'?'/':`/gantt/${encodeURIComponent(id)}`;}
export function boardApi(path:string,id:string){return `${path}${path.includes('?')?'&':'?'}board=${encodeURIComponent(id)}`;}
export function requestBoardId(request:Request){const id=new URL(request.url).searchParams.get('board')??'team';return /^[a-z0-9-]{1,64}$/.test(id)?id:null;}
export function validateGantt(value:unknown):Omit<Gantt,'id'|'firstWeekNumber'>{
 if(!value||typeof value!=='object')throw Error('Enter a name and time horizon.');
 const v=value as Record<string,unknown>;
 if(typeof v.name!=='string'||!v.name.trim()||v.name.trim().length>60)throw Error('Use a board name between 1 and 60 characters.');
 function date(value:unknown){
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||value<'2020-01-01'||value>'2100-12-31'||!Number.isFinite(Date.parse(value+'T12:00:00Z'))||new Date(value+'T12:00:00Z').toISOString().slice(0,10)!==value)throw Error('Choose valid start and end dates.');
  return value;
 }
 const start=date(v.startDate),end=date(v.endDate);
 if(end<start)throw Error('The end date must be on or after the start date.');
 const startWeek=weekOf(start),endWeek=weekOf(end);
 if(weekCount({id:'',name:'',startWeek,endWeek,firstWeekNumber:1})>104)throw Error('Choose a time horizon of up to 104 weeks.');
 return {name:v.name.trim(),startWeek,endWeek};
}
export function lastDay(gantt:Gantt){return addDays(gantt.endWeek,6);}
