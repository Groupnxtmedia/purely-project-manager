import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../app/chatgpt-auth';
import {getSession} from './session';
import {PEOPLE,type Person} from './board';
export class AssignedAccessError extends Error{constructor(message:string,public status:number){super(message);}}
export function assignedDb(){if(!env.DB)throw Error('Database unavailable.');return env.DB;}
async function workspaceOwnerId(name:Person='Dean'){
 if(name!=='Dean')return `team:${name}`;
 // Retain an existing workspace ID so changing the access rule never strands saved work.
 await assignedDb().prepare("INSERT OR IGNORE INTO assigned_owner (id,user_id,created_at) VALUES ('owner','team:Dean',?)").bind(new Date().toISOString()).run();
 const owner=await assignedDb().prepare("SELECT user_id FROM assigned_owner WHERE id='owner'").first<{user_id:string}>();
 if(!owner)throw Error('Assigned Work is unavailable.');
 return owner.user_id;
}
export async function assignedOwner(){
 const session=await getSession();
 if(!session)throw new AssignedAccessError('Sign in with your name and the team password to open your Assigned Work.',401);
 return {userId:await workspaceOwnerId(session.name),name:session.name,canViewAll:session.name==='Matthew'};
}
export type AssignedViewer=Awaited<ReturnType<typeof assignedOwner>>;
export async function assignedWorkspaceOwners(){
 const deanId=await workspaceOwnerId();
 return PEOPLE.map(name=>({name,userId:name==='Dean'?deanId:`team:${name}`}));
}
export async function assignedReadOwners(user:AssignedViewer,scope:string){
 if(scope==='mine')return [{name:user.name,userId:user.userId}];
 if(scope==='received'||scope==='visible')return assignedWorkspaceOwners();
 if(scope!=='everyone')throw new AssignedAccessError('Choose a valid Assigned Work view.',400);
 if(!user.canViewAll)throw new AssignedAccessError('The everyone view is available to Matthew.',403);
 return assignedWorkspaceOwners();
}
// Cloud tools do not carry the browser's team cookie. Keep their existing verified
// caller boundary separate from the user-approved team-profile access for the app.
export async function assignedAutomationOwner(){
 const user=await getChatGPTUser();if(!user)throw new AssignedAccessError('Sign in to use the reminder connection.',401);
 const saved=await assignedDb().prepare("SELECT user_id FROM assigned_owner WHERE id='owner'").first<{user_id:string}>();
 if(saved?.user_id===user.userId)return {userId:saved.user_id};
 const expected=(env as unknown as Record<string,string>).ASSIGNED_OWNER_EMAIL?.trim().toLowerCase();
 if(!expected)throw new AssignedAccessError('The background reminder connection is not configured yet.',503);
 if(user.email.toLowerCase()!==expected)throw new AssignedAccessError('This account cannot run Assigned Work reminders.',403);
 return {userId:await workspaceOwnerId()};
}
export function privateReply(data:unknown,status=200,extra:Record<string,string>={}){return Response.json(data,{status,headers:{'Cache-Control':'private, no-store',Vary:'Cookie',...extra}});}
export function privateError(error:unknown){return error instanceof AssignedAccessError?privateReply({error:error.message},error.status):privateReply({error:'The request could not finish. Please refresh and try again.'},500);}
export function sameOrigin(request:Request){const origin=request.headers.get('origin');return !origin||origin===new URL(request.url).origin;}
