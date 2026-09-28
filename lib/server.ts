import { env } from "cloudflare:workers";
import { compare, hash } from "bcryptjs";
import { z } from "zod";
import { defaults, deadline, score, released, totals } from "./rules";
import { DriveClient, authorizationUrl, driveConfigured, driveRedirectUri, exchangeCode, openRefreshToken, randomSecret, refreshAccess, sealRefreshToken, sha256url } from "./google-drive";
// All database access stays behind prepared, parameter-bound queries.
export const db = () => {
  if (!env.DB) throw Error("Database unavailable");
  return env.DB;
};
export const one = async (sql: string, ...v: any[]) =>
  db()
    .prepare(sql)
    .bind(...v)
    .first<any>();
export const all = async (sql: string, ...v: any[]) =>
  (
    await db()
      .prepare(sql)
      .bind(...v)
      .all<any>()
  ).results;
export const run = async (sql: string, ...v: any[]) =>
  db()
    .prepare(sql)
    .bind(...v)
    .run();
const uid = () => crypto.randomUUID();
const token = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(32)), (v) =>
    v.toString(16).padStart(2, "0"),
  ).join("");
const accessCode = () => {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const s = Array.from(
    crypto.getRandomValues(new Uint8Array(12)),
    (x) => alphabet[x % alphabet.length],
  ).join("");
  return `LVA-${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8)}`;
};
export const digest = async (s: string) =>
  Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)),
    ),
    (v) => v.toString(16).padStart(2, "0"),
  ).join("");
class ApiError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
function fail(s: string, n = 400): never {
  throw new ApiError(s, n);
}
const cookie = (r: Request, n: string) =>
  r.headers
    .get("cookie")
    ?.split(";")
    .map((v) => v.trim())
    .find((v) => v.startsWith(n + "="))
    ?.slice(n.length + 1) || "";
const cookieValue = (r: Request, n: string, v: string, age: number) =>
  `${n}=${v}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${new URL(r.url).protocol === "https:" ? "; Secure" : ""}`;
const DEVICE_COOKIE="lva_learner_device";
async function claimCodeDevice(r:Request,code:any) {
  const device=cookie(r,DEVICE_COOKIE)||token();
  const fingerprint=await digest(device);
  const claimed=await run("UPDATE codes SET device_hash=?,claimed_at=COALESCE(claimed_at,?) WHERE id=? AND active=1 AND (device_hash IS NULL OR device_hash=?)",fingerprint,Date.now(),code.id,fingerprint);
  if(!claimed.meta.changes)fail("This code belongs to another browser. Ask the administrator to reset its device binding.",403);
  return {device,headers:cookie(r,DEVICE_COOKIE)?{}:{"Set-Cookie":cookieValue(r,DEVICE_COOKIE,device,63072000)}};
}
async function hasEntitlement(codeId:string,type:string,id:string) {
  return !!await one("SELECT id FROM code_entitlements WHERE code_id=? AND resource_type=? AND resource_id=?",codeId,type,id);
}
const packageCookieName = (packageId: string) => `lva_package_${packageId.replace(/[^a-z0-9]/gi, "").slice(0, 20)}`;
async function packageSession(r: Request, packageId: string) {
  const value = cookie(r, packageCookieName(packageId));
  if (!value) return null;
  return one(
    "SELECT s.code_id,c.code,c.active,COALESCE(pr.name,o.name,'Learner') name,COALESCE(pr.university,'') university,COALESCE(pr.phone,o.phone,'') phone,pr.photo,o.expires_at order_expires,o.access_suspended,ce.id entitlement_id FROM package_sessions s JOIN codes c ON c.id=s.code_id LEFT JOIN package_orders o ON o.package_id=s.package_id AND o.access_code_id=s.code_id AND o.verified=1 LEFT JOIN code_entitlements ce ON ce.code_id=s.code_id AND ce.resource_type='package' AND ce.resource_id=s.package_id LEFT JOIN package_profiles pr ON pr.package_id=s.package_id AND pr.code_id=s.code_id WHERE s.package_id=? AND s.token_hash=? AND s.expires>? AND c.active=1 AND (o.id IS NOT NULL OR ce.id IS NOT NULL) AND COALESCE(o.access_suspended,0)=0 AND (o.expires_at IS NULL OR o.expires_at>?) LIMIT 1",
    packageId, await digest(value), Date.now(), Date.now(),
  );
}
async function grantStarterCode(type:"exam"|"course"|"package",id:string) {
  const codeId=uid(),value=accessCode();
  await db().batch([
    db().prepare("INSERT INTO codes(id,code,active,created_at) VALUES(?,?,1,?)").bind(codeId,value,Date.now()),
    db().prepare("INSERT INTO code_entitlements(id,code_id,resource_type,resource_id,created_at) VALUES(?,?,?,?,?)").bind(uid(),codeId,type,id,Date.now()),
  ]);
}
const json = (data: any, status = 200, headers: any = {}) =>
  Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...headers,
    },
  });
const textSchema = z.string().trim().min(1).max(200);
const phone = z
  .string()
  .trim()
  .regex(/^(?:\+?88)?01[3-9]\d{8}$/, "Enter a valid Bangladeshi mobile number.")
  .transform((v) => v.replace(/^\+?88/, ""));
const trx = z
  .string()
  .trim()
  .min(4)
  .max(80)
  .regex(/^[a-zA-Z0-9-]+$/, "Enter a valid transaction ID.")
  .transform((v) => v.toUpperCase());
const money = z.number().int().min(0).max(100000000);
const jsonList = (value: any) => {
  try {
    const parsed = JSON.parse(value || "");
    if (Array.isArray(parsed)) return parsed;
  } catch {}
  return value ? [String(value)] : [];
};
async function couponDiscount(
  code: string | undefined,
  amount: number,
  orderType: string,
  productIds: string[] = [],
  userKey?: string,
) {
  if (!code) return { code: null, discount: 0 };
  const c = await one(
    "SELECT * FROM coupons WHERE code=? AND active=1",
    code.trim().toUpperCase(),
  );
  if (
    !c ||
    (c.starts_at && c.starts_at > Date.now()) ||
    (c.expires_at && c.expires_at < Date.now()) ||
    (c.usage_limit && c.times_used >= c.usage_limit)
  )
    fail("This coupon is invalid, inactive, expired, or fully used.");
  if (userKey) {
    const uses = await one(
      "SELECT COUNT(*) n FROM coupon_redemptions WHERE coupon_id=? AND user_key=?",
      c.id,
      userKey,
    );
    if (Number(uses?.n || 0) >= c.per_user_limit)
      fail("This coupon has reached its limit for this customer.");
  }
  if (amount < c.minimum_order)
    fail("This order does not meet the coupon minimum.");
  const applies = JSON.parse(c.applies_to || "[]"),
    selected = JSON.parse(c.product_ids || "[]");
  if (
    !applies.includes("entire_store") &&
    !applies.includes(orderType) &&
    !(
      applies.includes("selected_products") &&
      productIds.some((x) => selected.includes(x))
    )
  )
    fail("This coupon does not apply to these items.");
  let discount =
    c.discount_type === "fixed"
      ? c.discount_value
      : Math.floor((amount * c.discount_value) / 10000);
  if (c.maximum_discount != null)
    discount = Math.min(discount, c.maximum_discount);
  return { code: c.code, discount: Math.min(amount, discount), id: c.id };
}
async function throttle(r: Request, key: string, max = 15) {
  const now = Date.now(),
    id = await digest(
      `${key}:${r.headers.get("cf-connecting-ip") || r.headers.get("x-real-ip") || "local"}:${Math.floor(now / 600000)}`,
    );
  const v = await one(
    "INSERT INTO limits(id,count,expires) VALUES(?,1,?) ON CONFLICT(id) DO UPDATE SET count=count+1 RETURNING count",
    id,
    now + 600000,
  );
  if (v.count > max)
    fail("Too many attempts. Please try again in 10 minutes.", 429);
  if (Math.random() < 0.01)
    await run("DELETE FROM limits WHERE expires<?", now);
}
async function setting(includeDrafts = false) {
  const row = await one("SELECT value FROM settings WHERE id=?", "site");
  try {
    const result: any = { ...defaults, ...(row ? JSON.parse(row.value) : {}) };
    // Carry older installations forward to the current public copy without
    // overwriting values an administrator has intentionally customized.
    if (result.stat1Label === "Active Students")
      result.stat1Label = "Learners Reached";
    if (result.stat1Value === "6000+") result.stat1Value = "6,000+";
    if (result.stat2Label === "Books Sold")
      result.stat2Label = "Books Delivered";
    if (result.stat3Label === "Review") result.stat3Label = "Student Rating";
    if (result.stat3Value === "4.8") result.stat3Value = "4.8/5";
    if (
      result.shortDescription === "BJS • Bar Council • Academic Legal Education"
    )
      result.shortDescription =
        "BJS • Bar Council • Law Officer • Academic Legal Education";
    if (
      result.about ===
      "LexVeritas Academy supports aspiring judges, advocates, and law students through focused BJS preparation, Bangladesh Bar Council preparation, academic legal education, MCQ examinations, and law books."
    )
      result.about =
        "LexVeritas Academy supports aspiring judges, advocates, Law Officer candidates, and law students through focused BJS preparation, Bangladesh Bar Council preparation, Law Officer preparation, academic legal education, MCQ examinations, and law books.";
    if (
      result.heroDescription ===
      "Prepare for the judiciary, the Bar, and your legal studies with focused MCQ examinations and carefully selected law materials."
    )
      result.heroDescription =
        "Prepare for BJS, the Bar Council, Law Officer recruitment, and academic law with focused MCQ examinations and carefully selected law materials.";
    const cms = await all(
      includeDrafts
        ? "SELECT id,value FROM settings WHERE id LIKE 'cms:%:live' OR id LIKE 'cms:%:draft' ORDER BY CASE WHEN id LIKE '%:live' THEN 0 ELSE 1 END"
        : "SELECT id,value FROM settings WHERE id LIKE 'cms:%:live'",
    );
    for (const item of cms) {
      const key = item.id.split(":")[1];
      try {
        result[`cms_${key}`] = JSON.parse(item.value);
      } catch {}
    }
    if (includeDrafts) result.cms_preview = true;
    return result;
  } catch {
    return { ...defaults };
  }
}
export const publicSiteSettings = () => setting(false);
const protectedWebsiteRoutes: Record<string, string> = {
  home: "/",
  about: "/about",
  contact: "/contact",
  courses: "/courses",
  books: "/books",
  packages: "/packages",
  notes: "/notes",
  blog: "/blog",
};
function validateWebsiteControl(key: string, value: any) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    fail("Website configuration must be an object.");
  if (key === "pages") {
    if (!Array.isArray(value.items) || value.items.length > 500)
      fail("Pages must be a list of at most 500 records.");
    const slugs = new Set<string>();
    for (const page of value.items) {
      const expected = protectedWebsiteRoutes[String(page.id || "")];
      const slug = String(page.slug || "");
      if (expected && (slug !== expected || page.status === "archived"))
        fail(`The protected route ${expected} cannot be removed or renamed.`);
      const normalized = slug === "/" ? "/" : slug.replace(/^\/+/, "");
      if (
        normalized !== "/" &&
        !/^[\p{L}\p{N}][\p{L}\p{N}\/_-]*$/u.test(normalized)
      )
        fail(`Invalid page slug: ${slug}`);
      if (slugs.has(normalized)) fail(`Duplicate page slug: ${slug}`);
      slugs.add(normalized);
    }
  }
  const inspect = (node: any, depth = 0) => {
    if (depth > 20) fail("Website configuration is nested too deeply.");
    if (Array.isArray(node))
      return node.forEach((item) => inspect(item, depth + 1));
    if (!node || typeof node !== "object") return;
    for (const [name, raw] of Object.entries(node)) {
      if (
        typeof raw === "string" &&
        ["url", "link", "ctaUrl", "canonicalUrl"].includes(name) &&
        raw &&
        !/^(?:\/|#|https:\/\/|mailto:|tel:)/i.test(raw)
      )
        fail(`Unsafe or unsupported URL in ${name}.`);
      inspect(raw, depth + 1);
    }
  };
  inspect(value);
}
const seoDefaults = {
  global: {
    siteTitle: "LexVeritas Academy",
    siteName: "LexVeritas Academy",
    defaultMetaTitle: "BJS, Bar Council, Law Officer & Legal Education",
    defaultMetaDescription:
      "BJS, Bangladesh Bar Council, Law Officer, and academic legal education from LexVeritas Academy.",
    titleSeparator: "|",
    titleTemplate: "%page_title% | LexVeritas Academy",
    defaultKeywords:
      "BJS, Bar Council, Law Officer, legal education, Bangladesh law",
    canonicalDomain: "https://lexveritasacademy.sites.bd",
    defaultIndex: true,
    defaultFollow: true,
    organizationName: "LexVeritas Academy",
    logo: "/assets/lexveritas-logo.png",
    email: "",
    phone: "",
    socialProfiles: "",
  },
  social: {
    ogTitle: "LexVeritas Academy",
    ogDescription: "Legal education, MCQ examinations and law books.",
    ogImage: "",
    twitterCard: "summary_large_image",
  },
  sitemap: {
    enabled: true,
    pages: true,
    books: true,
    courses: true,
    packages: true,
    notes: true,
    notices: true,
    blogs: true,
    categories: true,
    lastGenerated: 0,
  },
  robots: {
    defaultIndex: true,
    defaultFollow: true,
    blockedPaths: [
      "/admin",
      "/api",
      "/attempts",
      "/orders",
      "/checkout",
      "/track-order",
    ],
    sitemapDeclaration: true,
  },
  schema: {
    organization: true,
    website: true,
    breadcrumb: true,
    article: true,
    blogPosting: true,
    course: true,
    book: true,
    faq: true,
    product: true,
  },
  verification: { google: "", bing: "", otherName: "", otherCode: "" },
};
export async function seoConfig() {
  const row = await one("SELECT value FROM settings WHERE id='cms:seo:live'");
  let raw: any = {};
  try {
    raw = row ? JSON.parse(row.value) : {};
  } catch {}
  // Preserve the original flat SEO Manager values as migration fallbacks.
  const legacyGlobal = {
    ...seoDefaults.global,
    siteTitle: raw.siteTitle || seoDefaults.global.siteTitle,
    defaultMetaDescription:
      raw.metaDescription || seoDefaults.global.defaultMetaDescription,
    titleTemplate: String(
      raw.titleTemplate || seoDefaults.global.titleTemplate,
    ).replace("%s", "%page_title%"),
    canonicalDomain: raw.canonical || seoDefaults.global.canonicalDomain,
  };
  const legacySocial = {
    ...seoDefaults.social,
    ogTitle: raw.ogTitle || seoDefaults.social.ogTitle,
    ogDescription: raw.ogDescription || seoDefaults.social.ogDescription,
    ogImage: raw.ogImage || seoDefaults.social.ogImage,
  };
  return {
    ...seoDefaults,
    ...raw,
    global: { ...legacyGlobal, ...(raw.global || {}) },
    social: { ...legacySocial, ...(raw.social || {}) },
    sitemap: {
      ...seoDefaults.sitemap,
      ...(raw.sitemap && typeof raw.sitemap === "object"
        ? raw.sitemap
        : { enabled: raw.sitemap !== false }),
    },
    robots: {
      ...seoDefaults.robots,
      ...(raw.robots && typeof raw.robots === "object" ? raw.robots : {}),
    },
    schema: { ...seoDefaults.schema, ...(raw.schema || {}) },
    verification: { ...seoDefaults.verification, ...(raw.verification || {}) },
  };
}
const cleanSeoText = (value: any, fallback = "") =>
  String(value || fallback)
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
const seoPath = (value: string) => {
  const path = String(value || "").trim();
  if (!path) return "/";
  if (/^https?:\/\//i.test(path)) return new URL(path).pathname || "/";
  return `/${path.replace(/^\/+/, "").replace(/\/{2,}/g, "/")}`;
};
export async function seoInventory() {
  const [books, courses, packages, notes, notices, blogs, entries, pagesRow] =
    await Promise.all([
      all(
        "SELECT id,title,description,cover image,published,created_at updated_at FROM books",
      ),
      all(
        "SELECT id,name title,description,thumbnail image,published,created_at updated_at FROM courses",
      ),
      all(
        "SELECT id,title,description,thumbnail image,published,created_at updated_at FROM exam_packages",
      ),
      all(
        "SELECT id,title,description,thumbnail image,published,created_at updated_at FROM notes",
      ),
      all(
        "SELECT id,title,content description,attachment image,published,notice_date updated_at FROM notices",
      ),
      all(
        "SELECT id,slug,title,excerpt description,thumbnail image,published,updated_at,seo_title legacy_seo_title,meta_description legacy_meta_description,content FROM blogs",
      ),
      all("SELECT * FROM seo_entries"),
      one("SELECT value FROM settings WHERE id='cms:pages:live'"),
    ]);
  let customPages: any[] = [];
  try {
    customPages = JSON.parse(pagesRow?.value || "{}").items || [];
  } catch {}
  const staticPages = [
    ["home", "Home", "/"],
    ["books", "Books", "/books"],
    ["courses", "Courses", "/courses"],
    ["packages", "Exam Packages", "/packages"],
    ["notes", "Free Notes & Study Resources", "/notes"],
    ["notices", "Notices", "/notices"],
    ["blog", "Blog", "/blog"],
    ["about", "About", "/about"],
    ["contact", "Contact Us", "/contact"],
    ["faq", "FAQ", "/faq"],
  ].map(([id, title, path]) => ({
    type: "page",
    id,
    title,
    description: "",
    path,
    published: 1,
    image: "",
    updated_at: 0,
    schema_type: "WebPage",
  }));
  const mapped = [
    ...staticPages,
    ...customPages.filter((x: any) => seoPath(x.slug) !== "/bd-laws-ai").map((x: any) => ({
      type: "page",
      id: `custom:${x.slug}`,
      title: x.title,
      description: cleanSeoText(x.content),
      content_html: x.content || "",
      path: seoPath(x.slug),
      published: +!!x.published,
      image: "",
      updated_at: 0,
      schema_type: "WebPage",
    })),
    ...books.map((x: any) => ({
      ...x,
      type: "book",
      path: `/books/${x.id}`,
      schema_type: "Book",
    })),
    ...courses.map((x: any) => ({
      ...x,
      type: "course",
      path: `/courses/${x.id}`,
      schema_type: "Course",
    })),
    ...packages.map((x: any) => ({
      ...x,
      type: "package",
      path: `/packages/${x.id}`,
      schema_type: "Course",
    })),
    ...notes.map((x: any) => ({
      ...x,
      type: "note",
      path: `/notes/item/${x.id}`,
      schema_type: "Article",
    })),
    ...notices.map((x: any) => ({
      ...x,
      type: "notice",
      path: `/notices/${x.id}`,
      schema_type: "Article",
    })),
    ...blogs.map((x: any) => ({
      ...x,
      type: "blog",
      path: `/blog/${x.slug}`,
      schema_type: "BlogPosting",
    })),
  ];
  const byKey = new Map(
    entries.map((x: any) => [`${x.content_type}:${x.content_id}`, x]),
  );
  return mapped.map((item: any) => {
    const custom: any = byKey.get(`${item.type}:${item.id}`) || {};
    const description = cleanSeoText(item.description).slice(0, 320);
    return {
      ...item,
      description,
      seo_title: custom.seo_title || item.legacy_seo_title || item.title,
      meta_description:
        custom.meta_description || item.legacy_meta_description || description,
      canonical_url: custom.canonical_url || "",
      indexable: custom.indexable == null ? 1 : custom.indexable,
      follow_links: custom.follow_links == null ? 1 : custom.follow_links,
      og_title: custom.og_title || "",
      og_description: custom.og_description || "",
      social_image: custom.social_image || item.image || "",
      schema_type: custom.schema_type || item.schema_type,
      custom: !!custom.id,
      seo_updated_at: custom.updated_at || 0,
    };
  });
}
export async function seoEntryForPath(path: string) {
  return one("SELECT * FROM seo_entries WHERE path=?", seoPath(path));
}
const safeAsset = async (value: string | null | undefined) =>
  !value ||
  value.startsWith("/assets/") ||
  !!(await one(
    "SELECT id FROM files WHERE id=? AND visibility='public'",
    value,
  ));
function sanitizeBlogHtml(input: string) {
  const allowed = new Set([
    "p",
    "br",
    "h1",
    "h2",
    "h3",
    "h4",
    "strong",
    "b",
    "em",
    "i",
    "u",
    "s",
    "blockquote",
    "ol",
    "ul",
    "li",
    "a",
    "table",
    "thead",
    "tbody",
    "tr",
    "th",
    "td",
    "hr",
    "div",
    "pre",
    "code",
    "sup",
    "sub",
  ]);
  const withoutDangerous = input
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(
      /<(script|style|iframe|object|embed|svg|math)[^>]*>[\s\S]*?<\/\1\s*>/gi,
      "",
    );
  return withoutDangerous
    .replace(/<\/?[^>]+>/g, (tag) => {
      const m = tag.match(/^<\s*(\/?)\s*([a-z0-9]+)/i);
      if (!m || !allowed.has(m[2].toLowerCase())) return "";
      const closing = !!m[1],
        name = m[2].toLowerCase();
      if (closing) return `</${name}>`;
      if (name === "a") {
        const h = tag.match(/\bhref\s*=\s*(?:"([^"]*)"|'([^']*)')/i);
        const href = (h?.[1] || h?.[2] || "").trim();
        if (/^(https?:\/\/|mailto:|\/)/i.test(href))
          return `<a href="${href.replace(/["<>]/g, "")}" target="_blank" rel="noopener noreferrer">`;
        return "<a>";
      }
      if (
        [
          "p",
          "div",
          "h1",
          "h2",
          "h3",
          "h4",
          "blockquote",
          "li",
          "th",
          "td",
        ].includes(name)
      ) {
        const styles: string[] = [];
        const style = tag.match(/\bstyle\s*=\s*(?:"([^"]*)"|'([^']*)')/i);
        const source = style?.[1] || style?.[2] || "";
        const alignment = source.match(
          /(?:^|;)\s*text-align\s*:\s*(left|right|center|justify)\s*(?:;|$)/i,
        )?.[1];
        if (alignment) styles.push(`text-align:${alignment.toLowerCase()}`);
        const margin = Number(
          source.match(
            /(?:^|;)\s*margin-left\s*:\s*(\d{1,3})px\s*(?:;|$)/i,
          )?.[1] || 0,
        );
        if (margin > 0) styles.push(`margin-left:${Math.min(margin, 240)}px`);
        return styles.length
          ? `<${name} style="${styles.join(";")}">`
          : `<${name}>`;
      }
      return ["br", "hr"].includes(name) ? `<${name}>` : `<${name}>`;
    })
    .slice(0, 500000);
}
function slugify(value: string) {
  const slug = value
    .normalize("NFKD")
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
  return slug || `blog-${token().slice(0, 10)}`;
}
const wordCount = (value: string) =>
  value.trim() ? value.trim().split(/\s+/u).length : 0;
async function validateSettings(raw: any) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    fail("Invalid settings.");
  const out: any = { ...(await setting()) };
  for (const key of Object.keys(defaults)) {
    if (!(key in raw)) continue;
    const original = (defaults as any)[key],
      value = raw[key];
    if (Array.isArray(original)) {
      if (
        !Array.isArray(value) ||
        value.length > 20 ||
        value.some((x) => typeof x !== "string")
      )
        fail(`Invalid ${key}.`);
      const allowed = [
        "notice",
        "statistics",
        "packages",
        "courses",
        "books",
        "blog",
        "reviews",
        "team",
      ];
      out[key] = [...new Set(value.filter((x: string) => allowed.includes(x)))];
    } else if (typeof original === "boolean") {
      if (typeof value !== "boolean") fail(`Invalid ${key}.`);
      out[key] = value;
    } else if (typeof original === "number") {
      if (!Number.isSafeInteger(value) || value < 0 || value > 100000000)
        fail(`Invalid ${key}.`);
      out[key] = value;
    } else {
      if (typeof value !== "string" || value.length > 10000)
        fail(`Invalid ${key}.`);
      if (/Url$|facebook|telegram|whatsappGroup/i.test(key)) {
        if (value && !/^(https:\/\/|\/)/.test(value))
          fail(`${key} must use HTTPS or a website path.`);
      }
      if (/Color$/.test(key) && !/^#[0-9a-f]{6}$/i.test(value))
        fail(`Invalid ${key}.`);
      out[key] = value;
    }
  }
  for (const key of ["websiteLogo", "favicon", "heroImage", "footerLogo"])
    if (!(await safeAsset(out[key]))) fail(`Invalid ${key} image.`);
  return out;
}
async function seedAcademyContent() {
  await run(
    "INSERT OR IGNORE INTO team_members(id,name,role,details,photo,active,display_order,created_at) VALUES(?,?,?,?,?,?,?,?)",
    "team-md-parvez-mosarof",
    "MD. Parvez Mosarof",
    "Instructor",
    "LL.B. & LL.M\nBangladesh University Of Professionals",
    "/assets/md-parvez-mosarof.jpeg",
    1,
    1,
    Date.now(),
  );
}
async function audit(admin: any, action: string, target: string) {
  await run(
    "INSERT INTO audit(id,admin_id,action,target,created_at) VALUES(?,?,?,?,?)",
    uid(),
    admin.id,
    action,
    target,
    Date.now(),
  );
}
const rolePermissions: Record<string, string[]> = {
  super_admin: ["*"],
  content_manager: [
    "dashboard",
    "study",
    "team",
    "notices",
    "notes",
    "blogs",
    "reviews",
    "authors",
    "blog-taxonomy",
    "books",
    "courses",
    "codes",
    "upload",
    "media",
    "control",
    "seo",
  ],
  exam_manager: ["dashboard", "exams", "packages", "codes", "upload", "media"],
  order_manager: [
    "dashboard",
    "orders",
    "payments",
    "coupons",
    "pricing",
    "commerce-dashboard",
  ],
  editor: [
    "dashboard",
    "study",
    "team",
    "notices",
    "notes",
    "blogs",
    "authors",
    "blog-taxonomy",
    "books",
    "courses",
    "upload",
    "media",
    "seo",
  ],
};
async function accessControl() {
  const row = await one("SELECT value FROM settings WHERE id='admin_access'");
  try {
    return row ? JSON.parse(row.value) : { assignments: {} };
  } catch {
    return { assignments: {} };
  }
}
async function adminRole(admin: any) {
  if (admin.username === "lexveritas_admin") return "super_admin";
  const access = await accessControl();
  return access.assignments?.[admin.id] || "editor";
}
async function authorizeAdmin(admin: any, section: string) {
  if (["me", "password"].includes(section)) return;
  if (["course-builder", "youtube-check"].includes(section))
    section = "courses";
  if (section === "access") section = "codes";
  const role = await adminRole(admin);
  const access = await accessControl();
  const allowed =
    access.roles?.[role] || rolePermissions[role] || rolePermissions.editor;
  if (!allowed.includes("*") && !allowed.includes(section))
    fail("Your role does not allow this action.", 403);
}
async function auth(r: Request, allowChange = false) {
  const a = await one(
    "SELECT a.* FROM sessions s JOIN admins a ON a.id=s.admin_id WHERE s.id=? AND s.expires>? AND a.active=1",
    await digest(cookie(r, "lva_admin")),
    Date.now(),
  );
  if (!a) fail("Please sign in as Admin.", 401);
  if (a.must_change && !allowChange)
    fail("Change your temporary password in Settings to continue.", 403);
  return a;
}
async function attemptAuth(r: Request, id: string) {
  const a = await one("SELECT * FROM attempts WHERE id=?", id);
  if (!a || a.token_hash !== (await digest(cookie(r, "lva_attempt_" + id))))
    fail(
      "This exam session is unavailable on this browser. Use the original browser or result lookup after the exam.",
      403,
    );
  return a;
}
async function freeze(id: string) {
  if (await one("SELECT id FROM attempts WHERE exam_id=? LIMIT 1", id))
    fail(
      "This exam already has attempts. Its questions, schedule and scoring are locked; duplicate it to make changes.",
    );
}
// One atomic SQL statement grades attempts from saved answers. The same write lock
// serializes finalization with answer updates and makes retries idempotent.
async function grade(id: string, exam: string) {
  const now = Date.now();
  await run(
    `WITH g AS (
 SELECT a.id,e.correct_mark cm,e.negative_mark nm,COUNT(q.id) total,
 SUM(CASE WHEN z.selected=q.correct_option THEN 1 ELSE 0 END) c,
 SUM(CASE WHEN z.selected IS NOT NULL AND z.selected!=q.correct_option THEN 1 ELSE 0 END) w
 FROM attempts a JOIN exams e ON e.id=a.exam_id JOIN questions q ON q.exam_id=e.id
 LEFT JOIN answers z ON z.attempt_id=a.id AND z.question_id=q.id
 WHERE a.status='active' AND (a.id=? OR (a.exam_id=? AND a.deadline<=?)) GROUP BY a.id
 ) UPDATE attempts SET status='submitted',submitted_at=MIN(?,deadline),duration=MAX(0,MIN(?,deadline)-started_at),
 correct=g.c,wrong=g.w,unanswered=g.total-g.c-g.w,positive=g.c*g.cm,negative=g.w*g.nm,
 score=g.c*g.cm-g.w*g.nm,percentage=CAST(ROUND((g.c*g.cm-g.w*g.nm)*10000.0/(g.total*g.cm)) AS INTEGER)
 FROM g WHERE attempts.id=g.id AND attempts.status='active'`,
    id,
    exam,
    now,
    now,
    now,
  );
}
async function finish(id: string) {
  await grade(id, "");
  return one("SELECT * FROM attempts WHERE id=?", id);
}
async function expire(exam: string) {
  await grade("", exam);
}
async function seedCodes() {
  if (await one("SELECT id FROM settings WHERE id='initial_codes_seeded'"))
    return;
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const n = 10000 - (await one("SELECT COUNT(*) n FROM codes")).n;
  for (let i = 0; i < n; i += 100) {
    await db().batch(
      Array.from({ length: Math.min(100, n - i) }, () => {
        const s = Array.from(
          crypto.getRandomValues(new Uint8Array(12)),
          (x) => alphabet[x % 32],
        ).join("");
        return db()
          .prepare(
            "INSERT OR IGNORE INTO codes(id,code,active,created_at) SELECT ?,?,1,? WHERE (SELECT COUNT(*) FROM codes)<10000",
          )
          .bind(
            uid(),
            `LVA-${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8)}`,
            Date.now(),
          );
      }),
    );
  }
  await run(
    "INSERT OR IGNORE INTO settings VALUES('initial_codes_seeded','true')",
  );
}
async function rank(
  exam: string,
  limit = 50,
  offset = 0,
  search = "",
  sort = "rank",
  status = "",
) {
  await expire(exam);
  const order =
    sort === "name"
      ? "student_name,id"
      : sort === "start"
        ? "started_at,id"
        : "score DESC,wrong ASC,duration ASC,submitted_at ASC,id ASC";
  return all(
    `WITH candidates AS (SELECT a.*,c.code,ROW_NUMBER() OVER(PARTITION BY a.code_id ORDER BY CASE WHEN a.status='submitted' THEN 0 ELSE 1 END,a.score DESC,a.wrong,a.duration,a.submitted_at,a.id) attempt_choice FROM attempts a JOIN codes c ON c.id=a.code_id WHERE a.exam_id=?),ranked AS (SELECT *,ROW_NUMBER() OVER(ORDER BY CASE WHEN status='submitted' THEN 0 ELSE 1 END,score DESC,wrong,duration,submitted_at,id) position FROM candidates WHERE attempt_choice=1) SELECT * FROM ranked WHERE (student_name LIKE ? OR university LIKE ? OR code LIKE ?) AND (?='' OR status=?) ORDER BY ${order} LIMIT ? OFFSET ?`,
    exam,
    `%${search}%`,
    `%${search}%`,
    `%${search}%`,
    status,
    status,
    limit,
    offset,
  );
}
async function viewAttempt(a: any) {
  if (a.status === "active" && Date.now() >= a.deadline) a = await finish(a.id);
  const e = await one("SELECT * FROM exams WHERE id=?", a.exam_id),
    open = released(e, Date.now());
  const fields =
    open && a.status === "submitted"
      ? "q.*"
      : "q.id,q.question,q.options,q.image,q.display_order";
  const q = await all(
    `SELECT ${fields},a.selected,COALESCE(a.flagged,0) flagged FROM questions q LEFT JOIN answers a ON a.question_id=q.id AND a.attempt_id=? WHERE q.exam_id=? ORDER BY q.display_order,q.id`,
    a.id,
    e.id,
  );
  let result = null;
  if (open && a.status === "submitted") {
    await expire(e.id);
    const r = await one(
      "SELECT COUNT(*)+1 AS position FROM (SELECT *,ROW_NUMBER() OVER(PARTITION BY code_id ORDER BY score DESC,wrong,duration,submitted_at,id) chosen FROM attempts WHERE exam_id=? AND package_id IS ? AND status='submitted') WHERE chosen=1 AND (score>? OR (score=? AND wrong<?) OR (score=? AND wrong=? AND duration<?) OR (score=? AND wrong=? AND duration=? AND submitted_at<?) OR (score=? AND wrong=? AND duration=? AND submitted_at=? AND id<?))",
      e.id,
      a.package_id||null,
      a.score,
      a.score,
      a.wrong,
      a.score,
      a.wrong,
      a.duration,
      a.score,
      a.wrong,
      a.duration,
      a.submitted_at,
      a.score,
      a.wrong,
      a.duration,
      a.submitted_at,
      a.id,
    );
    result = {
      correct: a.correct,
      wrong: a.wrong,
      unanswered: a.unanswered,
      positive: a.positive,
      negative: a.negative,
      score: a.score,
      percentage: a.percentage,
      duration: a.duration,
      position: r.position,
    };
  }
  return {
    id: a.id,
    exam_id: a.exam_id,
    student_name: a.student_name,
    university: a.university,
    started_at: a.started_at,
    deadline: a.deadline,
    status: a.status,
    title: e.title,
    serverTime: Date.now(),
    result,
    questions: q.map((x) => ({ ...x, options: JSON.parse(x.options) })),
  };
}
function csvCell(v: any) {
  let s = String(v ?? "");
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return '"' + s.replace(/"/g, '""') + '"';
}

type BackupModule =
  "content" | "exams" | "commerce" | "settings" | "theme" | "seo" | "media";
const backupTables: Record<
  Exclude<BackupModule, "theme" | "media">,
  string[]
> = {
  content: [
    "authors",
    "blogs",
    "reviews",
    "team_members",
    "notices",
    "notes",
    "books",
    "courses",
    "course_content",
  ],
  exams: [
    "codes",
    "exams",
    "questions",
    "attempts",
    "answers",
    "exam_packages",
    "package_exams",
    "package_routines",
    "code_exam_access",
    "code_entitlements",
    "course_progress",
  ],
  commerce: [
    "hard_orders",
    "hard_items",
    "soft_orders",
    "package_orders",
    "course_orders",
    "payments",
    "coupons",
    "coupon_redemptions",
  ],
  settings: ["settings"],
  seo: ["seo_entries", "seo_redirects"],
};
const backupKinds: Record<string, BackupModule[]> = {
  full: ["content", "exams", "commerce", "settings", "theme", "seo", "media"],
  data: ["content", "exams", "commerce", "seo"],
  media: ["media"],
  settings: ["settings"],
  theme: ["theme"],
  exam: ["exams"],
  commerce: ["commerce"],
  recovery: [
    "content",
    "exams",
    "commerce",
    "settings",
    "theme",
    "seo",
    "media",
  ],
  migration: [
    "content",
    "exams",
    "commerce",
    "settings",
    "theme",
    "seo",
    "media",
  ],
};
const protectedSetting =
  /password|secret|credential|private[_-]?key|oauth|access[_-]?token|refresh[_-]?token/i;
const cleanBackupRows = (table: string, rows: any[]) =>
  rows
    .map((row) => {
      const copy = { ...row };
      for (const key of ["password_hash", "token_hash", "direct_token"])
        delete copy[key];
      if(table==="codes"){copy.device_hash=null;copy.claimed_at=null}
      return copy;
    })
    .filter(
      (row) =>
        table !== "settings" ||
        (!protectedSetting.test(String(row.id)) &&
          row.id !== "initial_codes_seeded"),
    );
const modulesForKind = (kind: string) => backupKinds[kind] || backupKinds.full;
const tableModules = (modules: BackupModule[]) =>
  modules.flatMap((module) =>
    module === "theme" || module === "media" ? [] : backupTables[module],
  );
const restoreTableOrder = [
  "settings",
  "authors",
  "team_members",
  "notices",
  "notes",
  "books",
  "reviews",
  "blogs",
  "codes",
  "exams",
  "questions",
  "exam_packages",
  "package_exams",
  "package_routines",
  "courses",
  "course_content",
  "attempts",
  "answers",
  "course_progress",
  "hard_orders",
  "hard_items",
  "soft_orders",
  "package_orders",
  "course_orders",
  "code_exam_access",
  "code_entitlements",
  "coupons",
  "payments",
  "coupon_redemptions",
  "seo_entries",
  "seo_redirects",
  "files",
];
const backupPrefix = (id: string) => `system-backups/${id}/`;
const backupPackageKey = (id: string) =>
  `${backupPrefix(id)}lexveritas-backup.json`;
const backupMediaKey = (id: string, fileId: string) =>
  `${backupPrefix(id)}media/${fileId}`;
const formatBytes = (n: number) =>
  n < 1024
    ? `${n} B`
    : n < 1048576
      ? `${(n / 1024).toFixed(1)} KB`
      : `${(n / 1048576).toFixed(1)} MB`;

async function createBackup(
  kind: string,
  createdBy: string,
  source = "manual",
) {
  if (!backupKinds[kind]) fail("Unsupported backup type.");
  if (!env.BUCKET) fail("Backup storage is unavailable.", 503);
  const id = uid(),
    createdAt = Date.now(),
    modules = modulesForKind(kind);
  await run(
    "INSERT INTO backup_history(id,kind,status,created_by,created_at,verification_status,drive_status,included_modules,source) VALUES(?,?,?,?,?,'pending','not_synced',?,?)",
    id,
    kind,
    "creating",
    createdBy,
    createdAt,
    JSON.stringify(modules),
    source,
  );
  try {
    const tables: Record<string, any[]> = {};
    for (const table of tableModules(modules))
      tables[table] = cleanBackupRows(
        table,
        await all(`SELECT * FROM ${table}`),
      );
    if (modules.includes("theme")) {
      const rows = cleanBackupRows(
        "settings",
        await all(
          "SELECT * FROM settings WHERE id LIKE 'cms:theme:%' OR id LIKE 'cms:appearance:%' OR id LIKE 'cms:responsive:%' OR id LIKE 'cms:header:%' OR id LIKE 'cms:footer:%' OR id LIKE 'cms:navigation:%' OR id LIKE 'cms:homepage:%' OR id='site'",
        ),
      );
      tables.theme_settings = rows;
    }
    const adminRoles = modules.includes("settings")
      ? await all(
          "SELECT id,username,active,created_at FROM admins ORDER BY created_at",
        )
      : [];
    const media: any[] = [];
    let mediaBytes = 0;
    if (modules.includes("media")) {
      const files = await all(
        "SELECT id,name,mime,visibility,created_at FROM files ORDER BY created_at",
      );
      tables.files = files;
      for (const file of files) {
        const object = await env.BUCKET.get(file.id);
        if (!object) throw Error(`Media file is missing: ${file.name}`);
        const key = backupMediaKey(id, file.id);
        await env.BUCKET.put(key, object.body, {
          httpMetadata: object.httpMetadata,
          customMetadata: { backupId: id, originalId: file.id },
        });
        const saved = await env.BUCKET.head(key);
        if (!saved || saved.size !== object.size)
          throw Error(`Media verification failed: ${file.name}`);
        media.push({
          id: file.id,
          name: file.name,
          mime: file.mime,
          size: object.size,
          key,
        });
        mediaBytes += object.size;
      }
    }
    const data = { tables, adminRoles };
    const checksum = await digest(JSON.stringify(data));
    const manifest = {
      backupId: id,
      createdAt,
      type: kind,
      source,
      version: "3.0",
      format: "lexveritas-portable-json",
      includedModules: modules,
      tableCounts: Object.fromEntries(
        Object.entries(tables).map(([key, rows]) => [key, rows.length]),
      ),
      mediaCount: media.length,
      mediaBytes,
      checksum,
      excludes: [
        "plain-text passwords",
        "password hashes",
        "session cookies",
        "raw access tokens",
        "OAuth credentials",
        "payment-card data",
      ],
      sourceCodeIncluded: false,
    };
    const pack = {
      format: "lexveritas-backup-package",
      version: 3,
      manifest,
      data,
      media,
      migrationReadme:
        kind === "migration"
          ? "Import this package through LexVeritas Admin → System → Import / Export. Media objects are stored beside this package in the verified backup folder. Source code is managed separately by Sites and is not included."
          : undefined,
    };
    const serialized = JSON.stringify(pack);
    const key = backupPackageKey(id);
    await env.BUCKET.put(key, serialized, {
      httpMetadata: { contentType: "application/json" },
      customMetadata: { backupId: id, checksum },
    });
    const saved = await env.BUCKET.head(key);
    if (
      !saved ||
      saved.size !== new TextEncoder().encode(serialized).byteLength
    )
      throw Error("Backup package verification failed.");
    const size = saved.size + mediaBytes;
    await run(
      "UPDATE backup_history SET status='verified',verification_status='verified',verified_at=?,size_bytes=?,manifest=?,checksum=?,archive_key=?,payload_key=?,media_count=? WHERE id=?",
      Date.now(),
      size,
      JSON.stringify(manifest),
      checksum,
      key,
      key,
      media.length,
      id,
    );
    return {
      id,
      kind,
      status: "verified",
      verification_status: "verified",
      created_at: createdAt,
      size_bytes: size,
      manifest,
      checksum,
      media_count: media.length,
    };
  } catch (error: any) {
    await run(
      "UPDATE backup_history SET status='failed',verification_status='failed',error_message=? WHERE id=?",
      String(error?.message || "Backup failed").slice(0, 500),
      id,
    );
    throw error;
  }
}

async function readBackupPackage(id: string) {
  const row = await one("SELECT * FROM backup_history WHERE id=?", id);
  if (!row) fail("Backup not found.", 404);
  if (!row.payload_key) fail("This backup has no recoverable package.", 409);
  const object = await env.BUCKET?.get(row.payload_key);
  if (!object) fail("Backup package is missing from storage.", 409);
  let pack: any;
  try {
    pack = JSON.parse(await object.text());
  } catch {
    fail("Backup package is unreadable.", 409);
  }
  if (
    pack?.format !== "lexveritas-backup-package" ||
    !pack?.manifest ||
    !pack?.data
  )
    fail("Backup package format is invalid.", 409);
  return { row, pack };
}
const tarField = (
  header: Uint8Array,
  offset: number,
  length: number,
  value: string,
) => {
  header.set(new TextEncoder().encode(value).slice(0, length), offset);
};
const tarHeader = (name: string, size: number, mtime: number) => {
  const h = new Uint8Array(512);
  tarField(h, 0, 100, name);
  tarField(h, 100, 8, "0000644\0");
  tarField(h, 108, 8, "0000000\0");
  tarField(h, 116, 8, "0000000\0");
  tarField(h, 124, 12, Math.floor(size).toString(8).padStart(11, "0") + "\0");
  tarField(
    h,
    136,
    12,
    Math.floor(mtime / 1000)
      .toString(8)
      .padStart(11, "0") + "\0",
  );
  for (let i = 148; i < 156; i++) h[i] = 32;
  h[156] = 48;
  tarField(h, 257, 6, "ustar\0");
  tarField(h, 263, 2, "00");
  const sum = h.reduce((a, b) => a + b, 0);
  tarField(h, 148, 8, sum.toString(8).padStart(6, "0") + "\0 ");
  return h;
};
const backupReadme = (pack:any) => pack.migrationReadme ||
  "LexVeritas verified backup package. Import lexveritas-backup.json through Admin → System → Import / Export. Actual media files are included in this archive. Source code and secrets are not included.";
const tarEntrySize = (bytes:number) => 512 + bytes + ((512 - bytes % 512) % 512);
function backupTarSize(pack:any) {
  const encoder=new TextEncoder();
  return tarEntrySize(encoder.encode(JSON.stringify(pack,null,2)).byteLength)
    + tarEntrySize(encoder.encode(backupReadme(pack)).byteLength)
    + (pack.media||[]).reduce((sum:number,file:any)=>sum+tarEntrySize(Number(file.size)),0)
    + 1024;
}
function backupArchiveStream(pack: any, compress=true) {
  const encoder = new TextEncoder(),
    jsonBytes = encoder.encode(JSON.stringify(pack, null, 2)),
    readme = encoder.encode(backupReadme(pack));
  async function* entries():AsyncGenerator<Uint8Array> {
    for(const [name, bytes] of [["lexveritas-backup.json",jsonBytes],["MIGRATION-README.txt",readme]] as const) {
      yield tarHeader(name,bytes.byteLength,pack.manifest.createdAt);
      yield bytes;
      const padding=(512-bytes.byteLength%512)%512;
      if(padding)yield new Uint8Array(padding);
    }
    for(const file of pack.media||[]) {
      const object=await env.BUCKET?.get(file.key);
      if(!object)throw Error(`Backup media is missing: ${file.name}`);
      if(object.size!==Number(file.size))throw Error(`Backup media size changed: ${file.name}`);
      const safe=String(file.name||file.id).replace(/[^a-zA-Z0-9._-]+/g,"-").slice(-60);
      yield tarHeader(`media/${file.id}-${safe}`,object.size,pack.manifest.createdAt);
      const reader=object.body.getReader();
      try { while(true){const chunk=await reader.read();if(chunk.done)break;if(chunk.value)yield chunk.value;} }
      finally {reader.releaseLock();}
      const padding=(512-object.size%512)%512;
      if(padding)yield new Uint8Array(padding);
    }
    yield new Uint8Array(1024);
  }
  const iterator=entries();
  const stream=new ReadableStream<Uint8Array>({
    async pull(controller){try{const next=await iterator.next();if(next.done)controller.close();else controller.enqueue(next.value)}catch(error){controller.error(error)}},
    async cancel(){await iterator.return(undefined)},
  });
  return compress && typeof CompressionStream !== "undefined"
    ? stream.pipeThrough(new CompressionStream("gzip") as any)
    : stream;
}
async function verifyBackup(id: string) {
  try {
    const { row, pack } = await readBackupPackage(id);
    const problems: string[] = [];
    const checksum = await digest(JSON.stringify(pack.data));
    if (checksum !== row.checksum || checksum !== pack.manifest.checksum)
      problems.push("Data checksum mismatch");
    for (const file of pack.media || []) {
      const object = await env.BUCKET?.head(file.key);
      if (!object) problems.push(`Missing media: ${file.name}`);
      else if (object.size !== file.size)
        problems.push(`Media size mismatch: ${file.name}`);
    }
    const status = problems.length ? "failed" : "verified";
    await run(
      "UPDATE backup_history SET verification_status=?,verified_at=?,status=CASE WHEN ?='verified' THEN 'verified' ELSE 'failed' END,error_message=? WHERE id=?",
      status,
      Date.now(),
      status,
      problems.join("; ").slice(0, 500) || null,
      id,
    );
    return { ok: !problems.length, status, problems };
  } catch (error: any) {
    await run(
      "UPDATE backup_history SET verification_status='failed',status='failed',error_message=? WHERE id=?",
      String(error?.message || "Verification failed").slice(0, 500),
      id,
    );
    throw error;
  }
}
async function restoreBackup(
  id: string,
  selected: BackupModule[],
  admin: string,
) {
  const allowed = new Set<BackupModule>(modulesForKind("full"));
  if (!selected.length || selected.some((x) => !allowed.has(x)))
    fail("Choose valid modules to restore.");
  const verified = await verifyBackup(id);
  if (!verified.ok)
    fail("Restore stopped because backup verification failed.", 409);
  const recovery = await createBackup("recovery", admin, "pre_restore");
  const { pack } = await readBackupPackage(id);
  const sourceTables = pack.data.tables || {};
  const names = new Set([
    ...tableModules(selected),
    ...(selected.includes("theme") ? ["theme_settings"] : []),
    ...(selected.includes("media") ? ["files"] : []),
  ]);
  let restoredRows = 0;
  const ordered = [...names].sort(
    (a, b) =>
      restoreTableOrder.indexOf(a === "theme_settings" ? "settings" : a) -
      restoreTableOrder.indexOf(b === "theme_settings" ? "settings" : b),
  );
  for (const sourceName of ordered) {
    const table = sourceName === "theme_settings" ? "settings" : sourceName;
    const rows = Array.isArray(sourceTables[sourceName])
      ? sourceTables[sourceName]
      : [];
    if (!rows.length) continue;
    const columns = new Set(
      (await all(`PRAGMA table_info(${table})`)).map((x: any) => x.name),
    );
    const statements: any[] = [];
    for (const raw of rows) {
      const row = { ...raw };
      if (columns.has("token_hash") && !row.token_hash)
        row.token_hash = await digest(`restored:${table}:${row.id}:${uid()}`);
      const keys = Object.keys(row).filter((key) => columns.has(key));
      if (!keys.includes("id")) continue;
      const updates = keys
        .filter((x) => x !== "id")
        .map((x) => `${x}=excluded.${x}`)
        .join(",");
      const sql = `INSERT INTO ${table}(${keys.join(",")}) VALUES(${keys.map(() => "?").join(",")}) ON CONFLICT(id) DO UPDATE SET ${updates}`;
      statements.push(
        db()
          .prepare(sql)
          .bind(...keys.map((k) => row[k])),
      );
      if (statements.length === 50) {
        await db().batch(statements.splice(0));
      }
      restoredRows++;
    }
    if (statements.length) await db().batch(statements);
  }
  let restoredMedia = 0;
  if (selected.includes("media")) {
    for (const file of pack.media || []) {
      const object = await env.BUCKET?.get(file.key);
      if (!object) fail(`Recovery media is missing: ${file.name}`, 409);
      await env.BUCKET?.put(file.id, object.body, {
        httpMetadata: { contentType: file.mime },
      });
      restoredMedia++;
    }
  }
  return {
    ok: true,
    recoveryBackupId: recovery.id,
    restoredRows,
    restoredMedia,
    verified: true,
  };
}

function nextSchedule(frequency: string, from = Date.now()) {
  const date = new Date(from);
  if (frequency === "daily") date.setUTCDate(date.getUTCDate() + 1);
  else if (frequency === "weekly") date.setUTCDate(date.getUTCDate() + 7);
  else date.setUTCMonth(date.getUTCMonth() + 1);
  return date.getTime();
}
async function ensureBackupDefaults() {
  const now = Date.now();
  await db().batch([
    db()
      .prepare(
        "INSERT OR IGNORE INTO backup_schedules(id,label,backup_type,frequency,enabled,retention_count,next_run_at,updated_at) VALUES('daily','Daily Data Backup','data','daily',1,7,?,?)",
      )
      .bind(nextSchedule("daily", now), now),
    db()
      .prepare(
        "INSERT OR IGNORE INTO backup_schedules(id,label,backup_type,frequency,enabled,retention_count,next_run_at,updated_at) VALUES('weekly','Weekly Full Backup','full','weekly',1,8,?,?)",
      )
      .bind(nextSchedule("weekly", now), now),
    db()
      .prepare(
        "INSERT OR IGNORE INTO backup_schedules(id,label,backup_type,frequency,enabled,retention_count,next_run_at,updated_at) VALUES('monthly','Monthly Archive','full','monthly',1,12,?,?)",
      )
      .bind(nextSchedule("monthly", now), now),
    db()
      .prepare(
        "INSERT OR IGNORE INTO backup_storage_connections(id,provider,account_email,folder,status,connected,config,updated_at) VALUES('google-drive-primary','google_drive','parvezbupllb@gmail.com','LexVeritas Academy Backups/','authorization_required',0,'{}',?)",
      )
      .bind(now),
  ]);
}

const googleEnv = () => env as unknown as Record<string, any>;
const driveConnectionId = "google-drive-primary";
const drivePendingId = "oauth:google-drive:pending";
const safeConnection = (row:any) => {
  const {config, ...publicRow} = row;
  return publicRow;
};
function driveConfig(row:any): {refreshTokenCiphertext?:string;rootFolderId?:string} {
  try { return JSON.parse(row.config || "{}"); } catch { return {}; }
}
async function driveClient(connection:any) {
  if(!driveConfigured(googleEnv())) fail("Google Drive OAuth is not configured.",503);
  const cipher=driveConfig(connection).refreshTokenCiphertext;
  if(!connection.connected || !cipher) fail("Connect the Google account before copying backups.",409);
  const refresh=await openRefreshToken(googleEnv(),cipher);
  const tokens=await refreshAccess(googleEnv(),refresh);
  return new DriveClient(tokens.access_token);
}
async function copyBackupToDrive(id:string) {
  const connection=await one("SELECT * FROM backup_storage_connections WHERE id=?",driveConnectionId);
  if(!connection?.connected) fail("Google Drive is not connected.",409);
  const row=await one("SELECT * FROM backup_history WHERE id=?",id);
  if(!row || row.status!=="verified" || row.verification_status!=="verified" || !row.archive_key)
    fail("Only verified backups can be copied to Drive.",409);
  if(row.drive_status==="synced") return {id,driveStatus:"synced",folderId:row.drive_folder_id};
  const active=row.drive_status==="syncing" && row.drive_started_at && Date.now()-row.drive_started_at<3600000;
  if(active) fail("This backup is already copying to Drive.",409);
  const startedAt=Date.now();
  const claimed=await run("UPDATE backup_history SET drive_status='syncing',drive_started_at=?,drive_error_message=NULL WHERE id=? AND (drive_status!='syncing' OR drive_started_at IS NULL OR drive_started_at<?)",startedAt,id,startedAt-3600000);
  if(!claimed.meta.changes) fail("This backup is already copying to Drive.",409);
  try {
    const client=await driveClient(connection);
    const email=await client.accountEmail();
    if(email!==String(connection.account_email).toLowerCase()) throw Error("Connected Google account does not match the configured backup account.");
    const config=driveConfig(connection);
    let rootId=config.rootFolderId;
    if(rootId) {
      const root=await client.file(rootId);
      if(!root || root.trashed) rootId="";
    }
    if(!rootId) {
      for(const name of String(connection.folder || "LexVeritas Academy Backups").split("/").map((s:string)=>s.trim()).filter(Boolean)) {
        const folder=await client.folder(name,rootId);
        rootId=folder.id;
      }
      if(!rootId) throw Error("The backup folder name is empty.");
      config.rootFolderId=rootId;
      await run("UPDATE backup_storage_connections SET config=?,updated_at=? WHERE id=?",JSON.stringify(config),Date.now(),driveConnectionId);
    }
    let folderId=row.drive_folder_id;
    if(folderId) {
      const existing=await client.file(folderId);
      if(!existing || existing.trashed) folderId="";
    }
    if(!folderId) {
      const name=`${new Date(row.created_at).toISOString().replace(/[:.]/g,"-")} - ${row.kind} - ${id.slice(0,8)}`;
      folderId=(await client.folder(name,rootId)).id;
      await run("UPDATE backup_history SET drive_folder_id=? WHERE id=?",folderId,id);
    }
    const {pack}=await readBackupPackage(id);
    const name=`lexveritas-${id}.tar`, size=backupTarSize(pack);
    const existing=(await client.children(folderId)).find((item:any)=>item.name===name && Number(item.size)===size);
    if(!existing) {
      const uploaded=await client.upload(name,"application/x-tar",size,backupArchiveStream(pack,false) as ReadableStream<Uint8Array>,folderId);
      if(Number(uploaded.size)!==size) throw Error("Drive archive size does not match the local backup.");
    }
    const syncedAt=Date.now();
    await db().batch([
      db().prepare("UPDATE backup_history SET drive_status='synced',drive_started_at=NULL,drive_synced_at=?,drive_error_message=NULL WHERE id=?").bind(syncedAt,id),
      db().prepare("UPDATE backup_storage_connections SET status='connected',last_synced_at=?,updated_at=? WHERE id=?").bind(syncedAt,syncedAt,driveConnectionId),
    ]);
    return {id,driveStatus:"synced",folderId,fileCount:1};
  } catch(error:any) {
    const message=String(error?.message||"Google Drive copy failed").slice(0,500);
    await run("UPDATE backup_history SET drive_status='failed',drive_started_at=NULL,drive_error_message=? WHERE id=?",message,id);
    throw error;
  }
}

async function googleDriveCallback(r:Request,u:URL) {
  const state=u.searchParams.get("state")||"";
  const code=u.searchParams.get("code")||"";
  const failRedirect=(reason:string)=>Response.redirect(new URL(`/admin/system/storage?drive=${encodeURIComponent(reason)}`,r.url).toString(),303);
  const pending=await one("SELECT value FROM settings WHERE id=?",drivePendingId);
  if(!pending || !state || !code) return failRedirect("authorization_failed");
  let record:any;
  try {record=JSON.parse(pending.value)}catch{return failRedirect("authorization_failed")}
  if(record.expires<Date.now() || await sha256url(state)!==record.stateHash) return failRedirect("authorization_expired");
  const removed=await run("DELETE FROM settings WHERE id=? AND value=?",drivePendingId,pending.value);
  if(!removed.meta.changes) return failRedirect("authorization_expired");
  try {
    const tokens=await exchangeCode(googleEnv(),code,record.verifier);
    if(!tokens.refresh_token) return failRedirect("refresh_token_missing");
    const client=new DriveClient(tokens.access_token);
    const email=await client.accountEmail();
    const connection=await one("SELECT * FROM backup_storage_connections WHERE id=?",driveConnectionId);
    if(!email || email!==String(connection?.account_email||"").toLowerCase()) return failRedirect("account_mismatch");
    const cipher=await sealRefreshToken(googleEnv(),tokens.refresh_token);
    await run("UPDATE backup_storage_connections SET config=?,connected=1,status='connected',last_tested_at=?,updated_at=? WHERE id=?",JSON.stringify({refreshTokenCiphertext:cipher}),Date.now(),Date.now(),driveConnectionId);
    return failRedirect("connected");
  }catch(error:any){
    console.error("Google Drive OAuth failed",String(error?.message||"failed").slice(0,200));
    return failRedirect("authorization_failed");
  }
}
export async function handle(r: Request) {
  try {
    return await dispatch(r);
  } catch (e: any) {
    if (e instanceof z.ZodError)
      return json(
        {
          error: e.issues
            .map((v: any) => `${v.path.join(".")}: ${v.message}`)
            .join("; "),
        },
        400,
      );
    if (e instanceof ApiError) return json({ error: e.message }, e.status);
    console.error("LVA request failed", e?.message);
    return json(
      { error: "We could not complete this request. Please try again." },
      500,
    );
  }
}
export async function publicHomeData() {
  const paths = ["notices", "courses", "packages", "notes", "books", "blogs", "reviews", "team", "study/home"];
  const values = await Promise.all(paths.map(async path => {
    try {
      const response = await handle(new Request(`https://lexveritasacademy.sites.bd/api/${path}${path === "notices" ? "?summary=1" : ""}`, { headers: { "X-LVA-Request": "1" } }));
      if (!response.ok) return null;
      const data = await response.json();
      if (path === "blogs" && Array.isArray(data))
        return data.slice(0, 8).map(({ content, author_description, ...summary }: any) => summary);
      if (path === "books" && Array.isArray(data)) return data.slice(0, 8);
      if (path === "packages" && Array.isArray(data)) return data.slice(0, 3);
      return data;
    } catch { return null; }
  }));
  return Object.fromEntries(paths.map((path, index) => [path === "study/home" ? "study" : path, values[index]]));
}
async function dispatch(r: Request): Promise<Response> {
  const u = new URL(r.url),
    p = u.pathname
      .replace(/^\/api\//, "")
      .split("/")
      .map((part) => {
        try {
          return decodeURIComponent(part);
        } catch {
          return part;
        }
      }),
    method = r.method,
    now = Date.now();
  if (method !== "GET" && method !== "HEAD") {
    const origin = r.headers.get("origin");
    if (origin && origin !== u.origin) fail("Request origin not allowed.", 403);
    if (!origin && r.headers.get("x-lva-request") !== "1")
      fail("Request verification failed.", 403);
  }
  if (p[0] === "study") {
    const { studyRequest } = await import("./study-server");
    return studyRequest(r, p.slice(1), async () => {
      const a = await auth(r);
      await authorizeAdmin(a, "study");
      return a;
    });
  }
  const body = async () => {
    if (Number(r.headers.get("content-length") || 0) > 2000000)
      fail("Request is too large.");
    return r.json();
  };
  if (p[0] === "settings" && method === "GET") {
    const vars = env as unknown as Record<string, string>;
    if (vars.INITIAL_ADMIN_HASH) {
      await run(
        "INSERT OR IGNORE INTO admins(id,username,password_hash,must_change,created_at) VALUES(?,?,?,?,?)",
        uid(),
        "lexveritas_admin",
        vars.INITIAL_ADMIN_HASH,
        1,
        now,
      );
      await seedCodes();
    }
    const preview = u.searchParams.get("preview") === "1";
    if (preview) {
      const administrator = await auth(r);
      await authorizeAdmin(administrator, "control");
    }
    return json(await setting(preview));
  }
  if (p[0] === "visitors" && method === "POST") {
    const existing = cookie(r, "lva_visitor");
    const visitorId = /^[a-f0-9-]{36}$/i.test(existing) ? existing : uid();
    await run(
      "INSERT INTO site_visitors(id,first_seen_at,last_seen_at,visit_count) VALUES(?,?,?,1) ON CONFLICT(id) DO UPDATE SET last_seen_at=excluded.last_seen_at,visit_count=visit_count+1",
      visitorId,
      now,
      now,
    );
    const [total, online] = await Promise.all([
      one("SELECT COUNT(*) total FROM site_visitors"),
      one(
        "SELECT COUNT(*) online FROM site_visitors WHERE last_seen_at>=?",
        now - 5 * 60 * 1000,
      ),
    ]);
    return json(
      { total: Number(total?.total || 0), online: Number(online?.online || 0) },
      200,
      {
        "Set-Cookie": cookieValue(r, "lva_visitor", visitorId, 31536000),
      },
    );
  }
  if (p[0] === "login" && method === "POST") {
    await throttle(r, "login", 8);
    const b = z
      .object({ username: textSchema, password: z.string().min(1).max(128) })
      .parse(await body());
    let a = await one(
      "SELECT * FROM admins WHERE username=? AND active=1",
      b.username,
    );
    const vars = env as unknown as Record<string, string>;
    if (
      !a &&
      b.username === "lexveritas_admin" &&
      vars.INITIAL_ADMIN_HASH &&
      !(await one("SELECT id FROM admins LIMIT 1"))
    ) {
      if (await compare(b.password, vars.INITIAL_ADMIN_HASH)) {
        await run(
          "INSERT OR IGNORE INTO admins(id,username,password_hash,must_change,created_at) VALUES(?,?,?,?,?)",
          uid(),
          b.username,
          vars.INITIAL_ADMIN_HASH,
          1,
          now,
        );
        a = await one("SELECT * FROM admins WHERE username=?", b.username);
      }
    }
    if (!a || !(await compare(b.password, a.password_hash)))
      fail("Username or password is incorrect.", 401);
    await run("UPDATE admins SET last_login_at=? WHERE id=?", now, a.id);
    await seedCodes();
    const t = token();
    await run(
      "INSERT INTO sessions VALUES(?,?,?)",
      await digest(t),
      a.id,
      now + 28800000,
    );
    return json({ mustChange: !!a.must_change }, 200, {
      "Set-Cookie": cookieValue(r, "lva_admin", t, 28800),
    });
  }
  if (p[0] === "logout" && method === "POST") {
    await run(
      "DELETE FROM sessions WHERE id=?",
      await digest(cookie(r, "lva_admin")),
    );
    return json({ ok: true }, 200, {
      "Set-Cookie": cookieValue(r, "lva_admin", "", 0),
    });
  }
  if (p[0] === "exams" && method === "GET") {
    if (!p[1])
      return json(
        await all(
          "SELECT e.id,e.title,e.description,e.start,e.end,e.duration,e.negative_mark,e.status,e.access_mode,e.attempt_limit,(SELECT COUNT(*) FROM questions q WHERE q.exam_id=e.id) question_count FROM exams e WHERE e.status IN ('published','closed') ORDER BY e.start DESC,e.created_at DESC",
        ),
      );
    const packageId = u.searchParams.get("package") || "";
    const e = await one(
      "SELECT e.id,e.title,e.description,e.syllabus,e.start,e.end,e.duration,e.correct_mark,e.negative_mark,e.status,e.access_mode,e.attempt_limit,e.results_published,(SELECT COUNT(*) FROM questions q WHERE q.exam_id=e.id) question_count FROM exams e WHERE e.id=? AND e.status IN ('published','closed')",
      p[1],
    );
    if (!e) fail("Examination not found.", 404);
    const viaPackage = packageId
      ? await one(
          "SELECT pe.id,p.access_mode FROM package_exams pe JOIN exam_packages p ON p.id=pe.package_id WHERE pe.package_id=? AND pe.exam_id=? AND p.published=1",
          packageId,
          e.id,
        )
      : null;
    if (viaPackage) {
      e.package_open=viaPackage.access_mode==="open";
      e.package_requires_code=viaPackage.access_mode!=="open";
      const studentSession=await packageSession(r,packageId);
      e.package_session=!!studentSession;
      if(studentSession)e.package_student={name:studentSession.name,university:studentSession.university};
      const routine = await one(
        "SELECT start,end FROM package_routines WHERE package_id=? AND exam_id=? ORDER BY CASE WHEN start<=? AND end>? THEN 0 WHEN start>? THEN 1 ELSE 2 END,start LIMIT 1",
        packageId,
        e.id,
        now,
        now,
        now,
      );
      if (routine) {
        e.start = routine.start;
        e.end = routine.end;
      }
    }
    const courseId=u.searchParams.get("course")||"";
    if(courseId){
      const lesson=await one("SELECT cc.access_mode FROM course_content cc JOIN courses cr ON cr.id=cc.course_id LEFT JOIN course_content par ON par.id=cc.parent_id LEFT JOIN course_content root ON root.id=par.parent_id WHERE cc.course_id=? AND cc.exam_id=? AND cc.status='published' AND (par.id IS NULL OR par.status='published') AND (root.id IS NULL OR root.status='published') AND cr.published=1 AND cr.active=1 LIMIT 1",courseId,e.id);
      if(lesson){
        e.course_open=lesson.access_mode==="public";
        e.course_requires_code=lesson.access_mode!=="public";
        const raw=cookie(r,`lva_course_${courseId.replace(/[^a-z0-9]/gi,"").slice(0,20)}`);
        e.course_session=!!raw&&!!await one("SELECT s.id FROM course_sessions s JOIN codes c ON c.id=s.code_id WHERE s.course_id=? AND s.token_hash=? AND s.expires>? AND c.active=1 AND (c.device_hash IS NULL OR c.device_hash=?)",courseId,await digest(raw),now,await digest(cookie(r,DEVICE_COOKIE)));
      }
    }
    return json({ ...e, serverTime: now });
  }
  if (p[0] === "exams" && p[2] === "start" && method === "POST") {
    const b = z
      .object({
        name: textSchema,
        university: textSchema,
        code: z.string().trim().max(100).default("").transform((v) => v.toUpperCase()),
        access: z.string().max(200).optional(),
        packageId: z.string().uuid().optional(),
        courseId: z.string().uuid().optional(),
      })
      .parse(await body());
    const e = await one(
      "SELECT * FROM exams WHERE id=? AND status IN ('published','closed')",
      p[1],
    );
    if (!e) fail("Examination is not available.");
    const openPackage=b.packageId?await one("SELECT p.id FROM exam_packages p JOIN package_exams pe ON pe.package_id=p.id WHERE p.id=? AND pe.exam_id=? AND p.published=1 AND p.available=1 AND p.status='active' AND p.access_mode='open'",b.packageId,e.id):null;
    const courseLink=b.courseId?await one("SELECT cc.access_mode FROM course_content cc JOIN courses cr ON cr.id=cc.course_id LEFT JOIN course_content par ON par.id=cc.parent_id LEFT JOIN course_content root ON root.id=par.parent_id WHERE cc.course_id=? AND cc.exam_id=? AND cc.status='published' AND (par.id IS NULL OR par.status='published') AND (root.id IS NULL OR root.status='published') AND cr.published=1 AND cr.active=1 LIMIT 1",b.courseId,e.id):null;
    const open=(b.packageId && !openPackage) || (b.courseId && courseLink?.access_mode!=="public") ? false : e.access_mode==="open" || !!openPackage || courseLink?.access_mode==="public";
    await throttle(r,open?"open-entry":"entry",open?120:20);
    if(!open && b.code.startsWith("OPEN-"))fail("Use an issued access code.",403);
    const device=cookie(r,DEVICE_COOKIE)||token();
    const anonymousCode=`OPEN-${(await digest(device)).slice(0,48)}`;
    if(open)await run("INSERT OR IGNORE INTO codes(id,code,active,created_at) VALUES(?,?,1,?)",uid(),anonymousCode,now);
    const courseCookie=b.courseId?cookie(r,`lva_course_${b.courseId.replace(/[^a-z0-9]/gi,"").slice(0,20)}`):"";
    const linkedSession=courseLink && courseCookie?await one("SELECT s.code_id FROM course_sessions s WHERE s.course_id=? AND s.token_hash=? AND s.expires>?",b.courseId,await digest(courseCookie),now):null;
    const linkedPackage=b.packageId&&!open?await packageSession(r,b.packageId):null;
    const c=linkedSession&&!open?await one("SELECT * FROM codes WHERE id=?",linkedSession.code_id):linkedPackage&&!b.code?await one("SELECT * FROM codes WHERE id=?",linkedPackage.code_id):await one("SELECT * FROM codes WHERE code=?",open?anonymousCode:b.code);
    if(!c || !c.active)fail("Invalid or inactive access code.",403);
    let entitledPackage:string|undefined=openPackage?.id;
    let oneAttemptOnly = false;
    let courseBound = !!courseLink && courseLink.access_mode !== "public";
    if(!open) {
      const packageAccess=await one("SELECT po.package_id FROM package_orders po JOIN package_exams pe ON pe.package_id=po.package_id WHERE po.access_code_id=? AND po.verified=1 AND po.access_suspended=0 AND (po.expires_at IS NULL OR po.expires_at>?) AND pe.exam_id=? LIMIT 1",c.id,now,e.id);
      const courseAccess=await one("SELECT cr.id,cr.package_id FROM course_orders co JOIN courses cr ON cr.id=co.course_id LEFT JOIN package_exams pe ON pe.package_id=cr.package_id WHERE co.access_code_id=? AND co.verified=1 AND co.access_suspended=0 AND (co.expires_at IS NULL OR co.expires_at>?) AND pe.exam_id=? LIMIT 1",c.id,now,e.id);
      const eligiblePackages=await all("SELECT pe.package_id FROM package_exams pe JOIN code_entitlements ce ON ce.resource_type='package' AND ce.resource_id=pe.package_id AND ce.code_id=? WHERE pe.exam_id=?",c.id,e.id);
      const courseExam=await one("SELECT cc.id FROM course_content cc JOIN code_entitlements ce ON ce.resource_type='course' AND ce.resource_id=cc.course_id AND ce.code_id=? WHERE cc.exam_id=? AND cc.status='published'",c.id,e.id);
      const courseOrderExam=await one("SELECT cc.id FROM course_content cc JOIN course_orders co ON co.course_id=cc.course_id AND co.access_code_id=? AND co.verified=1 AND co.access_suspended=0 AND (co.expires_at IS NULL OR co.expires_at>?) WHERE cc.exam_id=? AND cc.status='published'",c.id,now,e.id);
      entitledPackage=packageAccess?.package_id||courseAccess?.package_id||eligiblePackages[0]?.package_id;
      const inPackage=entitledPackage&&await one("SELECT id FROM package_exams WHERE package_id=? AND exam_id=?",entitledPackage,e.id);
      const direct=await hasEntitlement(c.id,"exam",e.id);
      const assigned=await one("SELECT id FROM code_entitlements WHERE resource_type='exam' AND resource_id=? LIMIT 1",e.id);
      const legacy=!assigned&&!entitledPackage&&!courseAccess&&!await one("SELECT id FROM code_entitlements WHERE code_id=? LIMIT 1",c.id)&&!await one("SELECT id FROM package_orders WHERE access_code_id=? LIMIT 1",c.id)&&!await one("SELECT id FROM course_orders WHERE access_code_id=? LIMIT 1",c.id);
      if(!direct&&!inPackage&&!courseExam&&!courseOrderExam&&!legacy)fail("This code does not include this examination.",403);
      oneAttemptOnly=!!(inPackage||courseExam||courseOrderExam||courseAccess);
      courseBound=courseBound||!!(courseAccess||courseExam||courseOrderExam);
    }
    const deviceClaim=open || (entitledPackage && !courseBound)
      ? {headers:cookie(r,DEVICE_COOKIE)?{}:{"Set-Cookie":cookieValue(r,DEVICE_COOKIE,device,63072000)}}
      : await claimCodeDevice(r,c);
    const packageScope=b.courseId?null:(b.packageId && (openPackage?.id===b.packageId||entitledPackage===b.packageId)?b.packageId:null);
    if(b.packageId&&!packageScope&&!open)fail("This access code does not belong to this exam batch.",403);
    const existing = await one(
      "SELECT * FROM attempts WHERE exam_id=? AND code_id=? AND package_id IS ? AND status='active' ORDER BY started_at DESC LIMIT 1",
      e.id,
      c.id,
      packageScope,
    );
    if (existing) {
      if (
        existing.status === "active" &&
        existing.deadline > now &&
        existing.token_hash ===
          (await digest(cookie(r, "lva_attempt_" + existing.id)))
      )
        return json({ id: existing.id },200,deviceClaim.headers);
      if(existing.deadline>now)fail("An attempt is already active on the original browser.",409);
    }
    const totalAttempts=await one("SELECT COUNT(*) n FROM attempts WHERE exam_id=? AND code_id=? AND package_id IS ?",e.id,c.id,packageScope);
    if(totalAttempts.n >= (oneAttemptOnly ? 1 : Number(e.attempt_limit||1)))fail("The attempt limit for this examination has been reached.",409);
    const routine = entitledPackage
      ? await one(
          "SELECT start,end FROM package_routines WHERE package_id=? AND exam_id=? ORDER BY CASE WHEN start<=? AND end>? THEN 0 WHEN start>? THEN 1 ELSE 2 END,start LIMIT 1",
          entitledPackage,
          e.id,
          now,
          now,
          now,
        )
      : null;
    const windowStart = routine?.start ?? e.start,
      windowEnd = routine?.end ?? e.end;
    if (windowStart > now) fail("The examination has not started yet.");
    if (windowEnd <= now || e.status !== "published")
      fail("The examination has already ended.");
    if (!(await one("SELECT id FROM questions WHERE exam_id=? LIMIT 1", e.id)))
      fail("The examination has no questions yet.");
    const id = uid(),
      t = token();
    try {
      const created = await one(
        `INSERT INTO attempts(id,exam_id,code_id,package_id,token_hash,student_name,university,started_at,deadline) SELECT ?,e.id,c.id,?,?,?,?,?,MIN(?+e.duration*60000,?) FROM exams e,codes c WHERE e.id=? AND c.id=? AND c.active=1 AND e.status='published' AND ?<=? AND ?>? AND (SELECT COUNT(*) FROM attempts WHERE exam_id=e.id AND code_id=c.id AND package_id IS ?)<CASE WHEN ? THEN 1 ELSE e.attempt_limit END AND NOT EXISTS(SELECT 1 FROM attempts WHERE exam_id=e.id AND code_id=c.id AND package_id IS ? AND status='active' AND deadline>?) RETURNING id`,
        id,
        packageScope,
        await digest(t),
        b.name,
        b.university,
        now,
        now,
        windowEnd,
        e.id,
        c.id,
        windowStart,
        now,
        windowEnd,
        now,
        packageScope,
        +oneAttemptOnly,
        packageScope,
        now,
      );
      if (!created)
        fail("The examination or access code is no longer available.");
    } catch (err: any) {
      if (String(err).includes("UNIQUE"))
        fail("This code has already been used for this examination.");
      throw err;
    }
    const response=json({id},200,{"Set-Cookie":cookieValue(r,"lva_attempt_"+id,t,2592000)});
    if(deviceClaim.headers["Set-Cookie"])response.headers.append("Set-Cookie",deviceClaim.headers["Set-Cookie"]);
    return response;
  }
  if (p[0] === "lookup" && method === "POST") {
    await throttle(r, "lookup", 15);
    const b = z
      .object({ exam: textSchema, code: textSchema })
      .parse(await body());
    const a = await one(
      "SELECT a.*,c.device_hash FROM attempts a JOIN codes c ON c.id=a.code_id WHERE a.exam_id=? AND c.code=? ORDER BY a.started_at DESC LIMIT 1",
      b.exam,
      b.code.toUpperCase(),
    );
    const e = await one("SELECT * FROM exams WHERE id=?", b.exam);
    if (!a || !e || !released(e, now))
      fail("No released result is available for these details.");
    if(a.device_hash && a.device_hash!==await digest(cookie(r,DEVICE_COOKIE)))fail("Open results on the browser linked to this code.",403);
    await expire(e.id);
    return json(await viewAttempt(a));
  }
  if (p[0] === "attempts") {
    let a = await attemptAuth(r, p[1]);
    if (method === "GET") return json(await viewAttempt(a));
    if (p[2] === "submit") {
      await finish(a.id);
      return json(
        await viewAttempt(await one("SELECT * FROM attempts WHERE id=?", a.id)),
      );
    }
    if (p[2] === "answers") {
      if (now >= a.deadline) {
        await finish(a.id);
        fail("Time has expired. Your saved answers have been submitted.");
      }
      if (a.status !== "active")
        fail("This examination has already been submitted.");
      const b = z
        .object({
          questionId: textSchema,
          selected: z.number().int().min(0).max(4).nullable(),
        })
        .parse(await body());
      const q = await one(
        "SELECT * FROM questions WHERE id=? AND exam_id=?",
        b.questionId,
        a.exam_id,
      );
      if (
        !q ||
        (b.selected !== null && b.selected >= JSON.parse(q.options).length)
      )
        fail("Invalid answer.");
      const saved = await run(
        "INSERT INTO answers(id,attempt_id,question_id,selected) SELECT ?,?,?,? WHERE EXISTS(SELECT 1 FROM attempts WHERE id=? AND status='active' AND deadline>CAST((julianday('now')-2440587.5)*86400000 AS INTEGER)) ON CONFLICT(attempt_id,question_id) DO UPDATE SET selected=excluded.selected WHERE EXISTS(SELECT 1 FROM attempts WHERE id=? AND status='active' AND deadline>CAST((julianday('now')-2440587.5)*86400000 AS INTEGER))",
        uid(),
        a.id,
        q.id,
        b.selected,
        a.id,
        a.id,
      );
      if (!saved.meta.changes)
        fail("The exam has ended; this answer was not saved.");
      return json({ saved: true, serverTime: now });
    }
    if (p[2] === "flags") {
      if (now >= a.deadline) {
        await finish(a.id);
        fail("Time has expired. Your saved answers have been submitted.");
      }
      if (a.status !== "active")
        fail("This examination has already been submitted.");
      const b = z
        .object({ questionId: textSchema, flagged: z.boolean() })
        .parse(await body());
      const q = await one(
        "SELECT id FROM questions WHERE id=? AND exam_id=?",
        b.questionId,
        a.exam_id,
      );
      if (!q) fail("Invalid question.");
      const saved = await run(
        "INSERT INTO answers(id,attempt_id,question_id,selected,flagged) SELECT ?,?,?,NULL,? WHERE EXISTS(SELECT 1 FROM attempts WHERE id=? AND status='active' AND deadline>CAST((julianday('now')-2440587.5)*86400000 AS INTEGER)) ON CONFLICT(attempt_id,question_id) DO UPDATE SET flagged=excluded.flagged WHERE EXISTS(SELECT 1 FROM attempts WHERE id=? AND status='active' AND deadline>CAST((julianday('now')-2440587.5)*86400000 AS INTEGER))",
        uid(),
        a.id,
        q.id,
        +b.flagged,
        a.id,
        a.id,
      );
      if (!saved.meta.changes)
        fail("The exam has ended; this flag was not saved.");
      return json({ saved: true, serverTime: now });
    }
  }
  if (p[0] === "books" && method === "GET") {
    const fields =
      "b.id,b.title,b.author,b.exam_category,b.subject,b.type,b.price,b.old_price,b.description,b.cover,b.preview,b.stock_count,b.available,b.created_at,((SELECT COALESCE(SUM(hi.quantity),0) FROM hard_items hi JOIN hard_orders ho ON ho.id=hi.order_id WHERE hi.book_id=b.id AND ho.verified=1)+(SELECT COUNT(*) FROM soft_orders so WHERE so.book_id=b.id AND so.verified=1)) sold_count";
    if (p[1]) {
      const b = await one(
        `SELECT ${fields} FROM books b WHERE b.id=? AND b.published=1`,
        p[1],
      );
      if (!b) fail("Book not found.", 404);
      return json(b);
    }
    return json(
      await all(
        `SELECT ${fields} FROM books b WHERE b.published=1 ORDER BY b.created_at DESC`,
      ),
    );
  }
  if (p[0] === "packages" && p[1] && p[2] === "profile" && method === "PATCH") {
    const session=await packageSession(r,p[1]);
    if(!session)fail("Sign in with your package code first.",403);
    const b=z.object({name:textSchema,university:z.string().trim().max(150),phone:phone.or(z.literal("")),photo:z.string().uuid().nullable().optional()}).parse(await body());
    if(b.photo){const f=await one("SELECT id FROM files WHERE id=? AND mime IN ('image/png','image/jpeg','image/webp','image/avif')",b.photo);if(!f)fail("Invalid profile photo.")}
    await run("INSERT INTO package_profiles(id,package_id,code_id,name,university,phone,photo,updated_at) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(package_id,code_id) DO UPDATE SET name=excluded.name,university=excluded.university,phone=excluded.phone,photo=excluded.photo,updated_at=excluded.updated_at",uid(),p[1],session.code_id,b.name,b.university,b.phone,b.photo??session.photo??null,now);
    return json({ok:true});
  }
  if(p[0]==="packages"&&p[1]&&p[2]==="photo"&&method==="POST"){
    const session=await packageSession(r,p[1]);if(!session)fail("Sign in with your package code first.",403);
    const uploaded=(await r.formData()).get("file");if(!(uploaded instanceof File)||uploaded.size>2097152||uploaded.size<10)fail("Choose an image smaller than 2 MB.");
    const bytes=new Uint8Array(await uploaded.arrayBuffer());
    const png=bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71;
    const jpg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
    const webp=bytes[0]===82&&bytes[1]===73&&bytes[2]===70&&bytes[3]===70&&bytes[8]===87&&bytes[9]===69&&bytes[10]===66&&bytes[11]===80;
    if(!png&&!jpg&&!webp)fail("Use a PNG, JPEG or WebP image.");
    if(!env.BUCKET)fail("File storage is unavailable.",503);
    const fileId=uid(),mime=png?"image/png":jpg?"image/jpeg":"image/webp";
    await env.BUCKET.put(fileId,bytes,{httpMetadata:{contentType:mime}});
    await db().batch([db().prepare("INSERT INTO files(id,name,mime,visibility,created_at) VALUES(?,?,?,?,?)").bind(fileId,"Profile photo",mime,"private",now),db().prepare("INSERT INTO package_profiles(id,package_id,code_id,name,university,phone,photo,updated_at) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(package_id,code_id) DO UPDATE SET photo=excluded.photo,updated_at=excluded.updated_at").bind(uid(),p[1],session.code_id,session.name,session.university,session.phone,fileId,now)]);
    return json({id:fileId},201);
  }
  if(p[0]==="packages"&&p[1]&&p[2]==="photo"&&method==="GET"){
    const session=await packageSession(r,p[1]);if(!session||!session.photo)fail("Profile photo unavailable.",404);
    return fileResponse(session.photo,true,undefined,true);
  }
  if(p[0]==="packages"&&p[1]&&p[2]==="logout"&&method==="POST"){
    const name=packageCookieName(p[1]),value=cookie(r,name);
    if(value)await run("DELETE FROM package_sessions WHERE package_id=? AND token_hash=?",p[1],await digest(value));
    return json({ok:true},200,{"Set-Cookie":cookieValue(r,name,"",0)});
  }
  if(p[0]==="packages"&&p[1]&&p[2]==="materials"&&p[3]&&method==="GET"){
    const pack=await one("SELECT access_mode FROM exam_packages WHERE id=? AND published=1",p[1]);
    if(!pack)fail("Package not found.",404);
    if(pack.access_mode!=="open"&&!await packageSession(r,p[1]))fail("Sign in with your package code first.",403);
    const item=await one("SELECT pe.support_pdf,e.title FROM package_exams pe JOIN exams e ON e.id=pe.exam_id WHERE pe.package_id=? AND pe.exam_id=?",p[1],p[3]);
    if(!item?.support_pdf)fail("No PDF material is attached to this exam.",404);
    return fileResponse(item.support_pdf,true,item.title+" Study Material");
  }
  if (p[0] === "packages" && method === "GET") {
    if (p[1] && p[2] === "dashboard") {
      const session = await packageSession(r,p[1]);
      if (!session) fail("Enter your package access code to view your dashboard.",403);
      const exams = await all("SELECT e.id,e.title,e.status,e.duration,e.syllabus,pe.support_pdf,COALESCE((SELECT r.start FROM package_routines r WHERE r.package_id=pe.package_id AND r.exam_id=e.id ORDER BY r.display_order,r.start LIMIT 1),e.start) start,COALESCE((SELECT r.end FROM package_routines r WHERE r.package_id=pe.package_id AND r.exam_id=e.id ORDER BY r.display_order,r.start LIMIT 1),e.end) end FROM package_exams pe JOIN exams e ON e.id=pe.exam_id WHERE pe.package_id=? ORDER BY pe.display_order",p[1]);
      const routines=await all("SELECT r.exam_id,r.start,r.end,e.title exam_title FROM package_routines r JOIN exams e ON e.id=r.exam_id WHERE r.package_id=? ORDER BY r.display_order,r.start",p[1]);
      const performance = [];
      for (const exam of exams) {
        const attempt = await one("SELECT * FROM attempts WHERE exam_id=? AND code_id=? AND package_id=? ORDER BY started_at DESC LIMIT 1",exam.id,session.code_id,p[1]);
        const view = attempt ? await viewAttempt(attempt) : null;
        performance.push({ ...exam, attempt_id: attempt?.id || null, status: attempt?.status || "not_started", result: view?.result || null,
          review: view?.result ? view.questions.filter((q:any) => q.selected == null || q.selected !== q.correct_option).map((q:any) => ({ question:q.question,options:q.options,selected:q.selected,correct_option:q.correct_option,explanation:q.explanation })) : [] });
      }
      const pack=await one("SELECT title FROM exam_packages WHERE id=?",p[1]);
      return json({learner:session.name||"Learner",profile:{name:session.name,university:session.university,phone:session.phone,photo:session.photo},packageTitle:pack?.title||"Exam Batch",expiresAt:session.order_expires||null,routines,exams:performance});
    }
    const fields =
      "p.id,p.title,p.description,p.thumbnail,p.details,p.price,p.old_price,p.access_mode,p.detailed_explanations,p.leaderboard,p.status,p.max_participants,p.access_days,p.available,p.created_at,(SELECT COUNT(*) FROM package_exams pe WHERE pe.package_id=p.id) exam_count,(SELECT COUNT(*) FROM questions q JOIN package_exams pe ON pe.exam_id=q.exam_id WHERE pe.package_id=p.id) total_mcqs,(SELECT COUNT(*) FROM package_orders po WHERE po.package_id=p.id AND po.verified=1) participant_count";
    if (p[1]) {
      const pack = await one(
        `SELECT ${fields} FROM exam_packages p WHERE p.id=? AND p.published=1`,
        p[1],
      );
      if (!pack) fail("Exam package not found.", 404);
      pack.exams = await all(
        "SELECT e.id,e.title,e.description,e.syllabus,pe.support_pdf,(SELECT COUNT(*) FROM questions q WHERE q.exam_id=e.id) question_count,COALESCE((SELECT r.start FROM package_routines r WHERE r.package_id=pe.package_id AND r.exam_id=e.id ORDER BY r.display_order,r.start LIMIT 1),e.start) start,COALESCE((SELECT r.end FROM package_routines r WHERE r.package_id=pe.package_id AND r.exam_id=e.id ORDER BY r.display_order,r.start LIMIT 1),e.end) end,e.duration,e.status FROM package_exams pe JOIN exams e ON e.id=pe.exam_id WHERE pe.package_id=? ORDER BY pe.display_order,e.start,e.id",
        pack.id,
      );
      pack.routines = await all(
        "SELECT r.id,r.exam_id,r.start,r.end,e.title exam_title FROM package_routines r JOIN exams e ON e.id=r.exam_id WHERE r.package_id=? ORDER BY r.display_order,r.start",
        pack.id,
      );
      return json(pack);
    }
    return json(
      await all(
        `SELECT ${fields} FROM exam_packages p WHERE p.published=1 ORDER BY p.created_at DESC`,
      ),
    );
  }
  if (p[0] === "packages" && p[1] && p[2] === "access" && method === "POST") {
    await throttle(r,"package-access",15);
    const b = z.object({code:z.string().trim().min(5).max(100).transform(v=>v.toUpperCase())}).parse(await body());
    const entitlement = await one("SELECT c.id,c.active,o.name,o.expires_at,o.access_suspended,ce.id entitlement_id FROM codes c LEFT JOIN package_orders o ON o.access_code_id=c.id AND o.package_id=? AND o.verified=1 LEFT JOIN code_entitlements ce ON ce.code_id=c.id AND ce.resource_type='package' AND ce.resource_id=? WHERE c.code=? AND (o.id IS NOT NULL OR ce.id IS NOT NULL) LIMIT 1",p[1],p[1],b.code);
    if (!entitlement?.active || entitlement.access_suspended || (entitlement.expires_at && entitlement.expires_at <= now)) fail("Invalid or expired package access code.",403);
    const sessionToken=token();
    await run("INSERT INTO package_sessions(id,package_id,code_id,token_hash,expires,created_at) VALUES(?,?,?,?,?,?)",uid(),p[1],entitlement.id,await digest(sessionToken),now+2592000000,now);
    return json({ok:true},200,{"Set-Cookie":cookieValue(r,packageCookieName(p[1]),sessionToken,2592000)});
  }
  if (p[0] === "team" && method === "GET") {
    await seedAcademyContent();
    return json(
      await all(
        "SELECT id,name,role,details,photo FROM team_members WHERE active=1 ORDER BY display_order,created_at,id",
      ),
    );
  }
  if (p[0] === "notices" && method === "GET") {
    if (p[1] && p[2] === "download") {
      const notice = await one(
        "SELECT attachment FROM notices WHERE id=? AND published=1",
        p[1],
      );
      if (!notice) fail("Notice not found.", 404);
      if (!notice.attachment) fail("This notice has no attachment.", 404);
      return fileResponse(notice.attachment, true);
    }
    if (!p[1] && u.searchParams.get("summary") === "1")
      return json(
        await all(
          "SELECT id,title,content,notice_date,attachment FROM notices WHERE published=1 ORDER BY notice_date DESC,created_at DESC,id LIMIT 3",
        ),
      );
    const fields =
      "n.id,n.title,n.content,n.attachment,n.notice_date,f.name attachment_name,f.mime attachment_mime";
    if (p[1]) {
      const notice = await one(
        `SELECT ${fields} FROM notices n LEFT JOIN files f ON f.id=n.attachment WHERE n.id=? AND n.published=1`,
        p[1],
      );
      if (!notice) fail("Notice not found.", 404);
      return json(notice);
    }
    return json(
      await all(
        `SELECT ${fields} FROM notices n LEFT JOIN files f ON f.id=n.attachment WHERE n.published=1 ORDER BY n.notice_date DESC,n.created_at DESC,n.id LIMIT 100`,
      ),
    );
  }
  if (p[0] === "blog-categories" && method === "GET") {
    const rows = await all(
      "SELECT DISTINCT TRIM(category) AS category FROM blogs WHERE published=1 AND TRIM(category)!='' ORDER BY category COLLATE NOCASE",
    );
    return json(rows.map((row) => row.category));
  }
  if (p[0] === "blogs" && method === "GET") {
    const fields =
      "b.id,b.slug,b.title,b.thumbnail,b.excerpt,b.category,b.subcategory,b.tags,b.seo_title,b.meta_description,b.view_count,b.author_id,b.author_name,b.author_photo,b.author_description,b.content,b.publish_date,COALESCE(a.slug,'') author_slug";
    if (p[1]) {
      const blog = await one(
        `SELECT ${fields} FROM blogs b LEFT JOIN authors a ON a.id=b.author_id WHERE b.slug=? AND b.published=1`,
        p[1],
      );
      if (!blog) fail("Blog not found.", 404);
      await run("UPDATE blogs SET view_count=view_count+1 WHERE id=?", blog.id);
      const related = await all(
        `SELECT ${fields} FROM blogs b LEFT JOIN authors a ON a.id=b.author_id
         WHERE b.published=1 AND b.id!=? AND ((?!='' AND b.subcategory=?) OR (?!='' AND b.category=?))
         ORDER BY CASE WHEN b.subcategory=? THEN 0 ELSE 1 END,b.publish_date DESC,b.created_at DESC LIMIT 3`,
        blog.id,
        blog.subcategory,
        blog.subcategory,
        blog.category,
        blog.category,
        blog.subcategory,
      );
      return json({
        ...blog,
        view_count: Number(blog.view_count || 0) + 1,
        author_slug: blog.author_slug || slugify(blog.author_name),
        related: related.map((item) => ({
          ...item,
          author_slug: item.author_slug || slugify(item.author_name),
        })),
      });
    }
    const rows = await all(
      `SELECT ${fields} FROM blogs b LEFT JOIN authors a ON a.id=b.author_id WHERE b.published=1 ORDER BY b.publish_date DESC,b.created_at DESC`,
    );
    return json(
      rows.map((blog) => ({
        ...blog,
        author_slug: blog.author_slug || slugify(blog.author_name),
      })),
    );
  }
  if (p[0] === "authors" && method === "GET" && p[1]) {
    let author = await one(
      "SELECT id,slug,name,photo,description FROM authors WHERE slug=? AND active=1",
      p[1],
    );
    if (!author) {
      const legacy = await all(
        "SELECT author_name,author_photo,author_description FROM blogs WHERE published=1 ORDER BY publish_date DESC,created_at DESC",
      );
      const match = legacy.find((item) => slugify(item.author_name) === p[1]);
      if (!match) fail("Author not found.", 404);
      author = {
        id: null,
        slug: p[1],
        name: match.author_name,
        photo: match.author_photo,
        description: match.author_description,
      };
    }
    const fields =
      "b.id,b.slug,b.title,b.thumbnail,b.excerpt,b.category,b.subcategory,b.tags,b.seo_title,b.meta_description,b.view_count,b.author_id,b.author_name,b.author_photo,b.author_description,b.content,b.publish_date,COALESCE(a.slug,'') author_slug";
    const rows = await all(
      `SELECT ${fields} FROM blogs b LEFT JOIN authors a ON a.id=b.author_id WHERE b.published=1 AND (b.author_id=? OR (b.author_id IS NULL AND b.author_name=?)) ORDER BY b.publish_date DESC,b.created_at DESC`,
      author.id || "",
      author.name,
    );
    return json({
      ...author,
      blogs: rows.map((blog) => ({
        ...blog,
        author_slug: blog.author_slug || slugify(blog.author_name),
      })),
    });
  }
  if (p[0] === "reviews" && method === "GET")
    return json(
      await all(
        "SELECT id,review_text,reviewer_name,reviewer_photo,university,rating FROM reviews WHERE published=1 AND verified=1 AND active=1 ORDER BY display_order,created_at DESC,id LIMIT 100",
      ),
    );
  if (p[0] === "reviews" && p[1] === "photo" && method === "POST") {
    await throttle(r, "review-photo", 3);
    if (Number(r.headers.get("content-length") || 0) > 2100000) fail("Photo must be smaller than 2 MB.");
    const file = (await r.formData()).get("file");
    if (!(file instanceof File) || !file.size || file.size > 2000000) fail("Choose an image smaller than 2 MB.");
    const bytes = new Uint8Array(await file.arrayBuffer());
    const png = bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71;
    const jpg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
    const webp = bytes[0] === 82 && bytes[1] === 73 && bytes[2] === 70 && bytes[3] === 70 && bytes[8] === 87 && bytes[9] === 69 && bytes[10] === 66 && bytes[11] === 80;
    if (!png && !jpg && !webp) fail("Use a PNG, JPEG or WebP image.");
    if (!env.BUCKET) fail("Photo storage is temporarily unavailable.", 503);
    const id = uid(), mime = png ? "image/png" : jpg ? "image/jpeg" : "image/webp";
    await env.BUCKET.put(id, bytes, { httpMetadata: { contentType: mime } });
    await run("INSERT INTO files VALUES(?,?,?,?,?)", id, file.name.slice(0, 200), mime, "public", now);
    return json({ id });
  }
  if (p[0] === "reviews" && method === "POST") {
    await throttle(r, "review-submit", 3);
    const b = z.object({
      reviewer_name: z.string().trim().min(2).max(100),
      university: z.string().trim().min(2).max(150),
      rating: z.number().int().min(1).max(5),
      review_text: z.string().trim().min(10).max(2000),
      reviewer_photo: z.string().uuid().nullable().optional(),
      website: z.string().max(200).optional(),
    }).parse(await body());
    if (b.website) return json({ ok: true, pending: true }, 202);
    if (b.reviewer_photo && !(await one("SELECT id FROM files WHERE id=? AND mime LIKE 'image/%'", b.reviewer_photo))) fail("Invalid reviewer photo.");
    await run(
      "INSERT INTO reviews(id,review_text,reviewer_name,reviewer_photo,university,rating,verified,published,active,display_order,created_at,updated_at) VALUES(?,?,?,?,?,?,0,0,1,0,?,?)",
      uid(), b.review_text, b.reviewer_name, b.reviewer_photo || null, b.university, b.rating, now, now,
    );
    return json({ ok: true, pending: true }, 202);
  }
  if (p[0] === "courses" && method === "GET") {
    const fields =
      "id,name,thumbnail,description,full_description,category,subject,instructor,class_count,exam_count,sheet_count,price,regular_price,pricing_type,access_mode,duration_label,access_validity_days,enrollment_start,course_start,course_end,maximum_students,enrollment_open,featured,details,package_id,active,status";
    if (p[1]) {
      const course = await one(
        `SELECT ${fields} FROM courses WHERE id=? AND published=1`,
        p[1],
      );
      if (!course) fail("Course not found.", 404);
      return json(course);
    }
    return json(
      await all(
        `SELECT ${fields} FROM courses WHERE published=1 ORDER BY created_at DESC,id`,
      ),
    );
  }
  if (p[0] === "course-learning" && p[1]) {
    const courseId = p[1],
      sessionCookie = cookie(
        r,
        `lva_course_${courseId.replace(/[^a-z0-9]/gi, "").slice(0, 20)}`,
      );
    const course = await one(
      "SELECT * FROM courses WHERE id=? AND published=1 AND active=1 AND status='published'",
      courseId,
    );
    if (!course) fail("Course is not available.", 404);
    const session = sessionCookie
      ? await one(
          "SELECT s.*,c.active code_active,c.device_hash,o.expires_at order_expires,o.access_suspended,ce.id entitlement_id FROM course_sessions s JOIN codes c ON c.id=s.code_id LEFT JOIN course_orders o ON o.course_id=s.course_id AND o.access_code_id=s.code_id AND o.verified=1 LEFT JOIN code_entitlements ce ON ce.code_id=s.code_id AND ce.resource_type='course' AND ce.resource_id=s.course_id WHERE s.course_id=? AND s.token_hash=? AND s.expires>? AND (o.id IS NOT NULL OR ce.id IS NOT NULL)",
          courseId,
          await digest(sessionCookie),
          now,
        )
      : null;
    const authorized =
      !!session &&
      !!session.code_active &&
      (!session.device_hash || session.device_hash===await digest(cookie(r,DEVICE_COOKIE))) &&
      !session.access_suspended &&
      (!session.order_expires || session.order_expires > now);
    if (p[2] === "access" && method === "POST") {
      await throttle(r, `course-access:${courseId}`, 20);
      const b = z
        .object({
          code: z
            .string()
            .trim()
            .min(1)
            .max(100)
            .transform((v) => v.toUpperCase()),
        })
        .parse(await body());
      const entitlement = await one(
        "SELECT c.id code_id,c.active,o.expires_at,o.access_suspended,ce.id entitlement_id FROM codes c LEFT JOIN course_orders o ON o.access_code_id=c.id AND o.course_id=? AND o.verified=1 LEFT JOIN code_entitlements ce ON ce.code_id=c.id AND ce.resource_type='course' AND ce.resource_id=? WHERE c.code=? AND (o.id IS NOT NULL OR ce.id IS NOT NULL) ORDER BY o.created_at DESC LIMIT 1",
        courseId,
        courseId,
        b.code,
      );
      if (!entitlement || !entitlement.active)
        fail("This course access code is invalid or inactive.", 403);
      if (entitlement.access_suspended)
        fail(
          "This course access has been suspended. Please contact support.",
          403,
        );
      if (entitlement.expires_at && entitlement.expires_at <= now)
        fail("Your course access has expired.", 403);
      const claimed=await claimCodeDevice(r,{id:entitlement.code_id});
      await run("UPDATE course_orders SET first_access_ip=COALESCE(first_access_ip,?) WHERE course_id=? AND access_code_id=? AND verified=1",(r.headers.get("cf-connecting-ip") || "").slice(0,45),courseId,entitlement.code_id);
      const raw = token(),
        expires = Math.min(
          entitlement.expires_at ||
            now + Number(course.access_validity_days || 365) * 86400000,
          now + Number(course.access_validity_days || 365) * 86400000,
        ),
        sid = uid();
      await run(
        "INSERT INTO course_sessions(id,course_id,code_id,token_hash,expires,created_at) VALUES(?,?,?,?,?,?) ON CONFLICT(course_id,code_id) DO UPDATE SET token_hash=excluded.token_hash,expires=excluded.expires",
        sid,
        courseId,
        entitlement.code_id,
        await digest(raw),
        expires,
        now,
      );
      const response=json({ ok: true }, 200, {
        "Set-Cookie": cookieValue(
          r,
          `lva_course_${courseId.replace(/[^a-z0-9]/gi, "").slice(0, 20)}`,
          raw,
          Math.max(1, Math.floor((expires - now) / 1000)),
        ),
      });
      if(claimed.headers["Set-Cookie"])response.headers.append("Set-Cookie",claimed.headers["Set-Cookie"]);
      return response;
    }
    const allContent=await all("SELECT * FROM course_content WHERE course_id=? ORDER BY display_order,id",courseId);
    const byId=new Map(allContent.map((item:any)=>[item.id,item]));
    const visibleContent=allContent.filter((item:any)=>{
      if(item.status!=="published")return false;
      const seen=new Set([item.id]);let parent=item.parent_id;
      while(parent){if(seen.has(parent))return false;seen.add(parent);const node:any=byId.get(parent);if(!node||node.status!=="published")return false;parent=node.parent_id}
      return true;
    });
    const completed = authorized
      ? await all(
          "SELECT content_id FROM course_progress WHERE course_id=? AND code_id=? AND completed=1",
          courseId,
          session.code_id,
        )
      : [];
    const examScores = authorized
      ? await all(
          "SELECT exam_id,MAX(score) best_score FROM attempts WHERE code_id=? AND status='submitted' GROUP BY exam_id",
          session.code_id,
        )
      : [];
    const scoreMap = new Map(
        examScores.map((x: any) => [x.exam_id, x.best_score]),
      ),
      completedSet = new Set(completed.map((x: any) => x.content_id));
    for (const item of visibleContent)
      if (
        item.lesson_type === "exam" &&
        item.exam_id &&
        scoreMap.has(item.exam_id)
      )
        completedSet.add(item.id);
    const lessons = visibleContent.filter((x: any) => x.node_type === "lesson"),
      progressPercent = lessons.length
        ? Math.round((100 * completedSet.size) / lessons.length)
        : 0;
    const withLocks = visibleContent.map((item: any, index: number) => {
      let locked = !authorized && item.access_mode!=="public" && !item.free_preview;
      if (authorized && item.node_type === "lesson") {
        if (course.sequential_learning) {
          const previous = [...visibleContent]
            .slice(0, index)
            .reverse()
            .find((x: any) => x.node_type === "lesson");
          if (previous && !completedSet.has(previous.id)) locked = true;
        }
        if (item.unlock_rule === "previous_lesson") {
          const previous = [...visibleContent]
            .slice(0, index)
            .reverse()
            .find((x: any) => x.node_type === "lesson");
          if (previous && !completedSet.has(previous.id)) locked = true;
        }
        if (
          item.unlock_rule === "progress" &&
          progressPercent < Number(item.unlock_value || 0)
        )
          locked = true;
        if (
          item.unlock_rule === "scheduled" &&
          new Date(item.unlock_value).getTime() > now
        )
          locked = true;
        if (item.unlock_rule === "manual") locked = true;
      }
      return {
        ...item,
        resources: locked ? [] : jsonList(item.resources),
        exam_score: item.exam_id ? (scoreMap.get(item.exam_id) ?? null) : null,
        locked,
        body: locked ? "" : item.body,
        video_url: locked ? null : item.video_url,
        video_id: locked ? null : item.video_id,
        file_id: locked ? null : item.file_id,
        external_url: locked ? null : item.external_url,
      };
    });
    const contentId = p[3] === "progress" ? null : p[3];
    if (p[2] === "progress" && method === "POST") {
      if (!authorized) fail("Enter your enrolled course access code.", 403);
      const b = z
        .object({
          contentId: z.string().uuid(),
          completed: z.boolean(),
          watchedSeconds: z.number().int().min(0).max(864000).optional(),
        })
        .parse(await body());
      const item = visibleContent.find(
        (x: any) => x.id === b.contentId && x.node_type === "lesson",
      );
      if (!item) fail("Lesson not found.", 404);
      const locked = withLocks.find((x: any) => x.id === b.contentId)?.locked;
      if (locked)
        fail("Complete the required content before opening this lesson.", 403);
      await db().batch([
        db()
          .prepare(
            "INSERT INTO course_progress(id,course_id,code_id,content_id,completed,watched_seconds,opened_at,completed_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(course_id,code_id,content_id) DO UPDATE SET completed=excluded.completed,watched_seconds=MAX(course_progress.watched_seconds,excluded.watched_seconds),completed_at=excluded.completed_at,updated_at=excluded.updated_at",
          )
          .bind(
            uid(),
            courseId,
            session.code_id,
            b.contentId,
            +b.completed,
            b.watchedSeconds || 0,
            now,
            b.completed ? now : null,
            now,
          ),
        db()
          .prepare(
            "UPDATE course_sessions SET last_accessed_content_id=? WHERE id=?",
          )
          .bind(b.contentId, session.id),
      ]);
      return json({ ok: true });
    }
    if (p[2] === "content" && contentId && method === "GET") {
      const item = withLocks.find((x: any) => x.id === contentId);
      if (!item || item.locked) fail("This course resource is locked.", 403);
      if (p[4] === "file") {
        if (!item.file_id) fail("File not found.", 404);
        return fileResponse(item.file_id, true, item.title, true);
      }
      if (p[4] === "resource" && p[5]) {
        const resource = jsonList(item.resources).find(
          (x: any) => x.id === p[5],
        );
        if (!resource?.file_id) fail("Resource not found.", 404);
        return fileResponse(
          resource.file_id,
          true,
          resource.title || item.title,
          !resource.download_allowed,
        );
      }
    }
    if (method === "GET")
      return json({
        course,
        content: withLocks,
        authorized,
        completed_ids: [...completedSet],
        progress_percent: progressPercent,
        last_accessed_lesson: authorized
          ? session.last_accessed_content_id
          : null,
      });
  }
  if (p[0] === "notes" && method === "GET") {
    if (p[1] && p[2] === "download") {
      const note = await one(
        "SELECT id,title,file,link FROM notes WHERE id=? AND published=1",
        p[1],
      );
      if (!note) fail("Note not found.", 404);
      if (!note.file && !note.link) fail("Note file is not available.", 404);
      const response = note.file
        ? await fileResponse(note.file, true, note.title)
        : Response.redirect(note.link, 302);
      await run(
        "UPDATE notes SET download_count=download_count+1 WHERE id=?",
        note.id,
      );
      return response;
    }
    if (p[1] && p[2] === "view") {
      const note = await one(
        "SELECT n.id,n.category,n.subcategory,n.title,n.description,n.subject,n.page_count,n.reading_minutes,n.thumbnail,n.file,n.link,n.download_count,n.created_at,f.mime file_mime FROM notes n LEFT JOIN files f ON f.id=n.file WHERE n.id=? AND n.published=1",
        p[1],
      );
      if (!note) fail("Note not found.", 404);
      const categories = jsonList(note.category),
        subcategories = jsonList(note.subcategory),
        subjects = jsonList(note.subject);
      return json({
        ...note,
        category: categories[0] || "",
        categories,
        subcategory: subcategories[0] || "",
        subcategories,
        subject: subjects.join(", "),
        subjects,
      });
    }
    const category = p[1] || "";
    const rows = await all(
      "SELECT n.id,n.category,n.subcategory,n.title,n.description,n.subject,n.page_count,n.reading_minutes,n.thumbnail,n.file,n.link,n.download_count,n.created_at,f.mime file_mime FROM notes n LEFT JOIN files f ON f.id=n.file WHERE n.published=1 AND (?='' OR n.category=? OR EXISTS(SELECT 1 FROM json_each(CASE WHEN json_valid(n.category) THEN n.category ELSE json_array(n.category) END) WHERE value=?)) ORDER BY n.created_at DESC,n.id",
      category,
      category,
      category,
    );
    return json(
      rows.map((n) => {
        const categories = jsonList(n.category),
          subcategories = jsonList(n.subcategory),
          subjects = jsonList(n.subject);
        return {
          ...n,
          category: categories[0] || "",
          categories,
          subcategory: subcategories[0] || "",
          subcategories,
          subject: subjects.join(", "),
          subjects,
        };
      }),
    );
  }
  if (p[0] === "coupons" && p[1] === "validate" && method === "POST") {
    await throttle(r, "coupon-validate", 30);
    const b = z
      .object({
        code: z.string().trim().min(1).max(40),
        amount: money,
        orderType: z.enum(["hardcopy", "softcopy", "course", "package"]),
        productIds: z.array(z.string()).max(50).default([]),
      })
      .parse(await body());
    return json(
      await couponDiscount(b.code, b.amount, b.orderType, b.productIds),
    );
  }
  if (p[0] === "orders" && p[1] === "track" && method === "POST") {
    await throttle(r, "order-track", 12);
    const b = z
      .object({
        id: z
          .string()
          .trim()
          .regex(/^LVA-[HSPC]-\d{4}-[A-F0-9]{12}$/i, "Enter a valid Order ID."),
      })
      .parse(await body());
    const kind = b.id.slice(4, 5).toUpperCase(),
      table =
        kind === "H"
          ? "hard_orders"
          : kind === "P"
            ? "package_orders"
            : kind === "C"
              ? "course_orders"
              : "soft_orders";
    const order = await one(
      `SELECT * FROM ${table} WHERE id=?`,
      b.id.toUpperCase(),
    );
    if (!order) fail("No order was found with this Order ID.", 404);
    delete order.token_hash;
    const type =
      kind === "H"
        ? "hardcopy"
        : kind === "P"
          ? "package"
          : kind === "C"
            ? "course"
            : "softcopy";
    const items =
      table === "hard_orders"
        ? await all(
            "SELECT title,quantity,price FROM hard_items WHERE order_id=? ORDER BY id",
            order.id,
          )
        : [];
    return json({
      ...order,
      type,
      items,
      title: order.book_title || order.package_title || order.course_name,
      total: order.total ?? order.price,
      paid: order.paid ?? order.price,
      due: order.due ?? 0,
    });
  }
  if (p[0] === "orders" && method === "POST") {
    await throttle(r, "orders", 20);
    const b = z
      .object({
        type: z.enum(["hardcopy", "softcopy", "package", "course"]),
        name: textSchema,
        phone,
        email: z.string().trim().email().max(200).optional(),
        trx,
        paymentMethod: z
          .enum(["bkash", "nagad", "rocket", "cash_on_delivery", "other"])
          .default("bkash"),
        couponCode: z.string().trim().max(40).optional(),
        address: z.string().trim().min(5).max(1000).optional(),
        delivery: z.enum(["sundarban", "dhaka", "outside"]).optional(),
        paymentType: z.enum(["full", "cod"]).optional(),
        bookId: z.string().optional(),
        packageId: z.string().optional(),
        courseId: z.string().optional(),
        items: z
          .array(
            z.object({
              id: textSchema,
              quantity: z.number().int().min(1).max(99),
            }),
          )
          .min(1)
          .max(50)
          .optional(),
      })
      .parse(await body());
    const t = token(),
      h = await digest(t),
      id = `LVA-${b.type === "hardcopy" ? "H" : b.type === "softcopy" ? "S" : b.type === "package" ? "P" : "C"}-${new Date(now + 21600000).getUTCFullYear()}-${token().slice(0, 12).toUpperCase()}`;
    let freeCourse = false;
    if (b.type === "hardcopy") {
      if (!b.address || !b.items || !b.delivery || !b.paymentType)
        fail("Complete your address, cart, delivery and payment choices.");
      if (new Set(b.items.map((x) => x.id)).size !== b.items.length)
        fail("Duplicate cart items.");
      const items = [];
      let subtotal = 0;
      for (const i of b.items) {
        const book = await one(
          "SELECT * FROM books WHERE id=? AND type='hardcopy' AND published=1 AND available=1",
          i.id,
        );
        if (!book) fail("A book in your cart is no longer available.");
        if (book.stock_count !== null && book.stock_count < i.quantity)
          fail(`${book.title} does not have enough stock for this quantity.`);
        subtotal += book.price * i.quantity;
        items.push({ ...i, title: book.title, price: book.price });
      }
      let total;
      try {
        total = totals(subtotal, b.delivery, b.paymentType, await setting());
      } catch (e: any) {
        fail(e.message);
      }
      const coupon = await couponDiscount(
        b.couponCode,
        total!.subtotal,
        "hardcopy",
        items.map((x) => x.id),
        b.phone,
      );
      const discountedSubtotal = total!.subtotal - coupon.discount,
        discountedTotal = discountedSubtotal + total!.delivery_charge,
        discountedPaid =
          b.paymentType === "cod" ? total!.delivery_charge : discountedTotal,
        discountedDue = b.paymentType === "cod" ? discountedSubtotal : 0;
      await db().batch([
        db()
          .prepare(
            "INSERT INTO hard_orders(id,token_hash,created_at,name,address,phone,email,payment_method,coupon_code,discount_amount,trx,subtotal,delivery,delivery_charge,payment_type,paid,due,total) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
          )
          .bind(
            id,
            h,
            now,
            b.name,
            b.address,
            b.phone,
            b.email || null,
            b.paymentMethod,
            coupon.code,
            coupon.discount,
            b.trx,
            discountedSubtotal,
            b.delivery,
            total!.delivery_charge,
            b.paymentType,
            discountedPaid,
            discountedDue,
            discountedTotal,
          ),
        ...items.map((i) =>
          db()
            .prepare("INSERT INTO hard_items VALUES(?,?,?,?,?,?)")
            .bind(uid(), id, i.id, i.title, i.quantity, i.price),
        ),
        ...items.map((i) =>
          db()
            .prepare(
              "UPDATE books SET stock_count=stock_count-?,available=CASE WHEN stock_count-?<=0 THEN 0 ELSE available END WHERE id=? AND stock_count IS NOT NULL",
            )
            .bind(i.quantity, i.quantity, i.id),
        ),
      ]);
    } else if (b.type === "softcopy") {
      const book = await one(
        "SELECT * FROM books WHERE id=? AND type='softcopy' AND published=1 AND available=1",
        b.bookId || "",
      );
      if (!book) fail("This softcopy is not available.");
      const coupon = await couponDiscount(
        b.couponCode,
        book.price,
        "softcopy",
        [book.id],
        b.phone,
      );
      await run(
        "INSERT INTO soft_orders(id,token_hash,created_at,book_id,book_title,price,name,phone,email,payment_method,coupon_code,discount_amount,trx) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)",
        id,
        h,
        now,
        book.id,
        book.title,
        book.price - coupon.discount,
        b.name,
        b.phone,
        b.email || null,
        b.paymentMethod,
        coupon.code,
        coupon.discount,
        b.trx,
      );
    } else if (b.type === "package") {
      const pack = await one(
        "SELECT * FROM exam_packages WHERE id=? AND published=1 AND available=1",
        b.packageId || "",
      );
      if (!pack) fail("This exam package is not available.");
      if (pack.status !== "active")
        fail("This exam package is not accepting purchases.");
      if (pack.max_participants) {
        const occupied = await one(
          "SELECT COUNT(*) n FROM package_orders WHERE package_id=?",
          pack.id,
        );
        if (occupied.n >= pack.max_participants)
          fail("All seats in this exam package have been filled.");
      }
      if (
        !(await one(
          "SELECT id FROM package_exams WHERE package_id=? LIMIT 1",
          pack.id,
        ))
      )
        fail("This exam package does not contain any examinations yet.");
      const coupon = await couponDiscount(
        b.couponCode,
        pack.price,
        "package",
        [pack.id],
        b.phone,
      );
      await run(
        "INSERT INTO package_orders(id,token_hash,created_at,package_id,package_title,price,name,phone,email,payment_method,coupon_code,discount_amount,trx) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)",
        id,
        h,
        now,
        pack.id,
        pack.title,
        pack.price - coupon.discount,
        b.name,
        b.phone,
        b.email || null,
        b.paymentMethod,
        coupon.code,
        coupon.discount,
        b.trx,
      );
    } else {
      const course = await one(
        "SELECT * FROM courses WHERE id=? AND published=1 AND active=1",
        b.courseId || "",
      );
      if (!course) fail("This course is not available for enrollment.");
      if (!course.enrollment_open)
        fail("Enrollment for this course is closed.");
      if (course.enrollment_start && course.enrollment_start > now)
        fail("Enrollment has not opened yet.");
      if (course.maximum_students) {
        const occupied = await one(
          "SELECT COUNT(*) n FROM course_orders WHERE course_id=? AND verified=1",
          course.id,
        );
        if (Number(occupied?.n || 0) >= course.maximum_students)
          fail("All available seats in this course have been filled.");
      }
      freeCourse = course.pricing_type === "free" || course.price === 0;
      const coupon = await couponDiscount(
        b.couponCode,
        course.price,
        "course",
        [course.id],
        b.phone,
      );
      await run(
        "INSERT INTO course_orders(id,token_hash,created_at,course_id,course_name,price,name,phone,email,payment_method,coupon_code,discount_amount,trx) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)",
        id,
        h,
        now,
        course.id,
        course.name,
        course.price - coupon.discount,
        b.name,
        b.phone,
        b.email || null,
        b.paymentMethod,
        coupon.code,
        coupon.discount,
        b.trx,
      );
      if (freeCourse) {
        let code = accessCode();
        while (await one("SELECT id FROM codes WHERE code=?", code))
          code = accessCode();
        const codeId = uid(),
          expires = now + Number(course.access_validity_days || 365) * 86400000;
        await db().batch([
          db()
            .prepare(
              "INSERT INTO codes(id,code,active,created_at) VALUES(?,?,1,?)",
            )
            .bind(codeId, code, now),
          db()
            .prepare(
              "UPDATE course_orders SET verified=1,verified_at=?,verified_by='automatic_free_enrollment',access_code_id=?,activated_at=?,expires_at=? WHERE id=?",
            )
            .bind(now, codeId, now, expires, id),
        ]);
      }
    }
    const paymentAmount =
      b.type === "hardcopy"
        ? (await one("SELECT paid amount FROM hard_orders WHERE id=?", id))
            .amount
        : (
            await one(
              `SELECT price amount FROM ${b.type === "softcopy" ? "soft_orders" : b.type === "package" ? "package_orders" : "course_orders"} WHERE id=?`,
              id,
            )
          ).amount;
    await run(
      "INSERT OR IGNORE INTO payments(id,order_id,order_type,customer,amount,method,transaction_id,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)",
      uid(),
      id,
      b.type,
      b.name,
      paymentAmount,
      b.paymentMethod,
      b.trx,
      freeCourse ? "paid" : "pending",
      now,
      now,
    );
    if (b.couponCode) {
      const used = await one(
        "SELECT discount_amount,coupon_code FROM " +
          (b.type === "hardcopy"
            ? "hard_orders"
            : b.type === "softcopy"
              ? "soft_orders"
              : b.type === "package"
                ? "package_orders"
                : "course_orders") +
          " WHERE id=?",
        id,
      );
      if (used?.coupon_code) {
        const c = await one(
          "SELECT id FROM coupons WHERE code=?",
          used.coupon_code,
        );
        await db().batch([
          db()
            .prepare(
              "UPDATE coupons SET times_used=times_used+1,total_discount=total_discount+?,updated_at=? WHERE id=?",
            )
            .bind(used.discount_amount, now, c.id),
          db()
            .prepare(
              "INSERT INTO coupon_redemptions(id,coupon_id,user_key,order_id,discount_amount,created_at) VALUES(?,?,?,?,?,?)",
            )
            .bind(uid(), c.id, b.phone, id, used.discount_amount, now),
        ]);
      }
    }
    return json({ id, type: b.type }, 201, {
      "Set-Cookie": cookieValue(r, "lva_order_" + id, t, 2592000),
    });
  }
  if (p[0] === "orders" && p[1] && method === "GET") {
    const table = p[1].startsWith("LVA-H-")
      ? "hard_orders"
      : p[1].startsWith("LVA-P-")
        ? "package_orders"
        : p[1].startsWith("LVA-C-")
          ? "course_orders"
          : "soft_orders";
    const o = await one(`SELECT * FROM ${table} WHERE id=?`, p[1]);
    if (!o || o.token_hash !== (await digest(cookie(r, "lva_order_" + p[1]))))
      fail("Order is unavailable in this browser.", 403);
    if (p[2] === "download") {
      if (table !== "soft_orders" || !o.verified)
        fail("Payment verification is pending.", 403);
      const book = await one("SELECT digital FROM books WHERE id=?", o.book_id);
      if (!book?.digital)
        fail(
          "The digital file is not available yet. Please contact the Academy.",
          404,
        );
      const response = await fileResponse(book.digital, true);
      const claimed = await run(
        "UPDATE soft_orders SET downloaded_at=? WHERE id=? AND verified=1 AND downloaded_at IS NULL",
        now,
        o.id,
      );
      if (Number((claimed as any).meta?.changes || 0) !== 1)
        fail("This softcopy has already been downloaded.", 410);
      return response;
    }
    const purchasedCode =
      (table === "package_orders" || table === "course_orders") &&
      o.verified &&
      o.access_code_id
        ? await one("SELECT code FROM codes WHERE id=?", o.access_code_id)
        : null;
    const digitalBook =
      table === "soft_orders"
        ? await one("SELECT digital FROM books WHERE id=?", o.book_id)
        : null;
    return json({
      id: o.id,
      verified: !!o.verified,
      total: o.total ?? o.price,
      paid: o.paid ?? o.price,
      due: o.due ?? 0,
      delivered: !!o.delivered,
      received: !!o.received,
      type:
        table === "hard_orders"
          ? "hardcopy"
          : table === "package_orders"
            ? "package"
            : table === "course_orders"
              ? "course"
              : "softcopy",
      title: o.package_title || o.course_name || o.book_title,
      accessCode: purchasedCode?.code || null,
      downloadAvailable:
        table === "soft_orders" &&
        !!o.verified &&
        !o.downloaded_at &&
        !!digitalBook?.digital,
      downloadedAt: o.downloaded_at || null,
    });
  }
  if (p[0] === "files" && method === "GET") return fileResponse(p[1], false);
  if (p[0] === "admin") {
    if(p[1]==="backup" && p[2]==="google" && p[3]==="callback" && method==="GET")
      return googleDriveCallback(r,u);
    const a = await auth(r, p[1] === "me" || p[1] === "password");
    await authorizeAdmin(a, p[1]);
    if (p[1] === "me")
      {
        const role = await adminRole(a);
        const access = await accessControl();
        return json({
          username: a.username,
          mustChange: !!a.must_change,
          role,
          allowedModules: access.roles?.[role] || rolePermissions[role] || rolePermissions.editor,
        });
      }
    if (p[1] === "password" && method === "POST") {
      const b = z
        .object({
          current: z.string().max(128),
          password: z.string().min(14).max(72),
        })
        .parse(await body());
      if (!(await compare(b.current, a.password_hash)))
        fail("Current password is incorrect.");
      if (await compare(b.password, a.password_hash))
        fail("Choose a different password.");
      await db().batch([
        db()
          .prepare("UPDATE admins SET password_hash=?,must_change=0 WHERE id=?")
          .bind(await hash(b.password, 12), a.id),
        db().prepare("DELETE FROM sessions WHERE admin_id=?").bind(a.id),
      ]);
      await audit(a, "password_changed", a.id);
      return json({ ok: true }, 200, {
        "Set-Cookie": cookieValue(r, "lva_admin", "", 0),
      });
    }
    if (p[1] === "dashboard") {
      const v = await one(
        "SELECT (SELECT COUNT(*) FROM exams WHERE status!='archived') exams,(SELECT COUNT(*) FROM exams WHERE status='published' AND start<=? AND end>?) active,(SELECT COUNT(*) FROM attempts) participants,(SELECT COUNT(*) FROM codes) codes,(SELECT COUNT(*) FROM hard_orders) hardcopy,(SELECT COUNT(*) FROM soft_orders) softcopy,(SELECT COUNT(*) FROM exam_packages) packages,(SELECT COUNT(*) FROM package_orders) package_orders,(SELECT COUNT(*) FROM courses) courses,(SELECT COUNT(*) FROM course_orders) course_orders,(SELECT COUNT(*) FROM blogs) blogs,(SELECT COUNT(*) FROM reviews) reviews,(SELECT COUNT(*) FROM hard_orders WHERE verified=0)+(SELECT COUNT(*) FROM soft_orders WHERE verified=0)+(SELECT COUNT(*) FROM package_orders WHERE verified=0)+(SELECT COUNT(*) FROM course_orders WHERE verified=0) unverified",
        now,
        now,
      );
      return json(v);
    }
    if (p[1] === "youtube-check" && method === "POST") {
      const b = z
        .object({ url: z.string().url().max(500) })
        .parse(await body());
      let id = "";
      try {
        const link = new URL(b.url);
        id = link.hostname.includes("youtu.be")
          ? link.pathname.split("/")[1] || ""
          : link.pathname.startsWith("/shorts/") ||
              link.pathname.startsWith("/embed/")
            ? link.pathname.split("/")[2] || ""
            : link.searchParams.get("v") || "";
      } catch {}
      if (!/^[A-Za-z0-9_-]{6,20}$/.test(id))
        fail("Enter a valid YouTube video URL.");
      try {
        const response = await fetch(
          `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}`,
        );
        if (!response.ok)
          fail(
            "This YouTube video cannot be embedded. Please use another video or change the YouTube embedding/privacy settings.",
            409,
          );
        const info: any = await response.json();
        return json({
          ok: true,
          videoId: id,
          title: String(info.title || "").slice(0, 300),
          thumbnail: String(info.thumbnail_url || ""),
        });
      } catch (error: any) {
        if (error instanceof ApiError) throw error;
        fail(
          "This YouTube video cannot be embedded. Please use another video or change the YouTube embedding/privacy settings.",
          409,
        );
      }
    }
    if (p[1] === "course-builder") {
      const courseId = p[2],
        options = async () => ({
          exams: await all(
            "SELECT e.id,e.title,e.duration,e.negative_mark,e.pass_mark,e.status,COUNT(q.id) question_count,COUNT(q.id)*e.correct_mark total_marks,e.start,e.end,e.result_mode FROM exams e LEFT JOIN questions q ON q.exam_id=e.id GROUP BY e.id ORDER BY e.created_at DESC",
          ),
          packages: await all(
            "SELECT p.id,p.title,p.status,p.access_days,COUNT(pe.id) exam_count FROM exam_packages p LEFT JOIN package_exams pe ON pe.package_id=p.id GROUP BY p.id ORDER BY p.created_at DESC",
          ),
        });
      if (method === "GET") {
        if (courseId === "new")
          return json({ course: null, content: [], options: await options() });
        const course = await one("SELECT * FROM courses WHERE id=?", courseId);
        if (!course) fail("Course not found.", 404);
        return json({
          course,
          content: await all(
            "SELECT * FROM course_content WHERE course_id=? ORDER BY display_order,id",
            courseId,
          ),
          options: await options(),
        });
      }
      const courseSchema = z.object({
        name: textSchema,
        description: z.string().max(2000),
        full_description: z.string().max(50000),
        category: z.string().max(200),
        subject: z.string().max(200),
        instructor: z.string().max(200),
        thumbnail: z.string().nullable(),
        regular_price: money.nullable(),
        price: money,
        pricing_type: z.enum(["free", "paid"]),
        access_mode: z.enum(["open","code","mixed"]).default("code"),
        duration_label: z.string().max(100),
        access_validity_days: z.number().int().min(1).max(3650),
        enrollment_start: z.number().int().positive().nullable(),
        course_start: z.number().int().positive().nullable(),
        course_end: z.number().int().positive().nullable(),
        maximum_students: z.number().int().min(1).max(1000000).nullable(),
        enrollment_open: z.boolean(),
        featured: z.boolean(),
        status: z.enum(["draft", "published", "archived"]),
        sequential_learning: z.boolean(),
        active: z.boolean(),
        published: z.boolean(),
        package_id: z.string().uuid().nullable().or(z.literal("")),
        details: z.string().max(20000).default(""),
      });
      const contentSchema = z.object({
        id: z.string().uuid(),
        parent_id: z.string().uuid().nullable(),
        node_type: z.enum(["module", "chapter", "lesson"]),
        lesson_type: z
          .enum([
            "youtube",
            "video",
            "pdf",
            "notes",
            "exam",
            "package",
            "text",
            "resource",
          ])
          .nullable()
          .optional(),
        title: textSchema,
        description: z.string().max(5000),
        body: z.string().max(100000),
        video_url: z.string().max(1000).nullable().optional(),
        video_id: z.string().max(30).nullable().optional(),
        video_duration: z.string().max(40).nullable().optional(),
        thumbnail: z.string().nullable().optional(),
        instructor: z.string().max(200).nullable().optional(),
        file_id: z.string().uuid().nullable().optional(),
        resources: z.string().max(100000),
        exam_id: z.string().uuid().nullable().optional(),
        package_id: z.string().uuid().nullable().optional(),
        external_url: z.string().max(2000).nullable().optional(),
        status: z.enum(["published", "draft", "hidden"]),
        free_preview: z.boolean(),
        access_mode: z.enum(["public","code"]).default("code"),
        download_allowed: z.boolean(),
        unlock_rule: z.enum([
          "immediate",
          "previous_lesson",
          "module_complete",
          "progress",
          "scheduled",
          "manual",
        ]),
        unlock_value: z.string().max(200),
        attempts_allowed: z.number().int().min(1).max(100),
        display_order: z.number().int().min(0).max(100000),
      });
      const b = z
        .object({
          course: courseSchema,
          content: z.array(contentSchema).max(3000),
        })
        .parse(await body());
      if (b.course.status === "published" && b.course.published &&
          !b.content.some((item) => item.node_type === "module" && item.title.trim() && item.title !== "New Module"))
        fail("Name at least one module before publishing the course.");
      if (
        b.course.thumbnail &&
        !(await one(
          "SELECT id FROM files WHERE id=? AND visibility='public'",
          b.course.thumbnail,
        ))
      )
        fail("Invalid course thumbnail.");
      if (
        b.course.course_end &&
        b.course.course_start &&
        b.course.course_end <= b.course.course_start
      )
        fail("Course end date must be after the start date.");
      const ids = new Set(b.content.map((x) => x.id));
      for (const item of b.content) {
        if (item.parent_id && !ids.has(item.parent_id))
          fail(`The parent for “${item.title}” is missing.`);
        const parent=b.content.find(x=>x.id===item.parent_id);
        const ancestors=new Set([item.id]);let cursor=parent;
        while(cursor){if(ancestors.has(cursor.id))fail(`A curriculum loop includes “${item.title}”.`);ancestors.add(cursor.id);cursor=b.content.find(x=>x.id===cursor!.parent_id)}
        if(item.node_type==="chapter" && parent?.node_type!=="module")fail(`Place “${item.title}” inside a module.`);
        if(item.node_type==="lesson" && !["chapter","module"].includes(parent?.node_type||""))fail(`Place “${item.title}” inside a module or chapter.`);
        if(item.node_type==="module" && item.parent_id)fail(`Modules belong at the top level.`);
        if (item.node_type === "lesson" && !item.lesson_type)
          fail(`Choose a lesson type for “${item.title}”.`);
        if (item.lesson_type === "youtube" && item.video_url && !item.video_id)
          fail(`Enter a valid YouTube URL for “${item.title}”.`);
        if(item.exam_id && !(await one("SELECT id FROM exams WHERE id=? AND status!='archived'",item.exam_id)))fail(`The selected exam for “${item.title}” is unavailable.`);
        if(b.course.status==="published" && item.status==="published" && item.exam_id && !(await one("SELECT id FROM exams WHERE id=? AND status IN ('published','closed')",item.exam_id)))fail(`Publish the exam linked to “${item.title}” before publishing this course.`);
        if(item.package_id && !(await one("SELECT id FROM exam_packages WHERE id=?",item.package_id)))fail(`The selected package for “${item.title}” is unavailable.`);
        if (
          item.file_id &&
          !(await one("SELECT id FROM files WHERE id=?", item.file_id))
        )
          fail(`The file for “${item.title}” is unavailable.`);
        let resources: any[] = [];
        try {
          resources = JSON.parse(item.resources || "[]");
        } catch {
          fail(`Resources for “${item.title}” are invalid.`);
        }
        if (!Array.isArray(resources) || resources.length > 50)
          fail(`Resources for “${item.title}” are invalid.`);
        for (const resource of resources)
          if (
            resource.file_id &&
            !(await one("SELECT id FROM files WHERE id=?", resource.file_id))
          )
            fail(`A resource for “${item.title}” is unavailable.`);
      }
      const rid = courseId || uid(),
        classes = b.content.filter((x) => x.node_type === "lesson").length,
        exams = b.content.filter(
          (x) =>
            x.node_type === "lesson" &&
            (!!x.exam_id || ["exam", "package"].includes(x.lesson_type || "")),
        ).length,
        sheets = b.content.filter(
          (x) =>
            x.node_type === "lesson" &&
            (!!x.file_id || JSON.parse(x.resources||"[]").length>0),
        ).length,
        published = b.course.status === "published" && b.course.published;
      if (courseId) {
        if (!(await one("SELECT id FROM courses WHERE id=?", rid)))
          fail("Course not found.", 404);
        await run(
          "UPDATE courses SET name=?,thumbnail=?,description=?,full_description=?,category=?,subject=?,instructor=?,class_count=?,exam_count=?,sheet_count=?,price=?,regular_price=?,pricing_type=?,duration_label=?,access_validity_days=?,enrollment_start=?,course_start=?,course_end=?,maximum_students=?,enrollment_open=?,featured=?,status=?,sequential_learning=?,details=?,package_id=?,active=?,published=?,access_mode=? WHERE id=?",
          b.course.name,
          b.course.thumbnail,
          b.course.description,
          b.course.full_description,
          b.course.category,
          b.course.subject,
          b.course.instructor,
          classes,
          exams,
          sheets,
          b.course.pricing_type === "free" ? 0 : b.course.price,
          b.course.regular_price,
          b.course.pricing_type,
          b.course.duration_label,
          b.course.access_validity_days,
          b.course.enrollment_start,
          b.course.course_start,
          b.course.course_end,
          b.course.maximum_students,
          +b.course.enrollment_open,
          +b.course.featured,
          b.course.status,
          +b.course.sequential_learning,
          b.course.details,
          b.course.package_id || null,
          +b.course.active,
          +published,
          b.course.access_mode,
          rid,
        );
      } else
        await run(
          "INSERT INTO courses(id,name,thumbnail,description,full_description,category,subject,instructor,class_count,exam_count,sheet_count,price,regular_price,pricing_type,duration_label,access_validity_days,enrollment_start,course_start,course_end,maximum_students,enrollment_open,featured,status,sequential_learning,details,package_id,active,published,access_mode,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
          rid,
          b.course.name,
          b.course.thumbnail,
          b.course.description,
          b.course.full_description,
          b.course.category,
          b.course.subject,
          b.course.instructor,
          classes,
          exams,
          sheets,
          b.course.pricing_type === "free" ? 0 : b.course.price,
          b.course.regular_price,
          b.course.pricing_type,
          b.course.duration_label,
          b.course.access_validity_days,
          b.course.enrollment_start,
          b.course.course_start,
          b.course.course_end,
          b.course.maximum_students,
          +b.course.enrollment_open,
          +b.course.featured,
          b.course.status,
          +b.course.sequential_learning,
          b.course.details,
          b.course.package_id || null,
          +b.course.active,
          +published,
          b.course.access_mode,
          now,
        );
      const existing = courseId
        ? await all("SELECT id FROM course_content WHERE course_id=?", rid)
        : [];
      for (const old of existing)
        if (!ids.has(old.id))
          await db().batch([
            db()
              .prepare("DELETE FROM course_progress WHERE content_id=?")
              .bind(old.id),
            db()
              .prepare("DELETE FROM course_content WHERE id=? AND course_id=?")
              .bind(old.id, rid),
          ]);
      const statements = b.content.map((item) =>
        db()
          .prepare(
            "INSERT INTO course_content(id,course_id,parent_id,node_type,lesson_type,title,description,body,video_url,video_id,video_duration,thumbnail,instructor,file_id,resources,exam_id,package_id,external_url,status,free_preview,access_mode,download_allowed,unlock_rule,unlock_value,attempts_allowed,display_order,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET parent_id=excluded.parent_id,node_type=excluded.node_type,lesson_type=excluded.lesson_type,title=excluded.title,description=excluded.description,body=excluded.body,video_url=excluded.video_url,video_id=excluded.video_id,video_duration=excluded.video_duration,thumbnail=excluded.thumbnail,instructor=excluded.instructor,file_id=excluded.file_id,resources=excluded.resources,exam_id=excluded.exam_id,package_id=excluded.package_id,external_url=excluded.external_url,status=excluded.status,free_preview=excluded.free_preview,access_mode=excluded.access_mode,download_allowed=excluded.download_allowed,unlock_rule=excluded.unlock_rule,unlock_value=excluded.unlock_value,attempts_allowed=excluded.attempts_allowed,display_order=excluded.display_order,updated_at=excluded.updated_at",
          )
          .bind(
            item.id,
            rid,
            item.parent_id,
            item.node_type,
            item.lesson_type || null,
            item.title,
            item.description,
            item.body,
            item.video_url || null,
            item.video_id || null,
            item.video_duration || "",
            item.thumbnail || null,
            item.instructor || "",
            item.file_id || null,
            item.resources,
            item.exam_id || null,
            item.package_id || null,
            item.external_url || null,
            item.status,
            +item.free_preview,
            item.access_mode,
            +item.download_allowed,
            item.unlock_rule,
            item.unlock_value,
            item.attempts_allowed,
            item.display_order,
            now,
            now,
          ),
      );
      for (let i = 0; i < statements.length; i += 50)
        await db().batch(statements.slice(i, i + 50));
      if(!courseId)await grantStarterCode("course",rid);
      await audit(
        a,
        courseId ? "course_builder_updated" : "course_builder_created",
        rid,
      );
      return json({ id: rid });
    }
    if (p[1] === "commerce-dashboard" && method === "GET") {
      return json(
        await one(
          `SELECT
        (SELECT COUNT(*) FROM hard_orders)+(SELECT COUNT(*) FROM soft_orders)+(SELECT COUNT(*) FROM package_orders)+(SELECT COUNT(*) FROM course_orders) total_orders,
        (SELECT COUNT(*) FROM hard_orders WHERE verified=0)+(SELECT COUNT(*) FROM soft_orders WHERE verified=0)+(SELECT COUNT(*) FROM package_orders WHERE verified=0)+(SELECT COUNT(*) FROM course_orders WHERE verified=0) pending_orders,
        (SELECT COUNT(*) FROM hard_orders) hardcopy_orders,(SELECT COUNT(*) FROM soft_orders) softcopy_orders,
        (SELECT COUNT(*) FROM package_orders)+(SELECT COUNT(*) FROM course_orders) course_orders,
        (SELECT COALESCE(SUM(amount-refund_amount),0) FROM payments WHERE status='paid' AND deleted_at IS NULL) paid_amount,
        (SELECT COALESCE(SUM(amount),0) FROM payments WHERE status='pending' AND deleted_at IS NULL) pending_payment,
        (SELECT COUNT(*) FROM hard_orders WHERE received=1) delivered_orders,
        (SELECT COALESCE(SUM(amount-refund_amount),0) FROM payments WHERE status='paid' AND deleted_at IS NULL AND created_at>=?) today_sales`,
          new Date(now + 21600000).setUTCHours(0, 0, 0, 0) - 21600000,
        ),
      );
    }
    if (p[1] === "payments") {
      if (method === "GET") {
        await db().batch([
          db().prepare(
            "INSERT OR IGNORE INTO payments(id,order_id,order_type,customer,amount,method,transaction_id,status,created_at,updated_at) SELECT lower(hex(randomblob(16))),id,'hardcopy',name,paid,payment_method,trx,CASE WHEN verified=1 THEN 'paid' ELSE 'pending' END,created_at,created_at FROM hard_orders",
          ),
          db().prepare(
            "INSERT OR IGNORE INTO payments(id,order_id,order_type,customer,amount,method,transaction_id,status,created_at,updated_at) SELECT lower(hex(randomblob(16))),id,'softcopy',name,price,payment_method,trx,CASE WHEN verified=1 THEN 'paid' ELSE 'pending' END,created_at,created_at FROM soft_orders",
          ),
          db().prepare(
            "INSERT OR IGNORE INTO payments(id,order_id,order_type,customer,amount,method,transaction_id,status,created_at,updated_at) SELECT lower(hex(randomblob(16))),id,'package',name,price,payment_method,trx,CASE WHEN verified=1 THEN 'paid' ELSE 'pending' END,created_at,created_at FROM package_orders",
          ),
          db().prepare(
            "INSERT OR IGNORE INTO payments(id,order_id,order_type,customer,amount,method,transaction_id,status,created_at,updated_at) SELECT lower(hex(randomblob(16))),id,'course',name,price,payment_method,trx,CASE WHEN verified=1 THEN 'paid' ELSE 'pending' END,created_at,created_at FROM course_orders",
          ),
        ]);
        const search = `%${(u.searchParams.get("search") || "").slice(0, 100)}%`,
          status = u.searchParams.get("status") || "";
        return json(
          await all(
            "SELECT * FROM payments WHERE deleted_at IS NULL AND (id LIKE ? OR order_id LIKE ? OR customer LIKE ? OR transaction_id LIKE ?) AND (?='' OR status=?) ORDER BY created_at DESC LIMIT 1000",
            search,
            search,
            search,
            search,
            status,
            status,
          ),
        );
      }
      if (method === "DELETE" && p[2]) {
        const payment = await one("SELECT id,order_id FROM payments WHERE id=? AND deleted_at IS NULL",p[2]);
        if (!payment) fail("Payment not found.",404);
        await run("UPDATE payments SET deleted_at=?,updated_at=? WHERE id=?",now,now,p[2]);
        await audit(a,"payment_removed_from_list",payment.order_id);
        return json({ok:true});
      }
      if (method === "PATCH") {
        const b = z
          .object({
            status: z.enum([
              "pending",
              "paid",
              "failed",
              "refunded",
              "partially_refunded",
            ]),
            transaction_id: z.string().trim().min(1).max(80),
            refund_amount: money.default(0),
            admin_note: z.string().max(3000).default(""),
          })
          .parse(await body());
        const payment = await one("SELECT * FROM payments WHERE id=?", p[2]);
        if (!payment) fail("Payment not found.", 404);
        if (b.refund_amount > payment.amount)
          fail("Refund cannot exceed the payment amount.");
        if (b.status === "paid" && ["package","course"].includes(payment.order_type)) {
          const tableName=payment.order_type === "package" ? "package_orders" : "course_orders";
          const order=await one(`SELECT * FROM ${tableName} WHERE id=?`,payment.order_id);
          if (order && !order.access_code_id) {
            if (payment.order_type === "package" && !(await one("SELECT id FROM package_exams WHERE package_id=? LIMIT 1",order.package_id))) fail("Add exams to this package before verifying payment.");
            let generated=accessCode();
            while(await one("SELECT id FROM codes WHERE code=?",generated))generated=accessCode();
            const codeId=uid();
            await db().batch([
              db().prepare("INSERT INTO codes(id,code,active,created_at) VALUES(?,?,1,?)").bind(codeId,generated,now),
              db().prepare(`UPDATE ${tableName} SET access_code_id=?,activated_at=?,expires_at=? WHERE id=?`).bind(codeId,now,now+(payment.order_type==="package"?Number((await one("SELECT access_days days FROM exam_packages WHERE id=?",order.package_id))?.days||30):Number((await one("SELECT access_validity_days days FROM courses WHERE id=?",order.course_id))?.days||365))*86400000,order.id),
            ]);
          } else if (order?.access_code_id) await run("UPDATE codes SET active=1 WHERE id=?",order.access_code_id);
        }
        await run(
          "UPDATE payments SET status=?,transaction_id=?,refund_amount=?,admin_note=?,updated_at=? WHERE id=?",
          b.status,
          b.transaction_id,
          b.refund_amount,
          b.admin_note,
          now,
          p[2],
        );
        const table =
          payment.order_type === "hardcopy"
            ? "hard_orders"
            : payment.order_type === "softcopy"
              ? "soft_orders"
              : payment.order_type === "package"
                ? "package_orders"
                : "course_orders";
        await run(
          `UPDATE ${table} SET verified=?,verified_at=?,verified_by=? WHERE id=?`,
          +(b.status === "paid"),
          b.status === "paid" ? now : null,
          b.status === "paid" ? a.username : null,
          payment.order_id,
        );
        await audit(a, `payment_${b.status}`, payment.order_id);
        return json({ ok: true });
      }
    }
    if (p[1] === "coupons") {
      if (method === "GET")
        return json(
          await all("SELECT * FROM coupons ORDER BY created_at DESC"),
        );
      if (method === "DELETE") {
        await run("DELETE FROM coupons WHERE id=?", p[2]);
        await audit(a, "coupon_deleted", p[2]);
        return json({ ok: true });
      }
      const b = z
        .object({
          code: z
            .string()
            .trim()
            .min(3)
            .max(40)
            .regex(/^[A-Z0-9_-]+$/i),
          discount_type: z.enum(["fixed", "percentage"]),
          discount_value: money,
          minimum_order: money,
          maximum_discount: money.nullable(),
          starts_at: z.number().int().nullable(),
          expires_at: z.number().int().nullable(),
          usage_limit: z.number().int().min(1).nullable(),
          per_user_limit: z.number().int().min(1).max(100),
          applies_to: z
            .array(
              z.enum([
                "hardcopy",
                "softcopy",
                "course",
                "package",
                "selected_products",
                "entire_store",
              ]),
            )
            .min(1),
          product_ids: z.array(z.string()).max(200),
          active: z.boolean(),
        })
        .parse(await body());
      if (b.discount_type === "percentage" && b.discount_value > 10000)
        fail("Percentage discount cannot exceed 100%.");
      if (b.starts_at && b.expires_at && b.expires_at <= b.starts_at)
        fail("Expiry must be after the start date.");
      const id = p[2] || uid();
      if (p[2])
        await run(
          "UPDATE coupons SET code=?,discount_type=?,discount_value=?,minimum_order=?,maximum_discount=?,starts_at=?,expires_at=?,usage_limit=?,per_user_limit=?,applies_to=?,product_ids=?,active=?,updated_at=? WHERE id=?",
          b.code.toUpperCase(),
          b.discount_type,
          b.discount_value,
          b.minimum_order,
          b.maximum_discount,
          b.starts_at,
          b.expires_at,
          b.usage_limit,
          b.per_user_limit,
          JSON.stringify(b.applies_to),
          JSON.stringify(b.product_ids),
          +b.active,
          now,
          id,
        );
      else
        await run(
          "INSERT INTO coupons(id,code,discount_type,discount_value,minimum_order,maximum_discount,starts_at,expires_at,usage_limit,per_user_limit,applies_to,product_ids,active,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
          id,
          b.code.toUpperCase(),
          b.discount_type,
          b.discount_value,
          b.minimum_order,
          b.maximum_discount,
          b.starts_at,
          b.expires_at,
          b.usage_limit,
          b.per_user_limit,
          JSON.stringify(b.applies_to),
          JSON.stringify(b.product_ids),
          +b.active,
          now,
          now,
        );
      await audit(a, p[2] ? "coupon_updated" : "coupon_created", id);
      return json({ id });
    }
    if (p[1] === "pricing") {
      if (method === "GET") {
        const s = await setting();
        const products = await all(
          "SELECT id,title,'book' type,price,old_price FROM books UNION ALL SELECT id,name title,'course' type,price,NULL old_price FROM courses UNION ALL SELECT id,title,'exam_package' type,price,old_price FROM exam_packages ORDER BY type,title",
        );
        return json({
          delivery: {
            sundarban: s.sundarban,
            dhaka: s.dhaka,
            outside: s.outside,
          },
          products,
        });
      }
      if (method === "PATCH") {
        const b = z
          .object({
            delivery: z.object({
              sundarban: money,
              dhaka: money,
              outside: money,
            }),
            products: z
              .array(
                z.object({
                  id: z.string().min(1).max(100),
                  type: z.enum(["book", "course", "exam_package"]),
                  price: money,
                  old_price: money.nullable(),
                }),
              )
              .max(1000),
          })
          .parse(await body());
        const s = await setting(),
          next = { ...s, ...b.delivery };
        const statements = [
          db()
            .prepare(
              "INSERT INTO settings(id,value) VALUES('site',?) ON CONFLICT(id) DO UPDATE SET value=excluded.value",
            )
            .bind(JSON.stringify(next)),
          ...b.products.map((x: any) =>
            x.type === "book"
              ? db()
                  .prepare("UPDATE books SET price=?,old_price=? WHERE id=?")
                  .bind(
                    x.price,
                    x.old_price && x.old_price > x.price ? x.old_price : null,
                    x.id,
                  )
              : x.type === "course"
                ? db()
                    .prepare("UPDATE courses SET price=? WHERE id=?")
                    .bind(x.price, x.id)
                : db()
                    .prepare(
                      "UPDATE exam_packages SET price=?,old_price=? WHERE id=?",
                    )
                    .bind(
                      x.price,
                      x.old_price && x.old_price > x.price ? x.old_price : null,
                      x.id,
                    ),
          ),
        ];
        await db().batch(statements);
        await audit(a, "pricing_updated", "all_products");
        return json({ ok: true });
      }
    }
    if (p[1] === "seo") {
      const section = p[2] || "inventory";
      if (section === "inventory" && method === "GET")
        return json({ items: await seoInventory(), config: await seoConfig() });
      if (section === "entry" && method === "PATCH") {
        const b = z
          .object({
            contentType: z.enum([
              "page",
              "book",
              "course",
              "package",
              "note",
              "notice",
              "blog",
            ]),
            contentId: z.string().min(1).max(160),
            currentPath: z.string().min(1).max(300),
            slug: z.string().trim().max(160).optional(),
            confirmSlugChange: z.boolean().default(false),
            createRedirect: z.boolean().default(true),
            seoTitle: z.string().trim().max(160).default(""),
            metaDescription: z.string().trim().max(320).default(""),
            canonicalUrl: z.string().trim().max(500).default(""),
            indexable: z.boolean().default(true),
            followLinks: z.boolean().default(true),
            ogTitle: z.string().trim().max(160).default(""),
            ogDescription: z.string().trim().max(320).default(""),
            socialImage: z.string().trim().max(500).nullable().default(""),
            schemaType: z.enum([
              "WebPage",
              "Article",
              "BlogPosting",
              "Course",
              "Book",
              "FAQPage",
              "Product",
            ]),
          })
          .parse(await body());
        let finalPath = seoPath(b.currentPath);
        if (b.slug && b.contentType === "blog") {
          const row = await one(
            "SELECT slug FROM blogs WHERE id=?",
            b.contentId,
          );
          if (!row) fail("Content not found.", 404);
          const nextSlug = b.slug
            .toLowerCase()
            .replace(/[^a-z0-9-]+/g, "-")
            .replace(/^-+|-+$/g, "");
          if (!nextSlug) fail("Enter a valid URL slug.");
          if (nextSlug !== row.slug) {
            if (!b.confirmSlugChange)
              fail("Confirm the URL change before saving.");
            if (
              await one(
                "SELECT id FROM blogs WHERE slug=? AND id!=?",
                nextSlug,
                b.contentId,
              )
            )
              fail("This URL slug is already in use.");
            const oldPath = `/blog/${row.slug}`;
            finalPath = `/blog/${nextSlug}`;
            await run(
              "UPDATE blogs SET slug=?,updated_at=? WHERE id=?",
              nextSlug,
              now,
              b.contentId,
            );
            if (b.createRedirect)
              await run(
                "INSERT INTO seo_redirects(id,old_url,new_url,status_code,active,created_at,updated_at) VALUES(?,?,?,?,1,?,?) ON CONFLICT(old_url) DO UPDATE SET new_url=excluded.new_url,status_code=301,active=1,updated_at=excluded.updated_at",
                uid(),
                oldPath,
                finalPath,
                301,
                now,
                now,
              );
          }
        }
        if (b.canonicalUrl) {
          try {
            new URL(b.canonicalUrl);
          } catch {
            fail("Canonical URL must be a complete valid URL.");
          }
        }
        await run(
          `INSERT INTO seo_entries(id,content_type,content_id,path,seo_title,meta_description,canonical_url,indexable,follow_links,og_title,og_description,social_image,schema_type,updated_at)
          VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(content_type,content_id) DO UPDATE SET path=excluded.path,seo_title=excluded.seo_title,meta_description=excluded.meta_description,canonical_url=excluded.canonical_url,indexable=excluded.indexable,follow_links=excluded.follow_links,og_title=excluded.og_title,og_description=excluded.og_description,social_image=excluded.social_image,schema_type=excluded.schema_type,updated_at=excluded.updated_at`,
          uid(),
          b.contentType,
          b.contentId,
          finalPath,
          b.seoTitle,
          b.metaDescription,
          b.canonicalUrl,
          +b.indexable,
          +b.followLinks,
          b.ogTitle,
          b.ogDescription,
          b.socialImage || null,
          b.schemaType,
          now,
        );
        // Keep the legacy blog fields synchronized so no existing metadata is lost.
        if (b.contentType === "blog")
          await run(
            "UPDATE blogs SET seo_title=?,meta_description=?,updated_at=? WHERE id=?",
            b.seoTitle,
            b.metaDescription,
            now,
            b.contentId,
          );
        await audit(a, "seo_entry_updated", `${b.contentType}:${b.contentId}`);
        return json({ ok: true, path: finalPath });
      }
      if (section === "redirects") {
        if (method === "GET") {
          const [rows, inventory] = await Promise.all([
            all("SELECT * FROM seo_redirects ORDER BY updated_at DESC"),
            seoInventory(),
          ]);
          const known = new Set(
            inventory.filter((x: any) => x.published).map((x: any) => x.path),
          );
          return json(
            rows.map((x: any) => ({
              ...x,
              target_status:
                /^https?:\/\//i.test(x.new_url) || known.has(x.new_url)
                  ? "good"
                  : "broken",
            })),
          );
        }
        if (method === "DELETE") {
          await run("DELETE FROM seo_redirects WHERE id=?", p[3]);
          await audit(a, "seo_redirect_deleted", p[3]);
          return json({ ok: true });
        }
        const b = z
          .object({
            oldUrl: z.string().trim().startsWith("/").max(300),
            newUrl: z.string().trim().startsWith("/").max(300),
            statusCode: z.union([z.literal(301), z.literal(302)]),
            active: z.boolean().default(true),
          })
          .parse(await body());
        const oldUrl = seoPath(b.oldUrl),
          newUrl = seoPath(b.newUrl);
        if (oldUrl === newUrl) fail("A redirect cannot point to itself.");
        if (
          [
            "/admin",
            "/api",
            "/attempts",
            "/orders",
            "/checkout",
            "/track-order",
          ].some(
            (x) =>
              oldUrl === x ||
              oldUrl.startsWith(`${x}/`) ||
              newUrl === x ||
              newUrl.startsWith(`${x}/`),
          )
        )
          fail("Administrative and private URLs cannot be redirected here.");
        let cursor = newUrl;
        const seen = new Set([oldUrl]);
        for (let i = 0; i < 20; i++) {
          if (seen.has(cursor)) fail("This redirect would create a loop.");
          seen.add(cursor);
          const next = await one(
            "SELECT new_url FROM seo_redirects WHERE old_url=? AND active=1",
            cursor,
          );
          if (!next) break;
          cursor = next.new_url;
        }
        const id = p[3] || uid();
        if (p[3])
          await run(
            "UPDATE seo_redirects SET old_url=?,new_url=?,status_code=?,active=?,updated_at=? WHERE id=?",
            oldUrl,
            newUrl,
            b.statusCode,
            +b.active,
            now,
            id,
          );
        else
          await run(
            "INSERT INTO seo_redirects(id,old_url,new_url,status_code,active,created_at,updated_at) VALUES(?,?,?,?,?,?,?)",
            id,
            oldUrl,
            newUrl,
            b.statusCode,
            +b.active,
            now,
            now,
          );
        await audit(
          a,
          p[3] ? "seo_redirect_updated" : "seo_redirect_created",
          id,
        );
        return json({ id });
      }
      if (
        (section === "audit" || section === "dashboard") &&
        method === "GET"
      ) {
        const [items, config, redirects, navigationRow] = await Promise.all([
          seoInventory(),
          seoConfig(),
          all("SELECT * FROM seo_redirects WHERE active=1"),
          one("SELECT value FROM settings WHERE id='cms:navigation:live'"),
        ]);
        const published = items.filter((x: any) => x.published),
          issues: any[] = [];
        const titleMap = new Map<string, any[]>(),
          descriptionMap = new Map<string, any[]>(),
          paths = new Set(published.map((x: any) => x.path));
        [
          "/privacy-policy",
          "/terms-and-conditions",
          "/refund-policy",
          "/shipping-delivery-policy",
          "/digital-product-policy",
          "/write-a-blog",
          "/cart",
        ].forEach((x) => paths.add(x));
        let navPaths = new Set<string>();
        try {
          navPaths = new Set(
            (JSON.parse(navigationRow?.value || "{}").items || [])
              .filter((x: any) => x.visible !== false)
              .map((x: any) => seoPath(x.url)),
          );
        } catch {}
        const add = (severity: string, issue: string, item: any, fix: string) =>
          issues.push({
            severity,
            issue,
            page: item?.title || "Site configuration",
            path: item?.path || "/admin/seo/global",
            fix,
          });
        for (const item of published) {
          const title = cleanSeoText(item.seo_title),
            description = cleanSeoText(item.meta_description);
          if (!title)
            add("critical", "Missing SEO title", item, "Add an SEO title");
          else {
            const key = title.toLowerCase();
            titleMap.set(key, [...(titleMap.get(key) || []), item]);
            if (title.length > 60)
              add(
                "warning",
                "SEO title is longer than 60 characters",
                item,
                "Shorten the SEO title",
              );
          }
          if (!description)
            add(
              "warning",
              "Missing meta description",
              item,
              "Add a concise meta description",
            );
          else {
            const key = description.toLowerCase();
            descriptionMap.set(key, [...(descriptionMap.get(key) || []), item]);
            if (description.length > 160)
              add(
                "warning",
                "Meta description is longer than 160 characters",
                item,
                "Shorten the meta description",
              );
          }
          if (!item.social_image && !config.social.ogImage)
            add(
              "warning",
              "Missing social image",
              item,
              "Add a page image or default social image",
            );
          if (item.canonical_url) {
            try {
              new URL(item.canonical_url);
            } catch {
              add(
                "critical",
                "Invalid canonical URL",
                item,
                "Use a complete HTTPS canonical URL",
              );
            }
          }
          if (!item.indexable)
            add(
              "warning",
              "Published page is set to noindex",
              item,
              "Review index settings",
            );
          const html = item.content || item.content_html || "";
          if (html) {
            const h1 = (html.match(/<h1\b/gi) || []).length;
            if (h1 > 0)
              add(
                "critical",
                "Multiple H1 headings",
                item,
                "Remove H1 headings from the body; the page title is already the H1",
              );
            const images = html.match(/<img\b[^>]*>/gi) || [];
            if (
              images.some(
                (tag: string) => !/\balt\s*=\s*["'][^"']+["']/i.test(tag),
              )
            )
              add(
                "warning",
                "Image missing alt text",
                item,
                "Add meaningful image alt text",
              );
            const hrefs = [
              ...html.matchAll(/href\s*=\s*["'](\/[^"'#?]*)/gi),
            ].map((m: any) => seoPath(m[1]));
            for (const href of new Set(hrefs))
              if (
                !paths.has(href) &&
                !/^\/notes\/[^/]+$/.test(href) &&
                !href.startsWith("/authors/") &&
                !redirects.some((r: any) => r.old_url === href)
              )
                add(
                  "critical",
                  `Broken internal link: ${href}`,
                  item,
                  "Update or remove the internal link",
                );
          }
          if (
            item.type === "page" &&
            String(item.id).startsWith("custom:") &&
            !navPaths.has(item.path)
          )
            add(
              "warning",
              "Orphan page",
              item,
              "Add this page to navigation or link to it from another page",
            );
        }
        for (const rows of titleMap.values())
          if (rows.length > 1)
            rows.forEach((item) =>
              add(
                "warning",
                "Duplicate SEO title",
                item,
                "Write a unique title",
              ),
            );
        for (const rows of descriptionMap.values())
          if (rows.length > 1)
            rows.forEach((item) =>
              add(
                "warning",
                "Duplicate meta description",
                item,
                "Write a unique description",
              ),
            );
        const redirectsByOld = new Map(
          redirects.map((x: any) => [x.old_url, x.new_url]),
        );
        for (const redirect of redirects) {
          let cursor = redirect.new_url;
          const seen = new Set([redirect.old_url]);
          let loop = false;
          for (let i = 0; i < 20 && redirectsByOld.has(cursor); i++) {
            if (seen.has(cursor)) {
              loop = true;
              break;
            }
            seen.add(cursor);
            cursor = redirectsByOld.get(cursor);
          }
          if (loop)
            add(
              "critical",
              "Redirect loop",
              { title: redirect.old_url, path: "/admin/seo/redirects" },
              "Edit or disable the redirect",
            );
          else if (
            !paths.has(redirect.new_url) &&
            !redirectsByOld.has(redirect.new_url)
          )
            add(
              "warning",
              "Broken redirect target",
              { title: redirect.old_url, path: "/admin/seo/redirects" },
              "Choose an existing destination",
            );
        }
        if (config.sitemap.enabled === false)
          add(
            "critical",
            "XML sitemap is disabled",
            null,
            "Enable the sitemap",
          );
        if (!config.robots.sitemapDeclaration)
          add(
            "warning",
            "Robots file does not declare the sitemap",
            null,
            "Enable sitemap declaration",
          );
        const critical = issues.filter((x) => x.severity === "critical").length,
          warning = issues.filter((x) => x.severity === "warning").length;
        const score = Math.max(
          0,
          Math.round(100 - (critical * 10 + warning * 2)),
        );
        return json({
          score,
          issues,
          counts: {
            total: published.length,
            good: Math.max(
              0,
              published.length - new Set(issues.map((x) => x.path)).size,
            ),
            warning,
            critical,
            indexable: published.filter((x: any) => x.indexable).length,
            noindex: published.filter((x: any) => !x.indexable).length,
            missingTitles: issues.filter((x) => x.issue === "Missing SEO title")
              .length,
            missingDescriptions: issues.filter(
              (x) => x.issue === "Missing meta description",
            ).length,
            duplicateTitles: issues.filter(
              (x) => x.issue === "Duplicate SEO title",
            ).length,
            duplicateDescriptions: issues.filter(
              (x) => x.issue === "Duplicate meta description",
            ).length,
            missingOg: issues.filter((x) => x.issue === "Missing social image")
              .length,
            brokenLinks: issues.filter((x) => x.issue.includes("Broken"))
              .length,
          },
          recent: [...published]
            .sort(
              (x: any, y: any) =>
                (y.seo_updated_at || y.updated_at || 0) -
                (x.seo_updated_at || x.updated_at || 0),
            )
            .slice(0, 8),
          sitemap: {
            enabled: config.sitemap.enabled !== false,
            url: `${config.global.canonicalDomain.replace(/\/$/, "")}/sitemap.xml`,
            total: published.filter((x: any) => x.indexable).length,
            lastGenerated: config.sitemap.lastGenerated || 0,
          },
          robots: {
            status: "good",
            url: `${config.global.canonicalDomain.replace(/\/$/, "")}/robots.txt`,
          },
        });
      }
      fail("Unknown SEO Manager action.", 404);
    }
    if (p[1] === "control") {
      const key = String(p[2] || "");
      const allowedKeys = new Set([
        "pages",
        "page-builder",
        "navigation",
        "header",
        "footer",
        "announcement",
        "popups",
        "homepage",
        "theme",
        "responsive",
        "seo",
        "commerce",
        "maintenance",
        "site",
        "appearance",
        "reusable-sections",
        "global-layout",
      ]);
      if (!allowedKeys.has(key)) fail("Unknown Control Center module.", 404);
      const readJson = async (id: string, fallback: any) => {
        const row = await one("SELECT value FROM settings WHERE id=?", id);
        try {
          return row ? JSON.parse(row.value) : fallback;
        } catch {
          return fallback;
        }
      };
      const draftId = `cms:${key}:draft`,
        liveId = `cms:${key}:live`,
        historyId = `cms:${key}:history`;
      if (method === "GET")
        return json({
          draft: await readJson(draftId, null),
          live: await readJson(liveId, null),
          history: await readJson(historyId, []),
        });
      const b = z
        .object({
          action: z.enum(["draft", "publish", "restore"]),
          data: z.record(z.string(), z.any()).optional(),
          version: z.number().int().min(0).optional(),
        })
        .parse(await body());
      if (b.action === "draft") validateWebsiteControl(key, b.data || {});
      const serialized = JSON.stringify(b.data || {});
      if (serialized.length > 1500000) fail("This configuration is too large.");
      if (b.action === "draft") {
        await run(
          "INSERT INTO settings(id,value) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value",
          draftId,
          serialized,
        );
        await audit(a, `control_draft:${key}`, key);
        return json({ ok: true });
      }
      let publishData = b.data || {};
      const history = await readJson(historyId, []);
      const current = await readJson(liveId, null);
      if (b.action === "restore") {
        const selected = history[b.version ?? -1];
        if (!selected) fail("Version not found.", 404);
        publishData = selected.data;
      }
      validateWebsiteControl(key, publishData);
      if (JSON.stringify(publishData).length > 1500000)
        fail("This configuration is too large.");
      const nextHistory = current
        ? [{ at: now, admin: a.username, data: current }, ...history].slice(
            0,
            25,
          )
        : history;
      if (
        current &&
        [
          "homepage",
          "page-builder",
          "theme",
          "appearance",
          "responsive",
          "header",
          "footer",
          "navigation",
          "global-layout",
          "reusable-sections",
          "pages",
        ].includes(key)
      ) {
        const snapshot = await createBackup(
          "theme",
          a.username,
          `pre_change:${key}`,
        );
        await audit(a, "recovery_snapshot_created", snapshot.id);
      }
      await db().batch([
        db()
          .prepare(
            "INSERT INTO settings(id,value) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value",
          )
          .bind(liveId, JSON.stringify(publishData)),
        db()
          .prepare(
            "INSERT INTO settings(id,value) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value",
          )
          .bind(draftId, JSON.stringify(publishData)),
        db()
          .prepare(
            "INSERT INTO settings(id,value) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value",
          )
          .bind(historyId, JSON.stringify(nextHistory)),
      ]);
      // Keep the legacy homepage live record in sync so old routes and earlier
      // deployments continue to render the same published homepage.
      if (key === "page-builder" && publishData?.pages?.home) {
        const homepage = publishData.pages.home;
        await db().batch([
          db()
            .prepare(
              "INSERT INTO settings(id,value) VALUES('cms:homepage:live',?) ON CONFLICT(id) DO UPDATE SET value=excluded.value",
            )
            .bind(JSON.stringify(homepage)),
          db()
            .prepare(
              "INSERT INTO settings(id,value) VALUES('cms:homepage:draft',?) ON CONFLICT(id) DO UPDATE SET value=excluded.value",
            )
            .bind(JSON.stringify(homepage)),
        ]);
      }
      await audit(
        a,
        `${b.action === "restore" ? "control_restored" : "control_published"}:${key}`,
        key,
      );
      return json({ ok: true });
    }
    if (p[1] === "logs" && method === "GET") {
      const search = `%${(u.searchParams.get("search") || "").slice(0, 100)}%`,
        result = u.searchParams.get("result") || "";
      const rows = await all(
        "SELECT au.id,au.action,au.target,au.created_at,au.result,COALESCE(ad.username,'Deleted admin') admin FROM audit au LEFT JOIN admins ad ON ad.id=au.admin_id WHERE (au.action LIKE ? OR au.target LIKE ? OR ad.username LIKE ?) AND (?='' OR au.result=?) ORDER BY au.created_at DESC LIMIT 1000",
        search,
        search,
        search,
        result,
        result,
      );
      return json(rows);
    }
    if (p[1] === "roles") {
      if ((await adminRole(a)) !== "super_admin")
        fail("Super Admin access is required.", 403);
      const access = await accessControl();
      if (method === "GET")
        return json({ roles: { ...rolePermissions, ...(access.roles || {}) } });
      const b = z
        .object({
          roles: z.record(
            z.string().regex(/^[a-z0-9_-]+$/),
            z.array(z.string().max(80)).max(100),
          ),
        })
        .parse(await body());
      access.roles = b.roles;
      await run(
        "INSERT INTO settings(id,value) VALUES('admin_access',?) ON CONFLICT(id) DO UPDATE SET value=excluded.value",
        JSON.stringify(access),
      );
      await audit(a, "roles_updated", "admin_access");
      return json({ ok: true });
    }
    if (p[1] === "media") {
      if (method === "GET")
        return json(
          await all(
            "SELECT id,name,mime,visibility,created_at FROM files ORDER BY created_at DESC LIMIT 1000",
          ),
        );
      if (method === "DELETE") {
        const id = p[2];
        const used = await one(
          `SELECT
          (SELECT COUNT(*) FROM books WHERE cover=? OR preview=? OR digital=?) +
          (SELECT COUNT(*) FROM notices WHERE attachment=?) +
          (SELECT COUNT(*) FROM notes WHERE thumbnail=? OR file=?) +
          (SELECT COUNT(*) FROM courses WHERE thumbnail=?) +
          (SELECT COUNT(*) FROM course_content WHERE thumbnail=? OR file_id=? OR resources LIKE ?) +
          (SELECT COUNT(*) FROM blogs WHERE thumbnail=? OR author_photo=?) +
          (SELECT COUNT(*) FROM reviews WHERE reviewer_photo=?) +
          (SELECT COUNT(*) FROM settings WHERE value LIKE ?) n`,
          id,
          id,
          id,
          id,
          id,
          id,
          id,
          id,
          id,
          `%${id}%`,
          id,
          id,
          id,
          `%${id}%`,
        );
        if (Number(used?.n || 0) > 0)
          fail("This file is currently in use and cannot be deleted.");
        await env.BUCKET?.delete(id);
        await run("DELETE FROM files WHERE id=?", id);
        await audit(a, "media_deleted", id);
        return json({ ok: true });
      }
    }
    if (p[1] === "users") {
      if ((await adminRole(a)) !== "super_admin")
        fail("Super Admin access is required.", 403);
      const access = await accessControl();
      if (method === "GET") {
        const rows = await all(
          "SELECT id,username,must_change,active,last_login_at,created_at FROM admins ORDER BY created_at,id",
        );
        return json(
          rows.map((row) => ({
            ...row,
            role:
              row.username === "lexveritas_admin"
                ? "super_admin"
                : access.assignments?.[row.id] || "editor",
          })),
        );
      }
      if (method === "DELETE") {
        if (p[2] === a.id) fail("You cannot delete your own account.");
        const target = await one(
          "SELECT username FROM admins WHERE id=?",
          p[2],
        );
        if (!target) fail("Admin user not found.", 404);
        if (target.username === "lexveritas_admin")
          fail("The primary Super Admin cannot be deleted.");
        await db().batch([
          db().prepare("DELETE FROM sessions WHERE admin_id=?").bind(p[2]),
          db().prepare("DELETE FROM admins WHERE id=?").bind(p[2]),
        ]);
        delete access.assignments?.[p[2]];
        await run(
          "INSERT INTO settings(id,value) VALUES('admin_access',?) ON CONFLICT(id) DO UPDATE SET value=excluded.value",
          JSON.stringify(access),
        );
        await audit(a, "admin_deleted", p[2]);
        return json({ ok: true });
      }
      if (p[2] && method === "PATCH") {
        const b = z
          .object({
            role: z.string().trim().min(2).max(80).optional(),
            active: z.boolean().optional(),
            resetPassword: z.string().min(14).max(72).optional(),
          })
          .parse(await body());
        const target = await one(
          "SELECT username FROM admins WHERE id=?",
          p[2],
        );
        if (!target) fail("Admin user not found.", 404);
        if (
          target.username === "lexveritas_admin" &&
          (b.active === false || b.role)
        )
          fail("The primary Super Admin cannot be deactivated or reassigned.");
        if (b.role) {
          access.assignments = {
            ...(access.assignments || {}),
            [p[2]]: b.role,
          };
          await run(
            "INSERT INTO settings(id,value) VALUES('admin_access',?) ON CONFLICT(id) DO UPDATE SET value=excluded.value",
            JSON.stringify(access),
          );
        }
        if (b.active !== undefined) {
          await run("UPDATE admins SET active=? WHERE id=?", +b.active, p[2]);
          if (!b.active)
            await run("DELETE FROM sessions WHERE admin_id=?", p[2]);
        }
        if (b.resetPassword) {
          await run(
            "UPDATE admins SET password_hash=?,must_change=1 WHERE id=?",
            await hash(b.resetPassword, 12),
            p[2],
          );
          await run("DELETE FROM sessions WHERE admin_id=?", p[2]);
        }
        await audit(a, "admin_updated", p[2]);
        return json({ ok: true });
      }
      const b = z
        .object({
          username: z
            .string()
            .trim()
            .min(3)
            .max(80)
            .regex(/^[a-zA-Z0-9._-]+$/),
          password: z.string().min(14).max(72).optional(),
          role: z.enum([
            "content_manager",
            "exam_manager",
            "order_manager",
            "editor",
          ]),
        })
        .parse(await body());
      if (!b.password) fail("A temporary password is required.");
      const id = uid();
      try {
        await run(
          "INSERT INTO admins(id,username,password_hash,must_change,created_at) VALUES(?,?,?,?,?)",
          id,
          b.username,
          await hash(b.password, 12),
          1,
          now,
        );
      } catch (error: any) {
        if (String(error).includes("UNIQUE"))
          fail("That username is already in use.");
        throw error;
      }
      access.assignments = { ...(access.assignments || {}), [id]: b.role };
      await run(
        "INSERT INTO settings(id,value) VALUES('admin_access',?) ON CONFLICT(id) DO UPDATE SET value=excluded.value",
        JSON.stringify(access),
      );
      await audit(a, "admin_created", id);
      return json({ id });
    }
    if (p[1] === "backup") {
      if ((await adminRole(a)) !== "super_admin")
        fail("Super Admin access is required.", 403);
      await ensureBackupDefaults();
      if (method === "GET" && p[2] === "overview") {
        const [history, schedules, storage] = await Promise.all([
          all(
            "SELECT * FROM backup_history ORDER BY created_at DESC LIMIT 100",
          ),
          all(
            "SELECT * FROM backup_schedules ORDER BY CASE frequency WHEN 'daily' THEN 1 WHEN 'weekly' THEN 2 ELSE 3 END",
          ),
          all("SELECT * FROM backup_storage_connections ORDER BY provider,account_email"),
        ]);
        const full = history.find(
            (x: any) => x.kind === "full" && x.status === "verified" && x.verification_status === "verified" && x.archive_key,
          ),
          verified = history.find(
            (x: any) => x.status === "verified" && x.verification_status === "verified" && x.archive_key,
          ),
          drive = history.find((x: any) => x.drive_status === "synced"),
          failed = history.filter((x: any) => x.status === "failed").length,
          overdue = schedules.some((x: any) => x.enabled && x.next_run_at && x.next_run_at < now && (!x.last_run_at || x.last_run_at < x.next_run_at));
        const health =
          !verified || now - verified.created_at > 8 * 86400000
            ? "critical"
            : overdue || failed || !storage.some((x: any) => x.connected)
              ? "warning"
              : "healthy";
        return json({
          history,
          schedules,
          storage:storage.map(safeConnection),
          googleDriveConfigured:driveConfigured(googleEnv()),
          googleDriveRedirectUri:driveRedirectUri(googleEnv()),
          health: {
            status: health,
            lastFullBackup: full?.created_at || null,
            lastVerifiedBackup: verified?.verified_at || null,
            lastDriveBackup: drive?.drive_synced_at || null,
            nextScheduledBackup:
              Math.min(
                ...schedules
                  .filter((x: any) => x.enabled && x.next_run_at)
                  .map((x: any) => x.next_run_at),
                Infinity,
              ) || null,
            driveStatus:
              storage.find((x: any) => x.provider === "google_drive")?.status ||
              "not_configured",
            failed,
            overdue,
            automaticSchedulesAvailable: false,
          },
          sourceCode: {
            dataBackup: "Supported",
            mediaBackup: "Supported with verified R2 copies",
            settingsBackup: "Supported",
            sourceCodeExport: "Not available from the Admin Panel",
            externalRepositoryBackup:
              "Sites-managed source repository; independent repository mirror not configured",
            includedInFullBackup: false,
          },
        });
      }
      if (method === "GET" && p[2] === "history")
        return json(
          await all(
            "SELECT * FROM backup_history ORDER BY created_at DESC LIMIT 200",
          ),
        );
      if (method === "GET" && p[2] && p[3] === "download") {
        const { row, pack } = await readBackupPackage(p[2]);
        if (row.verification_status !== "verified")
          fail("Verify this backup before downloading it.", 409);
        await audit(a, "backup_downloaded", p[2]);
        return new Response(backupArchiveStream(pack), {
          headers: {
            "Content-Type":
              typeof CompressionStream !== "undefined"
                ? "application/gzip"
                : "application/x-tar",
            "Content-Disposition": `attachment; filename="lexveritas-${row.kind}-${row.id}.${typeof CompressionStream !== "undefined" ? "tar.gz" : "tar"}"`,
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
          },
        });
      }
      if (method === "GET" && p[2] && p[3] === "preview") {
        const { pack } = await readBackupPackage(p[2]);
        return json({
          manifest: pack.manifest,
          modules: pack.manifest.includedModules,
          tableCounts: pack.manifest.tableCounts,
          mediaCount: pack.manifest.mediaCount,
        });
      }
      if (method === "POST" && p[2] === "create") {
        const b = z
          .object({
            kind: z.enum([
              "full",
              "data",
              "media",
              "settings",
              "theme",
              "exam",
              "commerce",
              "recovery",
              "migration",
            ]),
          })
          .parse(await body());
        try {
          const result = await createBackup(
            b.kind,
            a.username,
            b.kind === "migration" ? "migration" : "manual",
          );
          await audit(a, "backup_created", result.id);
          const connection=await one("SELECT connected FROM backup_storage_connections WHERE id=?",driveConnectionId);
          if(connection?.connected) {
            try { await copyBackupToDrive(result.id); await audit(a,"backup_drive_synced",result.id); }
            catch(error:any) { console.error("Drive copy failed after local backup",String(error?.message||"failed").slice(0,200)); }
          }
          return json({...result,driveStatus:(await one("SELECT drive_status FROM backup_history WHERE id=?",result.id))?.drive_status});
        } catch (error: any) {
          await audit(a, "backup_failed", b.kind);
          throw error;
        }
      }
      if (method === "POST" && p[2] && p[3] === "verify") {
        const result = await verifyBackup(p[2]);
        await audit(
          a,
          result.ok ? "backup_verified" : "backup_verification_failed",
          p[2],
        );
        return json(result, result.ok ? 200 : 409);
      }
      if (method === "POST" && p[2] && p[3] === "drive") {
        const result=await copyBackupToDrive(p[2]);
        await audit(a,"backup_drive_synced",p[2]);
        return json(result);
      }
      if (method === "POST" && p[2] && p[3] === "restore") {
        const b = z
          .object({
            modules: z
              .array(
                z.enum([
                  "content",
                  "exams",
                  "commerce",
                  "settings",
                  "theme",
                  "seo",
                  "media",
                ]),
              )
              .min(1),
            confirmation: z.literal("RESTORE"),
          })
          .parse(await body());
        const result = await restoreBackup(p[2], b.modules, a.username);
        await audit(a, "backup_restored", `${p[2]}:${b.modules.join(",")}`);
        return json(result);
      }
      if (method === "PATCH" && p[2] && p[3] === "keep") {
        const b = z.object({ keepForever: z.boolean() }).parse(await body());
        await run(
          "UPDATE backup_history SET keep_forever=? WHERE id=?",
          +b.keepForever,
          p[2],
        );
        await audit(a, "backup_retention_changed", p[2]);
        return json({ ok: true });
      }
      if (method === "DELETE" && p[2]) {
        const b = z
          .object({ confirmation: z.literal("DELETE") })
          .parse(await body());
        const row = await one("SELECT * FROM backup_history WHERE id=?", p[2]);
        if (!row) fail("Backup not found.", 404);
        if (row.keep_forever)
          fail("Remove Keep Forever before deleting this backup.", 409);
        if (env.BUCKET) {
          let cursor: string | undefined;
          do {
            const page = await env.BUCKET.list({
              prefix: backupPrefix(p[2]),
              cursor,
            });
            if (page.objects.length)
              await env.BUCKET.delete(page.objects.map((x: any) => x.key));
            cursor = page.truncated ? page.cursor : undefined;
          } while (cursor);
        }
        await run("DELETE FROM backup_history WHERE id=?", p[2]);
        await audit(a, "backup_deleted", p[2]);
        return json({ ok: true });
      }
      if (method === "PATCH" && p[2] === "schedule" && p[3]) {
        const b = z
          .object({
            enabled: z.boolean(),
            retentionCount: z.number().int().min(1).max(120),
          })
          .parse(await body());
        const schedule = await one(
          "SELECT * FROM backup_schedules WHERE id=?",
          p[3],
        );
        if (!schedule) fail("Schedule not found.", 404);
        await run(
          "UPDATE backup_schedules SET enabled=?,retention_count=?,next_run_at=?,updated_at=? WHERE id=?",
          +b.enabled,
          b.retentionCount,
          nextSchedule(schedule.frequency),
          now,
          p[3],
        );
        await audit(a, "backup_schedule_changed", p[3]);
        return json({ ok: true });
      }
      if (method === "POST" && p[2] === "schedule" && p[3] && p[4] === "run") {
        const schedule = await one(
          "SELECT * FROM backup_schedules WHERE id=?",
          p[3],
        );
        if (!schedule) fail("Schedule not found.", 404);
        const source = `schedule:${schedule.frequency}`,
          result = await createBackup(schedule.backup_type, a.username, source);
        const connected=await one("SELECT connected FROM backup_storage_connections WHERE id=?",driveConnectionId);
        if(connected?.connected) {
          try {await copyBackupToDrive(result.id)}catch(error:any){console.error("Scheduled Drive copy failed",String(error?.message||"failed").slice(0,200))}
        }
        await run(
          "UPDATE backup_schedules SET last_run_at=?,next_run_at=?,updated_at=? WHERE id=?",
          now,
          nextSchedule(schedule.frequency, now),
          now,
          p[3],
        );
        const expired = await all(
          "SELECT id FROM backup_history WHERE source=? AND keep_forever=0 ORDER BY created_at DESC LIMIT -1 OFFSET ?",
          source,
          schedule.retention_count,
        );
        for (const old of expired) {
          if (env.BUCKET) {
            let cursor: string | undefined;
            do {
              const page = await env.BUCKET.list({
                prefix: backupPrefix(old.id),
                cursor,
              });
              if (page.objects.length)
                await env.BUCKET.delete(page.objects.map((x: any) => x.key));
              cursor = page.truncated ? page.cursor : undefined;
            } while (cursor);
          }
          await run("DELETE FROM backup_history WHERE id=?", old.id);
        }
        await audit(a, "scheduled_backup_run", result.id);
        return json({ ...result, retentionPruned: expired.length });
      }
      if (method === "PATCH" && p[2] === "storage" && p[3]===driveConnectionId) {
        const b=z.object({accountEmail:z.string().email(),folder:z.string().trim().min(1).max(240)}).parse(await body());
        const current=await one("SELECT * FROM backup_storage_connections WHERE id=?",driveConnectionId);
        if(!current)fail("Storage connection not found.",404);
        const changed=b.accountEmail.toLowerCase()!==String(current.account_email).toLowerCase();
        const config=changed?{}:driveConfig(current);
        if(b.folder!==current.folder)delete config.rootFolderId;
        await run("UPDATE backup_storage_connections SET account_email=?,folder=?,config=?,connected=?,status=?,updated_at=? WHERE id=?",
          b.accountEmail.toLowerCase(),b.folder,JSON.stringify(config),changed?0:current.connected,changed?"authorization_required":current.status,now,driveConnectionId);
        await audit(a,"backup_storage_updated",driveConnectionId);
        return json({ok:true,message:changed?"Account changed. Connect the new Google account.":"Backup destination saved."});
      }
      if(method==="POST" && p[2]==="storage" && p[3]===driveConnectionId && p[4]==="connect") {
        if(!driveConfigured(googleEnv()))fail("Google OAuth client setup is required before connecting Drive.",503);
        const connection=await one("SELECT account_email FROM backup_storage_connections WHERE id=?",driveConnectionId);
        if(!connection)fail("Storage connection not found.",404);
        const state=randomSecret(),verifier=randomSecret(),challenge=await sha256url(verifier);
        await run("INSERT INTO settings(id,value) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value",drivePendingId,
          JSON.stringify({stateHash:await sha256url(state),verifier,expires:Date.now()+600000,adminId:a.id}));
        await audit(a,"backup_drive_authorization_started",driveConnectionId);
        return json({authorizationUrl:authorizationUrl(googleEnv(),state,challenge,connection.account_email)});
      }
      if(method==="POST" && p[2]==="storage" && p[3]===driveConnectionId && p[4]==="test") {
        const connection=await one("SELECT * FROM backup_storage_connections WHERE id=?",driveConnectionId);
        if(!connection)fail("Storage connection not found.",404);
        try {
          const email=await (await driveClient(connection)).accountEmail();
          if(email!==String(connection.account_email).toLowerCase())fail("Connected account does not match the configured email.",409);
          await run("UPDATE backup_storage_connections SET status='connected',last_tested_at=?,updated_at=? WHERE id=?",now,now,driveConnectionId);
          return json({ok:true,email});
        } catch(error:any) {
          await run("UPDATE backup_storage_connections SET status='connection_error',last_tested_at=?,updated_at=? WHERE id=?",now,now,driveConnectionId);
          throw error;
        }
      }
      if(method==="POST" && p[2]==="storage" && p[3]===driveConnectionId && p[4]==="sync") {
        const rows=await all("SELECT id FROM backup_history WHERE status='verified' AND verification_status='verified' AND drive_status!='synced' AND drive_status!='syncing' ORDER BY created_at DESC LIMIT 3");
        const results=[];
        for(const row of rows) {
          try {results.push(await copyBackupToDrive(row.id));await audit(a,"backup_drive_synced",row.id)}
          catch(error:any){results.push({id:row.id,driveStatus:"failed",error:String(error?.message||"Copy failed").slice(0,200)})}
        }
        return json({results,remaining:(await one("SELECT COUNT(*) n FROM backup_history WHERE status='verified' AND verification_status='verified' AND drive_status!='synced'"))?.n||0});
      }
      if (method === "POST" && p[2] === "import-preview") {
        if (Number(r.headers.get("content-length") || 0) > 12000000)
          fail(
            "Import package is larger than the 12 MB safe processing limit.",
            413,
          );
        const incoming: any = await r.json();
        if (
          incoming?.format !== "lexveritas-backup-package" ||
          incoming?.version !== 3 ||
          !incoming?.manifest ||
          !incoming?.data
        )
          fail("Choose a valid LexVeritas backup package.");
        const calculated = await digest(JSON.stringify(incoming.data));
        if (calculated !== incoming.manifest.checksum)
          fail("Import checksum validation failed.", 409);
        const allowedTables = new Set(Object.values(backupTables).flat()),
          conflicts: Record<string, number> = {};
        let total = 0,
          existing = 0;
        for (const [source, rowsValue] of Object.entries(
          incoming.data.tables || {},
        )) {
          const table = source === "theme_settings" ? "settings" : source;
          if (!allowedTables.has(table) && table !== "files") continue;
          const rows = Array.isArray(rowsValue) ? rowsValue : [],
            ids = rows.map((x: any) => x?.id).filter(Boolean);
          total += ids.length;
          let count = 0;
          for (let i = 0; i < ids.length; i += 75) {
            const part = ids.slice(i, i + 75),
              result = await one(
                `SELECT COUNT(*) n FROM ${table} WHERE id IN (${part.map(() => "?").join(",")})`,
                ...part,
              );
            count += Number(result?.n || 0);
          }
          if (count) conflicts[table] = (conflicts[table] || 0) + count;
          existing += count;
        }
        return json({
          valid: true,
          checksum: calculated,
          totalRecords: total,
          conflictingRecords: existing,
          newRecords: Math.max(0, total - existing),
          conflicts,
          modules: incoming.manifest.includedModules || [],
          mediaCount: incoming.manifest.mediaCount || 0,
          requiresRecoverySnapshot: true,
        });
      }
      if (method === "POST" && p[2] === "import") {
        if (Number(r.headers.get("content-length") || 0) > 12000000)
          fail(
            "Import package is larger than the 12 MB safe processing limit.",
            413,
          );
        const incoming: any = await r.json();
        if (
          incoming?.format !== "lexveritas-backup-package" ||
          incoming?.version !== 3 ||
          !incoming?.manifest ||
          !incoming?.data
        )
          fail("Choose a valid LexVeritas backup package.");
        const calculated = await digest(JSON.stringify(incoming.data));
        if (calculated !== incoming.manifest.checksum)
          fail("Import checksum validation failed.", 409);
        const recovery = await createBackup(
          "recovery",
          a.username,
          "pre_import",
        );
        const allowedTables = new Set(Object.values(backupTables).flat());
        let imported = 0;
        const entries = Object.entries(incoming.data.tables || {}).sort(
          ([a], [b]) =>
            restoreTableOrder.indexOf(a === "theme_settings" ? "settings" : a) -
            restoreTableOrder.indexOf(b === "theme_settings" ? "settings" : b),
        );
        for (const [table, rows] of entries) {
          const target = table === "theme_settings" ? "settings" : table;
          if (!allowedTables.has(target) && target !== "files") continue;
          const columns = new Set(
            (await all(`PRAGMA table_info(${target})`)).map((x: any) => x.name),
          );
          const statements: any[] = [];
          for (const raw of Array.isArray(rows) ? rows : []) {
            const row: any = { ...(raw as any) };
            if (columns.has("token_hash") && !row.token_hash)
              row.token_hash = await digest(
                `imported:${target}:${row.id}:${uid()}`,
              );
            const keys = Object.keys(row).filter((k) => columns.has(k));
            if (!keys.includes("id")) continue;
            const updates = keys
              .filter((k) => k !== "id")
              .map((k) => `${k}=excluded.${k}`)
              .join(",");
            statements.push(
              db()
                .prepare(
                  `INSERT INTO ${target}(${keys.join(",")}) VALUES(${keys.map(() => "?").join(",")}) ON CONFLICT(id) DO UPDATE SET ${updates}`,
                )
                .bind(...keys.map((k) => row[k])),
            );
            if (statements.length === 50)
              await db().batch(statements.splice(0));
            imported++;
          }
          if (statements.length) await db().batch(statements);
        }
        await audit(a, "backup_imported", String(imported));
        return json({
          ok: true,
          imported,
          recoveryBackupId: recovery.id,
          mediaNotice:
            "Portable JSON imports restore data and settings. Use a stored Backup History record to restore verified media copies.",
        });
      }
      fail("Unknown backup operation.", 404);
    }
    if (["team", "notices", "courses", "notes", "reviews"].includes(p[1])) {
      const section = p[1],
        recordId = p[2];
      const table =
        section === "team"
          ? "team_members"
          : section === "notices"
            ? "notices"
            : section;
      if (method === "GET") {
        if (recordId) {
          const row = await one(`SELECT * FROM ${table} WHERE id=?`, recordId);
          if (!row) fail("Record not found.", 404);
          return json(row);
        }
        return json(
          await all(`SELECT * FROM ${table} ORDER BY created_at DESC,id`),
        );
      }
      if (method === "DELETE") {
        if (section === "courses") {
          const ordered = await one(
            "SELECT id FROM course_orders WHERE course_id=? LIMIT 1",
            recordId,
          );
          if (ordered) {
            await run(
              "UPDATE courses SET published=0,active=0 WHERE id=?",
              recordId,
            );
            return json({
              message: "Course unpublished. Historical orders preserved.",
            });
          }
          await db().batch([
            db().prepare("DELETE FROM code_entitlements WHERE resource_type='course' AND resource_id=?").bind(recordId),
            db()
              .prepare("DELETE FROM course_progress WHERE course_id=?")
              .bind(recordId),
            db()
              .prepare("DELETE FROM course_sessions WHERE course_id=?")
              .bind(recordId),
            db()
              .prepare("DELETE FROM course_content WHERE course_id=?")
              .bind(recordId),
          ]);
        }
        await run(`DELETE FROM ${table} WHERE id=?`, recordId);
        await audit(a, `${section}_deleted`, recordId);
        return json({ ok: true });
      }
      if (section === "reviews") {
        if (recordId && p[3] === "approve" && method === "POST") {
          const result = await run(
            "UPDATE reviews SET verified=1,published=1,active=1,updated_at=? WHERE id=? AND verified=0",
            now, recordId,
          );
          if (!result.meta.changes) fail("Pending review not found.", 404);
          await audit(a, "review_approved", recordId);
          return json({ ok: true });
        }
        const b = z
          .object({
            review_text: z.string().trim().min(10).max(5000),
            reviewer_name: textSchema,
            reviewer_photo: z.string().nullable(),
            university: textSchema,
            rating: z.number().int().min(1).max(5),
            verified: z.boolean(),
            published: z.boolean(),
            active: z.boolean(),
            display_order: z.number().int().min(0).max(10000),
          })
          .parse(await body());
        if (
          b.reviewer_photo &&
          !(await one(
            "SELECT id FROM files WHERE id=? AND visibility='public'",
            b.reviewer_photo,
          ))
        )
          fail("Invalid reviewer photo.");
        const rid = recordId || uid();
        if (recordId)
          await run(
            "UPDATE reviews SET review_text=?,reviewer_name=?,reviewer_photo=?,university=?,rating=?,verified=?,published=?,active=?,display_order=?,updated_at=? WHERE id=?",
            b.review_text,
            b.reviewer_name,
            b.reviewer_photo,
            b.university,
            b.rating,
            +b.verified,
            +b.published,
            +b.active,
            b.display_order,
            now,
            rid,
          );
        else
          await run(
            "INSERT INTO reviews(id,review_text,reviewer_name,reviewer_photo,university,rating,verified,published,active,display_order,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
            rid,
            b.review_text,
            b.reviewer_name,
            b.reviewer_photo,
            b.university,
            b.rating,
            +b.verified,
            +b.published,
            +b.active,
            b.display_order,
            now,
            now,
          );
        await audit(a, recordId ? "review_updated" : "review_created", rid);
        return json({ id: rid });
      }
      if (section === "team") {
        const b = z
          .object({
            name: textSchema,
            role: textSchema,
            details: z.string().max(5000),
            photo: z.string().nullable(),
            active: z.boolean(),
            display_order: z.number().int().min(0).max(10000),
          })
          .parse(await body());
        if (
          b.photo &&
          !b.photo.startsWith("/assets/") &&
          !(await one(
            "SELECT id FROM files WHERE id=? AND visibility='public'",
            b.photo,
          ))
        )
          fail("Invalid team photo.");
        const rid = recordId || uid();
        if (recordId)
          await run(
            "UPDATE team_members SET name=?,role=?,details=?,photo=?,active=?,display_order=? WHERE id=?",
            b.name,
            b.role,
            b.details,
            b.photo,
            +b.active,
            b.display_order,
            rid,
          );
        else
          await run(
            "INSERT INTO team_members VALUES(?,?,?,?,?,?,?,?)",
            rid,
            b.name,
            b.role,
            b.details,
            b.photo,
            +b.active,
            b.display_order,
            now,
          );
        await audit(a, recordId ? "team_updated" : "team_created", rid);
        return json({ id: rid });
      }
      if (section === "notices") {
        const b = z
          .object({
            title: textSchema,
            content: z.string().trim().min(1).max(10000),
            attachment: z.string().nullable().optional(),
            notice_date: z.number().int().positive(),
            published: z.boolean(),
          })
          .parse(await body());
        const noticeAttachment = b.attachment || null;
        if (noticeAttachment) {
          const attachment = await one(
            "SELECT mime FROM files WHERE id=? AND visibility='public'",
            noticeAttachment,
          );
          if (
            !attachment ||
            !["application/pdf", "image/png", "image/jpeg", "image/webp", "image/avif"].includes(
              attachment.mime,
            )
          )
            fail("Invalid notice attachment.");
        }
        const rid = recordId || uid();
        if (recordId)
          await run(
            "UPDATE notices SET title=?,content=?,attachment=?,notice_date=?,published=? WHERE id=?",
            b.title,
            b.content,
            noticeAttachment,
            b.notice_date,
            +b.published,
            rid,
          );
        else
          await run(
            "INSERT INTO notices(id,title,content,attachment,notice_date,published,created_at) VALUES(?,?,?,?,?,?,?)",
            rid,
            b.title,
            b.content,
            noticeAttachment,
            b.notice_date,
            +b.published,
            now,
          );
        await audit(a, recordId ? "notice_updated" : "notice_created", rid);
        return json({ id: rid });
      }
      if (section === "courses") {
        const b = z
          .object({
            name: textSchema,
            thumbnail: z.string().nullable(),
            description: z.string().max(2000),
            class_count: z.number().int().min(0).max(100000),
            exam_count: z.number().int().min(0).max(100000),
            sheet_count: z.number().int().min(0).max(100000),
            price: money,
            details: z.string().max(20000),
            package_id: z.string().uuid().nullable(),
            active: z.boolean(),
            published: z.boolean(),
          })
          .parse(await body());
        if (
          b.thumbnail &&
          !(await one(
            "SELECT id FROM files WHERE id=? AND visibility='public'",
            b.thumbnail,
          ))
        )
          fail("Invalid course thumbnail.");
        if (
          b.package_id &&
          !(await one("SELECT id FROM exam_packages WHERE id=?", b.package_id))
        )
          fail("Selected exam package is unavailable.");
        const rid = recordId || uid();
        if (recordId)
          await run(
            "UPDATE courses SET name=?,thumbnail=?,description=?,class_count=?,exam_count=?,sheet_count=?,price=?,details=?,package_id=?,active=?,published=? WHERE id=?",
            b.name,
            b.thumbnail,
            b.description,
            b.class_count,
            b.exam_count,
            b.sheet_count,
            b.price,
            b.details,
            b.package_id,
            +b.active,
            +b.published,
            rid,
          );
        else
          await run(
            "INSERT INTO courses(id,name,thumbnail,description,class_count,exam_count,sheet_count,price,details,package_id,active,published,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)",
            rid,
            b.name,
            b.thumbnail,
            b.description,
            b.class_count,
            b.exam_count,
            b.sheet_count,
            b.price,
            b.details,
            b.package_id,
            +b.active,
            +b.published,
            now,
          );
        await audit(a, recordId ? "course_updated" : "course_created", rid);
        return json({ id: rid });
      }
      const b = z
        .object({
          category: z.union([
            z.string().trim().min(1).max(80),
            z.array(z.string().trim().min(1).max(80)).min(1).max(12),
          ]),
          subcategory: z
            .union([
              z.string().trim().max(80),
              z.array(z.string().trim().min(1).max(80)).max(20),
            ])
            .default([]),
          title: textSchema,
          description: z.string().max(5000),
          subject: z
            .union([
              z.string().trim().max(120),
              z.array(z.string().trim().min(1).max(120)).max(20),
            ])
            .default([]),
          page_count: z.number().int().min(0).max(10000).default(0),
          reading_minutes: z.number().int().min(0).max(10000).default(0),
          thumbnail: z.string().nullable(),
          file: z.string().nullable(),
          link: z.string().url().startsWith("https://").nullable(),
          published: z.boolean(),
        })
        .parse(await body());
      for (const key of ["thumbnail", "file"] as const)
        if (
          b[key] &&
          !(await one(
            "SELECT id FROM files WHERE id=? AND visibility='public'",
            b[key],
          ))
        )
          fail(`Invalid note ${key}.`);
      if (!b.file && !b.link)
        fail("Upload a note PDF or provide a secure link.");
      const rid = recordId || uid();
      const noteCategories = Array.isArray(b.category)
          ? b.category
          : [b.category],
        noteSubcategories = Array.isArray(b.subcategory)
          ? b.subcategory
          : b.subcategory
            ? [b.subcategory]
            : [],
        noteSubjects = Array.isArray(b.subject)
          ? b.subject
          : b.subject
            ? [b.subject]
            : [];
      if (recordId)
        await run(
          "UPDATE notes SET category=?,subcategory=?,title=?,description=?,subject=?,page_count=?,reading_minutes=?,thumbnail=?,file=?,link=?,published=? WHERE id=?",
          JSON.stringify([...new Set(noteCategories)]),
          JSON.stringify([...new Set(noteSubcategories)]),
          b.title,
          b.description,
          JSON.stringify([...new Set(noteSubjects)]),
          b.page_count,
          b.reading_minutes,
          b.thumbnail,
          b.file,
          b.link,
          +b.published,
          rid,
        );
      else
        await run(
          "INSERT INTO notes(id,category,subcategory,title,description,subject,page_count,reading_minutes,thumbnail,file,link,published,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)",
          rid,
          JSON.stringify([...new Set(noteCategories)]),
          JSON.stringify([...new Set(noteSubcategories)]),
          b.title,
          b.description,
          JSON.stringify([...new Set(noteSubjects)]),
          b.page_count,
          b.reading_minutes,
          b.thumbnail,
          b.file,
          b.link,
          +b.published,
          now,
        );
      await audit(a, recordId ? "note_updated" : "note_created", rid);
      return json({ id: rid });
    }
    if (p[1] === "authors" && method === "GET") {
      const saved = await all(
          "SELECT id,slug,name,photo,description FROM authors WHERE active=1 ORDER BY name,id",
        ),
        legacy = await all(
          "SELECT author_name,author_photo,author_description FROM blogs WHERE author_id IS NULL ORDER BY updated_at DESC,id",
        ),
        used = new Set(saved.map((author) => author.slug));
      for (const row of legacy) {
        const authorSlug = slugify(row.author_name);
        if (used.has(authorSlug)) continue;
        used.add(authorSlug);
        saved.push({
          id: null,
          slug: authorSlug,
          name: row.author_name,
          photo: row.author_photo,
          description: row.author_description,
        });
      }
      return json(saved);
    }
    if (p[1] === "blog-taxonomy" && method === "GET") {
      const rows = await all(
        "SELECT category,subcategory FROM blogs WHERE category!='' OR subcategory!='' ORDER BY category,subcategory",
      );
      return json({
        categories: [
          ...new Set(rows.map((row) => row.category).filter(Boolean)),
        ],
        subcategories: [
          ...new Set(rows.map((row) => row.subcategory).filter(Boolean)),
        ],
      });
    }
    if (p[1] === "blogs") {
      const recordId = p[2];
      if (method === "GET") {
        const row = recordId
          ? await one("SELECT * FROM blogs WHERE id=?", recordId)
          : await all(
              "SELECT * FROM blogs ORDER BY publish_date DESC,created_at DESC",
            );
        if (recordId && !row) fail("Blog not found.", 404);
        return json(row);
      }
      if (method === "DELETE") {
        const deleted = await run("DELETE FROM blogs WHERE id=?", recordId);
        if (!deleted.meta.changes) fail("Blog not found.", 404);
        await audit(a, "blog_deleted", recordId);
        return json({ ok: true });
      }
      const b = z
        .object({
          title: textSchema,
          slug: z.string().trim().max(140).optional(),
          thumbnail: z.string().nullable(),
          excerpt: z
            .string()
            .trim()
            .max(1000)
            .refine(
              (value) => wordCount(value) <= 50,
              "Short Excerpt must be 50 words or fewer.",
            ),
          category: z.string().trim().max(100).default(""),
          subcategory: z.string().trim().max(100).default(""),
          tags: z.string().trim().max(1000).default(""),
          seo_title: z.string().trim().max(160).default(""),
          meta_description: z.string().trim().max(320).default(""),
          author_id: z.string().uuid().nullable().optional(),
          author_name: textSchema,
          author_photo: z.string().nullable(),
          author_description: z.string().max(3000),
          content: z.string().trim().min(1).max(500000),
          publish_date: z.number().int().positive(),
          published: z.boolean(),
        })
        .parse(await body());
      if (!(await safeAsset(b.thumbnail)) || !(await safeAsset(b.author_photo)))
        fail("Invalid Blog image.");
      let blogSlug = slugify(b.slug || b.title),
        rid = recordId || uid(),
        suffix = 1;
      while (
        await one("SELECT id FROM blogs WHERE slug=? AND id!=?", blogSlug, rid)
      )
        blogSlug = `${slugify(b.slug || b.title)}-${++suffix}`;
      const clean = sanitizeBlogHtml(b.content);
      if (!clean.replace(/<[^>]*>/g, "").trim()) fail("Blog content is empty.");
      let authorProfile = b.author_id
        ? await one(
            "SELECT id,slug,name,photo,description FROM authors WHERE id=? AND active=1",
            b.author_id,
          )
        : await one(
            "SELECT id,slug,name,photo,description FROM authors WHERE slug=? AND active=1",
            slugify(b.author_name),
          );
      if (b.author_id && !authorProfile)
        fail("Selected author is unavailable.");
      if (!authorProfile) {
        const authorId = uid(),
          authorSlug = slugify(b.author_name);
        await run(
          "INSERT INTO authors(id,slug,name,photo,description,active,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)",
          authorId,
          authorSlug,
          b.author_name,
          b.author_photo,
          b.author_description,
          1,
          now,
          now,
        );
        authorProfile = {
          id: authorId,
          slug: authorSlug,
          name: b.author_name,
          photo: b.author_photo,
          description: b.author_description,
        };
      }
      if (recordId)
        await run(
          "UPDATE blogs SET slug=?,title=?,thumbnail=?,excerpt=?,category=?,subcategory=?,tags=?,seo_title=?,meta_description=?,author_id=?,author_name=?,author_photo=?,author_description=?,content=?,publish_date=?,published=?,updated_at=? WHERE id=?",
          blogSlug,
          b.title,
          b.thumbnail,
          b.excerpt,
          b.category,
          b.subcategory,
          b.tags,
          b.seo_title,
          b.meta_description,
          authorProfile.id,
          authorProfile.name,
          authorProfile.photo,
          authorProfile.description,
          clean,
          b.publish_date,
          +b.published,
          now,
          rid,
        );
      else
        await run(
          "INSERT INTO blogs(id,slug,title,thumbnail,excerpt,category,subcategory,tags,seo_title,meta_description,author_id,author_name,author_photo,author_description,content,publish_date,published,view_count,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
          rid,
          blogSlug,
          b.title,
          b.thumbnail,
          b.excerpt,
          b.category,
          b.subcategory,
          b.tags,
          b.seo_title,
          b.meta_description,
          authorProfile.id,
          authorProfile.name,
          authorProfile.photo,
          authorProfile.description,
          clean,
          b.publish_date,
          +b.published,
          0,
          now,
          now,
        );
      await audit(a, recordId ? "blog_updated" : "blog_created", rid);
      return json({ id: rid, slug: blogSlug, author_id: authorProfile.id });
    }
    if (p[1] === "packages") {
      const id = p[2];
      if (p[3] === "routines" && method === "DELETE") {
        const routine = await one(
          "SELECT r.exam_id,p.published FROM package_routines r JOIN exam_packages p ON p.id=r.package_id WHERE r.id=? AND r.package_id=?",
          p[4], id,
        );
        if (!routine) fail("Routine entry not found.", 404);
        if (routine.published) {
          const count = await one("SELECT COUNT(*) n FROM package_routines WHERE package_id=? AND exam_id=?", id, routine.exam_id);
          if (count.n <= 1) fail("Published packages need a routine for every exam. Unpublish the package before removing its last routine.");
        }
        const removed = await run(
          "DELETE FROM package_routines WHERE id=? AND package_id=?",
          p[4],
          id,
        );
        if (!removed.meta.changes) fail("Routine entry not found.", 404);
        await audit(a, "package_routine_deleted", p[4]);
        return json({ ok: true });
      }
      if (p[3] === "participants" && method === "GET") {
        const rows = await all(
          "SELECT a.*,e.title exam_title,c.code FROM attempts a JOIN exams e ON e.id=a.exam_id JOIN codes c ON c.id=a.code_id WHERE a.package_id=? ORDER BY a.started_at DESC",
          id,
        );
        rows.forEach((x) => delete x.token_hash);
        return json(rows);
      }
      if (method === "GET") {
        if (!id)
          return json(
            await all(
              "SELECT p.*,(SELECT COUNT(*) FROM package_exams pe WHERE pe.package_id=p.id) exam_count,(SELECT COUNT(*) FROM package_orders po WHERE po.package_id=p.id) order_count FROM exam_packages p ORDER BY p.created_at DESC",
            ),
          );
        const pack = await one("SELECT * FROM exam_packages WHERE id=?", id);
        if (!pack) fail("Exam package not found.", 404);
        pack.exams = await all(
          "SELECT e.*,pe.display_order,pe.support_pdf FROM package_exams pe JOIN exams e ON e.id=pe.exam_id WHERE pe.package_id=? ORDER BY pe.display_order,e.start,e.id",
          id,
        );
        pack.availableExams = await all(
          "SELECT id,title,start,end,status FROM exams WHERE status!='archived' ORDER BY start DESC",
        );
        pack.routines = await all(
          "SELECT r.*,e.title exam_title FROM package_routines r JOIN exams e ON e.id=r.exam_id WHERE r.package_id=? ORDER BY r.display_order,r.start,r.id",
          id,
        );
        return json(pack);
      }
      if (method === "DELETE") {
        const ordered = await one(
          "SELECT id FROM package_orders WHERE package_id=? LIMIT 1",
          id,
        );
        if (ordered) {
          await run(
            "UPDATE exam_packages SET published=0,available=0 WHERE id=?",
            id,
          );
          return json({
            message: "Package unpublished. Historical orders preserved.",
          });
        }
        await db().batch([
          db().prepare("DELETE FROM package_sessions WHERE package_id=?").bind(id),
          db().prepare("DELETE FROM package_profiles WHERE package_id=?").bind(id),
          db().prepare("DELETE FROM code_entitlements WHERE resource_type='package' AND resource_id=?").bind(id),
          db()
            .prepare("DELETE FROM package_routines WHERE package_id=?")
            .bind(id),
          db().prepare("DELETE FROM package_exams WHERE package_id=?").bind(id),
          db().prepare("DELETE FROM exam_packages WHERE id=?").bind(id),
        ]);
        await audit(a, "package_deleted", id);
        return json({ ok: true });
      }
      const b = z
        .object({
          title: textSchema,
          description: z.string().max(10000),
          syllabus: z.string().max(10000).default(""),
          thumbnail: z.string().nullable().default(null),
          details: z.string().max(30000).default(""),
          price: money,
          oldPrice: money.nullable().default(null),
          accessMode: z.enum(["open","code"]).default("code"),
          detailedExplanations: z.boolean().default(true),
          leaderboard: z.boolean().default(true),
          status: z.enum(["active", "inactive"]).default("active"),
          maxParticipants: z
            .number()
            .int()
            .min(1)
            .max(1000000)
            .nullable()
            .default(null),
          accessDays: z.number().int().min(1).max(3650).default(30),
          available: z.boolean(),
          published: z.boolean(),
          examIds: z.array(z.string().uuid()).min(1).max(100),
          examMaterials: z.record(z.string().uuid(),z.string().uuid().nullable()).default({}),
          routines: z
            .array(
              z.object({
                id: z.string().uuid().optional(),
                exam_id: z.string().uuid(),
                start: z.number().int().positive(),
                end: z.number().int().positive(),
                display_order: z.number().int().min(0).max(10000),
              }),
            )
            .max(200)
            .default([]),
        })
        .parse(await body());
      if(b.accessMode==="open" && b.price>0)fail("An open package must have a zero price.");
      if (new Set(b.examIds).size !== b.examIds.length)
        fail("An examination can only appear once in a package.");
      if ((!id || b.published) && b.examIds.some((examId) => !b.routines.some((routine) => routine.exam_id === examId)))
        fail("Set a routine for every examination before creating or publishing a package.");
      const found = await one(
        `SELECT COUNT(*) n FROM exams WHERE id IN (${b.examIds.map(() => "?").join(",")}) AND status!='archived'`,
        ...b.examIds,
      );
      if (found.n !== b.examIds.length) fail("Select valid examinations.");
      if (!(await safeAsset(b.thumbnail))) fail("Invalid package thumbnail.");
      for(const [examId,fileId] of Object.entries(b.examMaterials)){
        if(!b.examIds.includes(examId))fail("A material exam must be included in the package.");
        if(fileId && !(await one("SELECT id FROM files WHERE id=? AND mime='application/pdf'",fileId)))fail("Select a valid PDF material.");
      }
      for (const routine of b.routines) {
        if (!b.examIds.includes(routine.exam_id))
          fail("A routine exam must be included in the package.");
        if (routine.end <= routine.start)
          fail("Routine end time must be after start time.");
      }
      const packageId = id || uid();
      const statements = [
        id
          ? db()
              .prepare(
                "UPDATE exam_packages SET title=?,description=?,thumbnail=?,details=?,price=?,old_price=?,detailed_explanations=?,leaderboard=?,status=?,max_participants=?,access_days=?,available=?,published=?,access_mode=? WHERE id=?",
              )
              .bind(
                b.title,
                b.description,
                b.thumbnail,
                b.details,
                b.price,
                b.oldPrice && b.oldPrice > b.price ? b.oldPrice : null,
                +b.detailedExplanations,
                +b.leaderboard,
                b.status,
                b.maxParticipants,
                b.accessDays,
                +b.available,
                +b.published,
                b.accessMode,
                packageId,
              )
          : db()
              .prepare(
                "INSERT INTO exam_packages(id,title,description,thumbnail,details,price,old_price,detailed_explanations,leaderboard,status,max_participants,access_days,available,published,access_mode,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
              )
              .bind(
                packageId,
                b.title,
                b.description,
                b.thumbnail,
                b.details,
                b.price,
                b.oldPrice && b.oldPrice > b.price ? b.oldPrice : null,
                +b.detailedExplanations,
                +b.leaderboard,
                b.status,
                b.maxParticipants,
                b.accessDays,
                +b.available,
                +b.published,
                b.accessMode,
                now,
              ),
        db()
          .prepare("DELETE FROM package_exams WHERE package_id=?")
          .bind(packageId),
        db()
          .prepare("DELETE FROM package_routines WHERE package_id=?")
          .bind(packageId),
        ...b.examIds.map((examId, i) =>
          db()
            .prepare("INSERT INTO package_exams(id,package_id,exam_id,display_order,support_pdf) VALUES(?,?,?,?,?)")
            .bind(uid(), packageId, examId, i + 1,b.examMaterials[examId]||null),
        ),
        ...b.routines.map((routine, i) =>
          db()
            .prepare("INSERT INTO package_routines VALUES(?,?,?,?,?,?,?)")
            .bind(
              routine.id || uid(),
              packageId,
              routine.exam_id,
              routine.start,
              routine.end,
              routine.display_order || i + 1,
              now,
            ),
        ),
      ];
      await db().batch(statements);
      if(!id)await grantStarterCode("package",packageId);
      await audit(a, id ? "package_updated" : "package_created", packageId);
      return json({ id: packageId });
    }
    if (p[1] === "settings") {
      if (method === "GET") return json(await setting());
      const raw = await body();
      const b = await validateSettings(raw);
      b.payment = phone.parse(b.payment);
      b.bkashPayment = phone.parse(b.bkashPayment);
      b.nagadPayment = phone.parse(b.nagadPayment);
      b.rocketPayment = phone.parse(b.rocketPayment);
      b.whatsapp = phone.parse(b.whatsapp);
      b.sundarban = money.parse(b.sundarban);
      b.dhaka = money.parse(b.dhaka);
      b.outside = money.parse(b.outside);
      await run(
        "INSERT INTO settings VALUES(?,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value",
        "site",
        JSON.stringify(b),
      );
      await audit(a, "settings_updated", "site");
      return json({ ok: true });
    }
    if(p[1]==="access" && p[2] && p[3]) {
      const kind=p[2],id=p[3];
      if(!["exam","course","package"].includes(kind))fail("Unknown access resource.");
      const table=kind==="exam"?"exams":kind==="course"?"courses":"exam_packages";
      if(!(await one(`SELECT id FROM ${table} WHERE id=?`,id)))fail("Resource not found.",404);
      if(method==="GET")return json(await all("SELECT e.id,c.id code_id,c.code,c.active,c.claimed_at FROM code_entitlements e JOIN codes c ON c.id=e.code_id WHERE e.resource_type=? AND e.resource_id=? ORDER BY e.created_at DESC",kind,id));
      if(method==="POST") {
        const b=z.object({code:z.string().trim().optional(),quantity:z.number().int().min(1).max(1000).default(1)}).parse(await body());
        const assigned:string[]=[];
        if(b.code){
          const c=await one("SELECT * FROM codes WHERE code=?",b.code.toUpperCase());
          if(!c)fail("Code not found. Generate a new code or use one from Access Codes.",404);
          await run("INSERT OR IGNORE INTO code_entitlements(id,code_id,resource_type,resource_id,created_at) VALUES(?,?,?,?,?)",uid(),c.id,kind,id,now);
          assigned.push(c.code);
        } else for(let start=0;start<b.quantity;start+=50){
          const statements:any[]=[];
          for(let i=start;i<Math.min(start+50,b.quantity);i++){
            const value=accessCode(),codeId=uid();assigned.push(value);
            statements.push(db().prepare("INSERT INTO codes(id,code,active,created_at) VALUES(?,?,1,?)").bind(codeId,value,now));
            statements.push(db().prepare("INSERT INTO code_entitlements(id,code_id,resource_type,resource_id,created_at) VALUES(?,?,?,?,?)").bind(uid(),codeId,kind,id,now));
          }
          await db().batch(statements);
        }
        await audit(a,"access_codes_assigned",`${kind}:${id}:${assigned.length}`);
        return json({codes:assigned});
      }
      if(method==="DELETE" && p[4]) {
        await run("DELETE FROM code_entitlements WHERE id=? AND resource_type=? AND resource_id=?",p[4],kind,id);
        await audit(a,"access_code_unassigned",`${kind}:${id}`);
        return json({ok:true});
      }
    }
    if (p[1] === "codes") {
      const page = Math.max(1, Number(u.searchParams.get("page")) || 1),
        search = (u.searchParams.get("search") || "").slice(0, 100),
        active = u.searchParams.get("active") || "";
      if (p[2] === "generate" && method === "POST") {
        const b = z
          .object({ quantity: z.number().int().min(1).max(10000) })
          .parse(await body());
        const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        let count = 0;
        for (let n = 0; n < b.quantity; n += 100) {
          const stmts = Array.from(
            { length: Math.min(100, b.quantity - n) },
            () => {
              const bytes = crypto.getRandomValues(new Uint8Array(12));
              const s = Array.from(bytes, (x) => alphabet[x % 32]).join("");
              return db()
                .prepare("INSERT OR IGNORE INTO codes(id,code,active,created_at) VALUES(?,?,1,?)")
                .bind(
                  uid(),
                  `LVA-${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8)}`,
                  now,
                );
            },
          );
          const result = await db().batch(stmts);
          count += result.reduce((s, x) => s + x.meta.changes, 0);
        }
        await audit(a, "codes_generated:" + count, "codes");
        return json({ count });
      }
      if (p[2] && p[2] !== "csv") {
        if(p[3]==="reset-device" && method==="POST") {
          if(!(await one("SELECT id FROM codes WHERE id=?",p[2])))fail("Code not found.",404);
          await db().batch([
            db().prepare("DELETE FROM course_sessions WHERE code_id=?").bind(p[2]),
            db().prepare("UPDATE codes SET device_hash=NULL,claimed_at=NULL WHERE id=?").bind(p[2]),
          ]);
          await audit(a,"code_device_reset",p[2]);
          return json({ok:true});
        }
        if (method === "PATCH") {
          const b = z.object({ active: z.boolean() }).parse(await body());
          await run(
            "UPDATE codes SET active=? WHERE id=?",
            b.active ? 1 : 0,
            p[2],
          );
          await audit(a, "code_active:" + b.active, p[2]);
          return json({ ok: true });
        }
        return json(
          await all(
            "SELECT e.title,a.started_at,a.submitted_at,a.status FROM attempts a JOIN exams e ON e.id=a.exam_id WHERE a.code_id=? ORDER BY a.started_at DESC",
            p[2],
          ),
        );
      }
      if (p[2] === "csv") {
        const rows = await all(
          "SELECT code,active,created_at FROM codes ORDER BY created_at DESC LIMIT 100000",
        );
        return new Response(
          [
            "Code,Active,Created",
            ...rows.map((x) =>
              [x.code, x.active, new Date(x.created_at).toISOString()]
                .map(csvCell)
                .join(","),
            ),
          ].join("\r\n"),
          {
            headers: {
              "Content-Type": "text/csv; charset=utf-8",
              "Content-Disposition":
                'attachment; filename="lexveritas-access-codes.csv"',
              "Cache-Control": "no-store",
            },
          },
        );
      }
      const where = "WHERE c.code LIKE ? AND (?='' OR c.active=?)";
      return json({
        rows: await all(
          `SELECT c.id,c.code,c.active,c.created_at,c.claimed_at,(SELECT COUNT(*) FROM attempts a WHERE a.code_id=c.id) uses,(SELECT GROUP_CONCAT(resource_type,', ') FROM code_entitlements ce WHERE ce.code_id=c.id) assignments FROM codes c ${where} ORDER BY created_at DESC,id LIMIT 50 OFFSET ?`,
          `%${search}%`,
          active,
          active,
          (page - 1) * 50,
        ),
        total: (
          await one(
            `SELECT COUNT(*) n FROM codes c ${where}`,
            `%${search}%`,
            active,
            active,
          )
        ).n,
        page,
      });
    }
    if (p[1] === "exams") {
      const id = p[2];
      if (p[3] === "participants" && p[4] && method === "DELETE") {
        const attempt = await one(
          "SELECT id FROM attempts WHERE id=? AND exam_id=?",
          p[4],
          id,
        );
        if (!attempt) fail("Participant not found.", 404);
        await db().batch([
          db()
            .prepare("DELETE FROM answers WHERE attempt_id=?")
            .bind(attempt.id),
          db()
            .prepare("DELETE FROM attempts WHERE id=? AND exam_id=?")
            .bind(attempt.id, id),
        ]);
        await audit(a, "participant_deleted", attempt.id);
        return json({ ok: true });
      }
      if (p[3] === "link" && method === "POST") {
        const exam = await one("SELECT id FROM exams WHERE id=?", id);
        if (!exam) fail("Exam not found.", 404);
        return json({
          path: `/exams/${id}`,
        });
      }
      if (p[3] === "ranking" || p[3] === "participants") {
        const page = Math.max(1, Number(u.searchParams.get("page")) || 1),
          s = u.searchParams.get("search") || "",
          status = u.searchParams.get("status") || "";
        const e = await one("SELECT * FROM exams WHERE id=?", id);
        if (!e) fail("Exam not found.", 404);
        return json({
          exam: e,
          rows: await rank(
            id,
            u.searchParams.get("export") === "1" ? 100000 : 50,
            (page - 1) * 50,
            s,
            u.searchParams.get("sort") || "rank",
            status,
          ),
          total: (
            await one(
              "SELECT COUNT(DISTINCT a.code_id) n FROM attempts a JOIN codes c ON c.id=a.code_id WHERE exam_id=? AND (student_name LIKE ? OR university LIKE ? OR code LIKE ?) AND (?='' OR status=?)",
              id,
              `%${s}%`,
              `%${s}%`,
              `%${s}%`,
              status,
              status,
            )
          ).n,
          page,
        });
      }
      if (p[3] === "submission") {
        const attempt = await one(
          "SELECT * FROM attempts WHERE id=? AND exam_id=?",
          p[4],
          id,
        );
        if (!attempt) fail("Attempt not found.", 404);
        const rows = await all(
          "SELECT q.question,q.options,q.correct_option,q.explanation,z.selected FROM questions q LEFT JOIN answers z ON z.question_id=q.id AND z.attempt_id=? WHERE q.exam_id=? ORDER BY q.display_order,q.id",
          attempt.id,
          id,
        );
        delete attempt.token_hash;
        return json({
          ...attempt,
          questions: rows.map((q) => ({
            ...q,
            options: JSON.parse(q.options),
          })),
        });
      }
      if (p[3] === "questions") {
        if (p[4] === "reorder" && method === "POST") {
          await freeze(id);
          const b = z
            .object({ ids: z.array(textSchema).max(1000) })
            .parse(await body());
          const current = await all(
            "SELECT id FROM questions WHERE exam_id=?",
            id,
          );
          if (
            b.ids.length !== current.length ||
            new Set(b.ids).size !== current.length ||
            current.some((q) => !b.ids.includes(q.id))
          )
            fail("Question order is invalid.");
          await db().batch(
            b.ids.map((qid, i) =>
              db()
                .prepare(
                  "UPDATE questions SET display_order=? WHERE id=? AND exam_id=?",
                )
                .bind(i + 1, qid, id),
            ),
          );
          return json({ ok: true });
        }
        if (method === "GET")
          return json(
            (
              await all(
                "SELECT * FROM questions WHERE exam_id=? ORDER BY display_order,id",
                id,
              )
            ).map((q) => ({ ...q, options: JSON.parse(q.options) })),
          );
        await freeze(id);
        if (method === "DELETE") {
          await run("DELETE FROM questions WHERE id=? AND exam_id=?", p[4], id);
          return json({ ok: true });
        }
        const b = z
          .object({
            question: z.string().trim().min(1).max(10000),
            options: z.array(z.string().trim().min(1).max(5000)).min(4).max(5),
            correct_option: z.number().int().min(0).max(4),
            explanation: z.string().max(10000).default(""),
            image: z.string().nullable().optional(),
            display_order: z.number().int().min(0).max(10000),
          })
          .parse(await body());
        if (b.correct_option >= b.options.length)
          fail("Select a valid correct answer.");
        const qid = p[4] || uid();
        if (p[4])
          await run(
            "UPDATE questions SET question=?,options=?,correct_option=?,explanation=?,image=?,display_order=? WHERE id=? AND exam_id=?",
            b.question,
            JSON.stringify(b.options),
            b.correct_option,
            b.explanation,
            b.image || null,
            b.display_order,
            qid,
            id,
          );
        else
          await run(
            "INSERT INTO questions VALUES(?,?,?,?,?,?,?,?)",
            qid,
            id,
            b.question,
            JSON.stringify(b.options),
            b.correct_option,
            b.explanation,
            b.image || null,
            b.display_order,
          );
        return json({ id: qid });
      }
      if (p[3] === "duplicate") {
        const e = await one("SELECT * FROM exams WHERE id=?", id);
        if (!e) fail("Exam not found.", 404);
        const newid = uid(),
          qs = await all("SELECT * FROM questions WHERE exam_id=?", id);
        await db().batch([
          db()
            .prepare(
              "INSERT INTO exams(id,title,description,start,end,duration,correct_mark,negative_mark,pass_mark,question_target,direct_token,status,result_mode,access_mode,attempt_limit,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            )
            .bind(
              newid,
              e.title + " — Copy",
              e.description,
              Math.max(e.start, now),
              Math.max(e.end, now + 86400000),
              e.duration,
              e.correct_mark,
              e.negative_mark,
              e.pass_mark || 0,
              e.question_target || qs.length,
              token(),
              "draft",
              e.result_mode,
              e.access_mode,
              e.attempt_limit,
              now,
            ),
          ...qs.map((q) =>
            db()
              .prepare("INSERT INTO questions VALUES(?,?,?,?,?,?,?,?)")
              .bind(
                uid(),
                newid,
                q.question,
                q.options,
                q.correct_option,
                q.explanation,
                q.image,
                q.display_order,
              ),
          ),
        ]);
        await grantStarterCode("exam",newid);
        return json({ id: newid });
      }
      if (p[3] === "action") {
        const b = z
          .object({
            action: z.enum([
              "publish",
              "unpublish",
              "start",
              "close",
              "release",
              "archive",
            ]),
          })
          .parse(await body());
        if (["publish", "unpublish", "start"].includes(b.action))
          await freeze(id);
        if (b.action === "publish" || b.action === "start") {
          if (
            !(await one("SELECT id FROM questions WHERE exam_id=? LIMIT 1", id))
          )
            fail("Add questions before publishing.");
        }
        if (b.action === "publish")
          await run("UPDATE exams SET status='published' WHERE id=?", id);
        if (b.action === "unpublish")
          await run("UPDATE exams SET status='draft' WHERE id=?", id);
        if (b.action === "start")
          await run(
            "UPDATE exams SET status='published',start=? WHERE id=? AND end>?",
            now,
            id,
            now,
          );
        if (b.action === "close") {
          await db().batch([
            db()
              .prepare(
                "UPDATE exams SET status='closed',end=MIN(end,?) WHERE id=?",
              )
              .bind(now, id),
            db()
              .prepare(
                "UPDATE attempts SET deadline=MIN(deadline,?) WHERE exam_id=? AND status='active'",
              )
              .bind(now, id),
          ]);
          await expire(id);
        }
        if (b.action === "release") {
          const e = await one("SELECT * FROM exams WHERE id=?", id);
          if (!e || e.end > now)
            fail("Results cannot be released until the examination closes.");
          await expire(id);
          await run(
            "UPDATE exams SET results_published=1,published_at=? WHERE id=?",
            now,
            id,
          );
        }
        if (b.action === "archive") {
          await freeze(id);
          await run("UPDATE exams SET status='archived' WHERE id=?", id);
        }
        await audit(a, "exam_" + b.action, id);
        return json({ ok: true });
      }
      if (method === "GET") {
        if (id) {
          const e = await one("SELECT * FROM exams WHERE id=?", id);
          if (!e) fail("Exam not found.", 404);
          return json(e);
        }
        return json(
          await all(
            "SELECT e.*,(SELECT COUNT(DISTINCT a.code_id) FROM attempts a WHERE a.exam_id=e.id) participants,(SELECT COUNT(*) FROM questions q WHERE q.exam_id=e.id) question_count FROM exams e WHERE status!='archived' ORDER BY created_at DESC",
          ),
        );
      }
      if (method === "DELETE") {
        await db().batch([
          db().prepare("DELETE FROM code_entitlements WHERE resource_type='exam' AND resource_id=?").bind(id),
          db()
            .prepare(
              "DELETE FROM answers WHERE attempt_id IN (SELECT id FROM attempts WHERE exam_id=?)",
            )
            .bind(id),
          db().prepare("DELETE FROM attempts WHERE exam_id=?").bind(id),
          db().prepare("DELETE FROM code_exam_access WHERE exam_id=?").bind(id),
          db().prepare("DELETE FROM package_routines WHERE exam_id=?").bind(id),
          db().prepare("DELETE FROM package_exams WHERE exam_id=?").bind(id),
          db().prepare("DELETE FROM questions WHERE exam_id=?").bind(id),
          db().prepare("DELETE FROM exams WHERE id=?").bind(id),
        ]);
        await audit(a, "exam_deleted", id);
        return json({ ok: true });
      }
      const b = z
        .object({
          title: textSchema,
          description: z.string().max(10000),
          syllabus: z.string().max(10000).default(""),
          start: z.number().int().positive(),
          end: z.number().int().positive(),
          duration: z.number().int().min(1).max(1440),
          correct_mark: z.number().int().min(1).max(10000),
          negative_mark: z.number().int().min(0).max(10000),
          pass_mark: z.number().int().min(0).max(100000000).default(0),
          question_target: z.number().int().min(0).max(1000).default(0),
          access_mode: z.enum(["open","code"]).default("code"),
          attempt_limit: z.number().int().min(1).max(10).default(1),
          result_mode: z.enum(["auto", "manual", "immediate"]),
        })
        .parse(await body());
      if (b.end <= b.start) fail("Closing time must be after starting time.");
      const examId = id || uid();
      if (id) {
        await freeze(id);
        await run(
          "UPDATE exams SET title=?,description=?,syllabus=?,start=?,end=?,duration=?,correct_mark=?,negative_mark=?,pass_mark=?,question_target=?,result_mode=?,access_mode=?,attempt_limit=? WHERE id=?",
          b.title,
          b.description,
          b.syllabus,
          b.start,
          b.end,
          b.duration,
          b.correct_mark,
          b.negative_mark,
          b.pass_mark,
          b.question_target,
          b.result_mode,
          b.access_mode,
          b.attempt_limit,
          examId,
        );
      } else
        await run(
          "INSERT INTO exams(id,title,description,syllabus,start,end,duration,correct_mark,negative_mark,pass_mark,question_target,direct_token,result_mode,access_mode,attempt_limit,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
          examId,
          b.title,
          b.description,
          b.syllabus,
          b.start,
          b.end,
          b.duration,
          b.correct_mark,
          b.negative_mark,
          b.pass_mark,
          b.question_target,
          token(),
          b.result_mode,
          b.access_mode,
          b.attempt_limit,
          now,
        );
      if(!id)await grantStarterCode("exam",examId);
      return json({ ok: true, id: examId });
    }
    if (p[1] === "books") {
      if (method === "GET")
        return json(
          p[2]
            ? await one("SELECT * FROM books WHERE id=?", p[2])
            : await all("SELECT * FROM books ORDER BY created_at DESC"),
        );
      if (method === "DELETE") {
        const ordered = await one(
          "SELECT id FROM hard_items WHERE book_id=? UNION ALL SELECT id FROM soft_orders WHERE book_id=? LIMIT 1",
          p[2],
          p[2],
        );
        if (ordered) {
          await run(
            "UPDATE books SET published=0,available=0 WHERE id=?",
            p[2],
          );
          return json({
            message: "Book unpublished. Historical orders preserved.",
          });
        }
        await run("DELETE FROM books WHERE id=?", p[2]);
        return json({ ok: true });
      }
      const b = z
        .object({
          title: textSchema,
          author: z.string().max(200).default(""),
          authors: z
            .array(z.string().trim().min(1).max(200))
            .min(1)
            .max(20)
            .optional(),
          exam_category: z
            .union([
              z.string().trim().min(1).max(100),
              z.array(z.string().trim().min(1).max(100)).min(1).max(20),
            ])
            .default("Academic"),
          subject: z.string().max(200).default("General"),
          subjects: z
            .array(z.string().trim().min(1).max(200))
            .min(1)
            .max(20)
            .optional(),
          type: z.enum(["hardcopy", "softcopy"]),
          book_types: z
            .array(z.enum(["hardcopy", "softcopy"]))
            .min(1)
            .max(2)
            .optional(),
          price: money,
          old_price: money.nullable().default(null),
          description: z.string().max(10000),
          cover: z.string().nullable(),
          preview: z.string().nullable(),
          digital: z.string().nullable(),
          stock_count: z
            .number()
            .int()
            .min(0)
            .max(1000000)
            .nullable()
            .default(null),
          available: z.boolean(),
          published: z.boolean(),
        })
        .parse(await body());
      for (const [key, visibility] of [
        ["cover", "public"],
        ["preview", "public"],
        ["digital", "private"],
      ] as const) {
        if (
          b[key] &&
          !(await one(
            "SELECT id FROM files WHERE id=? AND visibility=?",
            b[key],
            visibility,
          ))
        )
          fail("Invalid " + key + " file.");
      }
      const authorList = b.authors || [b.author || "Unknown"],
        subjectList = b.subjects || [b.subject || "General"],
        categoryList = Array.isArray(b.exam_category)
          ? b.exam_category
          : [b.exam_category],
        typeList = b.book_types || [b.type];
      const examCategory = JSON.stringify([...new Set(categoryList)]),
        authors = JSON.stringify([...new Set(authorList)]),
        subjects = JSON.stringify([...new Set(subjectList)]),
        bookTypes = JSON.stringify([...new Set(typeList)]);
      if (p[2])
        await run(
          "UPDATE books SET title=?,author=?,authors=?,exam_category=?,subject=?,subjects=?,type=?,book_types=?,price=?,old_price=?,description=?,cover=?,preview=?,digital=?,stock_count=?,available=?,published=? WHERE id=?",
          b.title,
          authorList[0],
          authors,
          examCategory,
          subjectList[0],
          subjects,
          b.type,
          bookTypes,
          b.price,
          b.old_price && b.old_price > b.price ? b.old_price : null,
          b.description,
          b.cover,
          b.preview,
          b.digital,
          b.type === "hardcopy" ? b.stock_count : null,
          +(b.available && !(b.type === "hardcopy" && b.stock_count === 0)),
          +b.published,
          p[2],
        );
      else
        await run(
          "INSERT INTO books(id,title,author,authors,exam_category,subject,subjects,type,book_types,price,old_price,description,cover,preview,digital,stock_count,available,published,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
          uid(),
          b.title,
          authorList[0],
          authors,
          examCategory,
          subjectList[0],
          subjects,
          b.type,
          bookTypes,
          b.price,
          b.old_price && b.old_price > b.price ? b.old_price : null,
          b.description,
          b.cover,
          b.preview,
          b.digital,
          b.type === "hardcopy" ? b.stock_count : null,
          +(b.available && !(b.type === "hardcopy" && b.stock_count === 0)),
          +b.published,
          now,
        );
      return json({ ok: true });
    }
    if (p[1] === "orders") {
      const table =
        p[2] === "hardcopy"
          ? "hard_orders"
          : p[2] === "softcopy"
            ? "soft_orders"
            : p[2] === "package"
              ? "package_orders"
              : p[2] === "course"
                ? "course_orders"
                : fail("Order type is invalid.");
      if (method === "PATCH") {
        const b = z
          .object({
            field: z.enum([
              "verified",
              "delivered",
              "received",
              "access_suspended",
              "expires_at",
            ]),
            value: z.union([z.boolean(), z.number().int().positive()]),
          })
          .parse(await body());
        if (
          table === "hard_orders" &&
          !["verified", "delivered", "received"].includes(b.field)
        )
          fail("Invalid order control.");
        if (
          !["hard_orders", "package_orders", "course_orders"].includes(table) &&
          b.field !== "verified"
        )
          fail("Invalid order control.");
        if (
          ["access_suspended", "expires_at"].includes(b.field) &&
          !["package_orders", "course_orders"].includes(table)
        )
          fail("Invalid access control.");
        const old = await one(`SELECT * FROM ${table} WHERE id=?`, p[3]);
        if (!old) fail("Order not found.", 404);
        if (table === "package_orders" && b.field === "verified") {
          let codeId = old.access_code_id;
          const pack = await one(
            "SELECT max_participants,access_days,status FROM exam_packages WHERE id=?",
            old.package_id,
          );
          if (b.value && pack?.status !== "active")
            fail("This package is inactive.");
          if (b.value && pack?.max_participants) {
            const occupied = await one(
              "SELECT COUNT(*) n FROM package_orders WHERE package_id=? AND verified=1 AND id!=?",
              old.package_id,
              old.id,
            );
            if (occupied.n >= pack.max_participants)
              fail("The participant limit has been reached.");
          }
          if (b.value && !codeId) {
            const included = await all(
              "SELECT exam_id FROM package_exams WHERE package_id=? ORDER BY display_order",
              old.package_id,
            );
            if (!included.length)
              fail("Add examinations to this package before verification.");
            codeId = uid();
            let code = accessCode();
            while (await one("SELECT id FROM codes WHERE code=?", code))
              code = accessCode();
            await db().batch([
              db()
                .prepare("INSERT INTO codes(id,code,active,created_at) VALUES(?,?,1,?)")
                .bind(codeId, code, now),
              db()
                .prepare(
                  "UPDATE package_orders SET access_code_id=? WHERE id=?",
                )
                .bind(codeId, old.id),
              ...included.map((x) =>
                db()
                  .prepare("INSERT INTO code_exam_access VALUES(?,?,?,?)")
                  .bind(uid(), codeId, x.exam_id, old.id),
              ),
            ]);
          }
          if (codeId)
            await run("UPDATE codes SET active=? WHERE id=?", +b.value, codeId);
          if (b.value && !old.activated_at) {
            const activated = now,
              expires = now + (pack?.access_days || 30) * 86400000;
            await run(
              "UPDATE package_orders SET activated_at=?,expires_at=? WHERE id=?",
              activated,
              expires,
              old.id,
            );
          }
        }
        if (table === "course_orders" && b.field === "verified") {
          let codeId = old.access_code_id;
          const linked = await one(
            "SELECT c.package_id FROM course_orders o JOIN courses c ON c.id=o.course_id WHERE o.id=?",
            old.id,
          );
          if (b.value && !codeId) {
            codeId = uid();
            let code = accessCode();
            while (await one("SELECT id FROM codes WHERE code=?", code))
              code = accessCode();
            await db().batch([
              db()
                .prepare("INSERT INTO codes(id,code,active,created_at) VALUES(?,?,1,?)")
                .bind(codeId, code, now),
              db()
                .prepare("UPDATE course_orders SET access_code_id=? WHERE id=?")
                .bind(codeId, old.id),
            ]);
          }
          if (codeId)
            await run("UPDATE codes SET active=? WHERE id=?", +b.value, codeId);
          if (b.value && !old.activated_at) {
            const validity = await one(
              "SELECT access_validity_days FROM courses WHERE id=?",
              old.course_id,
            );
            await run(
              "UPDATE course_orders SET activated_at=?,expires_at=? WHERE id=?",
              now,
              now + Number(validity?.access_validity_days || 365) * 86400000,
              old.id,
            );
          }
        }
        if (b.field === "access_suspended") {
          await run(
            `UPDATE ${table} SET access_suspended=? WHERE id=?`,
            +b.value,
            p[3],
          );
          if (old.access_code_id)
            await run(
              "UPDATE codes SET active=? WHERE id=?",
              +(old.verified && !b.value),
              old.access_code_id,
            );
          await audit(a, `access_suspended:${b.value}`, p[3]);
          return json({ ok: true });
        }
        if (b.field === "expires_at") {
          await run(
            `UPDATE ${table} SET expires_at=? WHERE id=?`,
            b.value,
            p[3],
          );
          await audit(a, "access_extended", p[3]);
          return json({ ok: true });
        }
        await run(
          `UPDATE ${table} SET ${b.field}=?,${b.field}_at=?${b.field === "verified" ? ",verified_by=?" : ""} WHERE id=?`,
          +b.value,
          b.value ? now : null,
          ...(b.field === "verified" ? [b.value ? a.username : null] : []),
          p[3],
        );
        if (b.field === "verified")
          await run(
            "UPDATE payments SET status=?,updated_at=? WHERE order_id=?",
            b.value ? "paid" : "pending",
            now,
            p[3],
          );
        await audit(a, `${b.field}:${b.value}`, p[3]);
        return json({ ok: true });
      }
      if (method === "DELETE" && p[3]) {
        const old = await one(`SELECT * FROM ${table} WHERE id=?`, p[3]);
        if (!old) fail("Order not found.", 404);
        if (table === "hard_orders")
          await db().batch([
            db()
              .prepare("DELETE FROM hard_items WHERE order_id=?")
              .bind(old.id),
            db().prepare("DELETE FROM hard_orders WHERE id=?").bind(old.id),
          ]);
        else if (table === "package_orders") {
          await db().batch([
            ...(old.access_code_id ? [db().prepare("DELETE FROM package_sessions WHERE package_id=? AND code_id=?").bind(old.package_id,old.access_code_id)] : []),
            db()
              .prepare("DELETE FROM code_exam_access WHERE package_order_id=?")
              .bind(old.id),
            db().prepare("DELETE FROM package_orders WHERE id=?").bind(old.id),
            ...(old.access_code_id
              ? [
                  db()
                    .prepare("UPDATE codes SET active=0 WHERE id=?")
                    .bind(old.access_code_id),
                ]
              : []),
          ]);
        } else if (table === "course_orders") {
          await db().batch([
            ...(old.access_code_id
              ? [
                  db()
                    .prepare(
                      "DELETE FROM course_sessions WHERE course_id=? AND code_id=?",
                    )
                    .bind(old.course_id, old.access_code_id),
                  db()
                    .prepare(
                      "DELETE FROM course_progress WHERE course_id=? AND code_id=?",
                    )
                    .bind(old.course_id, old.access_code_id),
                ]
              : []),
            db().prepare("DELETE FROM course_orders WHERE id=?").bind(old.id),
            ...(old.access_code_id
              ? [
                  db()
                    .prepare("UPDATE codes SET active=0 WHERE id=?")
                    .bind(old.access_code_id),
                ]
              : []),
          ]);
        } else await run("DELETE FROM soft_orders WHERE id=?", old.id);
        await audit(a, `order_deleted:${p[2]}`, old.id);
        return json({ ok: true });
      }
      if (p[3]) {
        const o = await one(`SELECT * FROM ${table} WHERE id=?`, p[3]);
        if (!o) fail("Order not found.", 404);
        delete o.token_hash;
        if (table === "hard_orders")
          o.items = await all(
            "SELECT * FROM hard_items WHERE order_id=?",
            o.id,
          );
        if (
          (table === "package_orders" || table === "course_orders") &&
          o.access_code_id
        )
          o.access_code = (
            await one("SELECT code FROM codes WHERE id=?", o.access_code_id)
          )?.code;
        return json(o);
      }
      let where =
          "WHERE (id LIKE ? OR phone LIKE ? OR trx LIKE ? OR name LIKE ?)",
        v: any[] = Array(4).fill(
          "%" + (u.searchParams.get("search") || "") + "%",
        );
      for (const k of [
        "verified",
        ...(table === "hard_orders"
          ? ["delivered", "received", "payment_type"]
          : []),
      ]) {
        const value = u.searchParams.get(k);
        if (value) {
          where += ` AND ${k}=?`;
          v.push(value);
        }
      }
      for (const k of ["from", "to"]) {
        const value = Number(u.searchParams.get(k));
        if (value) {
          where += ` AND created_at${k === "from" ? ">=" : "<="}?`;
          v.push(value);
        }
      }
      if (u.searchParams.get("export") === "csv") {
        const rows = await all(
          `SELECT * FROM ${table} ${where} ORDER BY created_at DESC LIMIT 100000`,
          ...v,
        );
        const keys = rows[0]
          ? Object.keys(rows[0]).filter((k) => k !== "token_hash")
          : [];
        return new Response(
          [
            keys.map(csvCell).join(","),
            ...rows.map((row) => keys.map((k) => csvCell(row[k])).join(",")),
          ].join("\r\n"),
          {
            headers: {
              "Content-Type": "text/csv; charset=utf-8",
              "Content-Disposition": `attachment; filename="${p[2]}-orders.csv"`,
              "Cache-Control": "no-store",
            },
          },
        );
      }
      const page = Math.max(1, Number(u.searchParams.get("page")) || 1),
        total = (await one(`SELECT COUNT(*) n FROM ${table} ${where}`, ...v)).n;
      const rows = await all(
        `SELECT *,${table === "hard_orders" ? "(SELECT group_concat(title, ', ') FROM hard_items WHERE order_id=hard_orders.id)" : table === "soft_orders" ? "book_title" : table === "package_orders" ? "package_title" : "course_name"} product_summary,${table === "hard_orders" ? "(SELECT group_concat(quantity, ', ') FROM hard_items WHERE order_id=hard_orders.id)" : "1"} product_quantity,(SELECT COUNT(*) FROM hard_orders h WHERE h.trx=${table}.trx)+(SELECT COUNT(*) FROM soft_orders s WHERE s.trx=${table}.trx)+(SELECT COUNT(*) FROM package_orders p WHERE p.trx=${table}.trx)+(SELECT COUNT(*) FROM course_orders c WHERE c.trx=${table}.trx) trx_count FROM ${table} ${where} ORDER BY created_at DESC LIMIT 50 OFFSET ?`,
        ...v,
        (page - 1) * 50,
      );
      rows.forEach((o) => delete o.token_hash);
      return json({ rows, total, page });
    }
    if (p[1] === "upload" && method === "POST") {
      if (Number(r.headers.get("content-length") || 0) > 26000000)
        fail("File must be no larger than 25 MB.");
      const form = await r.formData(),
        f = form.get("file"),
        kind = form.get("kind");
      if (!(f instanceof File) || f.size > 25000000 || f.size === 0)
        fail("Select a file up to 25 MB.");
      const bytes = new Uint8Array(await f.arrayBuffer()),
        pdf = new TextDecoder().decode(bytes.slice(0, 5)) === "%PDF-",
        png =
          bytes[0] === 137 &&
          bytes[1] === 80 &&
          bytes[2] === 78 &&
          bytes[3] === 71,
        jpg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
      const webp =
        bytes[0] === 82 &&
        bytes[1] === 73 &&
        bytes[2] === 70 &&
        bytes[3] === 70 &&
        bytes[8] === 87 &&
        bytes[9] === 69 &&
        bytes[10] === 66 &&
        bytes[11] === 80;
      const avif =
        bytes[4] === 102 &&
        bytes[5] === 116 &&
        bytes[6] === 121 &&
        bytes[7] === 112 &&
        ((bytes[8] === 97 &&
          bytes[9] === 118 &&
          bytes[10] === 105 &&
          bytes[11] === 102) ||
          (bytes[8] === 97 &&
            bytes[9] === 118 &&
            bytes[10] === 105 &&
            bytes[11] === 115));
      if (
        ![
          "cover",
          "preview",
          "digital",
          "question",
          "team",
          "course",
          "note",
          "noteFile",
          "noticeAttachment",
          "blog",
          "author",
          "review",
          "settingsLogo",
          "settingsHero",
          "settingsFavicon",
          "coursePdf",
        ].includes(String(kind))
      )
        fail("Invalid upload purpose.");
      if (
        ["preview", "digital"].includes(String(kind))
          ? !pdf
          : kind === "noticeAttachment" || kind === "noteFile"
            ? !(pdf || png || jpg || webp || avif)
            : kind === "coursePdf"
              ? !pdf
              : !(png || jpg || webp || avif)
      )
        fail(
          "Use a PDF for document files or a PNG, JPEG, WebP or AVIF for images.",
        );
      const id = uid(),
        mime = pdf
          ? "application/pdf"
          : png
            ? "image/png"
            : webp
              ? "image/webp"
              : avif
                ? "image/avif"
                : "image/jpeg";
      if (!env.BUCKET) fail("File storage is unavailable.", 503);
      await env.BUCKET.put(id, bytes, { httpMetadata: { contentType: mime } });
      await run(
        "INSERT INTO files VALUES(?,?,?,?,?)",
        id,
        f.name.slice(0, 200),
        mime,
        kind === "digital" || kind === "coursePdf" ? "private" : "public",
        now,
      );
      return json({ id });
    }
  }
  return json({ error: "Not found." }, 404);
}
async function fileResponse(
  id: string,
  privateAccess: boolean,
  requestedName?: string,
  inline = false,
) {
  const f = await one("SELECT * FROM files WHERE id=?", id);
  if (!f || (!privateAccess && f.visibility === "private"))
    fail("File not found.", 404);
  const o = await env.BUCKET?.get(id);
  if (!o) fail("File not available.", 404);
  const extension =
    f.mime === "application/pdf"
      ? ".pdf"
      : f.mime === "image/png"
        ? ".png"
        : f.mime === "image/webp"
          ? ".webp"
          : f.mime === "image/avif"
            ? ".avif"
            : ".jpg";
  const displayName = requestedName
    ? `${requestedName.replace(/\.(pdf|png|jpe?g|webp|avif)$/i, "")}${extension}`
    : `lexveritas${extension}`;
  const disposition =
    privateAccess && !inline
      ? `attachment; filename="lexveritas${extension}"; filename*=UTF-8''${encodeURIComponent(displayName)}`
      : `inline; filename="lexveritas${extension}"`;
  return new Response(o.body, {
    headers: {
      "Content-Type": f.mime,
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Cache-Control":
        f.visibility === "private"
          ? "private, no-store"
          : "public, max-age=31536000, immutable",
      "Content-Disposition": disposition,
    },
  });
}
