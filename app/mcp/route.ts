import {assignedAutomationOwner,assignedDb} from '../../lib/assigned-auth';
import {runAssignedReminders,readAssignedReminders} from '../../lib/assigned-store';
export const dynamic='force-dynamic';
const tools=[{name:'run_assigned_work_reminders',description:'Run Dean’s private Assigned Work deadline reminders: two days before and on the deadline, from 9 a.m. Toronto time. Skips completed jobs and prevents duplicates. Requires Dean’s verified account. Returns counts only.',inputSchema:{type:'object',properties:{},additionalProperties:false}},{name:'assigned_work_reminder_status',description:'Read the last private Assigned Work reminder run and active reminder counts. Requires Dean’s verified account. Does not expose job details.',inputSchema:{type:'object',properties:{},additionalProperties:false}}];
export async function POST(request:Request){
 let body;try{const raw=await request.text();if(raw.length>10000)throw Error();body=JSON.parse(raw);}catch{return Response.json({jsonrpc:'2.0',id:null,error:{code:-32700,message:'Invalid JSON.'}},{status:400});}
 const result=(value:unknown)=>Response.json({jsonrpc:'2.0',id:body.id??null,result:value},{headers:{'Cache-Control':'no-store'}});
 if(body.method==='server/discover')return result({supportedVersions:['2026-07-28'],capabilities:{tools:{}}});
 if(body.method==='tools/list')return result({tools});
 if(body.method==='tools/call'){
  try{
   const user=await assignedAutomationOwner();const name=body.params?.name;if(!tools.some(t=>t.name===name))throw Error('Unknown tool.');
   const run=name==='run_assigned_work_reminders'?await runAssignedReminders(user.userId):null;
   const lastRun=await assignedDb().prepare('SELECT ran_at AS ranAt,created_count AS createdCount FROM assigned_reminder_runs WHERE owner_id=?').bind(user.userId).first();
   const reminders=await readAssignedReminders(user.userId);
   return result({content:[{type:'text',text:JSON.stringify({run,lastRun,activeReminders:reminders.length,unread:reminders.filter(r=>!r.readAt).length})}]});
  }catch(e){return result({isError:true,content:[{type:'text',text:e instanceof Error?e.message:'Reminder run failed.'}]});}
 }
 return Response.json({jsonrpc:'2.0',id:body.id??null,error:{code:-32601,message:'Method not found.'}});
}
