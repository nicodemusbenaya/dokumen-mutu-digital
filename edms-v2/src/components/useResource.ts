'use client';
import {useEffect,useRef,useState,useCallback} from 'react';

// Keyed results stay invisible as soon as the requested URL changes, even
// before effect cleanup. Both abort and generation protect against late fetches.
export function useResource<T=any>(path:string|null,delay=0){
 const [state,setState]=useState<{key:string|null;data?:T;error:string;loading:boolean}>({key:null,error:'',loading:true});
 const [revision,setRevision]=useState(0);
 const current=useRef(path);current.current=path;
 const generation=useRef(0);
 const reload=useCallback(()=>{generation.current++;setRevision(n=>n+1);},[]);
 useEffect(()=>{
  const stamp=++generation.current,controller=new AbortController();
  if(!path){setState({key:null,error:'',loading:false});return;}
  setState(previous=>({key:path,data:previous.key===path?previous.data:undefined,error:'',loading:true}));
  const timer=setTimeout(async()=>{
   try{
    const response=await fetch('/api/v2/'+path,{signal:controller.signal});
    const data=await response.json();
    if(!response.ok)throw new Error(data.error||'Tidak dapat memuat data. Coba lagi.');
    if(generation.current===stamp&&current.current===path)setState({key:path,data,error:'',loading:false});
   }catch(e:any){if(!controller.signal.aborted&&generation.current===stamp&&current.current===path)setState({key:path,error:e.message,loading:false});}
  },delay);
  return()=>{clearTimeout(timer);controller.abort();generation.current++;};
 },[path,delay,revision]);
 const matching=state.key===path;
 return {data:matching?state.data:undefined,error:matching?state.error:'',loading:!!path&&(!matching||state.loading),reload};
}
