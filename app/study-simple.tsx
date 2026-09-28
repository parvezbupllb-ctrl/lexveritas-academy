"use client";

import {useCallback,useEffect,useRef,useState} from "react";
import {CalendarDays,Check,Download,Home,LogOut,Plus,Trash2,TrendingUp} from "lucide-react";
import {api,Confirm,Field,Loading} from "@/lib/client";
import {addDays,todayBD} from "@/lib/study-engine";
import {studyPdf} from "@/lib/study-pdf";
import {Auth} from "./study-entry";

type Row={key:string;id?:string;date:string;subject:string;topic:string;done:boolean;carryCount?:number;originalDate?:string;dirty?:boolean};
const fresh=(date:string):Row=>({key:crypto.randomUUID(),date,subject:"",topic:"",done:false,dirty:true});
const toRows=(tasks:any[]):Row[]=>(tasks||[]).filter(t=>t.status!=="deleted").map(t=>({key:t.id,id:t.id,date:t.due_date,subject:t.subject_snapshot,topic:t.title_snapshot,done:t.status==="completed",carryCount:t.carry_count||0,originalDate:t.original_date,dirty:false}));
const storeKey=(user:string,plan:string)=>`lva-study-draft-${user}-${plan}`;
const dayLabel=(date:string)=>new Intl.DateTimeFormat("en-BD",{weekday:"long",day:"numeric",month:"short",year:"numeric",timeZone:"UTC"}).format(new Date(`${date}T12:00:00Z`));

export function StudyRoutineApp({examHint=""}:{examHint?:string}){
  const [user,setUser]=useState<any>(null),[loading,setLoading]=useState(true),[plans,setPlans]=useState<any[]>([]),[plan,setPlan]=useState<any>(null),[selected,setSelected]=useState(""),[screen,setScreen]=useState<"home"|"create"|"detail">("home"),[tab,setTab]=useState<"routine"|"performance">("routine");
  const [exam,setExam]=useState<"bar"|"bjs">(examHint==="bjs"?"bjs":"bar"),[title,setTitle]=useState(""),[start,setStart]=useState(todayBD()),[days,setDays]=useState(30),[rows,setRows]=useState<Row[]>([]),[error,setError]=useState(""),[busy,setBusy]=useState(false),[sync,setSync]=useState("Saved"),[deleteId,setDeleteId]=useState("");
  const timers=useRef<Record<string,ReturnType<typeof setTimeout>>>({}),rowsRef=useRef<Row[]>([]),dirty=useRef<Set<string>>(new Set()),working=useRef<Partial<Record<string,Promise<void>>>>({}),planRef=useRef<any>(null);
  const refresh=useCallback(async()=>{const items=await api("study/plans");setPlans(items);return items},[]);

  useEffect(()=>{api("study/me").then(async person=>{setUser(person);const items=await refresh();setScreen(items.length?"home":"create")}).catch(issue=>{if(issue.status!==401)setError(issue.message)}).finally(()=>setLoading(false))},[refresh]);
  useEffect(()=>{
    Object.values(timers.current).forEach(clearTimeout);timers.current={};dirty.current.clear();planRef.current=null;
    if(!selected||!user){setPlan(null);return}
    let cancelled=false;setPlan(null);setSync("Saved");
    api(`study/plans/${selected}`).then(data=>{
      if(cancelled)return;
      planRef.current=data;setPlan(data);
      const server=toRows(data.tasks),byId=new Map(server.map(row=>[row.id,row]));let local:Row[]=[];
      try{const cache=JSON.parse(localStorage.getItem(storeKey(user.id,selected))||"[]");if(Array.isArray(cache))local=cache.filter(row=>row&&typeof row.key==="string")}
      catch{}
      const localRows=local.filter(row=>!row.id||byId.has(row.id));
      const combined=localRows.map(row=>{
        const saved=row.id?byId.get(row.id):null;
        if(!saved||!row.dirty)return saved||row;
        return saved.carryCount!==(row.carryCount||0)?{...row,date:saved.date,carryCount:saved.carryCount,originalDate:saved.originalDate}:row;
      });
      const present=new Set(combined.map(row=>row.id).filter(Boolean));
      const next=[...combined,...server.filter(row=>!present.has(row.id))];
      rowsRef.current=next;setRows(next);
      for(const row of next)if(row.dirty&&row.id&&row.subject.trim()&&row.topic.trim()){dirty.current.add(row.key);queue(row.key)}
    }).catch(issue=>{if(!cancelled)setError(issue.message)});
    return()=>{cancelled=true;Object.values(timers.current).forEach(clearTimeout)};
  },[selected,user]);
  useEffect(()=>{if(plan&&user)localStorage.setItem(storeKey(user.id,plan.id),JSON.stringify(rows))},[rows,plan?.id,user?.id]);

  const persist=async(key:string):Promise<void>=>{
    if(working.current[key]){await working.current[key];if(dirty.current.has(key))return persist(key);return}
    const row=rowsRef.current.find(item=>item.key===key),planId=planRef.current?.id;
    if(!planId||!row||!dirty.current.has(key)||!row.subject.trim()||!row.topic.trim())return;
    const snapshot={subject:row.subject.trim(),topic:row.topic.trim(),date:row.date,done:row.done,id:row.id};
    const work=(async()=>{
      try{
        setSync("Saving…");const endpoint=`study/plans/${planId}/tasks`;
        const result=await api(snapshot.id?`${endpoint}/${snapshot.id}`:endpoint,snapshot.id?{subject:snapshot.subject,title:snapshot.topic,date:snapshot.date,status:snapshot.done?"completed":"pending"}:{subject:snapshot.subject,title:snapshot.topic,date:snapshot.date},snapshot.id?"PATCH":"POST");
        if(!snapshot.id&&snapshot.done)await api(`${endpoint}/${result.id}`,{status:"completed"},"PATCH");
        if(planRef.current?.id===planId){
          const index=rowsRef.current.findIndex(item=>item.key===key);
          if(index>=0){const current=rowsRef.current[index],unchanged=current.subject.trim()===snapshot.subject&&current.topic.trim()===snapshot.topic&&current.date===snapshot.date&&current.done===snapshot.done;
            rowsRef.current=rowsRef.current.map(item=>item.key===key?{...item,id:snapshot.id||result.id,dirty:!unchanged}:item);setRows([...rowsRef.current]);
            if(unchanged)dirty.current.delete(key);
          }
        }
        setSync("Saved");
      }catch(issue:any){setSync("Could not save");setError(issue.message);throw issue}
      finally{delete working.current[key]}
    })();
    working.current[key]=work;await work;
  };
  const queue=(key:string)=>{clearTimeout(timers.current[key]);timers.current[key]=setTimeout(()=>{void persist(key).catch(()=>{})},650)};
  const change=(key:string,part:Partial<Row>)=>{rowsRef.current=rowsRef.current.map(row=>row.key===key?{...row,...part,dirty:true}:row);setRows([...rowsRef.current]);dirty.current.add(key);setSync("Saving…");queue(key)};
  const remove=async(row:Row)=>{clearTimeout(timers.current[row.key]);if(working.current[row.key])await working.current[row.key];dirty.current.delete(row.key);rowsRef.current=rowsRef.current.filter(item=>item.key!==row.key);setRows([...rowsRef.current]);if(row.id)try{await api(`study/plans/${planRef.current.id}/tasks/${row.id}`,{},"DELETE")}catch(issue:any){setError(issue.message)}};
  const flush=async(strict=false)=>{
    Object.values(timers.current).forEach(clearTimeout);
    await Promise.all(Object.values(working.current).filter(Boolean) as Promise<void>[]);
    if(strict&&rowsRef.current.some(row=>!!row.subject.trim()!==!!row.topic.trim()))throw Error("প্রতিটি টার্গেটে বিষয় ও টপিক দুটোই লিখুন, অথবা খালি সারি মুছে দিন।");
    for(const key of [...dirty.current])await persist(key);
    if(strict&&!rowsRef.current.some(row=>row.id))throw Error("রুটিন সেভ করার আগে অন্তত একটি বিষয় ও টপিক যোগ করুন।");
    const latest=await api(`study/plans/${planRef.current.id}`);planRef.current=latest;setPlan(latest);return latest;
  };
  const open=async(id:string)=>{setError("");setSelected(id);setTab("routine");setScreen("detail")};
  const home=async()=>{if(planRef.current){try{await flush()}catch(issue:any){setError(issue.message)}}await refresh();setScreen("home");setSelected("");setPlan(null)};
  const create=async()=>{
    setError("");if(!title.trim()){setError("রুটিনের নাম লিখুন।");return}if(!Number.isInteger(days)||days<1||days>365){setError("১ থেকে ৩৬৫ দিনের মধ্যে বেছে নিন।");return}if(start<todayBD()){setError("আজ বা ভবিষ্যতের শুরুর তারিখ দিন।");return}
    setBusy(true);try{const response=await api("study/plans",{curriculum:exam,title:title.trim(),startDate:start,endDate:addDays(start,days-1),studyDays:[0,1,2,3,4,5,6],offDates:[],mode:"custom",carryMode:"auto",tasks:[],selections:[]});await refresh();await open(response.id)}catch(issue:any){setError(issue.message)}finally{setBusy(false)}
  };
  const save=async()=>{setBusy(true);setError("");try{const current=await flush(true);await api(`study/plans/${current.id}`,{status:"active"},"PATCH");await refresh();await home()}catch(issue:any){setError(issue.message)}finally{setBusy(false)}};
  const download=async()=>{setBusy(true);setError("");try{const current=await flush(true),settings=await api("study/pdf-settings");if(!settings.enabled)throw Error("PDF download is unavailable.");await studyPdf(current,user,"current",settings)}catch(issue:any){setError(issue.message)}finally{setBusy(false)}};
  const deletePlan=async()=>{const id=deleteId;setDeleteId("");setBusy(true);try{if(selected===id&&planRef.current)await Promise.all(Object.values(working.current).filter(Boolean) as Promise<void>[]);await api(`study/plans/${id}`,{},"DELETE");if(user)localStorage.removeItem(storeKey(user.id,id));if(selected===id){setSelected("");setPlan(null)}const items=await refresh();setScreen(items.length?"home":"create")}catch(issue:any){setError(issue.message)}finally{setBusy(false)}};

  if(loading)return <div className="container section"><Loading/></div>;
  if(!user)return <><Auth onDone={()=>{setLoading(true);api("study/me").then(async person=>{setUser(person);const items=await refresh();setScreen(items.length?"home":"create")}).catch(issue=>setError(issue.message)).finally(()=>setLoading(false))}}/>{error&&<p className="study-error container">{error}</p>}</>;
  const last=plan?[plan.end_date,...rows.map(row=>row.date)].sort().at(-1)!:"";
  const dayList=plan?Array.from({length:Math.min(731,Math.round((Date.parse(last)-Date.parse(plan.start_date))/86400000)+1)},(_,i)=>addDays(plan.start_date,i)):[];
  const total=rows.filter(row=>row.id).length,completed=rows.filter(row=>row.id&&row.done).length;
  const progress=total?Math.round(completed/total*100):0;
  const today=todayBD(),pendingToday=rows.filter(row=>row.id&&!row.done&&row.date===today).length,carried=rows.filter(row=>row.id&&!row.done&&!!row.carryCount).length;
  return <div className="container study-simple">
    <header className="study-simple-head"><div><span className="eyebrow">LEXVERITAS ACADEMY</span><h1>{screen==="home"?"My Study Routines":screen==="create"?"Create a Study Routine":plan?.title||"My Study Routine"}</h1><p>Welcome, {user.name}</p></div><div className="study-simple-buttons">{screen!=="home"&&<button className="btn outline" onClick={()=>void home()}><Home size={16}/> My Routines</button>}<button className="btn outline" onClick={async()=>{await api("study/logout",{});setUser(null);setPlan(null);setSelected("")}}><LogOut size={16}/> Logout</button></div></header>
    {error&&<p role="alert" className="study-error">{error}</p>}
    {screen==="home"&&<section className="study-library"><div className="section-head"><div><span className="eyebrow">YOUR PREPARATION</span><h2>Saved routines</h2><p>Open a routine to continue studying or review your progress.</p></div><button className="btn" onClick={()=>{setTitle("");setStart(todayBD());setScreen("create")}}><Plus size={16}/> New Routine</button></div><div className="study-library-grid">{plans.map(item=><article className="card study-library-card" key={item.id}><div className="study-library-card-head"><span className="study-badge">{item.curriculum.toUpperCase()}</span><span className="badge">{item.status==="draft"?"Draft":item.status==="active"?"Active":item.status}</span></div><h3>{item.title}</h3><p><CalendarDays size={15}/> {item.startDate} – {item.endDate}</p><div className="study-library-progress"><div><b>{item.progress?.percent||0}% complete</b><span>{item.progress?.completed||0} of {item.progress?.total||0} targets</span></div><div className="study-progress-track"><span style={{width:`${item.progress?.percent||0}%`}}/></div></div><div className="study-library-actions"><button className="btn secondary" onClick={()=>void open(item.id)}>{item.status==="draft"?"Continue editing":"Open routine"}</button><button className="study-simple-delete" aria-label={`Delete ${item.title}`} onClick={()=>setDeleteId(item.id)}><Trash2 size={17}/></button></div></article>)}{!plans.length&&<div className="study-library-empty"><p>No routines yet. Create your first BAR or BJS routine.</p><button className="btn" onClick={()=>setScreen("create")}>Create Routine</button></div>}</div></section>}
    {screen==="create"&&<section className="card study-simple-setup"><div className="eyebrow">STEP 1 · PLAN</div><h2>Set up your routine</h2><Field label="Routine name"><input required maxLength={180} placeholder="e.g. My BAR preparation" value={title} onChange={event=>setTitle(event.target.value)}/></Field><h3>Choose your exam</h3><div className="study-simple-exams"><button type="button" className={exam==="bar"?"selected":""} onClick={()=>setExam("bar")}>BAR</button><button type="button" className={exam==="bjs"?"selected":""} onClick={()=>setExam("bjs")}>BJS</button></div><div className="study-simple-fields"><Field label="How many days?"><input type="number" min="1" max="365" value={days} onChange={event=>setDays(Number(event.target.value))}/></Field><Field label="Starting date"><input type="date" min={todayBD()} value={start} onChange={event=>setStart(event.target.value)}/></Field></div><p className="study-simple-end"><CalendarDays size={17}/> {start} to {days>=1&&days<=365?addDays(start,days-1):"—"}</p><div className="study-simple-buttons"><button className="btn" disabled={busy} onClick={()=>void create()}>{busy?"Creating…":"Continue to day-by-day routine"}</button>{!!plans.length&&<button className="btn outline" onClick={()=>setScreen("home")}>Back to My Routines</button>}</div></section>}
    {screen==="detail"&&(!plan?<Loading/>:<><div className="study-simple-summary"><div><span className="study-badge">{plan.curriculum_id.toUpperCase()} · {plan.status==="draft"?"Draft":"Saved"}</span><h2>{plan.title}</h2><p>{plan.start_date} – {plan.end_date} · {dayList.length} study days</p></div>{plan.status!=="draft"&&<div><b>{progress}%</b><small>{completed}/{total} completed</small></div>}</div>
      {plan.status==="draft"?<div className="study-draft-banner"><p><Check size={15}/> Draft changes save automatically. Add your targets, then save to start tracking.</p><button className="btn" disabled={busy} onClick={()=>void save()}><Check size={16}/> {busy?"Saving…":"Save Routine"}</button></div>:<><div className="study-metrics study-simple-metrics">{[["Completed",completed],["Remaining",total-completed],["Due today",pendingToday],["Carried forward",carried]].map(([label,value])=><div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div><nav className="study-simple-tabs" aria-label="Routine views"><button className={tab==="routine"?"active":""} onClick={()=>setTab("routine")}><CalendarDays size={16}/> Routine</button><button className={tab==="performance"?"active":""} onClick={()=>setTab("performance")}><TrendingUp size={16}/> Performance</button></nav></>}
      {tab==="performance"&&plan.status!=="draft"?<section className="study-simple-performance"><h3>My performance</h3><div className="study-simple-progress-hero"><strong>{progress}%</strong><div><b>Overall completion</b><p>{completed} completed · {total-completed} remaining · {carried} carried forward</p><div className="study-progress-track"><span style={{width:`${progress}%`}}/></div></div></div><h3>Progress by subject</h3><div className="study-subject-grid">{[...new Set(rows.filter(row=>row.id).map(row=>row.subject))].map(subject=>{const group=rows.filter(row=>row.id&&row.subject===subject),done=group.filter(row=>row.done).length,percent=Math.round(done/group.length*100);return <article key={subject}><h4>{subject}</h4><p>{done}/{group.length} targets · {percent}%</p><div className="study-progress-track"><span style={{width:`${percent}%`}}/></div></article>})}</div></section>:<><p className="study-simple-save" role="status"><Check size={14}/> {sync} · Changes are saved to your account.</p><div className="study-simple-table-wrap"><table className="study-simple-table"><thead><tr><th>Subject</th><th>Topic / What to study</th>{plan.status!=="draft"&&<th>Studied?</th>}<th>Action</th></tr></thead><tbody>{dayList.map(day=><DayRows key={day} day={day} rows={rows.filter(row=>row.date===day)} tracking={plan.status!=="draft"} change={change} remove={remove} add={()=>{const row=fresh(day);rowsRef.current=[...rowsRef.current,row];setRows([...rowsRef.current])}}/>)}</tbody></table></div></>}
      <div className="study-simple-bottom"><button className="btn outline" onClick={()=>setDeleteId(plan.id)}><Trash2 size={16}/> Delete Routine</button>{plan.status==="draft"?<button className="btn" disabled={busy} onClick={()=>void save()}><Check size={17}/> {busy?"Saving…":"Save Routine"}</button>:<><button className="btn outline" disabled={busy} onClick={()=>void download()}><Download size={16}/> Download PDF</button>{plan.status==="saved"&&<button className="btn" onClick={async()=>{await api(`study/plans/${plan.id}`,{status:"active"},"PATCH");await refresh();setPlan(await api(`study/plans/${plan.id}`))}}>Set as active</button>}</>}</div>
    </>)}
    <Confirm open={!!deleteId} onOpenChange={(open:boolean)=>{if(!open)setDeleteId("")}} title="Delete this routine?" description="It will be removed from My Study Routines. Your other routines will remain available." action="Delete Routine" onConfirm={()=>void deletePlan()}/>
  </div>;
}
function DayRows({day,rows,tracking,change,remove,add}:{day:string;rows:Row[];tracking:boolean;change:(key:string,part:Partial<Row>)=>void;remove:(row:Row)=>Promise<void>;add:()=>void}){
  return <><tr className="study-simple-day"><td colSpan={tracking?4:3}><b>{dayLabel(day)}</b><button type="button" onClick={add}><Plus size={15}/> Add topic</button></td></tr>{rows.map(row=><tr key={row.key} className={row.carryCount?"study-simple-carried":""}><td data-label="Subject"><input aria-label={`Subject for ${day}`} placeholder="e.g. CPC" value={row.subject} onChange={event=>change(row.key,{subject:event.target.value})}/></td><td data-label="Topic"><input aria-label={`Topic for ${day}`} placeholder="e.g. Sections 1–10" value={row.topic} onChange={event=>change(row.key,{topic:event.target.value})}/>{!!row.carryCount&&<small className="study-carried">Carried forward from {row.originalDate}</small>}</td>{tracking&&<td data-label="Studied"><label className="study-simple-check"><input type="checkbox" checked={row.done} disabled={!row.id} onChange={event=>change(row.key,{done:event.target.checked})}/><span>{row.done?"পড়া হয়েছে":"পড়িনি"}</span></label></td>}<td><button className="study-simple-delete" type="button" aria-label={`Remove ${row.subject||"topic"} from ${day}`} onClick={()=>void remove(row)}><Trash2 size={16}/></button></td></tr>)}</>;
}
