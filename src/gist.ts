import {exportData,importData} from './db';
export type Settings={geminiKey:string;gistId:string;githubToken:string};
const blank:Settings={geminiKey:'',gistId:'',githubToken:''};
export function loadSettings():Settings{try{return {...blank,...JSON.parse(localStorage.getItem('quiet-day-settings')||'{}')}}catch{return {...blank}}}
export function saveSettings(s:Settings){localStorage.setItem('quiet-day-settings',JSON.stringify(s))}
const name='quiet-day-data.json';
async function request(s:Settings,method:'GET'|'PATCH',body?:unknown){
 if(!s.gistId.trim()||!s.githubToken.trim())throw new Error('Add your Gist ID and GitHub token in Settings.');
 const r=await fetch('https://api.github.com/gists/'+encodeURIComponent(s.gistId.trim()),{method,headers:{Authorization:'Bearer '+s.githubToken.trim(),Accept:'application/vnd.github+json','Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
 const j=await r.json();if(!r.ok)throw new Error(j.message||'GitHub Gist error');return j;
}
async function remote(s:Settings){
 const g=await request(s,'GET'),file=g.files?.[name],revision=g.history?.[0]?.version||null;
 if(!file)return{data:null,revision};
 let content=file.content;
 if(file.truncated){const r=await fetch(file.raw_url);if(!r.ok)throw new Error('Cannot fetch complete Gist data');content=await r.text()}
 const data=JSON.parse(content);
 if(data.version!==1||!Array.isArray(data.tasks)||!Array.isArray(data.entries)||!Array.isArray(data.focus))throw new Error('Gist contains an incompatible Quiet Day backup');
 return {data,revision};
}
const revisionKey=(s:Settings)=>'quiet-day-revision:'+s.gistId.trim();
export async function pull(s:Settings){
 const current=await remote(s);if(!current.data)throw new Error('No Quiet Day backup exists on this Gist yet.');
 await importData(current.data);localStorage.setItem(revisionKey(s),current.revision||'');
}
export async function push(s:Settings){
 const current=await remote(s),last=localStorage.getItem(revisionKey(s));
 if(current.data&&current.revision!==last)throw new Error('Remote data changed or has never been pulled on this device. Export locally before pulling or reconciling.');
 const data=await exportData();
 const result=await request(s,'PATCH',{files:{[name]:{content:JSON.stringify(data)}}});
 localStorage.setItem(revisionKey(s),result.history?.[0]?.version||'');
}

type RecordWithId={id:string;updatedAt?:number;createdAt?:number;startedAt?:number;endedAt?:number;deletedAt?:number};
type Snapshot={version:number;tasks:RecordWithId[];entries:RecordWithId[];focus:RecordWithId[]};
const latest=(x:RecordWithId)=>x.updatedAt||x.deletedAt||x.endedAt||x.createdAt||x.startedAt||0;
const combine=(a:RecordWithId[],b:RecordWithId[])=>{
 const records=new Map<string,RecordWithId>();
 for(const item of [...a,...b]){
  const old=records.get(item.id);
  if(!old||latest(item)>latest(old))records.set(item.id,item);
 }
 return [...records.values()];
};
function merge(local:Snapshot,cloud:Snapshot):Snapshot{
 return {version:1,tasks:combine(local.tasks,cloud.tasks),entries:combine(local.entries,cloud.entries),focus:combine(local.focus,cloud.focus)};
}
export async function synchronize(s:Settings):Promise<'created'|'updated'|'unchanged'>{
 const existing=await exportData();
 for(let attempt=0;attempt<3;attempt++){
  const r=await remote(s);
  const combined=r.data?merge(existing as Snapshot,r.data as Snapshot):existing;
  const serialized=JSON.stringify({version:1,tasks:combined.tasks,entries:combined.entries,focus:combined.focus});
  const remoteSerialized=r.data?JSON.stringify({version:1,tasks:r.data.tasks,entries:r.data.entries,focus:r.data.focus}):'';
  const localSerialized=JSON.stringify({version:1,tasks:existing.tasks,entries:existing.entries,focus:existing.focus});
  if(localSerialized!==serialized)await importData({...combined,exportedAt:new Date().toISOString()});
  if(remoteSerialized===serialized){localStorage.setItem(revisionKey(s),r.revision||'');return 'unchanged'}
  const verify=await remote(s);
  if(verify.revision!==r.revision)continue;
  const pushed=await request(s,'PATCH',{files:{[name]:{content:JSON.stringify({...combined,exportedAt:new Date().toISOString()})}}});
  localStorage.setItem(revisionKey(s),pushed.history?.[0]?.version||'');
  return r.data?'updated':'created';
 }
 throw new Error('Gist changed during synchronization. Try again; local data is preserved.');
}
