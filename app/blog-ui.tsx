"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BookOpenText,
  CalendarDays,
  Copy,
  Eye,
  Newspaper,
  Send,
  Share2,
  Tag,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { date, ErrorBox, Loading, useData } from "@/lib/client";

const asset = (value?: string | null) =>
  !value ? "" : value.startsWith("/") ? value : `/api/files/${value}`;
const taxonomyHref = (
  type: "category" | "subcategory" | "tag",
  value: string,
) => `/blog?${type}=${encodeURIComponent(value)}`;
const tagValues = (value = "") =>
  value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);

function TaxonomyLinks({
  blog,
  compact = false,
}: {
  blog: any;
  compact?: boolean;
}) {
  const items = [
    blog.category && { type: "category" as const, label: blog.category },
    blog.subcategory && {
      type: "subcategory" as const,
      label: blog.subcategory,
    },
  ].filter(Boolean) as { type: "category" | "subcategory"; label: string }[];
  if (!items.length) return null;
  return (
    <nav
      className={`blog-taxonomy-links ${compact ? "compact" : ""}`}
      aria-label="Article classification"
    >
      {items.map((item) => (
        <a
          key={`${item.type}-${item.label}`}
          href={taxonomyHref(item.type, item.label)}
        >
          {item.label}
        </a>
      ))}
    </nav>
  );
}

function AuthorAvatar({
  blog,
  size = "small",
}: {
  blog: any;
  size?: "small" | "large";
}) {
  return blog.author_photo ? (
    <img
      className={`author-avatar author-avatar-${size}`}
      loading="lazy"
      decoding="async"
      src={asset(blog.author_photo)}
      alt={`${blog.author_name} profile`}
    />
  ) : (
    <span
      className={`author-avatar author-avatar-${size} author-avatar-fallback`}
    >
      <User size={size === "large" ? 34 : 17} aria-hidden="true" />
    </span>
  );
}

function AuthorLink({ blog, large = false }: { blog: any; large?: boolean }) {
  const href = blog.author_slug ? `/authors/${blog.author_slug}` : "/blog";
  return (
    <a className={large ? "blog-author" : "blog-author-mini"} href={href}>
      <AuthorAvatar blog={blog} size={large ? "large" : "small"} />
      <span>
        {large && <small>WRITTEN BY</small>}
        <strong>{blog.author_name}</strong>
        {large && blog.author_description && <p>{blog.author_description}</p>}
      </span>
      {large && <ArrowRight size={18} aria-hidden="true" />}
    </a>
  );
}

function BlogCard({ blog, readMore = "Read More" }: any) {
  return (
    <article className="blog-card">
      <a className="blog-thumb" href={`/blog/${blog.slug}`}>
        {blog.thumbnail ? (
          <img
            loading="lazy"
            decoding="async"
            src={asset(blog.thumbnail)}
            alt={`${blog.title} thumbnail`}
          />
        ) : (
          <Newspaper size={46} aria-hidden="true" />
        )}
        <time>{date(blog.publish_date)}</time>
      </a>
      <div className="blog-card-body">
        <TaxonomyLinks blog={blog} compact />
        <h3>
          <a href={`/blog/${blog.slug}`}>{blog.title}</a>
        </h3>
        <AuthorLink blog={blog} />
        <p>{blog.excerpt}</p>
        <a className="blog-read-more" href={`/blog/${blog.slug}`}>
          {readMore} <ArrowRight size={16} />
        </a>
      </div>
    </article>
  );
}

function BlogShare({ title }: { title: string }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 8, left: 8 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const placeAbove = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const width = menuRef.current?.offsetWidth || 210;
      const height = menuRef.current?.offsetHeight || 300;
      setPosition({
        top: Math.max(8, rect.top - height - 8),
        left: Math.min(Math.max(8, rect.left), Math.max(8, window.innerWidth - width - 8)),
      });
    };
    const closeOutside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !menuRef.current?.contains(target)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    placeAbove();
    const frame = requestAnimationFrame(placeAbove);
    window.addEventListener("resize", placeAbove);
    window.addEventListener("scroll", placeAbove, true);
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", placeAbove);
      window.removeEventListener("scroll", placeAbove, true);
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);
  const share = (network: string) => {
    const url = window.location.href;
    const encodedUrl = encodeURIComponent(url);
    const encodedTitle = encodeURIComponent(title);
    const destinations: Record<string, string> = {
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
      x: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`,
      whatsapp: `https://wa.me/?text=${encodedTitle}%20${encodedUrl}`,
      telegram: `https://t.me/share/url?url=${encodedUrl}&text=${encodedTitle}`,
    };
    if (destinations[network]) {
      window.open(destinations[network], "_blank", "noopener,noreferrer");
      setOpen(false);
      return;
    }
    if (network === "instagram" && navigator.share) {
      navigator.share({ title, url }).catch(() => undefined);
      setOpen(false);
      return;
    }
    navigator.clipboard
      .writeText(url)
      .then(() =>
        toast.success(
          network === "instagram"
            ? "Link copied. Paste it into Instagram."
            : "Blog link copied.",
        ),
      );
    setOpen(false);
  };
  return (
    <div className="blog-share">
      <button
        ref={triggerRef}
        type="button"
        className="blog-share-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Share2 size={15} /> Share This Blog
      </button>
      {open && createPortal(<div ref={menuRef} className="blog-share-menu blog-share-menu-portal" role="menu" aria-label={`Share ${title}`} style={position}>
        <button type="button" onClick={() => share("facebook")}>
          <strong aria-hidden="true">f</strong> Facebook
        </button>
        <button type="button" onClick={() => share("x")}>
          <strong aria-hidden="true">X</strong> X / Twitter
        </button>
        <button type="button" onClick={() => share("instagram")}>
          <strong aria-hidden="true">◎</strong> Instagram
        </button>
        <button type="button" onClick={() => share("whatsapp")}>
          <Send size={16} /> WhatsApp
        </button>
        <button type="button" onClick={() => share("telegram")}>
          <Send size={16} /> Telegram
        </button>
        <button type="button" onClick={() => share("copy")}>
          <Copy size={16} /> Copy Link
        </button>
      </div>, document.body)}
    </div>
  );
}

export function HomeBlogs({ settings, initialData }: any) {
  const { data, error } = useData("blogs", initialData);
  if (!settings.blogVisible) return null;
  return (
    <section className="container section blog-home-section">
      <div className="section-head">
        <div>
          <div className="eyebrow">LEXVERITAS ACADEMY</div>
          <h2>{settings.blogTitle}</h2>
          <p>{settings.blogSubtitle}</p>
        </div>
        <div className="home-blog-heading-actions">
          <a className="btn outline" href="/write-a-blog">
            Write A Blog <BookOpenText size={16} />
          </a>
          <a className="text-link" href="/blog">
            {settings.viewAllText} Blogs <ArrowRight size={16} />
          </a>
        </div>
      </div>
      <ErrorBox error={error} />
      {!data && !error ? (
        <Loading />
      ) : data?.length ? (
        <div
          className="home-blog-carousel"
          aria-label="Latest Blogs. Swipe or scroll horizontally for more."
        >
          <div className="home-blog-track">
            {data.map((blog: any) => (
              <BlogCard
                key={blog.id}
                blog={blog}
                readMore={settings.blogReadMoreText}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="card empty">
          <h3>New Articles Will Appear Here</h3>
          <p>Published Academy Blogs will be displayed automatically.</p>
        </div>
      )}
    </section>
  );
}

export function WriteBlogPage() {
  return (
    <div className="container section write-blog-page">
      <div className="page-heading blog-page-heading">
        <div>
          <div className="eyebrow">CONTRIBUTE TO LEXVERITAS JOURNAL</div>
          <h1>Write A Blog</h1>
          <p>Submit your legal article for editorial review.</p>
        </div>
        <BookOpenText size={54} strokeWidth={1.2} aria-hidden="true" />
      </div>
      <section className="write-blog-card" aria-labelledby="submission-rules">
        <div>
          <div className="eyebrow">SUBMISSION GUIDELINES</div>
          <h2 id="submission-rules">Blog Rules &amp; Regulations</h2>
        </div>
        <ol className="submission-rules">
          <li>The article must be no longer than 3,000 words.</li>
          <li>Submit the complete article as a Microsoft Word file.</li>
          <li>
            Include your full name, one recent photograph and a short author
            description.
          </li>
          <li>
            Add every source and reference as a clickable hyperlink within the
            article.
          </li>
          <li>
            Email the Word file and author information to
            <a href="mailto:parvezbupllb@gmail.com">
              parvezbupllb@gmail.com
            </a>
            .
          </li>
        </ol>
        <a
          className="btn write-blog-email"
          href="mailto:parvezbupllb@gmail.com?subject=Blog%20Submission%20for%20LexVeritas%20Academy"
        >
          <Send size={17} /> Send Your Blog
        </a>
      </section>
    </div>
  );
}

export function BlogsPage() {
  const { data, error } = useData("blogs"),
    { data: settings } = useData("settings");
  const search = useSearchParams();
  const category = search.get("category") || "";
  const subcategory = search.get("subcategory") || "";
  const tag = search.get("tag") || "";
  const filtered = data?.filter((blog: any) => {
    if (category && blog.category.toLowerCase() !== category.toLowerCase())
      return false;
    if (
      subcategory &&
      blog.subcategory.toLowerCase() !== subcategory.toLowerCase()
    )
      return false;
    if (
      tag &&
      !tagValues(blog.tags).some(
        (item) => item.toLowerCase() === tag.toLowerCase(),
      )
    )
      return false;
    return true;
  });
  const activeFilter = category || subcategory || tag;
  return (
    <div className="container section blogs-page">
      <div className="page-heading blog-page-heading">
        <div>
          <div className="eyebrow">LEXVERITAS JOURNAL</div>
          <h1>{activeFilter || settings?.blogTitle || "Blog"}</h1>
          <p>
            {activeFilter
              ? `Articles filed under ${activeFilter}`
              : settings?.blogSubtitle}
          </p>
        </div>
        <BookOpenText size={54} strokeWidth={1.2} aria-hidden="true" />
      </div>
      <ErrorBox error={error} />
      {!data && !error ? (
        <Loading />
      ) : filtered?.length ? (
        <div className="blog-grid">
          {filtered.map((blog: any) => (
            <BlogCard
              key={blog.id}
              blog={blog}
              readMore={settings?.blogReadMoreText}
            />
          ))}
        </div>
      ) : !error ? (
        <div className="card empty">
          <h3>
            {activeFilter ? "No Matching Articles" : "No Published Blogs"}
          </h3>
          <p>
            {activeFilter
              ? "No published articles are currently filed under this selection."
              : "Published Academy Blogs will appear here."}
          </p>
          {activeFilter && (
            <a className="text-link" href="/blog">
              View All Blogs
            </a>
          )}
        </div>
      ) : null}
    </div>
  );
}

export function BlogDetail({ slug }: { slug: string }) {
  const { data, error } = useData(`blogs/${encodeURIComponent(slug)}`);
  useEffect(() => {
    if (!data) return;
    document.title = `${data.seo_title || data.title} | LexVeritas Academy`;
    let meta = document.querySelector<HTMLMetaElement>(
      'meta[name="description"]',
    );
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "description";
      document.head.appendChild(meta);
    }
    meta.content = data.meta_description || data.excerpt || data.title;
  }, [data]);
  if (error)
    return (
      <div className="container section">
        <a className="back-link" href="/blog">
          <ArrowLeft size={16} /> All Blogs
        </a>
        <ErrorBox error={error} />
      </div>
    );
  if (!data) return <Loading />;
  return (
    <article className="container section blog-detail legal-article">
      <nav className="blog-breadcrumb" aria-label="Breadcrumb">
        <a href="/blog">Blog</a>
        {data.category && (
          <>
            <span aria-hidden="true">·</span>
            <a href={taxonomyHref("category", data.category)}>
              {data.category}
            </a>
          </>
        )}
        {data.subcategory && (
          <>
            <span aria-hidden="true">·</span>
            <a href={taxonomyHref("subcategory", data.subcategory)}>
              {data.subcategory}
            </a>
          </>
        )}
      </nav>
      <header className="blog-detail-header">
        <h1>{data.title}</h1>
        {data.excerpt && <p className="blog-detail-deck">{data.excerpt}</p>}
        <div className="blog-meta-bar">
          <span className="blog-meta-author-prefix">By</span>
          <AuthorLink blog={data} />
          <span className="blog-meta-item">
            <CalendarDays size={15} /> {date(data.publish_date)}
          </span>
          <BlogShare title={data.title} />
          <span className="blog-meta-item blog-views">
            <Eye size={16} /> {Number(data.view_count || 0).toLocaleString()}
          </span>
        </div>
      </header>
      {data.thumbnail && (
        <figure className="blog-cover-card">
          <img
            className="blog-hero"
            src={asset(data.thumbnail)}
            alt={`${data.title} featured image`}
          />
        </figure>
      )}
      <div
        className="blog-content"
        dangerouslySetInnerHTML={{ __html: data.content }}
      />
      {!!tagValues(data.tags).length && (
        <section className="blog-tags" aria-label="Article tags">
          <strong>
            <Tag size={16} /> Tags
          </strong>
          <div>
            {tagValues(data.tags).map((tag) => (
              <a key={tag} href={taxonomyHref("tag", tag)}>
                {tag}
              </a>
            ))}
          </div>
        </section>
      )}
      <footer className="blog-author-footer">
        <AuthorLink blog={data} large />
      </footer>
      {!!data.related?.length && (
        <section className="related-articles">
          <div className="section-head">
            <div>
              <div className="eyebrow">CONTINUE READING</div>
              <h2>Related Articles</h2>
            </div>
            <a className="text-link" href="/blog">
              All Blogs <ArrowRight size={16} />
            </a>
          </div>
          <div className="related-article-grid">
            {data.related.map((blog: any) => (
              <BlogCard key={blog.id} blog={blog} />
            ))}
          </div>
        </section>
      )}
    </article>
  );
}

export function AuthorProfile({ slug }: { slug: string }) {
  const { data, error } = useData(`authors/${encodeURIComponent(slug)}`);
  if (error)
    return (
      <div className="container section">
        <a className="back-link" href="/blog">
          <ArrowLeft size={16} /> All Blogs
        </a>
        <ErrorBox error={error} />
      </div>
    );
  if (!data) return <Loading />;
  const avatarSource = {
    author_name: data.name,
    author_photo: data.photo,
  };
  return (
    <div className="author-profile-page">
      <section className="author-profile-hero">
        <div className="container author-profile-inner">
          <AuthorAvatar blog={avatarSource} size="large" />
          <div>
            <div className="eyebrow">AUTHOR PROFILE</div>
            <h1>{data.name}</h1>
            {data.description && <p>{data.description}</p>}
          </div>
        </div>
      </section>
      <section className="container section">
        <div className="section-head">
          <div>
            <div className="eyebrow">PUBLISHED WRITING</div>
            <h2>Articles By {data.name}</h2>
          </div>
          <a className="text-link" href="/blog">
            All Blogs <ArrowRight size={16} />
          </a>
        </div>
        {data.blogs?.length ? (
          <div className="blog-grid">
            {data.blogs.map((blog: any) => (
              <BlogCard key={blog.id} blog={blog} />
            ))}
          </div>
        ) : (
          <div className="card empty">
            <h3>No Published Articles</h3>
          </div>
        )}
      </section>
    </div>
  );
}
