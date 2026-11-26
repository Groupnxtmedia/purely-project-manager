'use client';
import {useEffect,useRef,useState} from 'react';
import {ArrowUp,Check,UserRound,RefreshCw,Sparkles,X} from 'lucide-react';
import type {AssignedTurn} from '../lib/assigned-work';
export default function AssignedDavid({name,canViewAll,onClose,onSaved,initialPrompt=''}:{name:string;canViewAll:boolean;onClose:()=>void;onSaved:()=>void;initialPrompt?:string}){
 const dialog=useRef<HTMLDialogElement>(null),bottom=useRef<HTMLDivElement>(null),lock=useRef(false);
 const [turns,setTurns]=useState<AssignedTurn[]>([]),[message,setMessage]=useState(initialPrompt),[error,setError]=useState(''),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 async function load(){try{const r=await fetch('/api/assigned-work/chat');const d=await r.json() as {error?:string;turns:AssignedTurn[];turn:AssignedTurn};if(!r.ok)throw Error(d.error||'David could not finish this request.');setTurns(d.turns);setError('');}catch(e){setError((e as Error).message);}finally{setLoading(false);}}
 useEffect(()=>{dialog.current?.showModal();void load();const previous=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{dialog.current?.close();document.body.style.overflow=previous;};},[]);
 useEffect(()=>{bottom.current?.scrollIntoView({block:'end'});},[turns.length,busy]);
 useEffect(()=>{if(!turns.some(t=>t.status==='processing')||busy)return;const timer=setInterval(()=>void load(),5000);return()=>clearInterval(timer);},[turns,busy]);
 async function send(text=message,id:string=crypto.randomUUID()){
  if(lock.current||!text.trim())return;lock.current=true;setBusy(true);setError('');
  setTurns(rows=>rows.some(t=>t.id===id)?rows.map(t=>t.id===id?{...t,status:'processing'}:t):[...rows,{id,message:text.trim(),reply:'',proposals:[],status:'processing',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()}]);setMessage('');
  try{const r=await fetch('/api/assigned-work/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'chat',id,message:text.trim()})});const d=await r.json() as {error?:string;turns:AssignedTurn[];turn:AssignedTurn};if(!r.ok)throw Error(d.error||'David could not finish this request.');setTurns(rows=>rows.map(t=>t.id===id?d.turn:t));}catch(e){setError((e as Error).message);setTurns(rows=>rows.map(t=>t.id===id?{...t,status:'failed',reply:(e as Error).message}:t));}finally{lock.current=false;setBusy(false);}
 }
 async function act(id:string,action:'confirm'|'dismiss'){
  if(lock.current)return;lock.current=true;setBusy(true);setError('');
  try{const r=await fetch('/api/assigned-work/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,action})});const d=await r.json() as {error?:string;turns:AssignedTurn[];turn:AssignedTurn};if(!r.ok)throw Error(d.error||'David could not finish this request.');setTurns(rows=>rows.map(t=>t.id===id?d.turn:t));if(action==='confirm')onSaved();}catch(e){setError((e as Error).message);}finally{lock.current=false;setBusy(false);}
 }
 return <dialog ref={dialog} className="manager-dialog assigned-david" aria-labelledby="assigned-david-title" onCancel={e=>{e.preventDefault();onClose();}}>
  <header className="manager-header"><div className="manager-emblem"><Sparkles size={22}/></div><div><div className="eyebrow">DAVID / ASSIGNED WORK</div><h2 id="assigned-david-title">Your follow-up partner</h2></div><button className="icon-btn" aria-label="Close David" onClick={onClose}><X size={20}/></button></header>
  <div className="manager-context"><span><UserRound size={13}/>{name}’s workspace · {canViewAll?'Team overview available':'Assigned by you + to you'}</span></div>
  <div className="manager-scroll">
   {loading?<p className="assigned-empty">Opening David…</p>:!turns.length?<div className="manager-welcome"><span className="welcome-spark"><Sparkles size={29}/></span><h3>What needs your attention?</h3><p>Ask what’s due, review who you’re waiting on, or tell me which jobs are finished.</p><div className="assigned-prompts"><button className="btn" onClick={()=>send('What assigned work is due soon or overdue?')}>What’s due soon?</button><button className="btn" onClick={()=>setMessage('The job that’s now complete is ')}>Report completed work</button></div></div>:turns.map(t=><article className="assigned-conversation" key={t.id}><div className="assigned-user-message"><small>You</small><p>{t.message}</p></div><div className="assigned-david-message"><small><Sparkles size={13}/>David</small><p>{t.status==='processing'?'Looking at your assigned work…':t.reply}</p>{t.status==='failed'&&<button className="text-btn" disabled={busy} onClick={()=>send(t.message,t.id)}><RefreshCw size={13}/>Retry</button>}</div>
    {t.status==='ready'&&<section className="assigned-completion-card"><strong>Mark these jobs complete?</strong>{t.proposals.map(p=><div key={p.id}><span>{p.title}</span><small>Assigned to {p.assignee}</small></div>)}<p>These jobs will move to Completed and their reminders will stop.</p><div className="assigned-actions"><button className="text-btn" disabled={busy} onClick={()=>act(t.id,'dismiss')}>Discard</button><button className="btn primary" disabled={busy} onClick={()=>act(t.id,'confirm')}><Check size={15}/>Confirm completion</button></div></section>}
    {t.status==='confirmed'&&<div className="assigned-saved"><Check size={14}/>Completed · Reminders stopped</div>}
   </article>)}<div ref={bottom}/>
  </div>
  <form className="assigned-chat-form" onSubmit={e=>{e.preventDefault();void send();}}>{error&&<p className="inline-error" role="alert">{error}</p>}<label className="sr-only" htmlFor="assigned-chat-message">Message David about assigned work</label><div><textarea id="assigned-chat-message" rows={2} maxLength={6000} value={message} onChange={e=>setMessage(e.target.value)} placeholder="Tell David what’s done, or ask what’s due…"/><button className="btn primary" aria-label="Send to David" disabled={busy||loading||!message.trim()}><ArrowUp size={19}/></button></div><small>Assigned Work conversation · Completion changes need your confirmation</small></form>
 </dialog>;
}
