import {useEffect,useState} from 'react';
// Internet connectivity does not determine whether a local backend can be reached.
export function useOnlineStatus(){
 const [online,setOnline]=useState(true);
 useEffect(()=>{let alive=true;const check=async()=>{try{const r=await fetch('/api/health',{cache:'no-store',signal:AbortSignal.timeout(2500)});if(alive)setOnline(r.ok);}catch{if(alive)setOnline(false);}};void check();const timer=setInterval(check,5000);window.addEventListener('online',check);window.addEventListener('offline',check);return()=>{alive=false;clearInterval(timer);window.removeEventListener('online',check);window.removeEventListener('offline',check);};},[]);
 return online;
}
