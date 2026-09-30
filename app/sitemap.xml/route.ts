import { all, seoConfig, seoInventory } from "@/lib/server";
export const dynamic = "force-dynamic";
const escapeXml=(value:string)=>value.replace(/[<>&'\"]/g,(c)=>({"<":"&lt;",">":"&gt;","&":"&amp;","'":"&apos;",'"':"&quot;"}[c]!));
export async function GET(){
  const config=await seoConfig();
  if(config.sitemap.enabled===false)return new Response("Sitemap is disabled.",{status:404});
  const domain=String(config.global.canonicalDomain||"https://lexveritasacademy.sites.bd").replace(/\/$/,"");
  const allowed:Record<string,boolean>={page:config.sitemap.pages!==false,book:config.sitemap.books!==false,course:config.sitemap.courses!==false,package:config.sitemap.packages!==false,note:config.sitemap.notes!==false,notice:config.sitemap.notices!==false,blog:config.sitemap.blogs!==false};
  const items=(await seoInventory()).filter((x:any)=>x.published&&x.indexable&&allowed[x.type]!==false);
  const urls=new Map<string,number>();
  for(const item of items)urls.set(item.path,Number(item.seo_updated_at||item.updated_at||0));
  if(config.sitemap.categories!==false&&config.sitemap.notes!==false){
    const rows=await all("SELECT category FROM notes WHERE published=1");
    for(const row of rows){let values:any[]=[];try{const p=JSON.parse(row.category);values=Array.isArray(p)?p:[row.category]}catch{values=[row.category]}for(const value of values.filter(Boolean))urls.set(`/notes/${encodeURIComponent(value)}`,0);}
  }
  const xml=["<?xml version=\"1.0\" encoding=\"UTF-8\"?>","<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">",...[...urls].map(([path,updated])=>`<url><loc>${escapeXml(`${domain}${path}`)}</loc>${updated?`<lastmod>${new Date(updated).toISOString()}</lastmod>`:""}</url>`),"</urlset>"].join("");
  return new Response(xml,{headers:{"Content-Type":"application/xml; charset=utf-8","Cache-Control":"public, max-age=300"}});
}
