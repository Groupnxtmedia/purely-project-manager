'use client';
import {useEffect,useRef,useState,type FormEvent} from 'react';
import {Plus,UserRound,X} from 'lucide-react';
import {addDays,dateLabel,weekOf} from '../lib/board';
import {ganttHref,TEAM_GANTT,validateGantt,weekCount,type Gantt} from '../lib/gantts';
export default function AssignedWorkLink({active='team'}:{active?:string}){
 const tabs=useRef<HTMLDivElement>(null),revealed=useRef<string|null>(null);
 const [unread,setUnread]=useState(0),[gantts,setGantts]=useState<Gantt[]>([TEAM_GANTT]),[creating,setCreating]=useState(false),[error,setError]=useState('');
 useEffect(()=>{if(revealed.current===active)return;const selected=tabs.current?.querySelector<HTMLElement>('[aria-current=page]');if(selected){selected.scrollIntoView({block:'nearest',inline:'nearest'});revealed.current=active;}},[active,gantts]);
 useEffect(()=>{let alive=true;async function load(){
  const results=await Promise.allSettled([fetch('/api/gantts').then(async r=>{const d=await r.json() as {gantts:Gantt[];error?:string};if(!r.ok)throw Error(d.error);return d.gantts;}),fetch('/api/assigned-work/access').then(async r=>r.ok?((await r.json()) as {unread:number}).unread:0)]);
  if(!alive)return;
  if(results[0].status==='fulfilled'){setGantts(results[0].value);setError('');}else setError('Boards could not load. Refresh to retry.');
  if(results[1].status==='fulfilled')setUnread(results[1].value);
 }void load();const timer=setInterval(()=>{if(document.visibilityState==='visible')void load();},30000);return()=>{alive=false;clearInterval(timer);};},[]);
 return <><nav className="workspace-sections" aria-label="Workspace section"><div className="gantt-tabs" ref={tabs}>{gantts.map(g=><a key={g.id} className="workspace-tab" title={g.name} href={ganttHref(g.id)} aria-current={active===g.id?'page':undefined}>{g.name}</a>)}</div><button className="new-gantt-button" aria-label="Add Gantt board" title="Add Gantt board" onClick={()=>setCreating(true)}><Plus size={17}/></button><a href="/assigned-work" aria-current={active==='assigned'?'page':undefined}><UserRound size={13}/>Assigned Work{unread>0&&<b>{unread}</b>}</a>{error&&<small role="status">{error}</small>}</nav>{creating&&<NewGanttDialog onClose={()=>setCreating(false)}/>}</>;
}
function NewGanttDialog({onClose}:{onClose:()=>void}){
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Toronto',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const [name,setName]=useState(''),[start,setStart]=useState(weekOf(today)),[end,setEnd]=useState(addDays(weekOf(today),41)),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const id=useRef(crypto.randomUUID()),dialog=useRef<HTMLDialogElement>(null),locked=useRef(false);
 useEffect(()=>{const d=dialog.current;d?.showModal();const before=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{d?.close();document.body.style.overflow=before;};},[]);
 let horizon='Choose a start and end date.';try{const v=validateGantt({name:name||'New Gantt',startDate:start,endDate:end});horizon=`${weekCount({...v,id:'',firstWeekNumber:1})} weeks · ${dateLabel(v.startWeek)} – ${dateLabel(addDays(v.endWeek,6),{month:'short',day:'numeric',year:'numeric'})}`;}catch{}
 async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();if(locked.current)return;locked.current=true;setBusy(true);setError('');try{
  const form=new FormData(e.currentTarget),details={name:String(form.get('name')??''),startDate:String(form.get('startDate')??''),endDate:String(form.get('endDate')??'')};
  validateGantt(details);
  const r=await fetch('/api/gantts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:id.current,...details})});const d=await r.json() as {gantt:Gantt;error?:string};if(!r.ok)throw Error(d.error||'Could not create the board.');window.location.assign(ganttHref(d.gantt.id));
 }catch(e){setError(e instanceof Error?e.message:'Could not create the board. Please retry.');locked.current=false;setBusy(false);}}
 return <dialog ref={dialog} className="dialog" aria-labelledby="new-gantt-title" onCancel={e=>{e.preventDefault();if(!busy)onClose();}}><div className="dialog-inner"><header className="dialog-header"><div><span className="eyebrow">PURELY / NEW BOARD</span><h2 id="new-gantt-title">New Gantt board</h2></div><button className="icon-btn" aria-label="Close new Gantt board" disabled={busy} onClick={onClose}><X size={20}/></button></header><form onSubmit={submit}><p className="modal-subtitle">A fresh timeline for your next set of projects.</p><fieldset disabled={busy}><label className="field">Board name<input name="name" autoFocus required maxLength={60} placeholder="e.g. Product launch" value={name} onChange={e=>setName(e.target.value)}/></label><div className="form-grid"><label className="field">Start date<input name="startDate" required type="date" min="2020-01-01" max="2100-12-31" value={start} onInput={e=>setStart(e.currentTarget.value)} onChange={e=>setStart(e.target.value)}/></label><label className="field">End date<input name="endDate" required type="date" min={start||'2020-01-01'} max="2100-12-31" value={end} onInput={e=>setEnd(e.currentTarget.value)} onChange={e=>setEnd(e.target.value)}/></label></div><p className="gantt-horizon-preview">{horizon}</p><p className="form-hint">Your timeline includes full weeks, Sunday through Saturday. New boards start with no projects or tasks and are shared with the team.</p>{error&&<p className="inline-error" role="alert">{error}</p>}<div className="form-footer"><button type="button" className="btn" onClick={onClose}>Cancel</button><button type="submit" className="btn primary">{busy?'Creating…':'Create Gantt'}<Plus size={15}/></button></div></fieldset></form></div></dialog>;
}
