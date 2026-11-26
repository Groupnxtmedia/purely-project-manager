'use client';
import {boardApi} from '../lib/gantts';
import {useCallback,useEffect,useRef,useState} from 'react';
import {Bell,Check,CheckCheck,ChevronLeft,ChevronRight,ExternalLink,Inbox,Send,Sparkles,X} from 'lucide-react';
import type {Board,Person} from '../lib/board';
import type {TeamNotification} from '../lib/notifications';
import {formatLogDate} from './ProjectHistory';

type InboxData={notifications:TeamNotification[];total:number;unread:number;inboxUnread:number;sentUnread:number};
export default function NotificationsPanel({boardId,name,board,revision,onAsk,onProject}:{boardId:string;name:Person;board:Board;revision:number;onAsk:(prompt:string)=>void;onProject:(id:string)=>void}){
 const [open,setOpen]=useState(false),[view,setView]=useState<'inbox'|'sent'>('inbox'),[page,setPage]=useState(0);
 const [data,setData]=useState<InboxData>({notifications:[],total:0,unread:0,inboxUnread:0,sentUnread:0}),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const [busy,setBusy]=useState(false),[delivering,setDelivering]=useState<string|null>(null),[note,setNote]=useState('');
 const dialog=useRef<HTMLDialogElement>(null),sequence=useRef(0),locked=useRef(false);
 const load=useCallback(async()=>{
  const seq=++sequence.current;
  try{const r=await fetch(boardApi(`/api/notifications?view=${view}&offset=${page*30}`,boardId));const d=await r.json() as InboxData&{error?:string};if(!r.ok)throw Error(d.error||'Could not load notifications.');if(seq===sequence.current){setData(d);setError('');}}
  catch(e){if(seq===sequence.current)setError(e instanceof Error?e.message:'Could not load notifications.');}
  finally{if(seq===sequence.current)setLoading(false);}
 },[boardId,name,view,page]);
 useEffect(()=>{setLoading(true);void load();const timer=setInterval(()=>{if(document.visibilityState==='visible')void load();},15000);const refresh=()=>{if(document.visibilityState==='visible')void load();};document.addEventListener('visibilitychange',refresh);return()=>{sequence.current++;clearInterval(timer);document.removeEventListener('visibilitychange',refresh);};},[load,revision]);
 useEffect(()=>{if(!open)return;const d=dialog.current;d?.showModal();void load();const previous=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{d?.close();document.body.style.overflow=previous;};},[open]);
 async function update(id:string,action:'read'|'resolve'){
  if(locked.current)return;locked.current=true;setBusy(true);setError('');
  try{const r=await fetch(boardApi('/api/notifications',boardId),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,action,note})});const d=await r.json() as {error?:string};if(!r.ok)throw Error(d.error||'Could not update this request.');setDelivering(null);setNote('');await load();}
  catch(e){setError(e instanceof Error?e.message:'Could not update this request.');}finally{locked.current=false;setBusy(false);}
 }
 function close(){setOpen(false);setDelivering(null);setNote('');}
 function ask(prompt:string){close();onAsk(prompt);}
 return <>
  <button className="icon-btn notification-bell" aria-label={`Notifications${data.unread?`, ${data.unread} unread`:''}`} title="Notifications from David" onClick={()=>setOpen(true)}><Bell size={19}/>{data.unread>0&&<span className="notification-badge">{data.unread>99?'99+':data.unread}</span>}</button>
  {open&&<dialog ref={dialog} className="notifications-dialog" aria-labelledby="notifications-title" onCancel={e=>{e.preventDefault();close();}} onClick={e=>{if(e.target===e.currentTarget)close();}}>
   <header className="notifications-header"><div className="manager-emblem"><Bell size={21}/></div><div><span className="eyebrow">DAVID / TEAM FOLLOW-UPS</span><h2 id="notifications-title">Notifications</h2></div><button className="icon-btn" aria-label="Close notifications" onClick={close}><X size={20}/></button></header>
   <div className="notifications-intro"><span>For <strong>{name}</strong></span><span>Keep the next step moving.</span></div>
   <div className="notification-tabs" role="group" aria-label="Notification view"><button aria-pressed={view==='inbox'} onClick={()=>{setView('inbox');setPage(0);setDelivering(null);}}><Inbox size={15}/>Inbox{data.inboxUnread>0&&<b>{data.inboxUnread}</b>}</button><button aria-pressed={view==='sent'} onClick={()=>{setView('sent');setPage(0);setDelivering(null);}}><Send size={14}/>Sent{data.sentUnread>0&&<b>{data.sentUnread}</b>}</button><span>{data.unread?`${data.unread} unread`:'All caught up'}</span></div>
   <div className="notifications-scroll">
    {error&&<div className="inline-error" role="alert">{error}<button className="text-btn" onClick={()=>load()}>Retry</button></div>}
    {loading?<p className="notification-empty">Loading your requests…</p>:!data.notifications.length?<div className="notification-empty"><span className="welcome-spark"><CheckCheck size={27}/></span><h3>{view==='inbox'?'A clear path ahead.':'Waiting on a teammate?'}</h3><p>{view==='inbox'?'Requests David relays to you will appear here, with the deliverable and the work it’s holding up.':'Tell David what you need, who you’re waiting on, and which project it affects. Review the message before sending.'}</p><button className="btn" onClick={()=>ask('Help me request a deliverable from a teammate. Ask me what I need and which project or task is waiting.')}><Sparkles size={15}/>Ask David</button></div>:data.notifications.map(n=>{
     const unread=view==='inbox'?!n.readAt:!!n.resolvedAt&&!n.senderReadAt,projectExists=board.projects.some(p=>p.id===n.projectId);
     return <article key={n.id} className={'notification-card '+(unread?'unread':'')}>
      <div className="notification-meta"><span><Sparkles size={13}/>David <small>· {view==='inbox'?`for ${n.sender}`:`to ${n.recipient}`}</small></span><span className={'request-state '+(n.resolvedAt?'delivered':'')}>{n.resolvedAt?'Delivered':'Waiting'}</span></div>
      <h3>{n.deliverable}</h3><p className="notification-reason"><strong>{n.sender} {n.resolvedAt?'was':'is'} waiting.</strong> {n.reason}</p>
      <button className="notification-project" disabled={!projectExists} onClick={()=>{close();onProject(n.projectId);}}><ExternalLink size={12}/><span>{board.projects.find(p=>p.id===n.projectId)?.title??n.projectTitle}{n.taskTitle&&<small>Task: {board.tasks.find(t=>t.id===n.taskId)?.title??n.taskTitle}</small>}{!projectExists&&<small>Project no longer on the board</small>}</span></button>
      {n.resolvedAt&&<div className="delivery-note"><CheckCheck size={15}/><div><strong>{n.recipient} marked this delivered</strong><time>{formatLogDate(n.resolvedAt)}</time>{n.resolutionNote&&<p>{n.resolutionNote}</p>}</div></div>}
      <div className="notification-card-footer"><time>{formatLogDate(n.createdAt)}</time><span>{view==='sent'&&!n.resolvedAt?(n.readAt?'Read by '+n.recipient:'Not read yet'):unread?'Unread':''}</span></div>
      <div className="notification-actions">{unread&&<button className="text-btn" disabled={busy} onClick={()=>update(n.id,'read')}><Check size={13}/>Mark read</button>}{view==='inbox'&&!n.resolvedAt&&<button className="btn small" disabled={busy} onClick={()=>{setDelivering(n.id);setNote('');}}><CheckCheck size={14}/>Mark delivered</button>}<button className="text-btn" onClick={()=>ask(`About the deliverable request from ${n.sender} to ${n.recipient} for ${n.projectTitle}${n.taskTitle?` / ${n.taskTitle}`:''}: “${n.deliverable}”. ${n.reason}\nHelp me discuss the next step. Do not create a duplicate request.`)}>Discuss with David</button></div>
      {delivering===n.id&&<form className="delivery-form" onSubmit={e=>{e.preventDefault();void update(n.id,'resolve');}}><label className="field">Delivery note <small>Optional</small><textarea autoFocus value={note} maxLength={1000} rows={2} placeholder="Where can they find the deliverable?" onChange={e=>setNote(e.target.value)}/></label><p>{n.sender} will see this confirmation. Project progress stays unchanged.</p><div><button type="button" className="text-btn" disabled={busy} onClick={()=>setDelivering(null)}>Cancel</button><button type="submit" className="btn primary small" disabled={busy}>{busy?'Saving…':'Confirm delivery'}</button></div></form>}
     </article>;
    })}
    {data.total>30&&<div className="notification-pagination"><button className="icon-btn" aria-label="Previous notifications" disabled={!page||loading} onClick={()=>setPage(p=>p-1)}><ChevronLeft size={18}/></button><span>{page*30+1}–{Math.min(page*30+30,data.total)} of {data.total}</span><button className="icon-btn" aria-label="Next notifications" disabled={(page+1)*30>=data.total||loading} onClick={()=>setPage(p=>p+1)}><ChevronRight size={18}/></button></div>}
   </div>
   <footer className="notifications-footer"><button className="btn manager-launch" onClick={()=>ask('Help me request a deliverable from a teammate. Ask me what I need and which project or task is waiting.')}><Sparkles size={15}/>Request a deliverable</button><small>Shared in the app · Updated every 15 seconds</small></footer>
  </dialog>}
 </>;
}
