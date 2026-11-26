import test from 'node:test';
import assert from 'node:assert/strict';
import {load} from './load-module.mjs';
const {validateNotifications,requestIdentity}=await load('lib/notifications.ts');
const board={projects:[{id:'a'},{id:'b'}],tasks:[{id:'ta',projectId:'a'},{id:'tb',projectId:'b'}]};
const request={recipient:'Matthew',projectId:'a',taskId:'ta',deliverable:' Approve copy ',reason:'Email scheduling is waiting.'};
test('recipient, project and task must be valid before confirmation',()=>{
 assert.equal(validateNotifications([request],board,'Dean',true)[0].deliverable,'Approve copy');
 assert.throws(()=>validateNotifications([{...request,recipient:'Dean'}],board,'Dean',true),/another/);
 assert.throws(()=>validateNotifications([{...request,recipient:'Unknown'}],board,'Dean',true),/teammate/);
 assert.throws(()=>validateNotifications([{...request,projectId:'deleted'}],board,'Dean',true),/no longer/);
 assert.throws(()=>validateNotifications([{...request,taskId:'tb'}],board,'Dean',true),/belong/);
 assert.throws(()=>validateNotifications([{...request,taskId:undefined}],board,'Dean',true),/belong/);
});
test('ambiguous proposals are reviewable but cannot be sent',()=>{
 const ambiguous={...request,projectId:null,recipient:null,taskId:null};
 assert.deepEqual(validateNotifications([ambiguous],board,'Dean'),[{...ambiguous,deliverable:'Approve copy'}]);
 assert.throws(()=>validateNotifications([ambiguous],board,'Dean',true),/Choose/);
 assert.throws(()=>validateNotifications([{...request,reason:' '}],board,'Dean',true),/Explain/);
 assert.throws(()=>validateNotifications([{...request,deliverable:'x'.repeat(1001)}],board,'Dean',true),/1,000/);
});
test('duplicate deliverables are normalized while routing stays distinct',()=>{
 assert.throws(()=>validateNotifications([request,{...request,deliverable:'approve   COPY'}],board,'Dean',true),/duplicate/);
 assert.notEqual(requestIdentity('Dean',request),requestIdentity('Arjun',request));
 assert.notEqual(requestIdentity('Dean',request),requestIdentity('Dean',{...request,recipient:'Keanu'}));
});
