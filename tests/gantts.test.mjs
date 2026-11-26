import test from 'node:test';
import assert from 'node:assert/strict';
import {load} from './load-module.mjs';
const {TEAM_GANTT,CHINA_GANTT,weekCount,lastDay,validateGantt,requestBoardId}=await load('lib/gantts.ts');
test('original team horizon and China week numbering are preserved',()=>{
 assert.equal(weekCount(TEAM_GANTT),6);assert.equal(lastDay(TEAM_GANTT),'2026-12-05');
 assert.equal(weekCount(CHINA_GANTT),8);assert.equal(CHINA_GANTT.firstWeekNumber,3);assert.equal(CHINA_GANTT.startWeek,'2026-11-08');assert.equal(lastDay(CHINA_GANTT),'2027-01-02');
});
test('custom horizons normalize to complete Sunday–Saturday weeks',()=>{
 assert.deepEqual(validateGantt({name:'  Launch  ',startDate:'2026-11-10',endDate:'2026-12-31'}),{name:'Launch',startWeek:'2026-11-08',endWeek:'2026-12-27'});
 const g={...validateGantt({name:'One day',startDate:'2026-11-10',endDate:'2026-11-10'}),id:'a',firstWeekNumber:1};assert.equal(weekCount(g),1);
 for(const x of [{name:''},{name:'a'.repeat(61)},{startDate:'2026-02-30'},{endDate:'2026-10-01'},{endDate:'2030-01-01'}])assert.throws(()=>validateGantt({name:'Board',startDate:'2026-11-10',endDate:'2026-12-31',...x}));
});
test('board scope defaults only when omitted and rejects malformed IDs',()=>{
 assert.equal(requestBoardId(new Request('https://app.test/api/board')),'team');
 assert.equal(requestBoardId(new Request('https://app.test/api/board?board=china')),'china');
 assert.equal(requestBoardId(new Request('https://app.test/api/board?board=')),null);
 assert.equal(requestBoardId(new Request('https://app.test/api/board?board=../team')),null);
});
