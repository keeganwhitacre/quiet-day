import React,{useEffect,useState,useRef} from 'react';import{createRoot}from'react-dom/client';import{BookOpen,Check,ChevronRight,Download,Upload,Plus,ArrowLeft,Play,RotateCcw,Pause,Sun,Moon,Settings as SettingsIcon,Trash2,ChevronDown,ChevronUp,RefreshCcw,Send,CalendarClock,ArrowUp,ArrowDown,Pencil,Clock3,MoreHorizontal}from'lucide-react';import{db,uid,localDate,exportData,importData,type Task,type Entry}from'./db';import {makePlan,focusReply,proposeReorganization,type ReorganizationProposal,type Plan,MODEL} from './ai';import {loadSettings,saveSettings,pull,push,synchronize,type Settings} from './gist';import './style.css';import './v2.css';
type Page='journal'|'today'|'focus'|'settings';
const dateLabel=()=>new Intl.DateTimeFormat(undefined,{weekday:'long',month:'long',day:'numeric'}).format(new Date());
function App(){const[page,setPage]=useState<Page>('today'),[tasks,setTasks]=useState<Task[]>([]),[entries,setEntries]=useState<Entry[]>([]),[draft,setDraft]=useState(''),[newTask,setNewTask]=useState(''),[selected,setSelected]=useState<string|null>(null),[active,setActive]=useState(false),[seconds,setSeconds]=useState(0),[sessionMinutes,setSessionMinutes]=useState(20),[focusFinished,setFocusFinished]=useState(false),[focusHelpOpen,setFocusHelpOpen]=useState(false),[stuck,setStuck]=useState(false),[dark,setDark]=useState(()=>{try{return localStorage.getItem('quiet-day-theme')==='dark'}catch{return false}}),[error,setError]=useState(''),[busy,setBusy]=useState(false),[config,setConfig]=useState<Settings>(loadSettings),[plan,setPlan]=useState<Plan|null>(null),[help,setHelp]=useState(''),[barrier,setBarrier]=useState('I cannot get started'),[message,setMessage]=useState(''),[expanded,setExpanded]=useState<string[]>([]),[conversation,setConversation]=useState<{role:'user'|'assistant';text:string}[]>([]),[focusInput,setFocusInput]=useState(''),[showDone,setShowDone]=useState(false),[showLater,setShowLater]=useState(false),[reviewOpen,setReviewOpen]=useState(false),[historyOpen,setHistoryOpen]=useState(false),[editing,setEditing]=useState<string|null>(null),[editText,setEditText]=useState(''),[evening,setEvening]=useState(false),[eveningNote,setEveningNote]=useState(''),[checkIn,setCheckIn]=useState(false),[finishingIds,setFinishingIds]=useState<string[]>([]),[leavingIds,setLeavingIds]=useState<string[]>([]),[navDirection,setNavDirection]=useState<'left'|'right'>('right'),[reorganizing,setReorganizing]=useState(false),[proposal,setProposal]=useState<ReorganizationProposal|null>(null),[proposalScope,setProposalScope]=useState<string|null>(null),[proposalChosen,setProposalChosen]=useState<string[]>([]),[proposalOrder,setProposalOrder]=useState<string[]>([]),[showEstimates,setShowEstimates]=useState(false),[planUndo,setPlanUndo]=useState<{before:Task[];createdIds:string[];appliedAt:number}|null>(null),[syncState,setSyncState]=useState(''),[syncEnabled,setSyncEnabled]=useState(localStorage.getItem('quiet-day-auto-sync')!=='off');const syncing=useRef(false);const swipeOrigin=useRef<{x:number;y:number;eligible:boolean}|null>(null);const focusClock=useRef<{started:number;base:number}|null>(null);
 const reload=async()=>{setTasks((await db.tasks.toArray()).filter(t=>!t.deletedAt&&!t.planArchived).sort((a,b)=>Number(a.done)-Number(b.done)||(a.sortOrder??a.createdAt)-(b.sortOrder??b.createdAt)));setEntries((await db.entries.toArray()).filter(e=>!e.deletedAt).sort((a,b)=>b.createdAt-a.createdAt));};
 useEffect(()=>{reload().catch(e=>setError(String(e)));setDraft(localStorage.getItem('quiet-day-draft')||'');},[]);useEffect(()=>{localStorage.setItem('quiet-day-draft',draft)},[draft]);
 useEffect(()=>{document.documentElement.dataset.theme=dark?'dark':'light';document.querySelector('meta[name="theme-color"]')?.setAttribute('content',dark?'#171e2c':'#f6f7fb');document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')?.setAttribute('content',dark?'black-translucent':'default');try{localStorage.setItem('quiet-day-theme',dark?'dark':'light')}catch{}},[dark]);
 const autoSync=async()=>{const settings=loadSettings();if(!syncEnabled||!settings.gistId||!settings.githubToken||syncing.current||!navigator.onLine)return;syncing.current=true;try{setSyncState('Syncing…');await synchronize(settings);await reload();setSyncState('Synced')}catch(e){setSyncState('Sync needs attention: '+String(e))}finally{syncing.current=false}};
 useEffect(()=>{const timer=window.setTimeout(()=>{autoSync()},4500);return()=>window.clearTimeout(timer)},[tasks,entries,syncEnabled]);
 useEffect(()=>{const id=window.setInterval(()=>{autoSync()},90000);const onFocus=()=>{if(document.visibilityState==='visible')autoSync()};document.addEventListener('visibilitychange',onFocus);return()=>{clearInterval(id);document.removeEventListener('visibilitychange',onFocus)}},[syncEnabled]);

 useEffect(()=>{if(!active)return;
  const update=()=>{const clock=focusClock.current;if(!clock)return;const elapsed=clock.base+Math.floor((Date.now()-clock.started)/1000);setSeconds(elapsed);if(elapsed>=sessionMinutes*60){setActive(false);setFocusFinished(true);focusClock.current=null;}};
  update();const id=window.setInterval(update,250);
  const onVisible=()=>{if(document.visibilityState==='visible')update()};
  document.addEventListener('visibilitychange',onVisible);
  return()=>{clearInterval(id);document.removeEventListener('visibilitychange',onVisible)};
 },[active,sessionMinutes]);
 const pauseFocus=()=>{const clock=focusClock.current;if(clock)setSeconds(clock.base+Math.floor((Date.now()-clock.started)/1000));focusClock.current=null;setActive(false)};
 const startFocus=()=>{if(focusFinished){setSessionMinutes(v=>v+20);setFocusFinished(false)}focusClock.current={started:Date.now(),base:seconds};setActive(true)};
 const stopFocus=()=>{pauseFocus();setSeconds(0);setFocusFinished(false);setCheckIn(false);setStuck(false);setFocusHelpOpen(false);setSelected(null);setPage('today')};
 const remainingFocus=Math.max(0,sessionMinutes*60-seconds);
 const focusFraction=remainingFocus/(sessionMinutes*60);
 const focusR=42,focusCirc=2*Math.PI*focusR;
 const dialTicks=Array.from({length:60},(_,i)=>i);

 const addTask=async(raw:string,source?:string)=>{const title=raw.trim();if(!title)return;const now=Date.now();await db.tasks.add({id:uid(),title,done:false,createdAt:now,updatedAt:now,source,sortOrder:now});await reload();};
 const saveEntry=async()=>{if(!draft.trim())return;const id=uid();await db.entries.add({id,date:localDate(),text:draft.trim(),createdAt:Date.now()});setDraft('');await reload();setPage('today');};
 const toggle=async(t:Task)=>{if(t.done){await db.tasks.update(t.id,{done:false,completedAt:undefined,updatedAt:Date.now()});await reload();return}
  if(finishingIds.includes(t.id))return;
  setFinishingIds(ids=>[...ids,t.id]);
  try{const now=Date.now();await db.tasks.update(t.id,{done:true,completedAt:now,updatedAt:now});
    window.setTimeout(()=>setLeavingIds(ids=>[...ids,t.id]),480);
    window.setTimeout(async()=>{try{await reload()}catch(e){setError(String(e))}finally{setFinishingIds(ids=>ids.filter(id=>id!==t.id));setLeavingIds(ids=>ids.filter(id=>id!==t.id))}},850);
  }catch(e){setFinishingIds(ids=>ids.filter(id=>id!==t.id));setError(String(e))}
 };
 const removeEntry=async(e:Entry)=>{if(!confirm('Delete this journal entry? Tasks created from it will remain.'))return;await db.entries.update(e.id,{deletedAt:Date.now(),updatedAt:Date.now()});await reload();};
 const renameTask=async(t:Task)=>{const title=editText.trim();if(title)await db.tasks.update(t.id,{title,updatedAt:Date.now()});setEditing(null);await reload();};
 const moveTask=async(id:string,delta:number)=>{const all=tasks.filter(t=>!t.done&&!t.deferredUntil||!t.done&&!!t.deferredUntil&&t.deferredUntil<=localDate());const i=all.findIndex(t=>t.id===id),j=i+delta;if(i<0||j<0||j>=all.length)return;[all[i],all[j]]=[all[j],all[i]];await db.transaction('rw',db.tasks,async()=>{for(let k=0;k<all.length;k++)await db.tasks.update(all[k].id,{sortOrder:k+1,updatedAt:Date.now()})});await reload();};

 const postpone=async(t:Task,days:number)=>{const date=new Date();date.setDate(date.getDate()+days);const until=days===0?undefined:date.getFullYear()+'-'+String(date.getMonth()+1).padStart(2,'0')+'-'+String(date.getDate()).padStart(2,'0');await db.tasks.update(t.id,{deferredUntil:until,lastReviewedAt:Date.now(),updatedAt:Date.now()});await reload();};
 const removeTask=async(t:Task)=>{if(!confirm('Delete this task?'))return;await db.tasks.update(t.id,{deletedAt:Date.now(),updatedAt:Date.now()});if(selected===t.id)setSelected(null);await reload();};
 const toggleSubtask=async(t:Task,id:string)=>{await db.tasks.update(t.id,{subtasks:(t.subtasks||[]).map(x=>x.id===id?{...x,done:!x.done}:x),updatedAt:Date.now()});await reload();};
 const addSubtask=async(t:Task)=>{const title=prompt('New step');if(!title?.trim())return;await db.tasks.update(t.id,{subtasks:[...(t.subtasks||[]),{id:uid(),title:title.trim(),done:false}],updatedAt:Date.now()});await reload();};
 const backup=async()=>{const data=await exportData(),url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=`quiet-day-${localDate()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 const restore=async(file:File)=>{if(!confirm('Import will replace all local entries and tasks. Continue?'))return;try{await importData(JSON.parse(await file.text()));await reload();setError('')}catch(e){setError(`Import failed: ${String(e)}`)}};
 const planDay=async()=>{setError('');setBusy(true);try{if(!draft.trim())throw new Error('Write about your day first.');const result=await makePlan(config.geminiKey,draft,tasks);await applyPlanResult(result);setPlan(null);}catch(e){setError(String(e))}finally{setBusy(false)}};
 const applyPlanResult=async(result:Plan)=>{const now=Date.now();const existing=(await db.tasks.toArray()).filter(t=>!t.planArchived);const titles=new Set(existing.filter(t=>!t.deletedAt&&!t.done).map(t=>t.title.trim().toLowerCase()));await db.transaction('rw',db.tasks,async()=>{for(const p of result.tasks){if(p.source==='existing'&&p.existingId){const t=existing.find(x=>x.id===p.existingId&&!x.done&&!x.deletedAt);if(t)await db.tasks.update(t.id,{firstStep:p.firstStep,minutes:p.minutes,priority:p.priority,plannedFor:localDate(),updatedAt:now,subtasks:t.subtasks?.length?t.subtasks:p.subtasks.map(title=>({id:uid(),title,done:false}))});continue;}if(titles.has(p.title.trim().toLowerCase()))continue;titles.add(p.title.trim().toLowerCase());await db.tasks.add({id:uid(),title:p.title,done:false,createdAt:now,updatedAt:now,sortOrder:now,firstStep:p.firstStep,minutes:p.minutes,priority:p.priority,plannedFor:localDate(),source:'journal',subtasks:p.subtasks.map(title=>({id:uid(),title,done:false}))});}});if(draft.trim())await db.entries.add({id:uid(),date:localDate(),text:draft.trim(),createdAt:now});setDraft('');await reload();setPage('today');};
 const sendFocus=async(text:string)=>{if(!current||!text.trim())return;const previous=conversation;const user={role:'user' as const,text:text.trim()};setConversation([...previous,user]);setFocusInput('');await db.tasks.update(current.id,{focusLog:[...previous,user].slice(-24) as Task['focusLog'],updatedAt:Date.now()});setBusy(true);setError('');try{const response=await focusReply(config.geminiKey,current.title,current.firstStep||'',(current.subtasks||[]).map(x=>({title:x.title,done:x.done})),previous,text.trim());setConversation(list=>{const updated=[...list,{role:'assistant' as const,text:response}];db.tasks.update(current.id,{focusLog:updated.slice(-24),updatedAt:Date.now()}).catch(e=>setError(String(e)));return updated})}catch(e){setError(String(e))}finally{setBusy(false)}};
 const beginTask=(id:string)=>{pauseFocus();setSelected(id);setSeconds(0);setFocusFinished(false);setFocusHelpOpen(false);setStuck(false);setHelp('');setConversation(tasks.find(t=>t.id===id)?.focusLog||[]);setCheckIn(false);setPage('focus')};
 const saveProgress=async()=>{if(!current)return;const note=prompt('Where did you leave off?',current.progressNote||'');if(note===null)return;await db.tasks.update(current.id,{progressNote:note.trim(),firstStep:note.trim()||current.firstStep,updatedAt:Date.now()});await reload();};
 const saveEvening=async()=>{if(!eveningNote.trim())return;await db.entries.add({id:uid(),date:localDate(),createdAt:Date.now(),text:'Evening note: '+eveningNote.trim()});setEveningNote('');setEvening(false);await reload();};
 const sync=async(direction:'pull'|'push')=>{setBusy(true);setError('');setMessage('');try{if(direction==='pull'){if(!confirm('Pull replaces local data. Export a backup first if you have unsynced work. Continue?'))return;await pull(config);await reload();setMessage('Data pulled from Gist.')}else{await push(config);setMessage('Data saved to Gist.')}}catch(e){setError(String(e))}finally{setBusy(false)}};

 const openReorganization=async(scope?:string)=>{
  setReorganizing(true);setError('');
  try{
   const available=tasks.filter(t=>!t.done&&!t.deletedAt&&!t.planArchived&&(!t.deferredUntil||t.deferredUntil<=localDate()));
   const list=scope?available.filter(t=>t.id===scope):available;
   if(!list.length)throw new Error('No open tasks to reorganize.');
   const result=await proposeReorganization(config.geminiKey,list.map(t=>({id:t.id,title:t.title,priority:t.priority,firstStep:t.firstStep,minutes:t.minutes,sortOrder:t.sortOrder,subtasks:t.subtasks})),scope);
   if(!result.items.length&&result.order.every((id,i)=>id===list[i].id))throw new Error('No tasks need expanding or reordering.');
   setProposal(result);setProposalScope(scope||null);setProposalOrder(result.order);
   setProposalChosen(result.items.map(x=>x.id));
  }catch(e){setError(String(e))}finally{setReorganizing(false)}
 };
 const shiftProposal=(id:string,delta:number)=>{
  setProposalOrder(order=>{const list=[...order],i=list.indexOf(id),j=i+delta;if(i<0||j<0||j>=list.length)return order;[list[i],list[j]]=[list[j],list[i]];return list});
 };

 const applyReorganization=async()=>{
  if(!proposal)return;
  const source=tasks.filter(t=>proposal.order.includes(t.id));
  const appliedAt=Date.now(),batchId=uid(),createdIds:string[]=[];
  const before:Task[]=[];
  try{
   await db.transaction('rw',db.tasks,async()=>{
    for(const id of proposal.order){
     const current=await db.tasks.get(id),snapshot=source.find(t=>t.id===id);
     if(!current||!snapshot||current.updatedAt!==snapshot.updatedAt||current.done||current.deletedAt||current.planArchived)
      throw new Error('Tasks changed during preview. Generate a new plan.');
     before.push({...current});
    }
    const created:Task[]=[];
    let position=proposalScope?(before.find(t=>t.id===proposalScope)?.sortOrder??before.find(t=>t.id===proposalScope)?.createdAt??1):1;
    for(const id of proposalOrder){
     const original=before.find(t=>t.id===id);
     if(!original)throw new Error('Invalid task order.');
     const idea=proposal.items.find(item=>item.id===id&&proposalChosen.includes(id));
     const canExpand=!!idea&&!original.planExpanded;
     if(canExpand&&idea){
      await db.tasks.update(id,{planArchived:true,planBatchId:batchId,updatedAt:appliedAt});
      for(const step of idea.steps){
       const childId=uid();createdIds.push(childId);
       created.push({id:childId,title:step.title,done:false,createdAt:appliedAt,updatedAt:appliedAt,
        plannedFor:original.plannedFor||localDate(),sortOrder:proposalScope?position+created.length/1000:position++,source:'reorganized',
        planSourceId:original.id,planBatchId:batchId,minutes:step.minutes,priority:original.priority});
      }
     }else if(!proposalScope){
      await db.tasks.update(id,{sortOrder:position++,updatedAt:appliedAt});
     }
    }
    if(created.length)await db.tasks.bulkAdd(created);
   });
   const changed=before.filter(t=>!proposalScope||proposalChosen.includes(t.id)&&proposal.items.some(x=>x.id===t.id)&&!t.planExpanded);
   setPlanUndo({before:changed,createdIds,appliedAt});
   setProposal(null);setProposalScope(null);await reload();
  }catch(e){setError(String(e))}
 };
 const undoReorganization=async()=>{
  if(!planUndo)return;
  try{
   await db.transaction('rw',db.tasks,async()=>{
    for(const original of planUndo.before){
     const current=await db.tasks.get(original.id);
     if(!current||current.updatedAt!==planUndo.appliedAt)
      throw new Error('Tasks changed since the plan was applied. The original tasks are still saved.');
    }
    for(const id of planUndo.createdIds){
     const task=await db.tasks.get(id);
     if(!task||task.updatedAt!==planUndo.appliedAt||task.done||task.deletedAt)
      throw new Error('A generated task was worked on. Undo is blocked to preserve progress.');
    }
    for(const id of planUndo.createdIds)await db.tasks.update(id,{deletedAt:Date.now(),updatedAt:Date.now()});
    for(const original of planUndo.before)await db.tasks.put({...original,updatedAt:Date.now()});
   });
   setPlanUndo(null);await reload();
  }catch(e){setError(String(e))}
 };
 const restoreSource=async(t:Task)=>{
  if(!t.planSourceId)return;
  try{
   await db.transaction('rw',db.tasks,async()=>{
    const source=await db.tasks.get(t.planSourceId!);
    if(!source?.planArchived)throw new Error('Original task is no longer archived.');
    const related=(await db.tasks.toArray()).filter(x=>x.planSourceId===source.id&&x.planBatchId===source.planBatchId&&!x.deletedAt);
    if(!related.length)throw new Error('No generated actions found.');
    if(related.some(x=>x.done||x.completedAt||x.deletedAt||x.updatedAt!==x.createdAt))
     throw new Error('These actions have been worked on. The original is preserved, but cannot be restored without losing progress.');
    for(const child of related)await db.tasks.update(child.id,{deletedAt:Date.now(),updatedAt:Date.now()});
    await db.tasks.update(source.id,{planArchived:false,planBatchId:undefined,updatedAt:Date.now()});
   });
   setPlanUndo(null);await reload();
  }catch(e){setError(String(e))}
 };
 const collapsePlan=async(t:Task)=>{
  if(!t.planExpanded||!t.planOriginal)return;
  const original=t.planOriginal;
  if(t.subtasks?.some(x=>x.done)&&!confirm('Restore the original task? Checked plan steps will be removed.'))return;
  await db.tasks.update(t.id,{subtasks:original.subtasks||[],firstStep:original.firstStep,minutes:original.minutes,planExpanded:false,planOriginal:undefined,updatedAt:Date.now()});
  setPlanUndo(null);await reload();
 };
 const visibleTasks=tasks.filter(t=>!t.done&&(!t.deferredUntil||t.deferredUntil<=localDate()));
 const deferredTasks=tasks.filter(t=>!t.done&&!!t.deferredUntil&&t.deferredUntil>localDate());
 const carriedTasks=visibleTasks.filter(t=>t.createdAt<new Date(localDate()+'T00:00:00').getTime()&&(!t.lastReviewedAt||t.lastReviewedAt<new Date(localDate()+'T00:00:00').getTime()));
 const current=tasks.find(t=>t.id===selected&&!t.done)||visibleTasks[0];
 const order:Page[]=['journal','today','focus'];
 const navigate=(target:Page)=>{if(target===page)return;const before=order.indexOf(page),after=order.indexOf(target);setNavDirection(after<before?'left':'right');setPage(target)};
 const swipeStart=(e:React.TouchEvent<HTMLElement>)=>{if(e.touches.length!==1)return;const target=e.target as HTMLElement;swipeOrigin.current={x:e.touches[0].clientX,y:e.touches[0].clientY,eligible:!target.closest('button,input,textarea,select,summary,details,label,.taskMenuPanel,.subtasks')};};
 const swipeEnd=(e:React.TouchEvent<HTMLElement>)=>{const start=swipeOrigin.current;swipeOrigin.current=null;if(!start?.eligible||e.changedTouches.length!==1||page==='settings')return;const dx=e.changedTouches[0].clientX-start.x,dy=e.changedTouches[0].clientY-start.y;if(Math.abs(dx)>76&&Math.abs(dx)>Math.abs(dy)*1.7){const next=order.indexOf(page)+(dx<0?1:-1);if(next>=0&&next<order.length)navigate(order[next])}};

 return <div className={"shell "+(page==='focus'&&active?'focusRunning':'')}><div className="stickyChrome"><header><button className="wordmark" onClick={()=>navigate('today')}>dashboard</button><div className="headerRight"><span className="date">{dateLabel()}</span><button className="iconBtn" aria-label="Toggle color mode" onClick={()=>setDark(!dark)}>{dark?<Sun size={17}/>:<Moon size={17}/>}</button><button className="iconBtn" aria-label="Settings" onClick={()=>setPage('settings')}><SettingsIcon size={18}/></button></div></header><div className="workspaceNav"><button className="navArrow" disabled={page==='journal'||page==='settings'} aria-label="Previous space" onClick={()=>navigate(order[Math.max(0,order.indexOf(page)-1)])}><ArrowLeft size={17}/></button><nav aria-label="Main navigation"><button className={page==='journal'?'active':''} onClick={()=>navigate('journal')}>Journal</button><button className={page==='today'?'active':''} onClick={()=>navigate('today')}>Today</button><button className={page==='focus'?'active':''} onClick={()=>navigate('focus')}>Focus</button></nav><button className="navArrow" disabled={page==='focus'||page==='settings'} aria-label="Next space" onClick={()=>navigate(order[Math.min(2,order.indexOf(page)+1)])}><ChevronRight size={17}/></button></div></div><main onTouchStart={swipeStart} onTouchEnd={swipeEnd}>
 {error&&<p role="alert" className="error">{error}</p>}
 {page==='journal'&&<section className={'screen journalScreen screenSlide '+navDirection} key="journal"><h1>Journal</h1><textarea aria-label="Morning journal" className="journal" placeholder="Write…" value={draft} onChange={e=>setDraft(e.target.value)}/><div className="actions"><span className="hint"></span><div className="buttonRow"><button className="secondary" onClick={saveEntry} disabled={!draft.trim()}>Save entry</button><button className="primary" onClick={planDay} disabled={!draft.trim()||busy}>{busy?'Organizing…':'Add tasks to Today'} <ChevronRight size={16}/></button></div></div>{entries.length>0&&<div className="history timelineHistory"><button className="historyToggle" aria-expanded={historyOpen} onClick={()=>setHistoryOpen(o=>!o)}><span>Past entries <span className="historyCount">{entries.length}</span></span>{historyOpen?<ChevronUp size={16}/>:<ChevronDown size={16}/>}</button>{historyOpen&&<div className="timelineEntries">{entries.map(e=><article className="timelineEntry" key={e.id}><div className="entryTop"><span className="small muted">{e.date}</span><button className="iconBtn" aria-label={'Delete journal entry from '+e.date} onClick={()=>removeEntry(e)}><Trash2 size={15}/></button></div><p>{e.text}</p></article>)}</div>}</div>}</section>}
 {page==='today'&&<section className={'screen todayScreen screenSlide '+navDirection} key="today"><div className="todayHeading"><div><h1>Today</h1><p className="muted intro">{visibleTasks.length} open{carriedTasks.length>0?' · '+carriedTasks.length+' carried over':''}</p></div><button className="roundUtility" onClick={()=>{setPage('journal');setDraft(d=>d)}}><Plus size={17}/> Journal</button></div><form className="addRow" onSubmit={async e=>{e.preventDefault();await addTask(newTask);setNewTask('')}}><input aria-label="New task" placeholder="New task…" value={newTask} onChange={e=>setNewTask(e.target.value)}/><button aria-label="Add task" type="submit" disabled={!newTask.trim()}><Plus size={18}/></button></form>{carriedTasks.length>0&&<div className="carryPanel"><button className="carryToggle" onClick={()=>setReviewOpen(!reviewOpen)}><span><CalendarClock size={17}/> {carriedTasks.length} unfinished from earlier</span>{reviewOpen?<ChevronUp size={17}/>:<ChevronDown size={17}/>}</button>{reviewOpen&&<div className="carryBody">{carriedTasks.slice(0,8).map(t=><div className="carryItem" key={t.id}><span>{t.title}</span><div><button onClick={()=>postpone(t,0)}>Keep today</button><button onClick={()=>beginTask(t.id)}>Start</button><button onClick={()=>postpone(t,1)}>Tomorrow</button><button onClick={()=>postpone(t,7)}>Later</button></div></div>)}</div>}</div>}
 <div className="taskList">{visibleTasks.length===0&&!showDone?<p className="empty">Nothing outstanding right now. Add a task or start with a journal entry.</p>:null}
 {(showDone?tasks.filter(t=>!t.deferredUntil||t.deferredUntil<=localDate()):visibleTasks).map(t=><article className={'taskBlock taskCompact '+(t.done?'taskDone':'')+(finishingIds.includes(t.id)?' isFinishing':'')+(leavingIds.includes(t.id)?' isLeaving':'')} key={t.id}>
 <div className="task">
 <button className={'check '+((t.done||finishingIds.includes(t.id))?'completed':'')} disabled={finishingIds.includes(t.id)} aria-label={(t.done?'Mark incomplete: ':'Complete: ')+t.title} onClick={()=>toggle(t)}>{(t.done||finishingIds.includes(t.id))&&<Check size={14}/>}</button>
 <div className="taskContent">
 {editing===t.id?<form onSubmit={e=>{e.preventDefault();renameTask(t)}}><input autoFocus className="editTask" value={editText} onChange={e=>setEditText(e.target.value)} onBlur={()=>renameTask(t)}/></form>:<div className={(t.done||finishingIds.includes(t.id))?'done':'taskTitle'}>{t.title}{t.priority==='high'&&!t.done&&<span className="priorityMark">Important</span>}</div>}

 {!t.done&&(!!t.subtasks?.length||!!t.firstStep)&&<div className="stepsSection"><button className="stepsButton" aria-expanded={expanded.includes(t.id)} onClick={()=>setExpanded(p=>p.includes(t.id)?p.filter(x=>x!==t.id):[...p,t.id])}>{expanded.includes(t.id)?<ChevronUp size={13}/>:<ChevronDown size={13}/>} {t.subtasks?.length?'Steps '+t.subtasks.filter(sub=>sub.done).length+'/'+t.subtasks.length:'Details'}</button></div>}
 </div>
 <div className="taskActions">
 {!t.done&&<button className="startTask focusButton" onClick={()=>beginTask(t.id)} title="Start focus" aria-label={'Focus on '+t.title}><Play size={16}/></button>}
 <details className="taskMenu"><summary title={'More actions for '+t.title} aria-label={'More actions for '+t.title}><MoreHorizontal size={19}/></summary><div className="taskMenuPanel">
 {!t.done&&<><button onClick={()=>{setEditing(t.id);setEditText(t.title)}}><Pencil size={15}/> Edit</button><button onClick={()=>moveTask(t.id,-1)}><ArrowUp size={15}/> Move up</button><button onClick={()=>moveTask(t.id,1)}><ArrowDown size={15}/> Move down</button><button onClick={()=>postpone(t,1)}><CalendarClock size={15}/> Tomorrow</button><button onClick={()=>postpone(t,7)}><Clock3 size={15}/> Later</button></>}
 {!t.done&&<button onClick={()=>openReorganization(t.id)}><RefreshCcw size={15}/> Expand task</button>}
 {t.planExpanded&&<button onClick={()=>collapsePlan(t)}><ChevronUp size={15}/> Collapse plan</button>}
 {t.planSourceId&&<button onClick={()=>restoreSource(t)}><ArrowLeft size={15}/> Restore original</button>}
 <button className="destructive" onClick={()=>removeTask(t)}><Trash2 size={15}/> Delete</button>
 </div></details>
 </div>
 </div>
 {!t.done&&expanded.includes(t.id)&&(!!t.firstStep||!!t.subtasks?.length)&&<div className="subtasks compactSubtasks">{t.firstStep&&<p className="taskDetailFirst">{t.firstStep}</p>}{(t.subtasks||[]).map(sub=><label className="subtask" key={sub.id}><input type="checkbox" checked={sub.done} onChange={()=>toggleSubtask(t,sub.id)}/><span className={sub.done?'done':''}>{sub.title}</span></label>)}<button className="addStep" onClick={()=>addSubtask(t)}>+ Add step</button></div>}
 </article>)}</div>
 {deferredTasks.length>0&&<div className="laterWrap"><button className="stepsButton" onClick={()=>setShowLater(!showLater)}>{showLater?<ChevronUp size={15}/>:<ChevronDown size={15}/>} Later · {deferredTasks.length}</button>{showLater&&deferredTasks.map(t=><div className="carryItem" key={t.id}><span>{t.title}<small> · {t.deferredUntil}</small></span><button onClick={()=>postpone(t,0)}>Bring back</button></div>)}</div>}
 <div className="utilityBar"><button onClick={()=>setEvening(!evening)}><Clock3 size={15}/> Evening review</button><button onClick={()=>setShowDone(!showDone)}><Check size={15}/>{showDone?'Hide completed':'Completed'}</button><button onClick={()=>{setPage('journal');setDraft(d=>d)}}><RefreshCcw size={15}/> Replan</button><button disabled={reorganizing||!visibleTasks.length} onClick={()=>openReorganization()}><RefreshCcw size={15}/>{reorganizing?'Organizing…':'Expand & Reorganize'}</button>{planUndo?.before.length?<button onClick={undoReorganization}><ArrowLeft size={15}/> Undo plan</button>:null}</div>{proposal&&<div className="proposalPanel" role="region" aria-label="Review proposed task plan"><div className="proposalHeading"><div><h2>Today after applying</h2><p className="small muted">Selected steps become independent tasks. Original tasks are saved.</p></div><button className="iconBtn" onClick={()=>setProposal(null)} aria-label="Close plan"><Check size={16}/></button></div>
 <label className="proposalEstimate"><input type="checkbox" checked={showEstimates} onChange={e=>setShowEstimates(e.target.checked)}/> Show time estimates</label>
 <div className="proposalRows">{proposalOrder.flatMap(id=>{const source=tasks.find(t=>t.id===id);if(!source)return [];const idea=proposal.items.find(x=>x.id===id);const selected=!!idea&&proposalChosen.includes(id);return [{id,source,idea,selected}]}).map(({id,source,idea,selected},i)=><div className="proposalRow" key={id}><div className="proposalRowHeader"><div className="proposalRowText"><strong>{selected?source.title:source.title}</strong>{idea&&<span className="proposalContext">{selected?'Replace with the actions below':'Keep original'}</span>}</div>{!proposalScope&&<div className="proposalMove"><button disabled={i===0} aria-label={'Move '+source.title+' up'} onClick={()=>shiftProposal(id,-1)}><ChevronUp size={15}/></button><button disabled={i===proposalOrder.length-1} aria-label={'Move '+source.title+' down'} onClick={()=>shiftProposal(id,1)}><ChevronDown size={15}/></button></div>}</div>{idea&&<label className="proposalReplace"><input type="checkbox" checked={selected} onChange={e=>setProposalChosen(old=>e.target.checked?[...old,id]:old.filter(x=>x!==id))}/> Replace with actions</label>}{selected&&idea&&<div className="proposalFlatSteps">{idea.steps.map((step,j)=><div className="proposalFlatRow" key={j}><span className="proposalFlatCircle"/><span>{step.title}</span>{showEstimates&&<small>{step.minutes}m</small>}</div>)}</div>}</div>)}</div>
 <div className="proposalActions"><button className="secondary" onClick={()=>setProposal(null)}>Cancel</button><button className="primary" onClick={applyReorganization}>Apply plan</button></div></div>}{evening&&<div className="eveningPanel"><h2>Evening</h2><p>{tasks.filter(t=>t.done).length} completed · {visibleTasks.length} open</p><textarea rows={3} value={eveningNote} onChange={e=>setEveningNote(e.target.value)} placeholder="Anything worth remembering for tomorrow?"/><button className="primary" onClick={saveEvening} disabled={!eveningNote.trim()}>Save note</button></div>}</section>}
 {page==='focus'&&<section className={'screen focus focusImmersive screenSlide '+navDirection} key="focus">{current?<><div className="focusHeading"><p className="eyebrow">Focus</p><h1>{current.title}</h1>{current.progressNote&&<p className="muted intro">Last: {current.progressNote}</p>}</div>
 <div className="focusDialArea"><div className="focusDial" role="img" aria-label={Math.ceil(remainingFocus/60)+' minutes remaining in '+sessionMinutes+' minute session'}>
 <svg className="focusDialSvg" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="42" className="dialFace"/>
 {dialTicks.map(i=><line key={i} x1="50" y1={i%5===0?"4":"6.2"} x2="50" y2={i%5===0?"9":"8"} className={i%5===0?'dialTick dialTickMajor':'dialTick'} transform={'rotate('+i*6+' 50 50)'}/>)}
 <circle cx="50" cy="50" r={focusR} className="dialElapsed"/>
 <circle cx="50" cy="50" r={focusR} className="dialRemaining" style={{strokeDasharray:focusCirc,strokeDashoffset:focusCirc*(1-focusFraction)}} transform="rotate(-90 50 50)"/>
 {Array.from({length:12},(_,i)=><text key={i} x="50" y="16" textAnchor="middle" className="dialNumber" transform={'rotate('+i*30+' 50 50)'}><tspan transform={'rotate('+(-i*30)+' 50 15)'}>{i===0?'0':i*5}</tspan></text>)}
 </svg>
 <div className="focusDialCenter"><span>{focusFinished?'Finished':active?'Focusing':seconds>0?'Paused':'Ready'}</span></div>
 </div>
 <div className="focusDuration" aria-label="Focus session length">
 {(!active&&seconds===0)?<div className="focusLengths">{[10,20,30,60].map(m=><button key={m} className={sessionMinutes===m?'chosen':''} onClick={()=>{setSessionMinutes(m);setFocusFinished(false)}}>{m}m</button>)}</div>:<span>{focusFinished?'Session complete':sessionMinutes+' min session'}</span>}
 </div></div>
 <div className="focusPrimaryActions">
 {active?<button className="primary" onClick={pauseFocus}><Pause size={17}/> Pause</button>:<button className="primary" onClick={startFocus}><Play size={17}/>{focusFinished?'Keep going':seconds>0?'Resume':'Start'}</button>}
 <button className="secondary stopFocus" onClick={stopFocus}><RotateCcw size={16}/> Stop</button>
 <button className="secondary" onClick={()=>setCheckIn(v=>!v)}><Check size={16}/> Check in</button>
 </div>
 {checkIn&&<div className="checkIn focusReflection"><h2>Check in</h2><div className="buttonRow"><button className="secondary" onClick={()=>{setCheckIn(false)}}>Continue</button><button className="secondary" onClick={()=>{setCheckIn(false);setFocusHelpOpen(true);setStuck(true)}}>I'm stuck</button><button className="secondary" onClick={()=>{setCheckIn(false);setFocusHelpOpen(true);sendFocus('I got distracted. Help me return to my task.')}}>Got distracted</button><button className="secondary" onClick={()=>{pauseFocus();setCheckIn(false)}}>Pause for now</button></div></div>}
 <div className="focusMore"><button onClick={saveProgress}>Save where I left off</button><button onClick={()=>setFocusHelpOpen(v=>!v)} aria-expanded={focusHelpOpen}>{focusHelpOpen?'Hide assistant':'Ask about this task'} <ChevronDown size={14}/></button></div>
 {focusHelpOpen&&<div className="focusAssistance">
 {stuck&&<div className="stuck"><select aria-label="What's getting in the way?" value={barrier} onChange={e=>setBarrier(e.target.value)}><option>I cannot get started</option><option>I don't know the first step</option><option>I'm overwhelmed</option><option>I'm avoiding this</option><option>I got distracted</option></select><button className="secondary" disabled={busy} onClick={()=>sendFocus(barrier)}>Help me start</button></div>}
 <div className="focusChat">{conversation.map((c,i)=><p className={c.role==='user'?'focusUser':'focusAssistant'} key={i}>{c.text}</p>)}<form className="focusForm" onSubmit={e=>{e.preventDefault();sendFocus(focusInput)}}><input aria-label="Message your task assistant" value={focusInput} onChange={e=>setFocusInput(e.target.value)} placeholder="Ask about this task…" /><button className="secondary" type="submit" disabled={!focusInput.trim()||busy} aria-label="Send"><Send size={17}/></button></form></div></div>}
 <div className="focusDone"><button onClick={async()=>{pauseFocus();if(!current.done)await toggle(current);setSelected(null);setSeconds(0);setFocusFinished(false);setConversation([]);setPage('today')}}><Check size={16}/> Mark task complete</button></div></>:<><h1>No task selected</h1><button className="primary" onClick={()=>setPage('today')}>Go to Today <ChevronRight size={16}/></button></>}</section>}
 {page==='settings'&&<section className="screen settingsScreen"><p className="eyebrow">Settings</p><h1>Connections</h1><p className="muted intro">Credentials are saved only in this browser, not in your Gist.</p><div className="settingsFields"><label>Gemini API key<input type="password" autoComplete="off" value={config.geminiKey} onChange={e=>setConfig({...config,geminiKey:e.target.value})}/></label><p className="small muted">Model: {MODEL}. Browser API requests can expose this key to scripts running on this website. A server proxy is safer.</p><label>GitHub Gist ID<input value={config.gistId} onChange={e=>setConfig({...config,gistId:e.target.value})}/></label><label>GitHub token<input type="password" autoComplete="off" value={config.githubToken} onChange={e=>setConfig({...config,githubToken:e.target.value})}/></label><p className="small muted">Use a token restricted to Gists. Gist data is unencrypted and a secret Gist is unlisted, not private. Avoid highly sensitive journal details.</p><button className="primary" onClick={()=>{saveSettings(config);setMessage('Settings saved locally.');if(syncEnabled)autoSync()}}>Save settings</button><label className="autoSyncOption"><input type="checkbox" checked={syncEnabled} onChange={e=>{setSyncEnabled(e.target.checked);localStorage.setItem('quiet-day-auto-sync',e.target.checked?'on':'off')}}/> Automatically synchronize changes when online</label><p className="small muted" role="status">{syncState||'Local data is always saved first. Cloud synchronization merges records by latest edit.'}</p><div className="syncActions"><button className="secondary" disabled={busy} onClick={()=>sync('pull')}>Pull from Gist</button><button className="secondary" disabled={busy} onClick={()=>sync('push')}>Push to Gist</button></div><p className="small muted">Manual pull replaces local data. Export a backup first if you have unsynced changes.</p>{message&&<p role="status" className="small">{message}</p>}<div className="backupSettings"><h2>Backups</h2><div className="buttonRow"><button className="secondary" onClick={backup}><Download size={15}/> Export JSON</button><label className="secondary importSettings"><Upload size={15}/> Import JSON<input type="file" accept="application/json,.json" onChange={async e=>{const f=e.target.files?.[0];if(f)await restore(f);e.target.value=''}}/></label></div></div></div></section>}
 </main></div>}
const installedPwa = window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & {standalone?:boolean}).standalone===true;
if(installedPwa){
 document.documentElement.classList.add('quiet-day-standalone');
 document.querySelector('meta[name="viewport"]')?.setAttribute('content','width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover');
 document.addEventListener('gesturestart',e=>e.preventDefault(),{passive:false});
 document.addEventListener('gesturechange',e=>e.preventDefault(),{passive:false});
 document.addEventListener('touchmove',e=>{if(e.touches.length>1)e.preventDefault()},{passive:false});
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
if('serviceWorker' in navigator){window.addEventListener('load',()=>{navigator.serviceWorker.register('./sw.js').catch(()=>{})})}

