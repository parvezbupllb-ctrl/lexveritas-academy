export type StudyNode = {id:string;parent_id:string|null;type:string;title_bn:string;title_en:string;reference_number:string;sort_order:number;workload_weight:number;estimated_workload:number;active:number};
export type StudySelection = {id:string;days:number;mode?:"full"|"custom"|"range";customText?:string;ranges?:{fromId?:string;toId?:string;text?:string}[];priority?:number};
export type DraftTask = {nodeId:string|null;title:string;subject:string;reference:string;date:string;workload:number;priority:number;notes:string};
export const dateISO=(date:Date)=>date.toISOString().slice(0,10);
export const addDays=(iso:string,n:number)=>dateISO(new Date(Date.parse(`${iso}T12:00:00Z`)+n*86400000));
export const todayBD=()=>new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Dhaka",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
export function activeDates(start:string,end:string,weekdays:number[],offDates:string[]=[]){
  const excluded=new Set(offDates),dates:string[]=[];
  for(let day=start,i=0;day<=end&&i<1100;day=addDays(day,1),i++)
    if(weekdays.includes(new Date(`${day}T12:00:00Z`).getUTCDay())&&!excluded.has(day))dates.push(day);
  return dates;
}
export function nextStudyDate(after:string,weekdays:number[],offDates:string[]=[],limit=400){
  const excluded=new Set(offDates);
  for(let i=1;i<=limit;i++){
    const day=addDays(after,i);
    if(weekdays.includes(new Date(`${day}T12:00:00Z`).getUTCDay())&&!excluded.has(day))return day;
  }
  throw Error("No upcoming study day is available.");
}
function orderedChildren(nodes:StudyNode[],parent:string|null){return nodes.filter(n=>n.parent_id===parent&&n.active).sort((a,b)=>a.sort_order-b.sort_order||a.id.localeCompare(b.id))}
function descendants(nodes:StudyNode[],root:StudyNode){const result:StudyNode[]=[];const visit=(node:StudyNode)=>{const kids=orderedChildren(nodes,node.id);if(kids.length)kids.forEach(visit);else result.push(node)};visit(root);return result}
function subjectFor(nodes:StudyNode[],node:StudyNode){let cur:StudyNode|undefined=node,subject=node.title_bn;const seen=new Set<string>();while(cur&&!seen.has(cur.id)){seen.add(cur.id);if(cur.type==="act")return cur.title_bn;if(cur.type==="subject")subject=cur.title_bn;cur=nodes.find(n=>n.id===cur?.parent_id)}return subject}
function label(n:StudyNode){return `${n.type==="section"?"Section ":n.type==="article"?"Article ":n.type==="order"?"Order ":n.type==="rule"?"Rule ":""}${n.reference_number||n.title_bn}`}
function partition(items:StudyNode[],count:number){const total=items.reduce((sum,n)=>sum+Math.max(1,n.workload_weight||100),0),chunks:StudyNode[][]=[];let current:StudyNode[]=[],used=0;
  for(const item of items){current.push(item);used+=Math.max(1,item.workload_weight||100);const remaining=items.length-chunks.flat().length-current.length,slots=count-chunks.length-1;if(slots>0&&remaining>=slots&&used>=total/count){chunks.push(current);current=[];used=0}}
  if(current.length)chunks.push(current);return chunks;
}
export function generateStudyTasks(nodes:StudyNode[],selections:StudySelection[],dates:string[],dailyLimit:number,dailyWorkload:number):DraftTask[]{
  if(!dates.length)throw Error("Choose at least one active study day.");
  if(!selections.length)throw Error("Select at least one subject or topic.");
  const selectedIds=new Set(selections.map(s=>s.id));const groups:{selection:StudySelection;items:DraftTask[]}[]=[];
  for(const selection of selections){
    const root=nodes.find(n=>n.id===selection.id&&n.active);if(!root)throw Error("A selected syllabus item is unavailable. Refresh the syllabus.");
    let ancestor=nodes.find(n=>n.id===root.parent_id),skip=false;const seen=new Set<string>();while(ancestor&&!seen.has(ancestor.id)){seen.add(ancestor.id);if(selectedIds.has(ancestor.id)){skip=true;break}ancestor=nodes.find(n=>n.id===ancestor?.parent_id)}if(skip)continue;
    const subject=subjectFor(nodes,root),source=descendants(nodes,root),units:StudyNode[][]=[];
    if(selection.mode==="range"){
      const inventory=source.filter(n=>["section","article","order","rule","schedule","provision"].includes(n.type));
      for(const range of selection.ranges||[]){
        if(range.text?.trim()){
          units.push([{...root,id:root.id,title_bn:range.text.trim(),reference_number:"",workload_weight:root.workload_weight}]);continue;
        }
        const from=inventory.findIndex(n=>n.id===range.fromId),to=inventory.findIndex(n=>n.id===range.toId);
        if(from<0||to<from)throw Error(`Invalid provision range for ${root.title_bn}. Select the endpoints in the configured order.`);
        units.push(...inventory.slice(from,to+1).map(n=>[n]));
      }
      if(!units.length)throw Error(`Choose a range or enter custom text for ${root.title_bn}.`);
    }else if(selection.mode==="custom"){
      const lines=String(selection.customText||"").split(/\n/).map(x=>x.trim()).filter(Boolean);
      if(!lines.length)throw Error(`Enter the portion to study for ${root.title_bn}.`);
      units.push(...lines.map(text=>[{...root,title_bn:text,reference_number:""}]));
    }else units.push(...source.map(n=>[n]));
    const flat=units.flat(),desired=Math.max(1,Math.min(100,Math.floor(selection.days||1)));
    const count=Math.min(desired,flat.length||1);
    const chunks=partition(flat,count);
    let items=chunks.map((chunk,i)=>{
      const first=chunk[0],last=chunk.at(-1)!;
      const portion=selection.mode==="range"&&chunk.length>1?`${label(first)} – ${label(last)}`:chunk.length>1?`${first.title_bn} – ${last.title_bn}`:first.title_bn;
      const title=portion===root.title_bn?root.title_bn:`${root.title_bn} — ${portion}`;
      return {nodeId:first.id===root.id?root.id:first.id,title,subject,reference:chunk.length>1?`${label(first)} – ${label(last)}`:first.reference_number||"",date:dates[0],workload:chunk.reduce((sum,n)=>sum+Math.max(1,n.workload_weight||100),0),priority:selection.priority||1,notes:""};
    });
    // An unmapped Act or a free-text range has no safe numeric subdivision.
    // Allocate named study sessions across the requested days without inventing provisions.
    if(items.length===1&&desired>1){const item=items[0];items=Array.from({length:Math.min(desired,dates.length)},(_,i)=>({...item,title:`${item.title} · Study session ${i+1}/${Math.min(desired,dates.length)}`,workload:Math.max(1,Math.ceil(item.workload/Math.min(desired,dates.length)))}));}
    groups.push({selection,items});
  }
  const dayLoad=dates.map(()=>0),dayCount=dates.map(()=>0),tasks:DraftTask[]=[];
  for(const group of groups.sort((a,b)=>(b.selection.priority||1)-(a.selection.priority||1))){
    group.items.forEach((item,i)=>{
      const desired=Math.min(dates.length-1,Math.floor((i*dates.length)/group.items.length));
      let best=0,cost=Infinity;
      for(let d=0;d<dates.length;d++){
        const over=Math.max(0,dayLoad[d]+item.workload-dailyWorkload)/Math.max(1,dailyWorkload);
        const countOver=dayCount[d]>=dailyLimit?5:0;
        const score=Math.abs(d-desired)*.45+dayLoad[d]/Math.max(1,dailyWorkload)+over*8+countOver;
        if(score<cost){cost=score;best=d}
      }
      item.date=dates[best];dayLoad[best]+=item.workload;dayCount[best]++;tasks.push(item);
    });
  }
  return tasks.sort((a,b)=>a.date.localeCompare(b.date)||b.priority-a.priority||a.subject.localeCompare(b.subject));
}
