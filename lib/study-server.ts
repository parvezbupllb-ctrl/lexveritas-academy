import {compare,hash} from "bcryptjs";
import {z} from "zod";
import {one,all,run,db,digest} from "./server";
import {activeDates,nextStudyDate,todayBD,generateStudyTasks,type StudyNode,type StudySelection,type DraftTask} from "./study-engine";
import {initialStudyNodes} from "./study-seed";
const uid=()=>crypto.randomUUID();
const randomToken=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),n=>n.toString(16).padStart(2,"0")).join("");
const COOKIE="lva_study";
const days=30*86400;
const defaults={
  homepage:{title:"Make Your Study Routine",subtitle:"LEXVERITAS STUDY PLANNER",description:"Create a personalized Bar Council or BJS study plan, divide your syllabus into daily targets and track your preparation.",barLabel:"BAR",bjsLabel:"BJS",barIcon:"book",bjsIcon:"scale",background:"#edf4f6",color:"#143847",image:"",visible:true,status:"published",ctaText:"Plan your preparation",displayOrder:0},
  routine:{enabled:true,bar:true,bjs:true,defaultDailyWorkload:400,maximumDailyWorkload:800,carryForward:true,defaultCarryMode:"auto",studentCustomization:true,dragDrop:true,pdf:true,multipleRoutines:true,archivedRoutines:true,streak:true,progress:true},
  pdf:{title:"Make Your Study Routine",accent:"#123b4b",footer:"LexVeritas Academy • Engineered for Your Legal Career."}
};
const output=(value:any,status=200,headers:Record<string,string>={})=>Response.json(value,{status,headers:{"Cache-Control":"no-store","X-Content-Type-Options":"nosniff",...headers}});
class StudyError extends Error{constructor(message:string,public status=400){super(message)}}
const bad=(message:string,status=400):never=>{throw new StudyError(message,status)};
const cookie=(r:Request)=>r.headers.get("cookie")?.split(";").map(x=>x.trim()).find(x=>x.startsWith(`${COOKIE}=`))?.slice(COOKIE.length+1)||"";
const sessionCookie=(r:Request,value:string,age:number)=>`${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${new URL(r.url).protocol==="https:"?"; Secure":""}`;
const phone=z.string().trim().regex(/^(?:\+?88)?01[3-9]\d{8}$/,"বাংলাদেশের সঠিক মোবাইল নম্বর দিন।").transform(s=>s.replace(/^\+?88/,""));
const text=z.string().trim().min(1).max(180);
const day=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s=>!Number.isNaN(Date.parse(s+"T12:00:00Z"))&&new Date(s+"T12:00:00Z").toISOString().slice(0,10)===s,"সঠিক তারিখ দিন।");
const parseArray=(v:any)=>{try{return JSON.parse(v||"[]")}catch{return []}};
export async function studySettings(){const row=await one("SELECT value FROM study_config WHERE id='main'");try{const value=JSON.parse(row?.value||"{}");return {homepage:{...defaults.homepage,...value.homepage},routine:{...defaults.routine,...value.routine},pdf:{...defaults.pdf,...value.pdf}}}catch{return defaults}}
export async function publicStudyHomepage(){const {homepage,routine}=await studySettings();return {...homepage,enabled:routine.enabled,barEnabled:routine.bar,bjsEnabled:routine.bjs}}
async function seed(){const existing=await one("SELECT id FROM study_config WHERE id='seeded'");if(existing)return;
  await db().batch([
    db().prepare("INSERT OR IGNORE INTO study_curricula(id,code,title,marks,active,sort_order) VALUES('bar','bar','Bar Council',NULL,1,1)"),
    db().prepare("INSERT OR IGNORE INTO study_curricula(id,code,title,marks,active,sort_order) VALUES('bjs','bjs','বাংলাদেশ জুডিসিয়াল সার্ভিস (BJS)',110,1,2)"),
  ]);
  // Stable seed IDs keep concurrent first reads idempotent. Later admin edits are never overwritten.
  for(let i=0;i<initialStudyNodes.length;i+=35){const chunk=initialStudyNodes.slice(i,i+35);await db().batch(chunk.map(n=>db().prepare("INSERT OR IGNORE INTO study_nodes(id,curriculum_id,parent_id,type,title_bn,title_en,reference_number,sort_order,marks,workload_weight,active,description,estimated_workload,metadata) VALUES(?,?,?,?,?,?,?,?,?,100,1,'',100,'{}')").bind(n.id,n.curriculum,n.parent,n.type,n.bn,n.en,n.ref,n.sort,n.marks)))}
  await run("INSERT OR IGNORE INTO study_config(id,value,updated_at) VALUES('seeded','true',?)",Date.now());
}
async function auth(r:Request){const session=cookie(r);if(!session)bad("Please sign in to continue.",401);const user=await one("SELECT u.id,u.name,u.university,u.phone,u.active,u.created_at,u.last_login_at FROM study_sessions s JOIN study_users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires>?",await digest(session),Date.now());if(!user||!user.active)bad("Your student session has expired or this account is disabled.",401);return user}
async function rateLimit(r:Request,key:string,max=8){const ip=r.headers.get("cf-connecting-ip")||"local";const bucket=Math.floor(Date.now()/600000),id=await digest(`study:${key}:${ip}:${bucket}`);const row=await one("INSERT INTO limits(id,count,expires) VALUES(?,1,?) ON CONFLICT(id) DO UPDATE SET count=count+1 RETURNING count",id,Date.now()+600000);if(row.count>max)bad("অনেকবার চেষ্টা হয়েছে। ১০ মিনিট পরে আবার চেষ্টা করুন।",429)}
async function read(r:Request){if(Number(r.headers.get("content-length")||0)>400000)bad("Request is too large.");return r.json()}
const planSchema=z.object({curriculum:z.enum(["bar","bjs"]),title:text,startDate:day,endDate:day,studyDays:z.array(z.number().int().min(0).max(6)).min(1).max(7),offDates:z.array(day).max(366).default([]),dailyWorkload:z.number().int().min(50).max(10000).default(400),dailyLimit:z.number().int().min(1).max(30).default(6),carryMode:z.enum(["auto","ask"]).default("auto"),mode:z.enum(["smart","custom"]).default("smart"),selections:z.array(z.object({id:z.string(),days:z.number().int().min(1).max(100),mode:z.enum(["full","range","custom"]).optional(),customText:z.string().max(2000).optional(),ranges:z.array(z.object({fromId:z.string().optional(),toId:z.string().optional(),text:z.string().max(300).optional()})).max(30).optional(),priority:z.number().int().min(1).max(3).optional()})).max(300).default([]),tasks:z.array(z.object({nodeId:z.string().nullable().optional(),title:text,subject:text,reference:z.string().max(200).default(""),date:day,workload:z.number().int().min(1).max(10000).default(100),priority:z.number().int().min(1).max(3).default(1),notes:z.string().max(2000).default("")})).max(3000).optional()});
async function preparePlan(input:any,settings:Awaited<ReturnType<typeof studySettings>>){const p=planSchema.parse(input);if(p.endDate<p.startDate)bad("শেষের তারিখ শুরুর তারিখের আগে হতে পারে না।");if(p.startDate<todayBD())bad("অতীতের তারিখ দিয়ে নতুন রুটিন শুরু করা যাবে না।");if((Date.parse(p.endDate)-Date.parse(p.startDate))/86400000>730)bad("সর্বোচ্চ দুই বছরের রুটিন তৈরি করুন।");const dates=activeDates(p.startDate,p.endDate,p.studyDays,p.offDates);if(!dates.length)bad("নির্বাচিত সময়ের মধ্যে কোনো পড়ার দিন নেই।");if(p.dailyWorkload>settings.routine.maximumDailyWorkload)bad("দৈনিক কাজের সীমা অ্যাডমিনের নির্ধারিত সর্বোচ্চ সীমার বেশি।");if(p.selections.some(s=>s.days>dates.length))bad("কোনো বিষয়ের জন্য নির্ধারিত দিন মোট পড়ার দিনের বেশি।");if(p.mode==="smart"&&!p.selections.length)bad("অন্তত একটি বিষয় বা টপিক নির্বাচন করুন।");if(p.mode==="custom"&&!p.tasks)bad("কাস্টম রুটিনের তথ্য পাওয়া যায়নি।");await seed();const curriculum=await one("SELECT * FROM study_curricula WHERE code=? AND active=1",p.curriculum);if(!curriculum||!settings.routine[p.curriculum])bad("এই পরীক্ষার রুটিন এখন উপলভ্য নেই।");const nodes=await all("SELECT * FROM study_nodes WHERE curriculum_id=? AND active=1 ORDER BY sort_order,id",p.curriculum) as StudyNode[];
  let tasks:DraftTask[]=p.mode==="smart"?generateStudyTasks(nodes,p.selections as StudySelection[],dates,p.dailyLimit,p.dailyWorkload):p.tasks!.map(t=>({...t,nodeId:t.nodeId||null}));
  if(p.tasks?.length&&p.mode==="smart")tasks=p.tasks.map(t=>({...t,nodeId:t.nodeId||null}));
  if(tasks.length>3000)bad("অনেক বেশি টার্গেট। বিষয় বা রেঞ্জ ছোট করুন।");if(tasks.some(t=>!dates.includes(t.date)))bad("টার্গেট অবশ্যই নির্বাচিত পড়ার দিনে রাখতে হবে।");
  return {p,dates,tasks,curriculum};
}
async function owned(userId:string,id:string){const plan=await one("SELECT * FROM study_plans WHERE id=? AND user_id=?",id,userId);if(!plan)bad("Routine not found.",404);return plan}
async function carry(plan:any,settings:Awaited<ReturnType<typeof studySettings>>){if(!settings.routine.carryForward||plan.carry_mode!=="auto"||plan.status!=="active")return;
  const now=todayBD(),weekdays=parseArray(plan.study_days),off=parseArray(plan.off_dates);
  const stale=await all("SELECT id,due_date FROM study_tasks WHERE plan_id=? AND due_date<? AND status IN ('pending','not_completed','carried','partial') ORDER BY due_date,sort_order",plan.id,now);
  for(const task of stale){const next=nextStudyDate(task.due_date,weekdays,off);const due=next<now?nextStudyDate(addDayBefore(now),weekdays,off):next;const updated=await run("UPDATE study_tasks SET due_date=?,status='carried',carry_count=carry_count+1 WHERE id=? AND plan_id=? AND due_date=? AND status IN ('pending','not_completed','carried','partial')",due,task.id,plan.id,task.due_date);if(updated.meta.changes)await run("INSERT INTO study_task_history(id,task_id,plan_id,action,previous_date,next_date,created_at) VALUES(?,?,?,'carried',?,?,?)",uid(),task.id,plan.id,task.due_date,due,Date.now())}
}
function addDayBefore(day:string){return new Date(Date.parse(`${day}T12:00:00Z`)-86400000).toISOString().slice(0,10)}
function stats(plan:any,tasks:any[]){const complete=tasks.filter(t=>t.status==="completed"),remaining=tasks.filter(t=>t.status!=="completed");const subjects=[...new Set(tasks.map(t=>t.subject_snapshot))].map(name=>{const group=tasks.filter(t=>t.subject_snapshot===name),done=group.filter(t=>t.status==="completed").length;return {name,total:group.length,completed:done,percent:Math.round(done/group.length*100)}});const today=todayBD(),todayTasks=tasks.filter(t=>t.due_date===today);const dates=activeDates(plan.start_date,plan.end_date,parseArray(plan.study_days),parseArray(plan.off_dates));const completedDays=new Set(complete.map(t=>t.due_date));let streak=0;for(let i=dates.length-1;i>=0;i--){if(dates[i]>today)continue;if(completedDays.has(dates[i]))streak++;else if(dates[i]<today)break}
  return {total:tasks.length,completed:complete.length,pending:remaining.length,percent:tasks.length?Math.round(complete.length/tasks.length*100):0,carried:remaining.filter(t=>t.carry_count>0).length,today:todayTasks.length,completedToday:todayTasks.filter(t=>t.status==="completed").length,pendingToday:todayTasks.filter(t=>t.status!=="completed").length,remainingDays:dates.filter(d=>d>=today).length,studyDaysCompleted:completedDays.size,streak,subjects,overloaded:todayTasks.filter(t=>t.status!=="completed").reduce((sum,t)=>sum+t.workload,0)>plan.daily_workload};
}
async function planDetail(userId:string,id:string,settings:Awaited<ReturnType<typeof studySettings>>){const plan=await owned(userId,id);await carry(plan,settings);const tasks=await all("SELECT * FROM study_tasks WHERE plan_id=? AND status!='deleted' ORDER BY due_date,sort_order,id",id);return {...plan,study_days:parseArray(plan.study_days),off_dates:parseArray(plan.off_dates),selections:parseArray(plan.selections),tasks,progress:stats(plan,tasks)}}
export async function studyRequest(r:Request,path:string[],adminCheck:()=>Promise<any>):Promise<Response>{try{
  const method=r.method,config=await studySettings();
  if(path[0]==="home"&&method==="GET")return output({...config.homepage,enabled:config.routine.enabled,barEnabled:config.routine.bar,bjsEnabled:config.routine.bjs});
  if(path[0]==="register"&&method==="POST"){
    if(!config.routine.enabled)bad("Study Routine Builder is currently unavailable.",503);await rateLimit(r,"register",8);
    const b=z.object({name:text,university:text,phone,password:z.string().min(10).max(128),confirmPassword:z.string()}).parse(await read(r));
    if(b.password!==b.confirmPassword)bad("পাসওয়ার্ড দুটি মিলছে না।");const normalized=phone.parse(b.phone);if(await one("SELECT id FROM study_users WHERE phone=?",normalized))bad("এই ফোন নম্বর দিয়ে ইতিমধ্যে অ্যাকাউন্ট খোলা হয়েছে।",409);
    const id=uid(),secret=randomToken(),now=Date.now();
    try{await db().batch([db().prepare("INSERT INTO study_users(id,name,university,phone,password_hash,created_at,last_login_at) VALUES(?,?,?,?,?,?,?)").bind(id,b.name,b.university,normalized,await hash(b.password,12),now,now),db().prepare("INSERT INTO study_sessions(id,user_id,token_hash,expires,created_at) VALUES(?,?,?,?,?)").bind(uid(),id,await digest(secret),now+days*1000,now)])}catch(e:any){if(String(e?.message).includes("UNIQUE"))bad("এই ফোন নম্বর দিয়ে ইতিমধ্যে অ্যাকাউন্ট খোলা হয়েছে।",409);throw e}
    return output({id,name:b.name,university:b.university,phone:normalized},201,{"Set-Cookie":sessionCookie(r,secret,days)});
  }
  if(path[0]==="login"&&method==="POST"){
    const b=z.object({phone,password:z.string()}).parse(await read(r));const normalized=phone.parse(b.phone);await rateLimit(r,`login:${normalized}`,8);
    const found=await one("SELECT * FROM study_users WHERE phone=?",normalized);if(!found||!found.active||!(await compare(b.password,found.password_hash)))bad("ফোন নম্বর বা পাসওয়ার্ড সঠিক নয়।",401);
    const secret=randomToken(),now=Date.now();await db().batch([db().prepare("INSERT INTO study_sessions(id,user_id,token_hash,expires,created_at) VALUES(?,?,?,?,?)").bind(uid(),found.id,await digest(secret),now+days*1000,now),db().prepare("UPDATE study_users SET last_login_at=? WHERE id=?").bind(now,found.id)]);
    return output({id:found.id,name:found.name,university:found.university,phone:found.phone},200,{"Set-Cookie":sessionCookie(r,secret,days)});
  }
  if(path[0]==="logout"&&method==="POST"){if(cookie(r))await run("DELETE FROM study_sessions WHERE token_hash=?",await digest(cookie(r)));return output({ok:true},200,{"Set-Cookie":sessionCookie(r,"",0)})}
  if(path[0]==="admin")return await adminRoutes(r,path.slice(1),adminCheck,config);
  if(!config.routine.enabled)bad("Study Routine Builder is currently unavailable.",503);
  if(path[0]==="curricula"&&method==="GET"){
    await seed();const curriculum=await one("SELECT * FROM study_curricula WHERE code=? AND active=1",path[1]);if(!curriculum||!config.routine[path[1] as "bar"|"bjs"])bad("This curriculum is unavailable.",404);
    return output({curriculum,nodes:await all("SELECT id,parent_id,type,title_bn,title_en,reference_number,sort_order,marks,workload_weight,estimated_workload,description FROM study_nodes WHERE curriculum_id=? AND active=1 ORDER BY sort_order,id",path[1])});
  }
  const user=await auth(r);
  if(path[0]==="me"&&method==="GET")return output(user);
  if(path[0]==="routine-settings"&&method==="GET")return output(config.routine);
  if(path[0]==="pdf-settings"&&method==="GET")return output({...config.pdf,enabled:config.routine.pdf});
  if(path[0]==="plans"&&path[1]==="preview"&&method==="POST"){
    const {p,dates,tasks}=await preparePlan(await read(r),config);return output({dates,tasks,summary:{studyDays:dates.length,targets:tasks.length,endDate:p.endDate,subjects:[...new Set(tasks.map(t=>t.subject))]}})
  }
  if(path[0]==="plans"&&path.length===1&&method==="GET"){
    const plans=await all("SELECT p.*,c.code curriculum FROM study_plans p JOIN study_curricula c ON c.id=p.curriculum_id WHERE p.user_id=? AND p.status!='deleted' ORDER BY CASE p.status WHEN 'active' THEN 0 WHEN 'draft' THEN 1 WHEN 'saved' THEN 2 ELSE 3 END,p.updated_at DESC",user.id);
    return output(await Promise.all(plans.map(async p=>{await carry(p,config);const tasks=await all("SELECT status,carry_count,due_date,subject_snapshot,workload FROM study_tasks WHERE plan_id=? AND status!='deleted'",p.id);return {id:p.id,title:p.title,curriculum:p.curriculum,status:p.status,startDate:p.start_date,endDate:p.end_date,updatedAt:p.updated_at,progress:stats(p,tasks)}})));
  }
  if(path[0]==="plans"&&path.length===1&&method==="POST"){
    if(!config.routine.multipleRoutines&&await one("SELECT id FROM study_plans WHERE user_id=? AND status!='deleted' LIMIT 1",user.id))bad("Only one routine is allowed.");
    const {p,tasks}=await preparePlan(await read(r),config),id=uid(),now=Date.now();
    const draft=p.mode==="custom"&&!tasks.length;
    const statements=[...(draft?[]:[db().prepare("UPDATE study_plans SET status='saved',updated_at=? WHERE user_id=? AND status='active'").bind(now,user.id)]),db().prepare("INSERT INTO study_plans(id,user_id,curriculum_id,title,start_date,end_date,study_days,off_dates,daily_workload,daily_limit,carry_mode,mode,status,selections,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(id,user.id,p.curriculum,p.title,p.startDate,p.endDate,JSON.stringify(p.studyDays),JSON.stringify(p.offDates),p.dailyWorkload,p.dailyLimit,p.carryMode,p.mode,draft?"draft":"active",JSON.stringify(p.selections),now,now),...tasks.map((t,i)=>db().prepare("INSERT INTO study_tasks(id,plan_id,node_id,title_snapshot,subject_snapshot,reference_snapshot,original_date,due_date,status,priority,notes,workload,sort_order) VALUES(?,?,?,?,?,?,?,?,'pending',?,?,?,?)").bind(uid(),id,t.nodeId,t.title,t.subject,t.reference,t.date,t.date,t.priority,t.notes,t.workload,i))];
    for(let i=0;i<statements.length;i+=70)await db().batch(statements.slice(i,i+70));return output({id},201);
  }
  if(path[0]==="plans"&&path[1]){
    const id=path[1],plan=await owned(user.id,id);
    if(plan.status==="deleted")bad("Routine not found.",404);
    if(path.length===2&&method==="GET")return output(await planDetail(user.id,id,config));
    if(path.length===2&&method==="DELETE"){
      await run("UPDATE study_plans SET status='deleted',updated_at=? WHERE id=? AND user_id=?",Date.now(),id,user.id);
      return output({ok:true});
    }
    if(path.length===2&&method==="PATCH"){
      const b=z.object({title:text.optional(),status:z.enum(["active","saved","archived"]).optional(),carryMode:z.enum(["auto","ask"]).optional(),endDate:day.optional(),dailyWorkload:z.number().int().min(50).max(10000).optional(),dailyLimit:z.number().int().min(1).max(30).optional()}).parse(await read(r));
      if(b.status==="archived"&&!config.routine.archivedRoutines)bad("Archiving is disabled.");
      if(b.endDate&&b.endDate<plan.start_date)bad("Target date is before the routine starts.");
      if(b.endDate&&b.endDate<todayBD())bad("Target date has already passed.");
      if(b.dailyWorkload&&b.dailyWorkload>config.routine.maximumDailyWorkload)bad("Daily workload exceeds the configured limit.");
      if(b.status==="active"){
        if(plan.status==="draft"&&!await one("SELECT id FROM study_tasks WHERE plan_id=? AND status!='deleted' LIMIT 1",id))bad("রুটিন সেভ করার আগে অন্তত একটি বিষয় ও টপিক যোগ করুন।");
        await run("UPDATE study_plans SET status='saved' WHERE user_id=? AND id!=? AND status='active'",user.id,id);
      }
      await run("UPDATE study_plans SET title=?,status=?,carry_mode=?,end_date=?,daily_workload=?,daily_limit=?,updated_at=? WHERE id=? AND user_id=?",b.title||plan.title,b.status||plan.status,b.carryMode||plan.carry_mode,b.endDate||plan.end_date,b.dailyWorkload||plan.daily_workload,b.dailyLimit||plan.daily_limit,Date.now(),id,user.id);return output({ok:true});
    }
    if(path[2]==="duplicate"&&method==="POST"){
      if(!config.routine.multipleRoutines)bad("Multiple routines are disabled.");const copyId=uid(),now=Date.now();const tasks=await all("SELECT * FROM study_tasks WHERE plan_id=? AND status!='deleted' ORDER BY sort_order",id);
      const statements=[db().prepare("INSERT INTO study_plans(id,user_id,curriculum_id,title,start_date,end_date,study_days,off_dates,daily_workload,daily_limit,carry_mode,mode,status,selections,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,'saved',?,?,?)").bind(copyId,user.id,plan.curriculum_id,`${plan.title} (Copy)`,plan.start_date,plan.end_date,plan.study_days,plan.off_dates,plan.daily_workload,plan.daily_limit,plan.carry_mode,plan.mode,plan.selections,now,now),...tasks.map((t:any)=>db().prepare("INSERT INTO study_tasks(id,plan_id,node_id,title_snapshot,subject_snapshot,reference_snapshot,original_date,due_date,status,priority,notes,workload,sort_order) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(uid(),copyId,t.node_id,t.title_snapshot,t.subject_snapshot,t.reference_snapshot,t.original_date,t.original_date,"pending",t.priority,t.notes,t.workload,t.sort_order))];for(let i=0;i<statements.length;i+=70)await db().batch(statements.slice(i,i+70));return output({id:copyId},201)
    }
    if(path[2]==="tasks"&&path.length===3&&method==="POST"){
      if(!config.routine.studentCustomization)bad("Customization is disabled.");const b=z.object({title:text,subject:text,reference:z.string().max(200).default(""),date:day,priority:z.number().int().min(1).max(3).default(1),notes:z.string().max(2000).default(""),workload:z.number().int().min(1).max(10000).default(100),nodeId:z.string().nullable().optional()}).parse(await read(r));if(b.date<plan.start_date)bad("Date is before the routine begins.");const taskId=uid();await run("INSERT INTO study_tasks(id,plan_id,node_id,title_snapshot,subject_snapshot,reference_snapshot,original_date,due_date,status,priority,notes,workload,sort_order) VALUES(?,?,?,?,?,?,?,?,'pending',?,?,?,?)",taskId,id,b.nodeId||null,b.title,b.subject,b.reference,b.date,b.date,b.priority,b.notes,b.workload,Date.now());await run("INSERT INTO study_task_history(id,task_id,plan_id,action,next_date,created_at) VALUES(?,?,?,'added',?,?)",uid(),taskId,id,b.date,Date.now());return output({id:taskId},201)
    }
    if(path[2]==="tasks"&&path[3]){
      const task=await one("SELECT * FROM study_tasks WHERE id=? AND plan_id=? AND status!='deleted'",path[3],id);if(!task)bad("Target not found.",404);
      if(method==="DELETE"){if(!config.routine.studentCustomization)bad("Customization is disabled.");await run("INSERT INTO study_task_history(id,task_id,plan_id,action,previous_date,details,created_at) VALUES(?,?,?,'deleted',?,?,?)",uid(),task.id,id,task.due_date,JSON.stringify(task),Date.now());await run("UPDATE study_tasks SET status='deleted' WHERE id=? AND plan_id=?",task.id,id);return output({ok:true})}
      if(method==="PATCH"){
        const b=z.object({status:z.enum(["pending","completed","not_completed","partial"]).optional(),date:day.optional(),title:text.optional(),subject:text.optional(),reference:z.string().max(200).optional(),notes:z.string().max(2000).optional(),priority:z.number().int().min(1).max(3).optional(),workload:z.number().int().min(1).max(10000).optional(),sortOrder:z.number().int().min(0).optional()}).parse(await read(r));
        if(!config.routine.studentCustomization&&Object.keys(b).some(k=>k!=="status"))bad("Customization is disabled.");if(b.date&&b.date<plan.start_date)bad("Date is before the routine begins.");
        await run("UPDATE study_tasks SET status=?,completed_at=?,due_date=?,title_snapshot=?,subject_snapshot=?,reference_snapshot=?,notes=?,priority=?,workload=?,sort_order=? WHERE id=? AND plan_id=?",b.status||task.status,b.status==="completed"?Date.now():b.status?null:task.completed_at,b.date||task.due_date,b.title||task.title_snapshot,b.subject||task.subject_snapshot,b.reference??task.reference_snapshot,b.notes??task.notes,b.priority??task.priority,b.workload??task.workload,b.sortOrder??task.sort_order,task.id,id);
        await run("INSERT INTO study_task_history(id,task_id,plan_id,action,previous_date,next_date,details,created_at) VALUES(?,?,?,?,?,?,?,?)",uid(),task.id,id,b.status||"edited",task.due_date,b.date||task.due_date,JSON.stringify(b),Date.now());return output({ok:true})
      }
    }
    if(path[2]==="carry"&&method==="POST"){
      if(!config.routine.carryForward)bad("Carry forward is disabled.");const b=z.object({ids:z.array(z.string()).min(1).max(100)}).parse(await read(r));for(const taskId of b.ids){const task=await one("SELECT * FROM study_tasks WHERE id=? AND plan_id=? AND status IN ('pending','not_completed','carried','partial')",taskId,id);if(!task)continue;const weekdays=parseArray(plan.study_days),off=parseArray(plan.off_dates),candidate=nextStudyDate(task.due_date,weekdays,off),next=candidate<todayBD()?nextStudyDate(addDayBefore(todayBD()),weekdays,off):candidate;await run("UPDATE study_tasks SET due_date=?,status='carried',carry_count=carry_count+1 WHERE id=? AND plan_id=?",next,taskId,id);await run("INSERT INTO study_task_history(id,task_id,plan_id,action,previous_date,next_date,created_at) VALUES(?,?,?,'carried',?,?,?)",uid(),task.id,id,task.due_date,next,Date.now())}return output({ok:true})
    }
    if(path[2]==="redistribute"&&method==="POST"){
      const b=z.object({date:day}).parse(await read(r)),targets=await all("SELECT * FROM study_tasks WHERE plan_id=? AND due_date=? AND status IN ('pending','not_completed','carried','partial') ORDER BY priority DESC,sort_order",id,b.date);let sum=targets.reduce((s,t)=>s+t.workload,0);for(const task of targets.reverse()){if(sum<=plan.daily_workload)break;const next=nextStudyDate(task.due_date,parseArray(plan.study_days),parseArray(plan.off_dates));await run("UPDATE study_tasks SET due_date=?,status='carried',carry_count=carry_count+1 WHERE id=? AND plan_id=?",next,task.id,id);await run("INSERT INTO study_task_history(id,task_id,plan_id,action,previous_date,next_date,created_at) VALUES(?,?,?,'redistributed',?,?,?)",uid(),task.id,id,task.due_date,next,Date.now());sum-=task.workload}return output({ok:true})
    }
  }
  return bad("Not found.",404);
}catch(error:any){if(error instanceof z.ZodError)return output({error:error.issues.map(i=>`${i.path.join(".")}: ${i.message}`).join("; ")},400);if(error instanceof StudyError)return output({error:error.message},error.status);console.error("Study routine API",error?.message);return output({error:"Could not complete this request. Please try again."},500)}}
async function adminRoutes(r:Request,path:string[],adminCheck:()=>Promise<any>,config:Awaited<ReturnType<typeof studySettings>>){await adminCheck();const method=r.method,url=new URL(r.url);
  if(path[0]==="settings"){
    if(method==="GET")return output(config);
    if(method==="PATCH"){
      const b=z.object({homepage:z.record(z.any()).optional(),routine:z.record(z.any()).optional(),pdf:z.record(z.any()).optional()}).parse(await read(r));
      const next={homepage:{...config.homepage,...b.homepage},routine:{...config.routine,...b.routine},pdf:{...config.pdf,...b.pdf}};
      // Reject unexpected keys; the UI and API share one authoritative set of controls.
      for(const group of ["homepage","routine","pdf"] as const)for(const key of Object.keys(b[group]||{}))if(!(key in defaults[group]))bad(`Unknown ${group} setting: ${key}`);
      await run("INSERT INTO study_config(id,value,updated_at) VALUES('main',?,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at",JSON.stringify(next),Date.now());return output(next);
    }
  }
  if(path[0]==="curricula"){
    await seed();if(method==="GET")return output({curricula:await all("SELECT * FROM study_curricula ORDER BY sort_order"),nodes:await all("SELECT * FROM study_nodes WHERE curriculum_id=? ORDER BY sort_order,id",path[1]||"bar")});
    if(method==="PATCH"&&path[1]){const b=z.object({title:text.optional(),marks:z.number().int().min(0).nullable().optional(),active:z.boolean().optional(),sortOrder:z.number().int().optional()}).parse(await read(r));const item=await one("SELECT * FROM study_curricula WHERE id=?",path[1]);if(!item)bad("Curriculum not found.",404);await run("UPDATE study_curricula SET title=?,marks=?,active=?,sort_order=? WHERE id=?",b.title??item.title,b.marks===undefined?item.marks:b.marks,b.active===undefined?item.active:+b.active,b.sortOrder??item.sort_order,item.id);return output({ok:true})}
    if(method==="POST"){const b=z.object({code:z.string().regex(/^[a-z][a-z0-9-]{1,30}$/),title:text,marks:z.number().int().min(0).nullable().default(null)}).parse(await read(r));await run("INSERT INTO study_curricula(id,code,title,marks,active,sort_order) VALUES(?,?,?,?,1,?)",b.code,b.code,b.title,b.marks,Date.now());return output({id:b.code},201)}
  }
  if(path[0]==="nodes"){
    if(method==="POST"||method==="PATCH"){
      const b=z.object({curriculumId:z.string().min(1),parentId:z.string().nullable().default(null),type:z.enum(["subject","topic","subtopic","chapter","act","section","article","order","rule","schedule","provision","case_doctrine","literature_period","author","custom","category"]),titleBn:text,titleEn:z.string().max(180).default(""),referenceNumber:z.string().max(80).default(""),sortOrder:z.number().int().min(0).default(0),marks:z.number().int().min(0).nullable().default(null),workloadWeight:z.number().int().min(1).max(10000).default(100),estimatedWorkload:z.number().int().min(1).max(10000).default(100),description:z.string().max(2000).default(""),active:z.boolean().default(true)}).parse(await read(r));
      const id=path[1]||uid();if(!(await one("SELECT id FROM study_curricula WHERE id=?",b.curriculumId)))bad("Select a valid exam.");if(b.parentId){const parent=await one("SELECT * FROM study_nodes WHERE id=? AND curriculum_id=?",b.parentId,b.curriculumId);if(!parent)bad("Parent item not found.");if(b.parentId===id)bad("A topic cannot contain itself.");let cursor=parent;const seen=new Set<string>();while(cursor&&!seen.has(cursor.id)){if(cursor.id===id)bad("A topic cannot move into its own child.");seen.add(cursor.id);cursor=cursor.parent_id?await one("SELECT id,parent_id FROM study_nodes WHERE id=?",cursor.parent_id):null}}
      if(method==="PATCH"&&!(await one("SELECT id FROM study_nodes WHERE id=?",id)))bad("Syllabus item not found.",404);
      await run("INSERT INTO study_nodes(id,curriculum_id,parent_id,type,title_bn,title_en,reference_number,sort_order,marks,workload_weight,active,description,estimated_workload,metadata) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,'{}') ON CONFLICT(id) DO UPDATE SET curriculum_id=excluded.curriculum_id,parent_id=excluded.parent_id,type=excluded.type,title_bn=excluded.title_bn,title_en=excluded.title_en,reference_number=excluded.reference_number,sort_order=excluded.sort_order,marks=excluded.marks,workload_weight=excluded.workload_weight,active=excluded.active,description=excluded.description,estimated_workload=excluded.estimated_workload",id,b.curriculumId,b.parentId,b.type,b.titleBn,b.titleEn,b.referenceNumber,b.sortOrder,b.marks,b.workloadWeight,+b.active,b.description,b.estimatedWorkload);return output({id},method==="POST"?201:200)
    }
    if(method==="DELETE"&&path[1]){const node=await one("SELECT id FROM study_nodes WHERE id=?",path[1]);if(!node)bad("Topic not found.",404);if(await one("SELECT id FROM study_nodes WHERE parent_id=? LIMIT 1",node.id))bad("Remove or move child items before deleting this topic.");await run("DELETE FROM study_nodes WHERE id=?",node.id);return output({ok:true})}
  }
  if(path[0]==="bulk"&&method==="POST"){
    const b=z.object({curriculumId:z.string(),parentId:z.string().nullable().default(null),type:z.enum(["category","subject","topic","subtopic","chapter","act","section","article","order","rule","schedule","provision","case_doctrine","literature_period","author","custom"]).default("section"),lines:z.string().max(30000)}).parse(await read(r));const lines=b.lines.split(/[\n,]/).map(s=>s.trim()).filter(Boolean);if(!lines.length||lines.length>500)bad("Add between 1 and 500 references.");if(!(await one("SELECT id FROM study_curricula WHERE id=?",b.curriculumId)))bad("Exam not found.");if(b.parentId&&!(await one("SELECT id FROM study_nodes WHERE id=? AND curriculum_id=?",b.parentId,b.curriculumId)))bad("Parent item not found.");const start=(await one("SELECT COALESCE(MAX(sort_order),0) n FROM study_nodes WHERE curriculum_id=? AND parent_id IS ?",b.curriculumId,b.parentId)).n;
    for(let i=0;i<lines.length;i+=50)await db().batch(lines.slice(i,i+50).map((line,j)=>db().prepare("INSERT INTO study_nodes(id,curriculum_id,parent_id,type,title_bn,title_en,reference_number,sort_order,marks,workload_weight,active,description,estimated_workload,metadata) VALUES(?,?,?,?,?,?,?, ?,NULL,100,1,'',100,'{}')").bind(uid(),b.curriculumId,b.parentId,b.type,`${b.type.charAt(0).toUpperCase()+b.type.slice(1)} ${line}`,"",line,start+i+j+1)));return output({added:lines.length})
  }
  if(path[0]==="import"&&method==="POST"){
    const b=z.object({curriculumId:z.string(),lines:z.string().max(100000)}).parse(await read(r));
    if(!(await one("SELECT id FROM study_curricula WHERE id=?",b.curriculumId)))bad("Exam not found.");
    const lines=b.lines.trim().split(/\r?\n/).filter(Boolean);
    if(!lines.length||lines.length>500)bad("Import 1–500 syllabus items at a time.");
    const allowed=new Set(["category","subject","topic","subtopic","chapter","act","section","article","order","rule","schedule","provision","case_doctrine","literature_period","author","custom"]);
    const parentIds:string[]=[],items:any[]=[];
    const root=(await one("SELECT COALESCE(MAX(sort_order),0) n FROM study_nodes WHERE curriculum_id=? AND parent_id IS NULL",b.curriculumId)).n;
    for(let i=0;i<lines.length;i++){
      const [depthText,type,titleBn,titleEn="",reference=""]=lines[i].split("\t"),depth=Number(depthText);
      if(!Number.isInteger(depth)||depth<0||depth>10||!allowed.has(type)||!titleBn?.trim()||titleBn.length>180||titleEn.length>180||reference.length>80||depth>0&&!parentIds[depth-1])bad(`Invalid syllabus entry on line ${i+1}. Use depth, type and title separated by tabs.`);
      const id=uid(),parent=depth?parentIds[depth-1]:null;parentIds[depth]=id;parentIds.length=depth+1;
      items.push({id,parent,type,titleBn:titleBn.trim(),titleEn:titleEn.trim(),reference:reference.trim(),sort:depth?i+1:root+i+1});
    }
    for(let i=0;i<items.length;i+=50)await db().batch(items.slice(i,i+50).map(n=>db().prepare("INSERT INTO study_nodes(id,curriculum_id,parent_id,type,title_bn,title_en,reference_number,sort_order,marks,workload_weight,active,description,estimated_workload,metadata) VALUES(?,?,?,?,?,?,?,?,NULL,100,1,'',100,'{}')").bind(n.id,b.curriculumId,n.parent,n.type,n.titleBn,n.titleEn,n.reference,n.sort)));
    return output({added:items.length},201);
  }
  if(path[0]==="students"){
    if(method==="GET"&&path[1]){return output(await all("SELECT p.id,p.title,p.status,c.code curriculum,p.start_date,p.end_date,(SELECT COUNT(*) FROM study_tasks t WHERE t.plan_id=p.id AND t.status!='deleted') targets,(SELECT COUNT(*) FROM study_tasks t WHERE t.plan_id=p.id AND t.status='completed') completed FROM study_plans p JOIN study_curricula c ON c.id=p.curriculum_id WHERE p.user_id=? ORDER BY p.updated_at DESC",path[1]))}
    if(method==="GET"){const q=(url.searchParams.get("q")||"").trim(),page=Math.max(1,Math.min(100000,Number(url.searchParams.get("page"))||1));const where=q?"WHERE u.name LIKE ? OR u.university LIKE ? OR u.phone LIKE ?":"",values=q?[`%${q}%`,`%${q}%`,`%${q}%`]:[];const count=await one(`SELECT COUNT(*) n FROM study_users u ${where}`,...values);const rows=await all(`SELECT u.id,u.name,u.university,u.phone,u.active,u.created_at,u.last_login_at,(SELECT COUNT(*) FROM study_plans p WHERE p.user_id=u.id) routine_count,(SELECT title FROM study_plans p WHERE p.user_id=u.id AND p.status='active' ORDER BY p.updated_at DESC LIMIT 1) active_routine FROM study_users u ${where} ORDER BY u.created_at DESC LIMIT 30 OFFSET ?`,...values,(page-1)*30);return output({rows,total:count.n,page})}
    if(method==="PATCH"&&path[1]){const b=z.object({active:z.boolean()}).parse(await read(r));await run("UPDATE study_users SET active=? WHERE id=?",+b.active,path[1]);if(!b.active)await run("DELETE FROM study_sessions WHERE user_id=?",path[1]);return output({ok:true})}
  }
  if(path[0]==="summary"&&method==="GET"){const [users,plans,targets,done]=await Promise.all([one("SELECT COUNT(*) n FROM study_users"),one("SELECT COUNT(*) n FROM study_plans"),one("SELECT COUNT(*) n FROM study_tasks"),one("SELECT COUNT(*) n FROM study_tasks WHERE status='completed'")]);return output({users:users.n,plans:plans.n,targets:targets.n,completed:done.n})}
  return bad("Admin study route not found.",404)
}
