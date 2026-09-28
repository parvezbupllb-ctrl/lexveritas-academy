"use client";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowDown, ArrowUp, Copy, Eye, FileArchive, FileText, GripVertical,
  History, Image as ImageIcon, Monitor, Plus, RotateCcw, Save, Search,
  ShieldCheck, Smartphone, Tablet, Trash2, Upload, UserPlus,
  Pencil,
} from "lucide-react";
import { api, ActionButton, Confirm, EmptyState, ErrorBox, Field, Loading, date, money, cash, useData } from "@/lib/client";
import { MediaUpload } from "./media-upload";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const titles: Record<string, string> = {
  pages: "Pages", "page-builder": "Visual Page Builder", navigation: "Navigation",
  header: "Header Builder", footer: "Footer Builder", announcement: "Announcement Bar",
  popups: "Popup Manager", homepage: "Homepage Sections", theme: "Theme Manager",
  responsive: "Device Settings", seo: "SEO Manager", commerce: "Commerce Settings",
  site: "Site Settings", appearance: "Appearance", maintenance: "Maintenance Mode",
};
const defaults: Record<string, any> = {
  navigation: { items: [
    { id: "home", label: "Home", url: "/", visible: true },
    { id: "notices", label: "Notices", url: "/notices", visible: true },
    { id: "notes", label: "Free Notes And Resources", url: "/notes", visible: true },
    { id: "courses", label: "Courses", url: "/courses", visible: true },
    { id: "complete-packages", parentId: "courses", label: "Complete Packages", url: "/courses", visible: true },
    { id: "exam-batches", parentId: "courses", label: "Exam Batches", url: "/packages", visible: true },
    { id: "mcq-exams", label: "MCQ Exams", url: "/exams", visible: true },
    { id: "books", label: "Books", url: "/books", visible: true },
    { id: "hardcopy", parentId: "books", label: "Hardcopy", url: "/books?type=hardcopy", visible: true },
    { id: "softcopy", parentId: "books", label: "Softcopy", url: "/books?type=softcopy", visible: true },
    { id: "track-order", parentId: "books", label: "Track Your Order", url: "/track-order", visible: true },
    { id: "blog", label: "Blog", url: "/blog", visible: true },
    { id: "all-blogs", parentId: "blog", label: "All Blogs", url: "/blog", visible: true },
    { id: "write-blog", label: "Write A Blog", url: "/write-a-blog", visible: true },
    { id: "about", label: "About", url: "/about", visible: true },
    { id: "contact", label: "Contact Us", url: "/contact", visible: true },
  ]},
  header: { sticky: false, height: 95, background: "#ffffff", logoSize: 180, search: false, cart: true, enterExam: true, whatsapp: true, ctaLabel: "", ctaUrl: "" },
  footer: { description: "Preparation for a career grounded in law.", background: "#102d3c", textColor: "#e7eef1", copyright: "LexVeritas Academy", newsletter: false },
  announcement: { enabled: false, text: "", link: "", background: "#102d3c", textColor: "#ffffff", start: "", end: "", desktop: true, mobile: true },
  popups: { enabled: false, title: "", message: "", link: "", buttonLabel: "Learn more", delay: 3, desktop: true, mobile: true, start: "", end: "" },
  theme: { primary: "#10243c", secondary: "#c89b3c", accent: "#d9b774", background: "#f7f8fa", text: "#172033", heading: "#153746", link: "#153746", border: "#dce4e8", fontFamily: "Arial", headingFont: "Georgia", bodySize: 16, headingWeight: 500, lineHeight: 1.6, radius: 14, shadow: "medium", container: 1200, sectionSpacing: 72 },
  appearance: { buttonStyle: "rounded", buttonWeight: 600, cardStyle: "bordered", cardRadius: 14, borderWidth: 1, shadow: "medium", sectionSpacing: 72, animation: "subtle", animationDuration: 300 },
  responsive: { device: "desktop", desktopColumns: 3, tabletColumns: 2, mobileColumns: 1, desktopPadding: 32, tabletPadding: 24, mobilePadding: 18, desktopFont: 16, tabletFont: 16, mobileFont: 16 },
  seo: { siteTitle: "LexVeritas Academy", titleTemplate: "%s | LexVeritas Academy", metaDescription: "Legal education, MCQ examinations and law books.", canonical: "", ogTitle: "LexVeritas Academy", ogDescription: "", ogImage: "", sitemap: true, robots: "index, follow" },
  commerce: { currency: "BDT", currencySymbol: "৳", bkash: true, nagad: true, rocket: true, coupons: true, deliveryEnabled: true, taxRate: 0 },
  site: { timezone: "Asia/Dhaka", language: "bn-BD", dateFormat: "DD MMM YYYY", adminEmail: "", supportPhone: "" },
  maintenance: { enabled: false, title: "We’ll be back shortly", message: "LexVeritas Academy is being improved. Please check again soon.", expectedReturn: "" },
  pages: { items: [] },
};

function useControl(kind: string) {
  const [record, setRecord] = useState<any>(null), [error, setError] = useState("");
  const load = () => api(`admin/control/${kind}`).then((r) => setRecord(r)).catch((e) => setError(e.message));
  useEffect(() => { void load(); }, [kind]);
  const value = record?.draft || record?.live || defaults[kind] || {};
  const save = async (action: "draft" | "publish" | "restore", data = value, version?: number) => {
    setError("");
    try {
      await api(`admin/control/${kind}`, { action, data, version }, "PATCH");
      toast.success(action === "draft" ? "Draft saved" : action === "restore" ? "Version restored" : "Changes published");
      load();
    } catch (e: any) { setError(e.message); }
  };
  return { record, value, setValue: (v: any) => setRecord({ ...(record || {}), draft: v }), error, save };
}

function ModuleHeader({ title, description, onDraft, onPublish }: any) {
  return <div className="cc-heading">
    <div><div className="eyebrow">LEXVERITAS CONTROL CENTER</div><h1>{title}</h1><p>{description}</p></div>
    <div className="cc-actions">
      <a className="btn secondary" href="/" target="_blank" rel="noreferrer"><Eye size={16}/> Preview Website</a>
      <button className="btn secondary" onClick={onDraft}><Save size={16}/> Save Draft</button>
      <button className="btn" onClick={onPublish}>Publish</button>
    </div>
  </div>;
}

const Input = ({ label, value, set, type = "text", ...props }: any) => <Field label={label} type={type} value={value ?? ""} onChange={(e: any) => set(type === "number" ? Number(e.target.value) : e.target.value)} {...props}/>;
const Toggle = ({ label, value, set, hint }: any) => <label className="cc-toggle"><span><b>{label}</b>{hint && <small>{hint}</small>}</span><input type="checkbox" checked={!!value} onChange={(e) => set(e.target.checked)}/></label>;

function Versions({ history, restore }: any) {
  if (!history?.length) return null;
  return <section className="card cc-panel"><h2><History size={19}/> Version History</h2><div className="cc-version-list">
    {history.map((v: any, i: number) => <div key={`${v.at}-${i}`}><span><b>{date(v.at)}</b><small>Published by {v.admin}</small></span><button className="btn secondary small" onClick={() => restore(i)}>Restore</button></div>)}
  </div></section>;
}

export function VisualPageBuilder() {
  const control = useControl("homepage");
  const initial = ["hero", "notice", "statistics", "courses", "exam-packages", "notes", "books", "blog", "reviews", "faq", "cta"];
  const labels: Record<string,string> = { courses: "Complete Package", "exam-packages": "Exam Package", notes: "Free Notes & Study Resources" };
  const rawSections = control.value.sections || initial.map((type, i) => ({ id: `${type}-${i}`, type, label: labels[type] || type[0].toUpperCase()+type.slice(1), visible: true, desktop: true, tablet: true, mobile: true }));
  const sections = (() => {
    const existingNote = rawSections.find((section:any) => section.type === "notes");
    const next = rawSections.filter((section:any) => section.type !== "notes");
    const coursesIndex = Math.max(next.findIndex((section:any) => section.type === "courses"), next.findIndex((section:any) => ["packages", "exam-packages"].includes(section.type)));
    next.splice(coursesIndex >= 0 ? coursesIndex + 1 : next.length, 0, existingNote || { id: "notes-restored", type: "notes", label: "Free Notes & Study Resources", visible: true, desktop: true, tablet: true, mobile: true });
    return next;
  })();
  const update = (next: any[]) => control.setValue({ ...control.value, sections: next });
  if (!control.record) return <Loading/>;
  return <>
    <ModuleHeader title="Visual Page Builder" description="Arrange homepage sections, control visibility by device, and publish only when ready." onDraft={() => control.save("draft", { ...control.value, sections })} onPublish={() => control.save("publish", { ...control.value, sections })}/>
    <ErrorBox error={control.error}/>
    <div className="cc-builder-layout">
      <section className="card cc-panel"><div className="cc-panel-title"><h2>Homepage canvas</h2><span>{sections.length} sections</span></div>
        <div className="cc-section-list">{sections.map((s: any, i: number) => <div className="cc-section-row" key={s.id}>
          <GripVertical size={18}/><div className="cc-section-name"><b>{s.label}</b><small>{s.type}</small></div>
          <div className="cc-device-toggles" aria-label="Device visibility">
            <button className={s.desktop ? "active" : ""} title="Desktop" onClick={() => update(sections.map((x:any)=>x.id===s.id?{...x,desktop:!x.desktop}:x))}><Monitor size={15}/></button>
            <button className={s.tablet ? "active" : ""} title="Tablet" onClick={() => update(sections.map((x:any)=>x.id===s.id?{...x,tablet:!x.tablet}:x))}><Tablet size={15}/></button>
            <button className={s.mobile ? "active" : ""} title="Mobile" onClick={() => update(sections.map((x:any)=>x.id===s.id?{...x,mobile:!x.mobile}:x))}><Smartphone size={15}/></button>
          </div>
          <button className="icon-btn" title="Edit section name" onClick={() => { const label=window.prompt("Section name",s.label); if(label?.trim()) update(sections.map((x:any)=>x.id===s.id?{...x,label:label.trim()}:x)); }}><Pencil size={15}/></button>
          <button className="icon-btn" disabled={!i} onClick={() => { const n=[...sections]; [n[i-1],n[i]]=[n[i],n[i-1]]; update(n); }}><ArrowUp size={15}/></button>
          <button className="icon-btn" disabled={i===sections.length-1} onClick={() => { const n=[...sections]; [n[i+1],n[i]]=[n[i],n[i+1]]; update(n); }}><ArrowDown size={15}/></button>
          <button className="icon-btn" title="Duplicate" onClick={() => { const n=[...sections]; n.splice(i+1,0,{...s,id:`${s.type}-${Date.now()}`,label:`${s.label} copy`}); update(n); }}><Copy size={15}/></button>
          <button className="icon-btn danger" title="Delete" onClick={() => update(sections.filter((x:any)=>x.id!==s.id))}><Trash2 size={15}/></button>
          <Toggle label="" value={s.visible} set={(v:boolean)=>update(sections.map((x:any)=>x.id===s.id?{...x,visible:v}:x))}/>
        </div>)}</div>
      </section>
      <SectionLibrary add={(type:string) => update([...sections,{ id:`${type}-${Date.now()}`,type,label:type.split("-").map(x=>x[0].toUpperCase()+x.slice(1)).join(" "),visible:true,desktop:true,tablet:true,mobile:true }])}/>
    </div>
    <Versions history={control.record.history} restore={(i:number)=>control.save("restore", undefined, i)}/>
  </>;
}
function SectionLibrary({ add }: any) {
  const types=["hero","notice","statistics","exam-packages","courses","books","notes","blog","reviews","faq","cta","rich-text","image-text","gallery","video","countdown","contact","pricing","download","social-links","divider","custom"];
  const labels: Record<string,string> = { courses: "Complete Package", "exam-packages": "Exam Package", notes: "Free Notes & Study Resources" };
  return <aside className="card cc-panel cc-library"><h2><Plus size={19}/> Add Section</h2><div>{types.map(x=><button key={x} onClick={()=>add(x)}><Plus size={14}/>{labels[x] || x.replaceAll("-"," ")}</button>)}</div></aside>;
}

const appearanceFields: Record<string,string[]> = {
  design: ["primary","secondary","accent","background","text","heading","link","border","fontFamily","headingFont","bodySize","headingWeight","lineHeight"],
  components: ["buttonStyle","buttonWeight","cardStyle","cardRadius"],
  surfaces: ["borderWidth","shadow","sectionSpacing"],
  animations: ["animation","animationDuration"],
};
export function SettingsStudio({ kind, focus }: { kind: string; focus?: string }) {
  const c = useControl(kind), value = c.value;
  if (!c.record) return <Loading/>;
  const set=(key:string,v:any)=>c.setValue({...value,[key]:v});
  const fields=focus ? Object.entries(value).filter(([key])=>appearanceFields[focus]?.includes(key)) : Object.entries(value);
  const title=focus ? ({design:"Colors & Typography",components:"Buttons & Cards",surfaces:"Spacing, Borders & Shadows",animations:"Animations"} as Record<string,string>)[focus] : titles[kind];
  return <>
    <ModuleHeader title={title || "Settings"} description="Edit safely, save a draft, preview, and publish when the change is ready." onDraft={()=>c.save("draft")} onPublish={()=>c.save("publish")}/>
    <ErrorBox error={c.error}/>
    {kind === "navigation" ? <NavigationEditor value={value} change={c.setValue}/> :
     kind === "pages" ? <PagesEditor value={value} change={c.setValue}/> :
     <section className="card cc-panel"><h2>{title}</h2><div className="grid two">
       {fields.map(([key,v]:any)=> typeof v === "boolean" ? <Toggle key={key} label={human(key)} value={v} set={(n:boolean)=>set(key,n)}/> :
         key === "message" || key === "metaDescription" || key === "ogDescription" || key === "description" ? <Field key={key} label={human(key)}><textarea rows={4} value={v||""} onChange={e=>set(key,e.target.value)}/></Field> :
         <Input key={key} label={human(key)} value={v} type={typeof v === "number" ? "number" : String(v).startsWith("#") ? "color" : key.includes("start")||key.includes("end") ? "datetime-local" : "text"} set={(n:any)=>set(key,n)}/>)}
     </div>{["theme","appearance"].includes(kind)&&<button className="btn secondary" onClick={()=>c.setValue(focus ? {...value,...Object.fromEntries(appearanceFields[focus].map(key=>[key,defaults[kind][key]]))} : defaults[kind])}><RotateCcw size={16}/> Restore design defaults</button>}</section>}
    <Versions history={c.record.history} restore={(i:number)=>c.save("restore",undefined,i)}/>
  </>;
}
const human=(s:string)=>s.replace(/([A-Z])/g," $1").replace(/^./,x=>x.toUpperCase());
function NavigationEditor({ value, change }: any) {
  const key = value.main?.length ? "main" : "items";
  const items = value[key] || [];
  const update = (next: any[]) => change({ ...value, [key]: next });
  const edit = (index: number, patch: any) => update(items.map((item: any, i: number) => i === index ? { ...item, ...patch } : item));
  return <section className="card cc-panel">
    <h2>Menu items</h2>
    <p>Place an item under Courses, Books or Blog to show it in that dropdown. Published blog categories appear automatically.</p>
    <div className="cc-section-list">{items.map((item: any, i: number) => <div className="cc-menu-item" key={item.id || i}>
      <GripVertical size={18} />
      <Input label="Label" value={item.label} set={(label: string) => edit(i, { label })} />
      <Input label="Link" value={item.url} set={(url: string) => edit(i, { url })} />
      <Field label="Dropdown parent"><select value={item.parentId || ""} onChange={e => edit(i, { parentId: e.target.value })}>
        <option value="">Top level</option>
        {items.filter((candidate: any) => candidate.id && candidate.id !== item.id && !candidate.parentId).map((candidate: any) => <option key={candidate.id} value={candidate.id}>{candidate.label}</option>)}
      </select></Field>
      <Toggle label="Visible" value={item.visible} set={(visible: boolean) => edit(i, { visible })} />
      <Toggle label="New tab" value={item.newTab} set={(newTab: boolean) => edit(i, { newTab })} />
      <button className="icon-btn" aria-label={`Move ${item.label} up`} disabled={!i} onClick={() => { const next = [...items]; [next[i - 1], next[i]] = [next[i], next[i - 1]]; update(next); }}><ArrowUp size={15} /></button>
      <button className="icon-btn danger" aria-label={`Delete ${item.label}`} onClick={() => update(items.filter((_: any, j: number) => j !== i && _.parentId !== item.id))}><Trash2 size={15} /></button>
    </div>)}</div>
    <button className="btn secondary" onClick={() => update([...items, { id: crypto.randomUUID(), label: "New item", url: "/", visible: true, newTab: false, parentId: "" }])}><Plus size={16} /> Add menu item</button>
  </section>;
}
function PagesEditor({value,change}:any){const items=value.items||[];return <section className="card cc-panel"><h2>Website pages</h2>{items.length?items.map((x:any,i:number)=><div className="cc-page-editor" key={i}><div className="grid two"><Input label="Page title" value={x.title} set={(v:string)=>change({...value,items:items.map((a:any,j:number)=>j===i?{...a,title:v}:a)})}/><Input label="Slug" value={x.slug} set={(v:string)=>change({...value,items:items.map((a:any,j:number)=>j===i?{...a,slug:v}:a)})}/></div><Field label="Page content"><textarea rows={5} value={x.content||""} onChange={e=>change({...value,items:items.map((a:any,j:number)=>j===i?{...a,content:e.target.value}:a)})}/></Field><div className="actions"><Toggle label="Published" value={x.published} set={(v:boolean)=>change({...value,items:items.map((a:any,j:number)=>j===i?{...a,published:v}:a)})}/><button className="icon-btn danger" onClick={()=>change({...value,items:items.filter((_:any,j:number)=>j!==i)})}><Trash2 size={15}/></button></div></div>):<EmptyState title="No custom pages">Add a page when you need a new editable public page.</EmptyState>}<button className="btn secondary" onClick={()=>change({...value,items:[...items,{title:"Untitled page",slug:`page-${items.length+1}`,content:"",published:false}]})}><Plus size={16}/> Add page</button></section>}

export function MediaLibrary(){const {data,error,reload}=useData("admin/media");const [q,setQ]=useState(""),[kind,setKind]=useState("all"),[del,setDel]=useState<any>(null);const rows=useMemo(()=>data?.filter((x:any)=>(kind==="all"||(kind==="images"?x.mime.startsWith("image/"):x.mime==="application/pdf"))&&x.name.toLowerCase().includes(q.toLowerCase()))||[],[data,q,kind]);return <><div className="cc-heading"><div><div className="eyebrow">MEDIA</div><h1>Media Library</h1><p>Upload once, preview, search and reuse files across the website.</p></div></div><ErrorBox error={error}/><section className="card cc-panel"><div className="cc-media-toolbar"><div className="search-field"><Search size={17}/><input placeholder="Search media" value={q} onChange={e=>setQ(e.target.value)}/></div><select value={kind} onChange={e=>setKind(e.target.value)}><option value="all">All files</option><option value="images">Images</option><option value="pdf">PDFs</option></select><MediaUpload kind="blog" value={null} onChange={()=>reload()} successMessage="File uploaded"/></div>{!data?<Loading/>:<div className="cc-media-grid">{rows.map((x:any)=><article key={x.id}><a href={`/api/files/${x.id}`} target="_blank" rel="noreferrer">{x.mime.startsWith("image/")?<img src={`/api/files/${x.id}`} alt=""/>:<FileText size={45}/>}</a><b title={x.name}>{x.name}</b><small>{x.mime.replace("application/","")} · {date(x.created_at)}</small><div><button className="btn secondary small" onClick={()=>navigator.clipboard.writeText(x.id).then(()=>toast.success("Media reference copied"))}><Copy size={14}/> Reuse</button><button className="icon-btn danger" onClick={()=>setDel(x)}><Trash2 size={14}/></button></div></article>)}</div>}</section><Confirm open={!!del} onOpenChange={()=>setDel(null)} title="Delete this file?" description="Files currently used by the website are protected and will not be deleted." action="Delete" onConfirm={async()=>{await api(`admin/media/${del.id}`,{},"DELETE");setDel(null);reload();toast.success("File deleted")}}/></>}

export function ActivityLogs(){const [search,setSearch]=useState(""),[result,setResult]=useState("");const {data,error}=useData(`admin/logs?search=${encodeURIComponent(search)}&result=${result}`);return <><div className="cc-heading"><div><div className="eyebrow">SYSTEM</div><h1>Activity Logs</h1><p>A searchable chronological record of important administrative actions and results.</p></div><div className="toolbar"><input placeholder="Search user, action or item" value={search} onChange={e=>setSearch(e.target.value)}/><select value={result} onChange={e=>setResult(e.target.value)}><option value="">All results</option><option value="success">Success</option><option value="failed">Failed</option></select></div></div><ErrorBox error={error}/>{!data?<Loading/>:<section className="card cc-panel"><div className="cc-log-list">{data.map((x:any)=><div key={x.id}><ShieldCheck size={17}/><span><b>{x.action.replaceAll("_"," ")}</b><small>{x.admin} · {x.target} · {x.result}</small></span><time>{date(x.created_at)}</time></div>)}</div></section>}</>}

export function AdminUsers(){const {data,error,reload}=useData("admin/users");const [form,setForm]=useState({username:"",password:"",role:"editor"}),[remove,setRemove]=useState<any>(null);const roles=["content_manager","exam_manager","order_manager","editor"];return <><div className="cc-heading"><div><div className="eyebrow">ACCESS CONTROL</div><h1>Admin Users</h1><p>Add, edit, deactivate, remove and reset accountable admin access.</p></div></div><ErrorBox error={error}/><div className="cc-split"><section className="card cc-panel"><h2><UserPlus size={19}/> Add admin user</h2><Input label="Username" value={form.username} set={(v:string)=>setForm({...form,username:v})}/><Input label="Temporary password (14+ characters)" type="password" value={form.password} set={(v:string)=>setForm({...form,password:v})}/><Field label="Role"><select value={form.role} onChange={e=>setForm({...form,role:e.target.value})}>{roles.map(x=><option value={x} key={x}>{human(x)}</option>)}</select></Field><ActionButton action={async()=>{await api("admin/users",form);setForm({username:"",password:"",role:"editor"});reload();toast.success("Admin user created")}}><Plus size={16}/> Create user</ActionButton></section><section className="card cc-panel"><h2>Current users</h2>{!data?<Loading/>:<div className="cc-users">{data.map((x:any)=><div key={x.id}><span><b>{x.username}</b><small>{human(x.role)} · {x.active?"Active":"Inactive"} · Last login: {x.last_login_at?date(x.last_login_at):"Never"}{x.must_change?" · password change required":""}</small></span>{x.role!=="super_admin"&&<><select value={x.role} onChange={async e=>{await api(`admin/users/${x.id}`,{role:e.target.value},"PATCH");reload();toast.success("Role updated")}}>{roles.map(r=><option value={r} key={r}>{human(r)}</option>)}</select><button className="btn secondary small" onClick={async()=>{const password=window.prompt("New temporary password (14+ characters)");if(password){await api(`admin/users/${x.id}`,{resetPassword:password},"PATCH");reload();toast.success("Access reset")}}}>Reset Access</button><button className="btn secondary small" onClick={async()=>{await api(`admin/users/${x.id}`,{active:!x.active},"PATCH");reload();toast.success(x.active?"Admin deactivated":"Admin activated")}}>{x.active?"Deactivate":"Activate"}</button><button className="icon-btn danger" onClick={()=>setRemove(x)}><Trash2 size={15}/></button></>}</div>)}</div>}</section></div><Confirm open={!!remove} onOpenChange={()=>setRemove(null)} title="Remove this admin user?" description="Their sessions will end immediately. Activity history will be preserved." action="Remove" onConfirm={async()=>{await api(`admin/users/${remove.id}`,undefined,"DELETE");setRemove(null);reload();toast.success("Admin removed")}}/></>}

export function RolesManager(){const {data,error,reload}=useData("admin/roles"),[roles,setRoles]=useState<any>(null);useEffect(()=>{if(data&&!roles)setRoles(data.roles)},[data]);const modules=["dashboard","team","notices","notes","study","blogs","reviews","books","courses","exams","packages","codes","orders","payments","coupons","pricing","commerce-dashboard","media","upload","control","seo","logs"];if(!roles)return <><ErrorBox error={error}/><Loading/></>;return <><div className="cc-heading"><div><div className="eyebrow">SYSTEM</div><h1>Roles & Permissions</h1><p>Grant or remove access to an entire module. Access includes viewing and managing that module; action-specific permissions are not available.</p></div><ActionButton action={async()=>{await api("admin/roles",{roles},"PATCH");reload();toast.success("Permissions saved")}}>Save Permissions</ActionButton></div><section className="card cc-panel role-matrix"><table><thead><tr><th>Module access</th>{Object.keys(roles).map(r=><th key={r}>{human(r)}</th>)}</tr></thead><tbody>{modules.map(m=><tr key={m}><td>{human(m)}</td>{Object.entries(roles).map(([r,allowed]:any)=><td key={r}><input type="checkbox" disabled={r==="super_admin"} checked={r==="super_admin"||allowed.includes("*")||allowed.includes(m)} onChange={e=>setRoles({...roles,[r]:e.target.checked?[...new Set([...allowed,m])]:allowed.filter((x:string)=>x!==m)})}/></td>)}</tr>)}</tbody></table></section></>}

export function VersionHistoryPage(){
  const kinds=["pages","homepage","navigation","header","footer","theme","appearance","responsive","seo","commerce","site","maintenance"];
  const [records,setRecords]=useState<any[]>([]),[error,setError]=useState(""),[detail,setDetail]=useState<any>(null);
  const load=async()=>{
    const results=await Promise.allSettled(kinds.map(async kind=>({kind,...await api(`admin/control/${kind}`)})));
    setRecords(results.filter((r):r is PromiseFulfilledResult<any>=>r.status==="fulfilled").map(r=>r.value));
    setError(results.some(r=>r.status==="rejected")?"Some sections could not be loaded. Available history is shown below.":"");
  };
  useEffect(()=>{void load()},[]);
  const compare=(v:any)=>{
    const history=records.find(x=>x.kind===v.kind)?.history||[],older=history[v.index+1]?.data;
    if(!older){setDetail({title:"No earlier version",message:"There is no previous saved version for this section."});return}
    const keys=[...new Set([...Object.keys(older),...Object.keys(v.data||{})])];
    const changed=keys.filter(key=>JSON.stringify(older[key])!==JSON.stringify(v.data?.[key]));
    setDetail({title:`${human(v.kind)} · changes`,changes:changed.map(key=>({key,before:older[key],after:v.data?.[key]}))});
  };
  return <><div className="cc-heading"><div><div className="eyebrow">SYSTEM</div><h1>Version History</h1><p>Inspect saved settings, compare changes and restore a previous version.</p></div></div>
    <ErrorBox error={error}/>{!records.length&&!error?<Loading/>:<section className="card cc-panel cc-version-list">{records.flatMap(record=>(record.history||[]).map((v:any,index:number)=>({...v,kind:record.kind,index}))).sort((a:any,b:any)=>b.at-a.at).map((v:any)=><div key={`${v.kind}-${v.index}-${v.at}`}><span><b>{human(v.kind)} · {date(v.at)}</b><small>Published by {v.admin}</small></span><button className="btn secondary small" onClick={()=>setDetail({title:`${human(v.kind)} · ${date(v.at)}`,data:v.data})}>View</button><button className="btn secondary small" onClick={()=>compare(v)}>Compare</button><ActionButton className="btn small" action={async()=>{if(!window.confirm(`Restore this ${human(v.kind)} version?`))return;await api(`admin/control/${v.kind}`,{action:"restore",version:v.index},"PATCH");await load();toast.success("Version restored")}}>Restore</ActionButton></div>)}</section>}
    <Dialog open={!!detail} onOpenChange={open=>!open&&setDetail(null)}><DialogContent className="cc-history-dialog"><DialogHeader><DialogTitle>{detail?.title}</DialogTitle></DialogHeader><div className="cc-history-body">{detail?.message?<p>{detail.message}</p>:detail?.changes?<>{detail.changes.length?detail.changes.map((change:any)=><section key={change.key}><h3>{human(change.key)}</h3><div className="cc-history-values"><div><b>Previous</b><pre>{JSON.stringify(change.before,null,2)??"Not set"}</pre></div><div><b>Selected</b><pre>{JSON.stringify(change.after,null,2)??"Not set"}</pre></div></div></section>):<p>No changes from the previous version.</p>}</>:<pre>{JSON.stringify(detail?.data,null,2)}</pre>}</div></DialogContent></Dialog>
  </>;
}

export function BackupManager(){const [file,setFile]=useState<File|null>(null);return <><div className="cc-heading"><div><div className="eyebrow">SYSTEM</div><h1>Backups & Import / Export</h1><p>Download website configuration and content snapshots. Imports restore settings only, protecting transactional data.</p></div></div><div className="cc-split"><section className="card cc-panel"><FileArchive size={38}/><h2>Manual backup</h2><p>Includes website settings and core content. Passwords, sessions, access codes and payment tokens are excluded.</p><a className="btn" href="/api/admin/backup"><Upload size={16}/> Export backup</a></section><section className="card cc-panel"><h2>Import settings</h2><p>Only site and Control Center configuration entries are imported.</p><input type="file" accept="application/json" onChange={e=>setFile(e.target.files?.[0]||null)}/><ActionButton disabled={!file} action={async()=>{if(!file)return;const parsed=JSON.parse(await file.text());await api("admin/backup",{settings:parsed.settings});toast.success("Settings imported")}}>Import settings</ActionButton></section></div></>}

export function DeliveryPricingManager(){
  const {data,error,reload}=useData("admin/pricing"),[form,setForm]=useState<any>(null);
  useEffect(()=>{if(data)setForm({delivery:Object.fromEntries(Object.entries(data.delivery).map(([k,v]:any)=>[k,String(v/100)])),products:data.products.map((x:any)=>({...x,price:String(x.price/100),old_price:x.old_price==null?"":String(x.old_price/100)}))})},[data]);
  const changeProduct=(id:string,type:string,key:string,value:string)=>setForm({...form,products:form.products.map((x:any)=>x.id===id&&x.type===type?{...x,[key]:value}:x)});
  return <><div className="cc-heading"><div><div className="eyebrow">COMMERCE</div><h1>Delivery &amp; Pricing</h1><p>Set every delivery charge and manage the current price of every book, course and exam package.</p></div>{form&&<ActionButton action={async()=>{await api("admin/pricing",{delivery:Object.fromEntries(Object.entries(form.delivery).map(([k,v]:any)=>[k,cash(v)])),products:form.products.map((x:any)=>({id:x.id,type:x.type,price:cash(x.price),old_price:x.old_price?cash(x.old_price):null}))},"PATCH");reload();toast.success("Delivery charges and product prices updated")}}><Save size={16}/> Save All Prices</ActionButton>}</div><ErrorBox error={error}/>{!form?<Loading/>:<><section className="card cc-panel"><h2>Delivery charges</h2><div className="grid three">{[["sundarban","Sundarban Courier"],["dhaka","Home Delivery Within Dhaka"],["outside","Home Delivery Outside Dhaka"]].map(([key,label])=><Input key={key} label={`${label} (BDT)`} value={form.delivery[key]} set={(v:string)=>setForm({...form,delivery:{...form.delivery,[key]:v}})}/>)}</div></section><section className="table-card pricing-table"><table><thead><tr><th>Product</th><th>Type</th><th>Current Price (BDT)</th><th>Previous Price (BDT)</th></tr></thead><tbody>{form.products.map((x:any)=><tr key={`${x.type}:${x.id}`}><td><b>{x.title}</b></td><td><span className="badge">{human(x.type)}</span></td><td><input inputMode="decimal" aria-label={`${x.title} price`} value={x.price} onChange={e=>changeProduct(x.id,x.type,"price",e.target.value)}/></td><td><input inputMode="decimal" aria-label={`${x.title} previous price`} placeholder="Optional" value={x.old_price} onChange={e=>changeProduct(x.id,x.type,"old_price",e.target.value)}/></td></tr>)}</tbody></table></section></>}</>;
}

export function CommerceDashboard(){const {data,error}=useData("admin/commerce-dashboard");return <><div className="cc-heading"><div><div className="eyebrow">COMMERCE</div><h1>Commerce Dashboard</h1><p>Orders, sales, payments and delivery status at a glance.</p></div></div><ErrorBox error={error}/>{!data?<Loading/>:<div className="stats-grid">{[["Total Orders","total_orders"],["Pending Orders","pending_orders"],["Hardcopy Orders","hardcopy_orders"],["Softcopy Orders","softcopy_orders"],["Course Orders","course_orders"],["Today’s Sales","today_sales"],["Paid Amount","paid_amount"],["Pending Payment","pending_payment"],["Delivered Orders","delivered_orders"]].map(([label,key])=><div className="stat" key={key}><span>{label}</span><strong>{key.includes("sales")||key.includes("amount")||key.includes("payment")?money(data[key]):Number(data[key]||0).toLocaleString()}</strong></div>)}</div>}</>}

export function PaymentsManager(){const [search,setSearch]=useState(""),[status,setStatus]=useState(""),[edit,setEdit]=useState<any>(null),[remove,setRemove]=useState<any>(null);const {data,error,reload}=useData(`admin/payments?search=${encodeURIComponent(search)}&status=${status}`);return <><div className="cc-heading"><div><div className="eyebrow">COMMERCE</div><h1>Payments</h1><p>Verify, reject and record full or partial refunds without duplicate payment records.</p></div><div className="toolbar wrap"><input placeholder="Payment, order, customer or TrxID" value={search} onChange={e=>setSearch(e.target.value)}/><select value={status} onChange={e=>setStatus(e.target.value)}><option value="">All statuses</option>{["pending","paid","failed","refunded","partially_refunded"].map(x=><option key={x} value={x}>{human(x)}</option>)}</select></div></div><ErrorBox error={error}/>{!data?<Loading/>:<section className="table-card"><table><thead><tr>{["Payment / Order","Customer","Amount","Method / TrxID","Status","Date / Time","Manage"].map(x=><th key={x}>{x}</th>)}</tr></thead><tbody>{data.map((x:any)=><tr key={x.id}><td><b>{x.id}</b><small className="block muted">{x.order_id} · {human(x.order_type)}</small></td><td>{x.customer}</td><td>{money(x.amount)}{x.refund_amount>0&&<small className="block muted">Refund: {money(x.refund_amount)}</small>}</td><td>{human(x.method)}<small className="block muted">{x.transaction_id}</small></td><td><span className="badge">{human(x.status)}</span></td><td>{date(x.created_at)}</td><td><div className="table-actions"><button className="text-link" onClick={()=>setEdit({...x,refund_amount:String((x.refund_amount||0)/100)})}>Manage</button><button className="icon-btn danger" aria-label={`Delete payment ${x.id}`} onClick={()=>setRemove(x)}><Trash2 size={16}/></button></div></td></tr>)}</tbody></table></section>}<Dialog open={!!edit} onOpenChange={v=>!v&&setEdit(null)}><DialogContent><DialogHeader><DialogTitle>Manage Payment</DialogTitle></DialogHeader>{edit&&<div><Field label="Status"><select value={edit.status} onChange={e=>setEdit({...edit,status:e.target.value})}>{["pending","paid","failed","refunded","partially_refunded"].map(x=><option value={x} key={x}>{human(x)}</option>)}</select></Field><Input label="Transaction ID" value={edit.transaction_id} set={(v:string)=>setEdit({...edit,transaction_id:v})}/><Input label="Refund amount (BDT)" value={edit.refund_amount} set={(v:string)=>setEdit({...edit,refund_amount:v})}/><Field label="Admin note"><textarea rows={4} value={edit.admin_note||""} onChange={e=>setEdit({...edit,admin_note:e.target.value})}/></Field><ActionButton action={async()=>{await api(`admin/payments/${edit.id}`,{status:edit.status,transaction_id:edit.transaction_id,refund_amount:cash(edit.refund_amount||"0"),admin_note:edit.admin_note||""},"PATCH");setEdit(null);reload();toast.success("Payment updated")}}>Save Payment</ActionButton></div>}</DialogContent></Dialog><Confirm open={!!remove} onOpenChange={(open:boolean)=>!open&&setRemove(null)} title="Remove this payment from the list?" description="The linked order and its verification status remain available. This payment entry will be hidden from Payments." action="Delete Payment" onConfirm={async()=>{await api(`admin/payments/${remove.id}`,undefined,"DELETE");setRemove(null);reload();toast.success("Payment removed")}}/></>}

export function CouponManager(){const {data,error,reload}=useData("admin/coupons"),[edit,setEdit]=useState<any>(null),[remove,setRemove]=useState<any>(null);const fresh={code:"",discount_type:"fixed",discount_value:"0",minimum_order:"0",maximum_discount:"",starts_at:"",expires_at:"",usage_limit:"",per_user_limit:1,applies_to:["entire_store"],product_ids:[],active:true};const save=async()=>{await api(`admin/coupons${edit.id?`/${edit.id}`:""}`,{...edit,discount_value:edit.discount_type==="percentage"?Math.round(Number(edit.discount_value)*100):cash(edit.discount_value),minimum_order:cash(edit.minimum_order),maximum_discount:edit.maximum_discount?cash(edit.maximum_discount):null,starts_at:edit.starts_at?new Date(edit.starts_at).getTime():null,expires_at:edit.expires_at?new Date(edit.expires_at).getTime():null,usage_limit:edit.usage_limit?Number(edit.usage_limit):null,per_user_limit:Number(edit.per_user_limit),product_ids:edit.product_ids||[]},edit.id?"PATCH":"POST");setEdit(null);reload();toast.success("Coupon saved")};return <><div className="cc-heading"><div><div className="eyebrow">COMMERCE</div><h1>Coupons</h1><p>Create validated discounts for selected order types or the whole store.</p></div><button className="btn" onClick={()=>setEdit(fresh)}><Plus size={16}/> Add Coupon</button></div><ErrorBox error={error}/>{!data?<Loading/>:<section className="table-card"><table><thead><tr>{["Code","Discount","Applies to","Usage","Status","Manage"].map(x=><th key={x}>{x}</th>)}</tr></thead><tbody>{data.map((x:any)=><tr key={x.id}><td><b>{x.code}</b></td><td>{x.discount_type==="percentage"?`${x.discount_value/100}%`:money(x.discount_value)}</td><td>{JSON.parse(x.applies_to||"[]").map(human).join(", ")}</td><td>{x.times_used}{x.usage_limit?` / ${x.usage_limit}`:""}<small className="block muted">Given: {money(x.total_discount)}</small></td><td>{x.active?"Active":"Inactive"}</td><td><button className="text-link" onClick={()=>setEdit({...x,discount_value:x.discount_type==="percentage"?String(x.discount_value/100):String(x.discount_value/100),minimum_order:String(x.minimum_order/100),maximum_discount:x.maximum_discount==null?"":String(x.maximum_discount/100),starts_at:x.starts_at?new Date(x.starts_at).toISOString().slice(0,16):"",expires_at:x.expires_at?new Date(x.expires_at).toISOString().slice(0,16):"",applies_to:JSON.parse(x.applies_to||"[]"),product_ids:JSON.parse(x.product_ids||"[]")})}>Edit</button><button className="icon-btn danger" onClick={()=>setRemove(x)}><Trash2 size={15}/></button></td></tr>)}</tbody></table></section>}<Dialog open={!!edit} onOpenChange={v=>!v&&setEdit(null)}><DialogContent className="wide-dialog"><DialogHeader><DialogTitle>{edit?.id?"Edit":"Add"} Coupon</DialogTitle></DialogHeader>{edit&&<div className="grid two"><Input label="Coupon code" value={edit.code} set={(v:string)=>setEdit({...edit,code:v.toUpperCase()})}/><Field label="Discount type"><select value={edit.discount_type} onChange={e=>setEdit({...edit,discount_type:e.target.value})}><option value="fixed">Fixed Discount</option><option value="percentage">Percentage Discount</option></select></Field><Input label={edit.discount_type==="percentage"?"Percentage":"Fixed discount (BDT)"} value={edit.discount_value} set={(v:string)=>setEdit({...edit,discount_value:v})}/><Input label="Minimum order (BDT)" value={edit.minimum_order} set={(v:string)=>setEdit({...edit,minimum_order:v})}/><Input label="Maximum discount (BDT)" value={edit.maximum_discount} set={(v:string)=>setEdit({...edit,maximum_discount:v})}/><Input label="Usage limit" value={edit.usage_limit} set={(v:string)=>setEdit({...edit,usage_limit:v})}/><Input label="Per-user limit" value={edit.per_user_limit} set={(v:string)=>setEdit({...edit,per_user_limit:v})}/><Input label="Start date" type="datetime-local" value={edit.starts_at} set={(v:string)=>setEdit({...edit,starts_at:v})}/><Input label="Expiry date" type="datetime-local" value={edit.expires_at} set={(v:string)=>setEdit({...edit,expires_at:v})}/><div className="span-two"><b>Apply to</b><div className="multi-create-options">{[["hardcopy","Hardcopy Books"],["softcopy","Softcopy Books"],["course","Courses / Complete Package"],["package","Exam Packages"],["selected_products","Selected Products"],["entire_store","Entire Store"]].map(([v,l])=><label key={v}><input type="checkbox" checked={edit.applies_to.includes(v)} onChange={e=>setEdit({...edit,applies_to:e.target.checked?[...new Set([...edit.applies_to,v])]:edit.applies_to.filter((x:string)=>x!==v)})}/>{l}</label>)}</div></div><Toggle label="Active" value={edit.active} set={(v:boolean)=>setEdit({...edit,active:v})}/><ActionButton action={save}>Save Coupon</ActionButton></div>}</DialogContent></Dialog><Confirm open={!!remove} onOpenChange={()=>setRemove(null)} title="Delete this coupon?" description="The coupon will no longer be accepted at checkout." action="Delete" onConfirm={async()=>{await api(`admin/coupons/${remove.id}`,undefined,"DELETE");setRemove(null);reload();toast.success("Coupon deleted")}}/></>}
