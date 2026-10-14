export const MODEL = 'gemini-3.8-flash';
export type PlannedTask = {title:string;firstStep:string;minutes:number;priority:'high'|'normal'|'low';source:'new'|'existing';existingId?:string};
export type Plan = {summary:string;tasks:PlannedTask[];note:string};
export async function generate(key:string,system:string,input:unknown):Promise<string>{
 if(!key.trim())throw new Error('Add your Gemini API key in Settings.');
 const r=await fetch('https://generativelanguage.googleapis.com/v1beta/models/'+MODEL+':generateContent',{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key.trim()},body:JSON.stringify({systemInstruction:{parts:[{text:system}]},contents:[{role:'user',parts:[{text:JSON.stringify(input)}]}]})});
 const d=await r.json();if(!r.ok)throw new Error(d.error?.message||'Gemini request failed. Verify your model access in Settings.');
 const answer=(d.candidates?.[0]?.content?.parts||[]).map((p:{text?:string})=>p.text||'').join('').trim();
 if(!answer)throw new Error('No response from Gemini');return answer;
}
export async function makePlan(key:string,journal:string,existing:{id:string;title:string;done:boolean}[]):Promise<Plan>{
 const prompt='You are a private executive-function planning tool, not a coach or therapist. Read the free-form journal and capture ALL actionable to-dos, including small errands, followups and work tasks. Do NOT limit the total to three. Mark just the most important tasks high priority. Keep tasks specific, actionable, and include a tiny, physical firstStep and estimated minutes. Never turn a feeling or worry into a new obligation. Avoid inventing commitments or deadlines. The existing unfinished tasks already persist in Today; DO NOT output them again unless the journal explicitly requests updating one. If updating, use source existing and exact existingId. New items use source new. Return ONLY JSON: {"summary":"brief","tasks":[{"title":"short","firstStep":"specific next action","minutes":15,"priority":"normal","source":"new"}],"note":"brief"}. Be concise and practical.';
 const raw=await generate(key,prompt,{journal,unfinishedTasks:existing.filter(t=>!t.done).slice(0,150)});
 let x:any;try{x=JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g,''))}catch{throw new Error('AI returned an invalid task list; try generating again.')}
 if(typeof x.summary!=='string'||!Array.isArray(x.tasks)||typeof x.note!=='string')throw new Error('Invalid AI task list format');
 const ids=new Set(existing.filter(t=>!t.done).map(t=>t.id));
 return {summary:x.summary.slice(0,1000),note:x.note.slice(0,1000),tasks:x.tasks.slice(0,150).filter((t:any)=>typeof t.title==='string'&&typeof t.firstStep==='string').map((t:any)=>({title:t.title.slice(0,200),firstStep:t.firstStep.slice(0,350),minutes:Math.max(2,Math.min(240,Number(t.minutes)||15)),priority:['high','normal','low'].includes(t.priority)?t.priority:'normal',source:t.source==='existing'&&ids.has(t.existingId)?'existing':'new',existingId:t.existingId}))};
}
export async function helpBegin(key:string,task:string,barrier:string){return generate(key,'You are a concise task-start assistant. Offer ONE practical physical first action for the task and the stated barrier in at most 65 words. No therapy language, compliments, generic encouragement, or slogans.',{task,barrier});}
