import Site from "../site";
import type { Metadata } from "next";
import { one, publicHomeData, publicSiteSettings, seoConfig, seoEntryForPath } from "@/lib/server";
import { notFound, redirect } from "next/navigation";
export const dynamic = "force-dynamic";
const fallbackSiteUrl = "https://lexveritasacademy.sites.bd";
const decodePart = (part:string) => { try { return decodeURIComponent(part); } catch { return part; } };
const pathOf = (slug:string[]) => `/${slug.join("/")}`.replace(/\/$/,"") || "/";
const imageUrl=(siteUrl:string,image?:string|null)=>!image?"":/^https?:\/\//i.test(image)?image:image.startsWith("/")?`${siteUrl}${image}`:`${siteUrl}/api/files/${image}`;
const pageMetadata = (config:any,title:string,description:string,href:string,image?:string|null,entry?:any): Metadata => {
  const siteUrl=String(config.global.canonicalDomain||fallbackSiteUrl).replace(/\/$/,"");
  const pageTitle=entry?.seo_title||title||config.global.defaultMetaTitle;
  const renderedTitle=href==="/"?pageTitle:String(config.global.titleTemplate||"%page_title% | LexVeritas Academy").replaceAll("%page_title%",pageTitle).replaceAll("%site_name%",config.global.siteName);
  const metaDescription=entry?.meta_description||description||config.global.defaultMetaDescription;
  const ogTitle=entry?.og_title||pageTitle||config.social.ogTitle;
  const ogDescription=entry?.og_description||metaDescription||config.social.ogDescription;
  const socialImage=imageUrl(siteUrl,entry?.social_image||image||`${siteUrl}/share-card?path=${encodeURIComponent(href)}`);
  const canonical=entry?.canonical_url||`${siteUrl}${href}`;
  const other:Record<string,string>={};
  if(config.verification?.bing)other["msvalidate.01"]=config.verification.bing;
  if(config.verification?.otherName&&config.verification?.otherCode)other[config.verification.otherName]=config.verification.otherCode;
  return {title:renderedTitle,description:metaDescription,keywords:config.global.defaultKeywords||undefined,alternates:{canonical},robots:{index:entry?.indexable==null?config.global.defaultIndex:!!entry.indexable,follow:entry?.follow_links==null?config.global.defaultFollow:!!entry.follow_links},openGraph:{title:ogTitle,description:ogDescription,url:canonical,siteName:config.global.siteName,type:"website",...(socialImage?{images:[{url:socialImage}]}:{images:[]})},twitter:{card:socialImage?(config.social.twitterCard||"summary_large_image"):"summary",title:ogTitle,description:ogDescription,...(socialImage?{images:[socialImage]}:{images:[]})},verification:config.verification?.google?{google:config.verification.google}:undefined,other};
};
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}): Promise<Metadata> {
  const { slug: rawSlug = [] } = await params;
  const slug = rawSlug.map(decodePart);
  let config:any; try{config=await seoConfig()}catch{config={global:{canonicalDomain:fallbackSiteUrl,siteName:"LexVeritas Academy",defaultMetaTitle:"LexVeritas Academy",defaultMetaDescription:"Legal education, MCQ examinations and law books.",titleTemplate:"%page_title% | LexVeritas Academy",defaultIndex:true,defaultFollow:true},social:{},verification:{}}}
  const href=pathOf(slug); let entry:any=null; try{entry=await seoEntryForPath(href)}catch{}
  if (slug[0] === "blog" && slug[1]) {
    try {
      const article = await one(
        "SELECT title,seo_title,excerpt,meta_description,thumbnail FROM blogs WHERE slug=? AND published=1",
        slug[1],
      );
      if (article)
        return pageMetadata(config,article.seo_title || article.title, article.meta_description || article.excerpt || article.title, href, article.thumbnail,entry);
    } catch {}
  }
  try {
    if (slug[0] === "books" && slug[1]) {
      const item = await one("SELECT title,description,cover FROM books WHERE id=? AND published=1", slug[1]);
      if (item) return pageMetadata(config,item.title, item.description || "Explore this LexVeritas Academy book.", href, item.cover,entry);
    }
    if (slug[0] === "courses" && slug[1]) {
      const item = await one("SELECT name,description,thumbnail FROM courses WHERE id=? AND published=1", slug[1]);
      if (item) return pageMetadata(config,item.name, item.description || "Explore this LexVeritas Academy course.", href, item.thumbnail,entry);
    }
    if (slug[0] === "packages" && slug[1]) {
      const item = await one("SELECT title,description,thumbnail FROM exam_packages WHERE id=? AND published=1", slug[1]);
      if (item) return pageMetadata(config,item.title, item.description || "Explore this LexVeritas Academy exam package.", href, item.thumbnail,entry);
    }
    if (slug[0] === "notes" && slug[1] === "item" && slug[2]) {
      const item = await one("SELECT title,description,thumbnail FROM notes WHERE id=? AND published=1", slug[2]);
      if (item) return pageMetadata(config,item.title, item.description || "Read this LexVeritas Academy study note.", href, item.thumbnail,entry);
    }
    if (slug[0] === "notices" && slug[1]) {
      const item = await one("SELECT n.title,n.content,CASE WHEN f.mime LIKE 'image/%' THEN n.attachment ELSE NULL END image FROM notices n LEFT JOIN files f ON f.id=n.attachment WHERE n.id=? AND n.published=1", slug[1]);
      if (item) return pageMetadata(config,item.title, String(item.content||"").slice(0,320), href, item.image,entry);
    }
  } catch {}
  const name: Record<string, string> = {
    exams: "MCQ Exams",
    books: "Books",
    cart: "Cart",
    checkout: "Checkout",
    contact: "Contact Us",
    about: "About",
    admin: "Admin",
    blog: "Blog",
    authors: "Authors",
    notices: "Notices",
    notes: "Notes",
    courses: "Courses",
    packages: "Exam Packages",
    "track-order": "Track Your Order",
    "write-a-blog": "Write A Blog",
    "study-routine": "Make Your Study Routine",
    faq: "Frequently Asked Questions",
    "privacy-policy": "Privacy Policy",
    "terms-and-conditions": "Terms & Conditions",
    "refund-policy": "Refund Policy",
    "shipping-delivery-policy": "Shipping & Delivery Policy",
    "digital-product-policy": "Digital Product Policy",
  };
  const blocked=["admin", "attempts", "orders", "checkout", "track-order", "bd-laws-ai", "study-routine"].includes(slug[0]);
  const meta=pageMetadata(config,slug.length?(name[slug[0]]||"LexVeritas Academy"):config.global.defaultMetaTitle,config.global.defaultMetaDescription,href,undefined,entry);
  if(blocked)meta.robots={index:false,follow:false};
  return meta;
}
export default async function Page({params}:{params:Promise<{slug?:string[]}>}) {
  const {slug:rawSlug=[]}=await params;const slug=rawSlug.map(decodePart);const href=pathOf(slug);
  if (slug[0] === "bd-laws-ai") notFound();
  let initialSettings:any=null, initialHomeData:any=null;
  if (!slug.length) {
    const values=await Promise.allSettled([publicSiteSettings(),publicHomeData()]);
    if(values[0].status==="fulfilled")initialSettings=values[0].value;
    if(values[1].status==="fulfilled")initialHomeData=values[1].value;
  }
  try{const rule=await one("SELECT new_url,status_code FROM seo_redirects WHERE old_url=? AND active=1",href);if(rule)redirect(rule.new_url)}catch(error:any){if(error?.digest?.startsWith("NEXT_REDIRECT"))throw error;}
  let jsonLd:any=null;
  try{
    const config=await seoConfig(),siteUrl=String(config.global.canonicalDomain||fallbackSiteUrl).replace(/\/$/,"");
    const override=await seoEntryForPath(href);
    if(slug[0]==="books"&&slug[1]&&(config.schema.book||config.schema.product)){const x=await one("SELECT title,author,description,cover,price,available,type FROM books WHERE id=? AND published=1",slug[1]);if(x)jsonLd=override?.schema_type==="Product"&&config.schema.product?{"@context":"https://schema.org","@type":"Product",name:x.title,description:x.description||undefined,image:imageUrl(siteUrl,x.cover)||undefined,offers:{"@type":"Offer",priceCurrency:"BDT",price:(Number(x.price)/100).toFixed(2),availability:x.available?"https://schema.org/InStock":"https://schema.org/OutOfStock",url:`${siteUrl}${href}`}}:{"@context":"https://schema.org","@type":"Book",name:x.title,author:x.author?{"@type":"Person",name:x.author}:undefined,description:x.description||undefined,image:imageUrl(siteUrl,x.cover)||undefined,url:`${siteUrl}${href}`};}
    else if(slug[0]==="courses"&&slug[1]&&config.schema.course){const x=await one("SELECT name,description FROM courses WHERE id=? AND published=1",slug[1]);if(x)jsonLd={"@context":"https://schema.org","@type":"Course",name:x.name,description:x.description||undefined,provider:{"@type":"Organization",name:config.global.organizationName,url:siteUrl}};}
    else if(slug[0]==="blog"&&slug[1]&&config.schema.blogPosting){const x=await one("SELECT title,excerpt,thumbnail,publish_date,author_name FROM blogs WHERE slug=? AND published=1",slug[1]);if(x)jsonLd={"@context":"https://schema.org","@type":"BlogPosting",headline:x.title,description:x.excerpt||undefined,image:imageUrl(siteUrl,x.thumbnail)||undefined,datePublished:new Date(x.publish_date).toISOString(),author:{"@type":"Person",name:x.author_name},publisher:{"@type":"Organization",name:config.global.organizationName,logo:{"@type":"ImageObject",url:imageUrl(siteUrl,config.global.logo)}},url:`${siteUrl}${href}`};}
    else if(slug[0]==="notes"&&slug[1]==="item"&&slug[2]&&config.schema.article){const x=await one("SELECT title,description,thumbnail,created_at FROM notes WHERE id=? AND published=1",slug[2]);if(x)jsonLd={"@context":"https://schema.org","@type":"Article",headline:x.title,description:x.description||undefined,image:imageUrl(siteUrl,x.thumbnail)||undefined,datePublished:new Date(x.created_at).toISOString(),publisher:{"@type":"Organization",name:config.global.organizationName},url:`${siteUrl}${href}`};}
    else if(slug[0]==="notices"&&slug[1]&&config.schema.article){const x=await one("SELECT title,content,notice_date FROM notices WHERE id=? AND published=1",slug[1]);if(x)jsonLd={"@context":"https://schema.org","@type":"Article",headline:x.title,description:String(x.content||"").slice(0,320),datePublished:new Date(x.notice_date).toISOString(),publisher:{"@type":"Organization",name:config.global.organizationName},url:`${siteUrl}${href}`};}
    else if(slug[0]==="faq"&&config.schema.faq)jsonLd={"@context":"https://schema.org","@type":"FAQPage",mainEntity:[{"@type":"Question",name:"How do I get help with an order?",acceptedAnswer:{"@type":"Answer",text:"Message the Academy on WhatsApp and include the Order ID shown on your confirmation page."}},{"@type":"Question",name:"What should I send for exam access support?",acceptedAnswer:{"@type":"Answer",text:"Send the Exam or Package name, your name and your access code. Never share an Admin password."}},{"@type":"Question",name:"When will my payment be confirmed?",acceptedAnswer:{"@type":"Answer",text:"Payments are checked manually. You can follow the current status from Track Your Order."}}]};
    else if(!slug.length&&config.schema.website)jsonLd={"@context":"https://schema.org","@graph":[{"@type":"WebSite",name:config.global.siteName,url:siteUrl},{"@type":"Organization",name:config.global.organizationName,url:siteUrl,logo:imageUrl(siteUrl,config.global.logo),sameAs:String(config.global.socialProfiles||"").split(/[,\n]/).map((x:string)=>x.trim()).filter(Boolean)}]};
    if(jsonLd&&slug.length>1&&config.schema.breadcrumb){const primary={...jsonLd};delete primary["@context"];jsonLd={"@context":"https://schema.org","@graph":[primary,{"@type":"BreadcrumbList",itemListElement:[{"@type":"ListItem",position:1,name:"Home",item:siteUrl},{"@type":"ListItem",position:2,name:slug[0].replaceAll("-"," "),item:`${siteUrl}/${slug[0]}`},{"@type":"ListItem",position:3,name:primary.name||primary.headline||"Details",item:`${siteUrl}${href}`}] }]};}
  }catch{}
  return <>{jsonLd&&<script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(jsonLd).replace(/</g,"\\u003c")}}/>}<Site initialSettings={initialSettings} initialHomeData={initialHomeData}/></>;
}
