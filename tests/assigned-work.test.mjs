import test from 'node:test';
import assert from 'node:assert/strict';
import {jobInput,localDay,reminderKind,shiftDate} from '../lib/assigned-work.ts';
const active={deadline:'2026-11-09',completedAt:null};
test('two-day and deadline reminders start at 9 a.m. Toronto',()=>{
 assert.equal(reminderKind(active,new Date('2026-11-07T13:59:59Z')),null);
 assert.equal(reminderKind(active,new Date('2026-11-07T14:00:00Z')),'two_days');
 assert.equal(reminderKind(active,new Date('2026-11-08T14:00:00Z')),null);
 assert.equal(reminderKind(active,new Date('2026-11-09T14:00:00Z')),'due_today');
 assert.equal(reminderKind(active,new Date('2026-11-10T14:00:00Z')),null);
});
test('completed work never gets a reminder',()=>assert.equal(reminderKind({...active,completedAt:'2026-11-06T14:00:00Z'},new Date('2026-11-07T14:00:00Z')),null));
test('calendar reminders survive DST and year boundaries',()=>{
 assert.equal(localDay(new Date('2026-11-01T05:30:00Z')).date,'2026-11-01');
 assert.equal(reminderKind({deadline:'2026-11-02',completedAt:null},new Date('2026-10-31T13:00:00Z')),'two_days');
 assert.equal(reminderKind({deadline:'2026-11-03',completedAt:null},new Date('2026-11-01T14:00:00Z')),'two_days');
 assert.equal(shiftDate('2027-01-01',-2),'2026-12-30');
 assert.equal(localDay(new Date('2026-11-08T03:00:00Z')).date,'2026-11-07');
});
test('job input allows staff outside the Gantt and rejects invalid dates',()=>{
 assert.equal(jobInput({title:'  Campaign brief ',assignee:'Jordan',deadline:'2026-11-10',brief:''}).assignee,'Jordan');
 assert.throws(()=>jobInput({title:'Job',assignee:'Jordan',deadline:'2026-02-30',brief:''}));
 assert.throws(()=>jobInput({title:'Job',assignee:'',deadline:'2026-11-10',brief:''}));
});
