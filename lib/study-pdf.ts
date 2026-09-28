const escape=(value:any)=>String(value??"");
const mixed=(value:any)=>escape(value).split(/([\u0980-\u09ff\u200c\u200d]+)/).filter(Boolean).map(part=>({text:part,font:/[\u0980-\u09ff]/.test(part)?"Bengali":"Latin"}));
export async function studyPdf(plan:any,user:any,kind:"initial"|"current"|"progress",pdfSettings:any={}){
  const [module,bengali,latin]=await Promise.all([import("pdfmake/build/pdfmake"),fetch("/fonts/NotoSansBengali-Regular.ttf"),fetch("/fonts/Latin-Regular.ttf")]);
  if(!bengali.ok||!latin.ok)throw Error("PDF fonts are unavailable.");
  const encode=async(response:Response)=>{const bytes=new Uint8Array(await response.arrayBuffer());let binary="";for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.slice(i,i+8192));return btoa(binary)};
  const pdf:any=(module as any).default||module;
  pdf.addVirtualFileSystem({"Bengali.ttf":await encode(bengali),"Latin.ttf":await encode(latin)});
  pdf.fonts={Latin:{normal:"Latin.ttf",bold:"Latin.ttf",italics:"Latin.ttf",bolditalics:"Latin.ttf"},Bengali:{normal:"Bengali.ttf",bold:"Bengali.ttf",italics:"Bengali.ttf",bolditalics:"Bengali.ttf"}};
  const rows=plan.tasks.filter((t:any)=>t.status!=="deleted").map((t:any)=>{
    const date=kind==="initial"?t.original_date:t.due_date,status=kind==="initial"?"Pending":t.status.replaceAll("_"," ");
    return [date,new Intl.DateTimeFormat("en-BD",{weekday:"short",timeZone:"UTC"}).format(new Date(date+"T12:00:00Z")),t.subject_snapshot,t.reference_snapshot||t.title_snapshot,t.title_snapshot,status,t.notes||""].map(value=>({text:mixed(value),margin:[3,5,3,5],fontSize:8}));
  });
  const accent=/^#[0-9a-fA-F]{6}$/.test(pdfSettings.accent||"")?pdfSettings.accent:"#123b4b";
  const doc:any={pageSize:"A4",pageOrientation:"landscape",pageMargins:[30,58,30,52],defaultStyle:{font:"Latin",fontSize:9,color:"#173846"},info:{title:`LexVeritas Academy - ${plan.title}`,author:"LexVeritas Academy"},header:()=>({text:"LexVeritas Academy",color:accent,fontSize:15,bold:true,margin:[30,20,30,0]}),content:[
    {text:mixed(pdfSettings.title||"Make Your Study Routine"),fontSize:18,bold:true,color:accent,margin:[0,0,0,9]},
    {columns:[{text:["Student: ",...mixed(user.name),"\nUniversity: ",...mixed(user.university)]},{text:["Plan: ",...mixed(plan.title),`\n${plan.curriculum_id.toUpperCase()} · ${plan.start_date} to ${plan.end_date}`]}],margin:[0,0,0,14]},
    ...(kind==="progress"?[{text:`Progress: ${plan.progress.percent}% · Completed ${plan.progress.completed}/${plan.progress.total} · Carried Forward ${plan.progress.carried}`,margin:[0,0,0,10],bold:true}]:[]),
    {table:{headerRows:1,dontBreakRows:true,widths:[64,36,96,100,"*",67,70],body:[["Date","Day","Subject","Topic / Provision","Target","Status","Remarks"].map(v=>({text:v,color:"#ffffff",fillColor:accent,bold:true,margin:[3,6,3,6],fontSize:8})),...rows]},layout:{hLineColor:()=>"#dce6e9",vLineColor:()=>"#dce6e9",fillColor:(row:number)=>row>0&&row%2===0?"#f2f7f8":null}}
  ],footer:(page:number,pages:number)=>({columns:[{text:pdfSettings.footer||"LexVeritas Academy",margin:[30,0,0,0]},{text:`Page ${page} / ${pages}`,alignment:"right",margin:[0,0,30,0]}],fontSize:8,color:"#536b77",margin:[0,18,0,0]})};
  if(!rows.length)throw Error("This routine has no targets to export.");
  await new Promise<void>((resolve,reject)=>{try{pdf.createPdf(doc).getBlob((blob:Blob)=>{const url=URL.createObjectURL(blob),link=document.createElement("a");link.href=url;link.download=`LexVeritas-${plan.curriculum_id.toUpperCase()}-${kind}-${plan.id}.pdf`;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);resolve()})}catch(e){reject(e)}});
}
