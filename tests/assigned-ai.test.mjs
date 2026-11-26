import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const source=readFileSync(new URL('../lib/assigned-ai.ts',import.meta.url),'utf8').replace("import {env} from 'cloudflare:workers';","const env={OPENAI_API_KEY:'local-test-placeholder'};");
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {askAssignedDavid}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
test('David accepts an assignee completion and rejects a read-only overview job',async()=>{
 const original=globalThis.fetch;
 const jobs=[{id:'received',title:'Assigned to Matthew',assignedBy:'Dean',assignee:'Matthew',revision:3,completedAt:null,canManage:false,canUpdateStatus:true,brief:'',deadline:'2026-12-20'},{id:'overview',title:'Assigned to Arjun',assignedBy:'Dean',assignee:'Arjun',revision:0,completedAt:null,canManage:false,canUpdateStatus:false,brief:'',deadline:'2026-12-20'}];
 let proposed='received';
 try{
  globalThis.fetch=async(url,options)=>{
   assert.equal(url,'https://api.openai.com/v1/responses');
   const body=JSON.parse(options.body),context=JSON.parse(body.input[1].content);
   assert.match(body.input[0].content,/ONLY where canUpdateStatus is true/);
   assert.equal(context.jobs[0].canUpdateStatus,true);assert.equal(context.jobs[1].canUpdateStatus,false);
   return Response.json({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify({reply:'Please confirm this completed job.',completedJobIds:[proposed]})}]}]});
  };
  const answer=await askAssignedDavid('My assigned job is complete',jobs,[],[],'Matthew');assert.equal(answer.proposals[0].id,'received');assert.equal(answer.proposals[0].revision,3);
  proposed='overview';await assert.rejects(()=>askAssignedDavid('Mark the other job complete',jobs,[],[],'Matthew'),/unavailable/);
 }finally{globalThis.fetch=original;}
});
