import { seoConfig } from "@/lib/server";
export const dynamic = "force-dynamic";
export async function GET(){
  const config=await seoConfig(),domain=String(config.global.canonicalDomain||"https://lexveritasacademy.sites.bd").replace(/\/$/,"");
  const protectedPaths=["/admin","/api","/attempts","/orders","/checkout","/track-order"];
  const configured=Array.isArray(config.robots.blockedPaths)?config.robots.blockedPaths:[];
  const blocked=[...new Set([...protectedPaths,...configured].map((x:string)=>`/${String(x).replace(/^\/+/,"")}`))];
  const lines=["User-agent: *",...(config.robots.defaultIndex===false?["Disallow: /"]:blocked.map((x:string)=>`Disallow: ${x}`)),...(config.robots.sitemapDeclaration!==false?[`Sitemap: ${domain}/sitemap.xml`]:[])];
  return new Response(`${lines.join("\n")}\n`,{headers:{"Content-Type":"text/plain; charset=utf-8","Cache-Control":"public, max-age=300"}});
}
