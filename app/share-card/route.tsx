import { ImageResponse } from "next/og.js";
import { one } from "@/lib/server";

export const dynamic = "force-dynamic";
let fontCache: Promise<ArrayBuffer> | null = null;

const labels: Record<string, [string, string]> = {
  "/": ["LEXVERITAS ACADEMY", "Learn The Law. Test Your Preparation."],
  "/books": ["BOOKS & STUDY MATERIALS", "Law books and digital editions"],
  "/blog": ["LEGAL INSIGHTS", "Stories, guides and legal analysis"],
  "/courses": ["ACADEMY COURSES", "Structured legal preparation"],
  "/packages": ["EXAM BATCHES", "Practice with purpose"],
  "/notes": ["FREE STUDY NOTES", "Resources for legal preparation"],
  "/notices": ["ACADEMY NOTICES", "Latest announcements"],
};

export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get("path") || "/";
  const path = raw.startsWith("/") && raw.length <= 350 && !raw.includes("..") ? raw.replace(/\/$/, "") || "/" : "/";
  const parts = path.split("/").filter(Boolean);
  let [eyebrow, title] = labels[path] || ["LEXVERITAS ACADEMY", parts.at(-1)?.replaceAll("-", " ") || "Legal education"];
  try {
    let item:any = null;
    if (parts[0] === "blog" && parts[1]) {
      eyebrow = "LEGAL INSIGHTS";
      item = await one("SELECT title FROM blogs WHERE slug=? AND published=1", parts[1]);
    } else if (parts[0] === "books" && parts[1]) {
      eyebrow = "BOOKS & STUDY MATERIALS";
      item = await one("SELECT title FROM books WHERE id=? AND published=1", parts[1]);
    } else if (parts[0] === "courses" && parts[1]) {
      eyebrow = "ACADEMY COURSES";
      item = await one("SELECT name title FROM courses WHERE id=? AND published=1", parts[1]);
    } else if (parts[0] === "packages" && parts[1]) {
      eyebrow = "EXAM BATCHES";
      item = await one("SELECT title FROM exam_packages WHERE id=? AND published=1", parts[1]);
    } else if (parts[0] === "notes" && parts[1] === "item" && parts[2]) {
      eyebrow = "FREE STUDY NOTES";
      item = await one("SELECT title FROM notes WHERE id=? AND published=1", parts[2]);
    } else if (parts[0] === "notices" && parts[1]) {
      eyebrow = "ACADEMY NOTICE";
      item = await one("SELECT title FROM notices WHERE id=? AND published=1", parts[1]);
    }
    if (item?.title) title = String(item.title);
  } catch { /* Keep a useful branded card when the content service is unavailable. */ }
  const displayTitle = title.length > 110 ? `${title.slice(0, 107)}…` : title;
  let fonts: any[] = [];
  try {
    fontCache ||= fetch(new URL("/fonts/NotoSansBengali-Regular.ttf", request.url)).then(async response => {
      if (!response.ok) throw Error("Font unavailable");
      return response.arrayBuffer();
    });
    fonts = [{ name: "Lex Bengali", data: await fontCache, weight: 400, style: "normal" }];
  } catch { fontCache = null; }
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "76px 82px", backgroundColor: "#102d3c", color: "#fff", fontFamily: fonts.length ? "Lex Bengali" : "sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16, color: "#e9c990", fontSize: 23, letterSpacing: 3 }}>
        <div style={{ width: 38, height: 5, backgroundColor: "#e9c990" }} />{eyebrow}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
        <div style={{ fontSize: displayTitle.length > 72 ? 47 : 61, lineHeight: 1.3, overflowWrap: "anywhere" }}>{displayTitle}</div>
        <div style={{ width: 175, height: 5, backgroundColor: "#e9c990" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 26 }}>
        <span>LexVeritas Academy</span><span style={{ color: "#b5cbd4", fontSize: 19 }}>BJS · Bar Council · Law Officer</span>
      </div>
    </div>,
    { width: 1200, height: 630, fonts, headers: { "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400" } },
  );
}
