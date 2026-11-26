import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const moduleFrom=async(path,replace=[])=>{let source=readFileSync(new URL(path,import.meta.url),'utf8');for(const [a,b] of replace)source=source.replace(a,b);return import('data:text/javascript;base64,'+Buffer.from(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText).toString('base64'));};
const {chinaTaskInput,chinaPatch}=await moduleFrom('../lib/china.ts',[["import {PEOPLE,type Person} from './board';","const PEOPLE=['Arjun','Keanu','Matthew','Dean'];"]]);
const draft={tableId:crypto.randomUUID(),title:'Approve samples',progress:25,priority:'High',status:'In progress',assignee:'Matthew',notes:'Two samples',deadline:'2026-12-03'};
test('task validation and completion/reopening keep progress and status consistent',()=>{
 assert.deepEqual(chinaTaskInput(draft),draft);
 const done=chinaPatch(draft,'status','Done');assert.equal(done.progress,100);assert.equal(done.status,'Done');
 assert.equal(chinaPatch(done,'progress',40).status,'In progress');assert.equal(chinaPatch(done,'progress',0).status,'Not started');
 assert.equal(chinaPatch(done,'status','Blocked').progress,99);assert.equal(chinaPatch(draft,'status','Not started').progress,0);
 assert.equal(chinaTaskInput({...draft,progress:100}).status,'Done');
 for(const change of [{progress:-1},{progress:101},{progress:0.5},{progress:'50'},{assignee:'Stranger'},{deadline:'2026-02-30'},{deadline:'invalid'},{title:''},{priority:'Wrong'},{status:'Wrong'},{notes:'x'.repeat(10001)}])assert.throws(()=>chinaTaskInput({...draft,...change}));
 assert.throws(()=>chinaPatch(draft,'createdBy','Someone'));assert.throws(()=>chinaPatch(draft,'tableId',crypto.randomUUID()));
});
const {askChinaDavid}=await moduleFrom('../lib/china-ai.ts',[["import {env} from 'cloudflare:workers';","const env={OPENAI_API_KEY:'local-test-placeholder'};"]]);
test('David receives only this task and ready conversation excerpts; cannot mutate task fields',async()=>{
 const original=globalThis.fetch;let failure=false;
 try{
  globalThis.fetch=async(url,options)=>{
   assert.equal(url,'https://api.openai.com/v1/responses');const payload=JSON.parse(options.body),context=JSON.parse(payload.input[1].content);
   assert.equal(payload.store,false);assert.equal(payload.model,'gpt-6-astra');assert.match(payload.input[0].content,/You cannot update progress/);
   assert.deepEqual(context.task,{title:draft.title,table:'Suppliers',progress:25,priority:'High',status:'In progress',assignee:'Matthew',notes:'Two samples',deadline:'2026-12-03'});
   assert.equal(context.messages.length,1);assert.equal(context.messages[0].message.length,2000);assert.equal(context.messages[0].author,'Dean');
   return failure?Response.json({error:'no'}, {status:500}):Response.json({status:'completed',output:[{content:[{type:'output_text',text:'Review the samples with Matthew.'}]}]});
  };
  const messages=[{author:'Dean',body:'x'.repeat(2500),createdAt:'2026-11-22T12:00:00Z',status:'ready'},{author:'David',body:'failed response',status:'failed'}];
  assert.equal(await askChinaDavid(draft,'Suppliers',messages),'Review the samples with Matthew.');failure=true;await assert.rejects(()=>askChinaDavid(draft,'Suppliers',messages),/Your message is saved/);
 }finally{globalThis.fetch=original;}
});
