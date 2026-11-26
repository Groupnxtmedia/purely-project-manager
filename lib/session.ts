import {env} from 'cloudflare:workers';
import {cookies} from 'next/headers';
import {PEOPLE,type Person} from './board';
const encoder=new TextEncoder();
export const COOKIE='purely_team';
export function secrets(){const e=env as unknown as Record<string,string>;return {key:e.SESSION_SECRET,code:e.TEAM_ACCESS_CODE};}
const AUTH_VERSION=2; // Reject sessions issued while the shared password was disabled.
async function key(){const value=secrets().key;if(!value)throw new Error('Team access is not configured.');return crypto.subtle.importKey('raw',encoder.encode(value),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);}
function hex(bytes:ArrayBuffer){return Array.from(new Uint8Array(bytes)).map(x=>x.toString(16).padStart(2,'0')).join('');}
export async function digest(value:string){return hex(await crypto.subtle.digest('SHA-256',encoder.encode(value)));}
export async function codeMatches(value:string){const expected=secrets().code;if(!expected)return false;const [a,b]=await Promise.all([digest(value),digest(expected)]);let difference=0;for(let i=0;i<a.length;i++)difference|=a.charCodeAt(i)^b.charCodeAt(i);return difference===0;}
export async function issueSession(name:Person){const payload=btoa(JSON.stringify({name,authVersion:AUTH_VERSION,expires:Date.now()+7*86400000}));return `${payload}.${hex(await crypto.subtle.sign('HMAC',await key(),encoder.encode(payload)))}`;}
export async function getSession():Promise<{name:Person}|null>{
 try{if(!secrets().code)return null;const value=(await cookies()).get(COOKIE)?.value;if(!value)return null;const [payload,signature,extra]=value.split('.');if(!payload||!signature||extra!==undefined||! /^[a-f0-9]{64}$/.test(signature))return null;
 const bytes=new Uint8Array(signature.match(/../g)!.map(x=>parseInt(x,16)));
 if(!await crypto.subtle.verify('HMAC',await key(),bytes,encoder.encode(payload)))return null;
 const data=JSON.parse(atob(payload));return data.authVersion===AUTH_VERSION&&data.expires>Date.now()&&PEOPLE.includes(data.name)?{name:data.name}:null;
 }catch{return null;}
}
