export const MODEL = 'gemini-3.8-flash';
export type PlannedTask = {title:string;firstStep:string;minutes:number;priority:'high'|'normal'|'low';source:'new'|'existing';existingId?:string;subtasks:string[]};
export type Plan = {summary:string;tasks:PlannedTask[];note:string};
export async function generate(key:string,system:string,input:unknown):Promise<string>{
 if(!key.trim())throw new Error('Add your Gemini API key in Settings.');
 const r=await fetch('https://generativelanguage.googleapis.com/v1beta/models/'+MODEL+':generateContent',{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key.trim()},body:JSON.stringify({systemInstruction:{parts:[{text:system}]},contents:[{role:'user',parts:[{text:JSON.stringify(input)}]}]})});
 const d=await r.json();if(!r.ok)throw new Error(d.error?.message||'Gemini request failed. Verify your model access in Settings.');
 const answer=(d.candidates?.[0]?.content?.parts||[]).map((p:{text?:string})=>p.text||'').join('').trim();
 if(!answer)throw new Error('No response from Gemini');return answer;
}
export async function makePlan(key:string,journal:string,existing:{id:string;title:string;done:boolean;deferredUntil?:string;lastReviewedAt?:number;firstStep?:string}[]):Promise<Plan>{
 const prompt='You are a private executive-function planning tool, not a coach or therapist. Read the free-form journal and capture ALL actionable to-dos, including small errands, followups and work tasks. Do NOT limit the total to three. Mark just the most important tasks high priority. Keep tasks specific, actionable, and include a tiny, physical firstStep and estimated minutes. Never turn a feeling or worry into a new obligation. Avoid inventing commitments or deadlines. The existing unfinished tasks already persist in Today; DO NOT output them again unless the journal explicitly requests updating one. If updating, use source existing and exact existingId. Only create subtasks for genuinely multi-session or broad projects (for example a thesis statement, preparing a presentation, or cleaning a whole apartment). For appointments, pickups, messages, errands, short emails, and single-step admin, ALWAYS return an empty subtasks array. For complex projects use 2-5 checkable actions, not advice. Subtasks must be short and can stay hidden until expanded. New items use source new. Return ONLY JSON: {"summary":"brief","tasks":[{"title":"short","firstStep":"specific next action","minutes":15,"priority":"normal","source":"new","subtasks":[]}],"note":"brief"}. Be concise and practical.';
 const raw=await generate(key,prompt,{journal,unfinishedTasks:existing.filter(t=>!t.done).slice(0,150)});
 let x:any;try{x=JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g,''))}catch{throw new Error('AI returned an invalid task list; try generating again.')}
 if(typeof x.summary!=='string'||!Array.isArray(x.tasks)||typeof x.note!=='string')throw new Error('Invalid AI task list format');
 const ids=new Set(existing.filter(t=>!t.done).map(t=>t.id));
 return {summary:x.summary.slice(0,1000),note:x.note.slice(0,1000),tasks:x.tasks.slice(0,150).filter((t:any)=>typeof t.title==='string'&&typeof t.firstStep==='string').map((t:any)=>({title:t.title.slice(0,200),firstStep:t.firstStep.slice(0,350),minutes:Math.max(2,Math.min(240,Number(t.minutes)||15)),priority:['high','normal','low'].includes(t.priority)?t.priority:'normal',source:t.source==='existing'&&ids.has(t.existingId)?'existing':'new',existingId:t.existingId,subtasks:Array.isArray(t.subtasks)?t.subtasks.filter((v:unknown)=>typeof v==='string').slice(0,6).map((v:string)=>v.slice(0,180)):[]}))};
}
export async function helpBegin(key:string,task:string,barrier:string){return generate(key,'You are a concise task-start assistant. Offer ONE practical physical first action for the task and the stated barrier in at most 65 words. No therapy language, compliments, generic encouragement, or slogans.',{task,barrier});}

export async function focusReply(key:string,task:string,firstStep:string,subtasks:{title:string;done:boolean}[],conversation:{role:string;text:string}[],userText:string){return generate(key,'You are an action-oriented task partner. Follow the user\'s task progress and previous chat. Ask at most one focused question or propose one specific physical next action. No generic praise, therapy language or verbosity; at most 75 words. For being stuck, identify the barrier and reduce it to something doable in two minutes. Never claim that you can monitor work when this page is closed.',{task,firstStep,subtasks,conversation:conversation.slice(-10),userText});}

/** Review-only plan. This function never edits tasks. */
export type ReorganizationStep={title:string;minutes:number};
export type ReorganizationItem={id:string;steps:ReorganizationStep[]};
export type ReorganizationProposal={order:string[];items:ReorganizationItem[]};
export async function proposeReorganization(key:string,tasks:{id:string;title:string;priority?:string;firstStep?:string;minutes?:number;subtasks?:{title:string;done:boolean;minutes?:number}[];sortOrder?:number}[],scope?:string):Promise<ReorganizationProposal>{
 const input=scope?tasks.filter(t=>t.id===scope):tasks;
 if(!input.length)throw new Error('No tasks to reorganize.');
 const prompt='You help one person convert intimidating tasks into doable actions. Return JSON ONLY of shape {"order":["exact task id"],"items":[{"id":"exact task id","steps":[{"title":"small observable action","minutes":5}]}]}. order MUST contain every provided task id once, in a helpful execution order based on real dependencies, stated priorities, and effort. For a single task keep the supplied order. items ONLY for genuinely vague, broad or difficult tasks that benefit from decomposition; leave actionable errands and emails unchanged. Break complex tasks into 2-5 meaningful steps; no filler such as decide to start, make a list, prepare mentally, or work on it. A first step may be opening the relevant document, but it must lead to actual progress. Each step is an approachable session, not a promise to complete the whole project. No invented dates, obligations, or details. If a task already has subtasks, do NOT rewrite its subtasks; existing incomplete subtasks will automatically be offered as flat tasks, preserving completed progress. Do not split everything. Duration estimates are optional user-facing guidance and are NOT deadlines. No therapy language. JSON only.';
 const raw=await generate(key,prompt,{tasks:input});
 let x:any;try{x=JSON.parse(raw.replace(/^\x60\x60\x60(?:json)?\s*|\s*\x60\x60\x60$/g,''))}catch{throw new Error('AI returned an invalid plan. Try again.')}
 const ids=new Set(input.map(t=>t.id));
 if(!Array.isArray(x.order)||!Array.isArray(x.items))throw new Error('Invalid plan format.');
 const order=x.order.filter((v:unknown)=>typeof v==='string'&&ids.has(v));
 if(order.length!==ids.size||new Set(order).size!==ids.size)throw new Error('AI did not return a complete task order. Try again.');
 const used=new Set<string>();
 const items:ReorganizationItem[]=x.items.filter((v:any)=>v&&typeof v.id==='string'&&ids.has(v.id)&&Array.isArray(v.steps)).flatMap((v:any)=>{
  if(used.has(v.id))return [];
  used.add(v.id);
  const original=input.find(t=>t.id===v.id);
  if(original?.subtasks?.length)return [];
  const steps:ReorganizationStep[]=v.steps.slice(0,5).filter((st:any)=>st&&typeof st.title==='string'&&st.title.trim()).map((st:any)=>({title:st.title.trim().slice(0,160),minutes:Math.min(90,Math.max(2,Math.round(Number(st.minutes)||10)))}));
  return steps.length>=2?[{id:v.id,steps}]:[];
 });
 // Existing unfinished subtasks are the most reliable proposed steps.
 // Never ask the model to overwrite progress that has already been recorded.
 for(const task of input){
  if(!task.subtasks?.length)continue;
  const unfinished=task.subtasks.filter(st=>!st.done&&st.title.trim()).map(st=>({
   title:st.title.trim().slice(0,160),
   minutes:Math.min(90,Math.max(2,Math.round(Number(st.minutes)||Number(task.minutes)||10)))
  }));
  if(unfinished.length)items.push({id:task.id,steps:unfinished});
 }
 return {order,items};
}
