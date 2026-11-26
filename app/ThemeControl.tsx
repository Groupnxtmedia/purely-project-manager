'use client';
import {useEffect,useState} from 'react';
import {Moon,Sun,Clock3} from 'lucide-react';
import {scheduledTheme} from '../lib/manager';
type Mode='auto'|'light'|'dark';
export default function ThemeControl(){
 const [mode,setMode]=useState<Mode>('auto');
 useEffect(()=>{try{const stored=localStorage.getItem('purely-theme');if(stored==='light'||stored==='dark')setMode(stored);}catch{}},[]);
 useEffect(()=>{
  function apply(){const actual=mode==='auto'?scheduledTheme(new Date().getHours()):mode;document.documentElement.dataset.theme=actual;document.querySelector('meta[name="theme-color"]')?.setAttribute('content',actual==='dark'?'#101827':'#ffffff');}
  apply();const timer=setInterval(apply,15000);document.addEventListener('visibilitychange',apply);return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',apply);};
 },[mode]);
 return <label className="theme-control" title="Auto: dark from 6 pm to 6 am, using this device’s time">{mode==='dark'?<Moon size={14}/>:mode==='light'?<Sun size={14}/>:<Clock3 size={14}/>}<span className="sr-only">Appearance</span><select aria-label="Appearance" value={mode} onChange={e=>{const value=e.target.value as Mode;setMode(value);try{localStorage.setItem('purely-theme',value);}catch{}}}><option value="auto">Auto</option><option value="light">Light</option><option value="dark">Dark</option></select></label>;
}
