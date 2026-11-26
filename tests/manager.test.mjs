import test from 'node:test';
import assert from 'node:assert/strict';
import {load} from './load-module.mjs';
const {validateUpdates,scheduledTheme}=await load('lib/manager.ts');
const board={projects:[{id:'one'},{id:'two'}],tasks:[]};
const draft={projectId:'one',workDone:' Landing page reviewed ',status:null,nextSteps:'QA next',blockers:null};
test('confirmation requires an existing and explicitly chosen project',()=>{
 assert.equal(validateUpdates([draft],board,true)[0].workDone,'Landing page reviewed');
 assert.equal(validateUpdates([{...draft,projectId:null}],board)[0].projectId,null);
 assert.throws(()=>validateUpdates([{...draft,projectId:null}],board,true),/Choose/);
 assert.throws(()=>validateUpdates([{...draft,projectId:'deleted'}],board,true),/no longer/);
 assert.throws(()=>validateUpdates([{...draft,workDone:''}],board,true),/description/);
});
test('memory distinguishes unchanged from explicitly cleared fields',()=>{
 const saved=validateUpdates([{...draft,nextSteps:null,blockers:''}],board,true)[0];
 assert.equal(saved.nextSteps,null);assert.equal(saved.blockers,'');
 assert.throws(()=>validateUpdates([{...draft,status:'x'.repeat(2001)}],board),/2,000/);
});
test('automatic dark mode switches at 6 pm and returns at 6 am',()=>{
 assert.equal(scheduledTheme(17),'light');assert.equal(scheduledTheme(18),'dark');assert.equal(scheduledTheme(0),'dark');assert.equal(scheduledTheme(5),'dark');assert.equal(scheduledTheme(6),'light');
});
