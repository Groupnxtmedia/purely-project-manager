import {env} from 'cloudflare:workers';
import {assignedOwner,assignedDb,privateReply,privateError,sameOrigin} from '../../../../lib/assigned-auth';
import {assignedViewQuery} from '../../../../lib/assigned-store';
import {MAX_BRIEF_BYTES,briefTypes} from '../../../../lib/assigned-work';
export const dynamic='force-dynamic';
export async function GET(request:Request){try{
 const user=await assignedOwner(),id=new URL(request.url).searchParams.get('id');
 const {where,bindings}=await assignedViewQuery(user,user.canViewAll?'everyone':'visible');
 const file=await assignedDb().prepare(`SELECT b.object_key,b.filename,b.content_type FROM assigned_briefs b WHERE b.id=? AND EXISTS(SELECT 1 FROM assigned_jobs j WHERE j.id=b.job_id AND j.owner_id=b.owner_id AND ${where})`).bind(id??'',...bindings).first<{object_key:string;filename:string;content_type:string}>();
 if(!file)return privateReply({error:'Brief not found.'},404);
 const object=await env.BUCKET?.get(file.object_key);if(!object)return privateReply({error:'The brief is unavailable. Please try again.'},404);
 return new Response(object.body,{headers:{'Content-Type':file.content_type,'Content-Disposition':`attachment; filename="brief"; filename*=UTF-8''${encodeURIComponent(file.filename).replace(/'/g,'%27')}`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'"}});
}catch(e){return privateError(e);}}
export async function POST(request:Request){
 if(!sameOrigin(request))return privateReply({error:'Invalid request origin.'},403);
 try{
  const user=await assignedOwner();if(!env.BUCKET)return privateReply({error:'Brief storage is unavailable.'},503);
  const length=Number(request.headers.get('content-length')??0);if(length>MAX_BRIEF_BYTES+10000)return privateReply({error:'Each brief must be 20 MB or smaller.'},413);
  // Bound the streamed request before parsing, including clients without Content-Length.
  const reader=request.body?.getReader();if(!reader)return privateReply({error:'Choose a brief to upload.'},400);
  const chunks:Uint8Array[]=[];let total=0;for(;;){const chunk=await reader.read();if(chunk.done)break;total+=chunk.value.length;if(total>MAX_BRIEF_BYTES+10000){await reader.cancel();return privateReply({error:'Each brief must be 20 MB or smaller.'},413);}chunks.push(chunk.value);}
  const bytes=new Uint8Array(total);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  let data:FormData;try{data=await new Response(bytes,{headers:{'Content-Type':request.headers.get('content-type')??''}}).formData();}catch{return privateReply({error:'Invalid upload.'},400);}
  const file=data.get('file'),jobId=data.get('jobId'),id=data.get('id');
  if(!(file instanceof File)||typeof jobId!=='string'||typeof id!=='string'||!/^[a-f\d-]{36}$/i.test(id))return privateReply({error:'Choose a brief and job.'},400);
  if(!file.size||file.size>MAX_BRIEF_BYTES)return privateReply({error:'Each brief must contain data and be 20 MB or smaller.'},400);
  const type=briefTypes[file.name.split('.').pop()?.toLowerCase()??''];if(!type)return privateReply({error:'Use PDF, Word, text, Markdown, PNG, JPG, or WebP.'},400);
  const job=await assignedDb().prepare('SELECT id FROM assigned_jobs WHERE id=? AND owner_id=?').bind(jobId,user.userId).first();if(!job)return privateReply({error:'Job not found.'},404);
  const prior=await assignedDb().prepare('SELECT id FROM assigned_briefs WHERE id=? AND owner_id=? AND job_id=?').bind(id,user.userId,jobId).first();if(prior)return privateReply({id});
  const count=await assignedDb().prepare('SELECT count(*) AS n FROM assigned_briefs WHERE job_id=? AND owner_id=?').bind(jobId,user.userId).first<{n:number}>();if((count?.n??0)>=10)return privateReply({error:'A job can have up to 10 briefs.'},400);
  const objectKey=`assigned/${user.userId}/${jobId}/${id}/${crypto.randomUUID()}`,filename=file.name.replace(/[\x00-\x1f\x7f/\\]/g,'_').slice(0,200);
  await env.BUCKET.put(objectKey,await file.arrayBuffer(),{httpMetadata:{contentType:type}});
  try{
   const saved=await assignedDb().prepare('INSERT OR IGNORE INTO assigned_briefs (id,job_id,owner_id,object_key,filename,size,content_type,created_at) SELECT ?,?,?,?,?,?,?,? WHERE (SELECT count(*) FROM assigned_briefs WHERE job_id=? AND owner_id=?)<10').bind(id,jobId,user.userId,objectKey,filename,file.size,type,new Date().toISOString(),jobId,user.userId).run();
   if(!saved.meta.changes){
    await env.BUCKET.delete(objectKey);
    const retry=await assignedDb().prepare('SELECT id FROM assigned_briefs WHERE id=? AND owner_id=? AND job_id=?').bind(id,user.userId,jobId).first();
    if(!retry)return privateReply({error:'A job can have up to 10 briefs. Please refresh and try again.'},409);
   }
  }catch(e){await env.BUCKET.delete(objectKey);throw e;}
  return privateReply({id});
 }catch(e){return privateError(e);}
}
