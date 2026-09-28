"use client";

import {useState} from "react";
import {toast} from "sonner";
import {KeyRound,Plus,RotateCcw,Trash2} from "lucide-react";
import {api,useData,ErrorBox,Loading} from "@/lib/client";

export function AccessCodesPanel({type,id}:{type:"exam"|"course"|"package";id:string}){
  const {data,error,reload}=useData(`admin/access/${type}/${id}`);
  const [code,setCode]=useState(""),[quantity,setQuantity]=useState(1);
  return <section className="card access-code-panel"><div className="section-head"><div><h2><KeyRound size={20}/> Access codes</h2><p>One code can unlock several assigned items. Its first use binds it to one browser. Assign it to another course, package or exam from that item's editor.</p></div></div>
    <ErrorBox error={error}/>{!data?<Loading/>:<div className="access-code-list">{data.length?data.map((entry:any)=><div key={entry.id}><code>{entry.code}</code><span>{entry.active?entry.claimed_at?"Assigned · Device bound":"Assigned · Unused":"Inactive"}</span><button type="button" title="Reset device" onClick={async()=>{if(!confirm(`Release the browser currently using ${entry.code}? The next browser to enter it will take ownership.`))return;await api(`admin/codes/${entry.code_id}/reset-device`,{});reload();toast.success("Browser binding reset")}}><RotateCcw size={16}/></button><button type="button" title="Remove assignment" onClick={async()=>{if(!confirm(`Remove ${entry.code} from this item?`))return;await api(`admin/access/${type}/${id}/${entry.id}`,undefined,"DELETE");reload();toast.success("Assignment removed")}}><Trash2 size={16}/></button></div>):<p>No code is assigned yet. Generate a code before sharing a restricted item.</p>}</div>}
    <div className="access-code-actions"><label>New codes <input type="number" min="1" max="1000" value={quantity} onChange={e=>setQuantity(Math.max(1,Math.min(1000,Number(e.target.value)||1)))}/></label><button type="button" className="btn small" onClick={async()=>{const result=await api(`admin/access/${type}/${id}`,{quantity});reload();toast.success(`${result.codes.length} code(s) created`)}}><Plus size={15}/> Generate & assign</button><label>Existing code <input value={code} onChange={e=>setCode(e.target.value.toUpperCase())} placeholder="LVA-XXXX-XXXX-XXXX"/></label><button type="button" className="btn small outline" disabled={!code.trim()} onClick={async()=>{await api(`admin/access/${type}/${id}`,{code:code.trim()});setCode("");reload();toast.success("Code assigned")}}>Assign code</button></div>
  </section>;
}
