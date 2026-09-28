"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  GraduationCap,
  ScrollText,
  Users,
  BadgeCheck,
  Quote,
  UserRound,
  Download,
  Star,
  CirclePlay,
} from "lucide-react";
import {
  api,
  date,
  ErrorBox,
  Field,
  Loading,
  money,
  useData,
} from "@/lib/client";
import { PaymentMethodPicker } from "./payment-method";
import { PackageCard } from "./packages-ui";
import { PdfDocumentViewer } from "@/components/pdf-viewer";
import { ShareActions } from "@/components/share-actions";
import { matchesPreparationCategory } from "@/lib/academy-navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const asset = (value?: string | null) =>
  !value ? "" : value.startsWith("/") ? value : `/api/files/${value}`;

function AnimatedStatValue({ value, active }: { value: string; active: boolean }) {
  const [display, setDisplay] = useState("0");
  useEffect(() => {
    if (!active) return;
    const raw = String(value || "0");
    const match = raw.match(/^([^\d]*)([\d,]+(?:\.\d+)?)(.*)$/);
    if (!match) {
      setDisplay(raw);
      return;
    }
    const [, prefix, numeric, suffix] = match;
    const target = Number(numeric.replaceAll(",", ""));
    const decimals = numeric.includes(".") ? numeric.split(".")[1].length : 0;
    if (!Number.isFinite(target) || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setDisplay(raw);
      return;
    }
    const started = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - started) / 1350);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = target * eased;
      setDisplay(
        `${prefix}${current.toLocaleString("en-US", {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        })}${suffix}`,
      );
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active, value]);
  return <>{display}</>;
}

export function StatisticsSection({ settings }: any = {}) {
  const sectionRef = useRef<HTMLElement>(null);
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    const node = sectionRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setEntered(true);
          observer.disconnect();
        }
      },
      { threshold: 0.18 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  if (settings?.statisticsVisible === false) return null;
  const icons = [Users, BookOpen, Star, FileText];
  const stats = [1, 2, 3, 4]
    .map((n) => ({
      label: settings?.[`stat${n}Label`],
      value: settings?.[`stat${n}Value`],
      visible: settings?.[`stat${n}Visible`] !== false,
      Icon: icons[n - 1],
      tone: n,
    }))
    .filter((item) => item.visible);
  if (!stats.length) return null;
  return (
    <section
      ref={sectionRef}
      className={`statistics-band ${entered ? "is-visible" : ""}`}
      aria-label="Academy achievements"
    >
      <div className="container section compact-section">
        <div className="statistics-heading">
          <div className="eyebrow">
            {settings?.statisticsSubtitle || "TRUSTED LEGAL LEARNING COMMUNITY"}
          </div>
          <h2>{settings?.statisticsTitle || "LexVeritas In Numbers"}</h2>
        </div>
        <div className="statistics-grid">
          {stats.map((item) => (
            <article
              className={`statistics-card stat-tone-${item.tone}`}
              key={item.label}
            >
              <strong aria-label={item.value}>
                <AnimatedStatValue value={item.value} active={entered} />
              </strong>
              <span className="statistics-icon" aria-hidden="true">
                <item.Icon size={20} />
              </span>
              <span>{item.label}</span>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function VerifiedReviews({ settings, initialData }: any = {}) {
  const { data, error } = useData("reviews", initialData);
  const rail = useRef<HTMLDivElement>(null);
  const paused = useRef(false);
  const [formOpen, setFormOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [formError, setFormError] = useState("");
  const [rating, setRating] = useState(5);
  const submitReview = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSending(true);
    setFormError("");
    const form = event.currentTarget;
      const values = new FormData(form);
    try {
      const photo = values.get("reviewer_photo");
      let reviewerPhoto: string | null = null;
      if (photo instanceof File && photo.size) {
        const upload = new FormData();
        upload.append("file", photo);
        const response = await fetch("/api/reviews/photo", { method: "POST", headers: { "X-LVA-Request": "1" }, body: upload });
        const result: any = await response.json();
        if (!response.ok) throw Error(result.error || "Could not upload photo.");
        reviewerPhoto = result.id;
      }
      await api("reviews", {
        reviewer_name: values.get("reviewer_name"),
        university: values.get("university"),
        rating,
        review_text: values.get("review_text"),
        reviewer_photo: reviewerPhoto,
        website: values.get("website"),
      });
      form.reset();
      setSent(true);
    } catch (issue: any) {
      setFormError(issue.message || "Could not submit your review. Please try again.");
    } finally {
      setSending(false);
    }
  };
  const rows = data?.slice(0, Math.max(1, settings?.reviewsHomeCount || 6));
  const moving = (rows?.length || 0) > 3;
  useEffect(() => {
    const node = rail.current;
    if (
      !node ||
      !moving ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    let frame = 0;
    let previous = 0;
    let visible = false;
    let running = false;
    const step = (now: number) => {
      if (!visible || document.hidden) { running = false; return; }
      if (!paused.current) {
        node.scrollLeft += Math.min(1.15, ((now - previous) / 1000) * 29);
        const halfway = node.scrollWidth / 2;
        if (node.scrollLeft >= halfway) node.scrollLeft -= halfway;
      }
      previous = now;
      frame = requestAnimationFrame(step);
    };
    const start = () => {
      if (visible && !document.hidden && !running) {
        previous = performance.now();
        running = true;
        frame = requestAnimationFrame(step);
      }
    };
    const stop = () => { cancelAnimationFrame(frame); running = false; };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) start(); else stop();
    }, { rootMargin: "120px" });
    const onVisibility = () => { if (document.hidden) stop(); else start(); };
    observer.observe(node);
    document.addEventListener("visibilitychange", onVisibility);
    return () => { observer.disconnect(); document.removeEventListener("visibilitychange", onVisibility); stop(); };
  }, [moving, data?.length]);
  if (settings?.reviewsVisible === false) return null;
  return (
    <section className="reviews-band">
      <div className="container section">
        <div className="section-head">
          <div>
            <h2>{settings?.reviewsTitle || "Verified Reviews"}</h2>
          </div>
          <button className="btn review-write-button review-write-desktop" type="button" onClick={() => { setSent(false); setFormError(""); setFormOpen(true); }}>
            <Star size={17} /> Share Your Opinion
          </button>
        </div>
        <ErrorBox error={error} />
        {!data && !error ? (
          <Loading />
        ) : rows?.length ? (
          <div
            ref={rail}
            className={`review-carousel ${moving ? "is-moving" : ""}`}
            aria-label="Verified reviews. Swipe or drag in either direction."
            onPointerDown={() => (paused.current = true)}
            onPointerUp={() => (paused.current = false)}
            onPointerCancel={() => (paused.current = false)}
            onMouseEnter={() => (paused.current = true)}
            onMouseLeave={() => (paused.current = false)}
            onFocus={() => (paused.current = true)}
            onBlur={() => (paused.current = false)}
          >
            <div className="review-carousel-track">
              {rows.map((r: any) => <ReviewCard review={r} key={r.id} />)}
              {moving &&
                rows.map((r: any) => <ReviewCard review={r} key={`copy-${r.id}`} clone />)}
            </div>
          </div>
        ) : (
          <div className="announcement review-empty">
            <BadgeCheck size={30} />
            <div>
              <h3>Verified Reviews Will Appear Here</h3>
              <p>
                Only reviews approved and published by the Academy are shown.
              </p>
            </div>
          </div>
        )}
        <button className="btn review-write-button review-write-mobile" type="button" onClick={() => { setSent(false); setFormError(""); setFormOpen(true); }}>
          <Star size={17} /> Share Your Opinion
        </button>
      </div>
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="review-submit-dialog">
          <DialogHeader><DialogTitle>Share Your Opinion</DialogTitle></DialogHeader>
          {sent ? (
            <div className="review-submit-success" role="status">
              <CheckCircle2 size={34} />
              <h3>Thank you for your review.</h3>
              <p>It will appear on the website after admin approval.</p>
              <button type="button" className="btn" onClick={() => setFormOpen(false)}>Close</button>
            </div>
          ) : (
            <form className="review-submit-form" onSubmit={submitReview}>
              <label>Your name<input name="reviewer_name" required minLength={2} maxLength={100} autoComplete="name" /></label>
              <label>University name<input name="university" required minLength={2} maxLength={150} /></label>
              <fieldset className="review-rating-input">
                <legend>Rating</legend>
                <div>{[1,2,3,4,5].map((n) => (
                  <button type="button" key={n} onClick={() => setRating(n)} aria-label={`${n} out of 5 stars`} aria-pressed={rating === n}>
                    <Star size={28} fill={n <= rating ? "currentColor" : "none"} />
                  </button>
                ))}</div>
              </fieldset>
              <label>Your review<textarea name="review_text" rows={5} required minLength={10} maxLength={2000} placeholder="Tell us about your experience with LexVeritas Academy" /></label>
              <label>Photo (optional)<input name="reviewer_photo" type="file" accept="image/png,image/jpeg,image/webp" /></label>
              <div className="review-trap" aria-hidden="true"><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
              <p className="review-submit-note">Reviews are published after admin approval. Photo limit: 2 MB.</p>
              {formError && <p className="error" role="alert">{formError}</p>}
              <button type="submit" className="btn" disabled={sending}>{sending ? "Submitting…" : "Submit Review"}</button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}

function ReviewCard({ review: r, clone = false }: any) {
  return (
    <article className="testimonial-card" aria-hidden={clone || undefined}>
      <div className="testimonial-rating" aria-label={`${r.rating || 5} out of 5 stars`}>
        {Array.from({ length: 5 }).map((_, index) => (
          <Star key={index} size={17} fill={index < (r.rating || 5) ? "currentColor" : "none"} aria-hidden="true" />
        ))}
      </div>
      <Quote className="testimonial-quote" size={28} aria-hidden="true" />
      <blockquote>“{r.review_text}”</blockquote>
      <div className="testimonial-person">
        <div className="reviewer-photo">
          {r.reviewer_photo ? (
            <img loading="lazy" decoding="async" src={asset(r.reviewer_photo)} alt={clone ? "" : `${r.reviewer_name} profile`} />
          ) : (
            <UserRound size={27} aria-hidden="true" />
          )}
        </div>
        <div>
          <strong className="reviewer-name">{r.reviewer_name} <BadgeCheck size={16} aria-label="Verified reviewer" /></strong>
          <span>{r.university || "BJS Candidate"}</span>
        </div>
      </div>
    </article>
  );
}

export function NoticeSection({ settings, initialData }: any = {}) {
  const { data, error } = useData("notices?summary=1", initialData);
  if (settings && settings.noticeVisible === false) return null;
  if (error)
    return (
      <section className="container section">
        <ErrorBox error={error} />
      </section>
    );
  return (
    <section className="notice-band">
      <div className="container section compact-section">
        <div className="section-head">
          <div>
            <div className="eyebrow">
              {settings?.noticeSubtitle || "ACADEMY UPDATES"}
            </div>
            <h2>
              <a className="heading-link" href="/notices">
                {settings?.noticeTitle || "Notice"}
              </a>
            </h2>
          </div>
          <div className="notice-head-actions">
            <a className="text-link" href="/notices">
              See All Notices <ArrowRight size={16} />
            </a>
          </div>
        </div>
        <div
          className="notice-home-list"
          role="feed"
          aria-label="Academy notices"
          tabIndex={data?.length ? 0 : undefined}
        >
          {data?.slice(0, 3).map((n: any, index: number) => (
            <article
              className="notice-home-row"
              key={n.id}
              style={{ animationDelay: `${index * 80}ms` }}
            >
              <a
                href={`/notices/${n.id}`}
                aria-label={`Read notice: ${n.title}`}
              >
                <NoticeDate value={n.notice_date} />
                <div className="notice-home-copy">
                  <div className="notice-home-meta">
                    <span className="notice-home-badge">
                      {index === 0 ? "Latest" : "Notice"}
                    </span>
                    {n.attachment && (
                      <span className="notice-home-file">
                        <FileText size={13} aria-hidden="true" /> Attachment
                      </span>
                    )}
                  </div>
                  <h3>{n.title}</h3>
                  <p>{n.content}</p>
                </div>
                <span className="notice-home-action" aria-hidden="true">
                  Read Notice <ArrowRight size={16} />
                </span>
              </a>
            </article>
          ))}
          {!data?.length && (
            <div className="notice-empty-card">
              <div>
                <h3>No Published Notices</h3>
                <p>New Academy notices will appear here.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function NoticeDate({ value }: { value: number | string }) {
  const timestamp = Number(value);
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Dhaka",
  }).formatToParts(timestamp);
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value || "";

  return (
    <time
      className="notice-date-block"
      dateTime={new Date(timestamp).toISOString()}
      aria-label={date(timestamp)}
    >
      <strong>{pick("day")}</strong>
      <span>{pick("month")}</span>
      <small>{pick("year")}</small>
    </time>
  );
}

export function NoticesPage() {
  const { data, error } = useData("notices");
  return (
    <div className="container section notice-page">
      <div className="page-heading">
        <div className="eyebrow">ACADEMY UPDATES</div>
        <h1>All Notices</h1>
        <p>Official announcements and updates from LexVeritas Academy.</p>
      </div>
      <ErrorBox error={error} />
      {!data && !error ? (
        <Loading />
      ) : data?.length ? (
        <div className="notice-list">
          {data.map((notice: any, index: number) => (
            <article
              className="notice-list-card"
              key={notice.id}
              style={{ animationDelay: `${Math.min(index, 8) * 70}ms` }}
            >
              <NoticeDate value={notice.notice_date} />
              <div>
                <h2>
                  <a href={`/notices/${notice.id}`}>{notice.title}</a>
                </h2>
                <p>{notice.content}</p>
                <a className="text-link" href={`/notices/${notice.id}`}>
                  Read Full Notice <ArrowRight size={16} />
                </a>
              </div>
              {notice.attachment && (
                <span className="notice-attachment-chip">
                  <FileText size={15} /> Attachment
                </span>
              )}
            </article>
          ))}
        </div>
      ) : (
        <div className="announcement">
          <ScrollText size={30} />
          <div>
            <h3>No Published Notices</h3>
            <p>New Academy notices will appear here.</p>
          </div>
        </div>
      )}
    </div>
  );
}

export function NoticeDetail({ id }: { id: string }) {
  const { data, error } = useData(`notices/${encodeURIComponent(id)}`);
  if (error)
    return (
      <div className="container section">
        <a className="back-link" href="/notices">
          All Notices
        </a>
        <ErrorBox error={error} />
      </div>
    );
  if (!data) return <Loading />;
  const isImage = String(data.attachment_mime || "").startsWith("image/");
  return (
    <article className="container section notice-detail">
      <a className="back-link" href="/notices">
        All Notices
      </a>
      <header className="notice-detail-header">
        <div className="eyebrow">OFFICIAL NOTICE</div>
        <h1>{data.title}</h1>
        <time>{date(data.notice_date)}</time>
      </header>
      <div className="notice-detail-content pre-wrap">{data.content}</div>
      {data.attachment && (
        <section className="notice-attachment" aria-label="Notice attachment">
          <div className="notice-attachment-head">
            <span className="eyebrow">ATTACHMENT</span>
            <a
              className="btn outline"
              href={`/api/notices/${data.id}/download`}
            >
              {isImage ? "Download Image" : "Download PDF"} <Download size={17} />
            </a>
          </div>
          {isImage ? (
            <img
              className="notice-image-preview"
              src={`/api/files/${data.attachment}`}
              alt={`${data.title} attachment`}
            />
          ) : (
            <PdfDocumentViewer
              src={`/api/files/${data.attachment}`}
              title={`${data.title} attachment`}
            />
          )}
        </section>
      )}
    </article>
  );
}

export function CourseCarousel({ settings, initialData }: any = {}) {
  const { data, error } = useData("courses", initialData);
  if (settings && settings.courseVisible === false) return null;
  return (
    <section className="container section">
      <div className="section-head">
        <div>
          <div className="eyebrow">PRACTICE WITH PURPOSE</div>
          <h2>Our Courses</h2>
          <p>
            {settings?.courseSubtitle ||
              "Choose a structured course for your next stage of legal preparation."}
          </p>
        </div>
        <a className="text-link" href="/courses">
          {settings?.viewAllText || "View All"} Courses <ArrowRight size={17} />
        </a>
      </div>
      <ErrorBox error={error} />
      {!data && !error ? (
        <Loading />
      ) : data?.length ? (
        <>
          <div className="course-section-label">Complete Package</div>
          <div className="course-carousel" aria-label="Complete course packages">
            {data.map((c: any) => (
              <CourseCard key={c.id} course={c} settings={settings} />
            ))}
          </div>
        </>
      ) : (
        <div className="announcement">
          <GraduationCap size={32} />
          <div>
            <h3>New Courses Will Be Announced Here</h3>
            <p>Published courses will appear automatically.</p>
          </div>
        </div>
      )}
    </section>
  );
}

function CourseCard({ course: c, settings }: { course: any; settings?: any }) {
  return (
    <article className="course-card">
      <div className="course-thumb">
        {c.thumbnail ? (
          <img
            loading="lazy"
            decoding="async"
            src={asset(c.thumbnail)}
            alt={`${c.name} thumbnail`}
          />
        ) : (
          <GraduationCap size={48} />
        )}
      </div>
      <div className="course-body">
        <h3>{c.name}</h3>
        <p>{c.description}</p>
        <div className="course-stats">
          <span>
            <Users /> {c.class_count} Video Classes
          </span>
          <span>
            <ClipboardCheck /> {c.exam_count} Exams
          </span>
          <span>
            <ScrollText /> {c.sheet_count} Notes / Sheets
          </span>
        </div>
        <strong className="course-price">{money(c.price)}</strong>
        <div className="course-actions">
          <a className="btn" href={`/courses/${c.id}#enroll`}>
            {settings?.enrollText || "ভর্তি হোন"}
          </a>
          <a className="btn outline" href={`/courses/${c.id}`}>
            {settings?.detailsText || "বিস্তারিত"}
          </a>
        </div>
        <ShareActions title={c.name} href={`/courses/${c.id}`} compact />
      </div>
    </article>
  );
}

export function CoursesPage({ category = "" }: { category?: string }) {
  const { data, error } = useData("courses");
  const { data: packages, error: packageError } = useData("packages");
  const filteredCourses = (data || []).filter((item: any) => matchesPreparationCategory(item, category));
  return (
    <div className="container section">
      <div className="page-heading">
        <div className="eyebrow">LEXVERITAS ACADEMY</div>
        <h1>{category ? category.replaceAll("-", " ").replace(/\b\w/g, c => c.toUpperCase()) + " Courses" : "Courses"}</h1>
        <p>
          Professional preparation courses for BJS, Bar Council, Law Officer
          and academic legal education.
        </p>
      </div>
      <div className="course-page-jump" aria-label="Course sections">
        <a href="#complete-package">Complete Package</a>
        <a href="#exam-package">Exam Package</a>
      </div>
      <section id="complete-package" className="course-page-section">
        <div className="section-head">
          <div>
            <div className="eyebrow">COMPLETE LEARNING PROGRAM</div>
            <h2>Complete Package</h2>
          </div>
        </div>
        <ErrorBox error={error} />
        {!data && !error ? (
          <Loading />
        ) : (
          <div className="grid three">
            {filteredCourses.map((c: any) => (
              <CourseCard key={c.id} course={c} />
            ))}
            {data && !filteredCourses.length && <p>No published courses in this category yet.</p>}
          </div>
        )}
      </section>
      <section id="exam-package" className="course-page-section">
        <div className="section-head">
          <div>
            <div className="eyebrow">STRUCTURED EXAM SERIES</div>
            <h2>Exam Package</h2>
          </div>
        </div>
        <ErrorBox error={packageError} />
        {!packages && !packageError ? (
          <Loading />
        ) : (
          <div className="grid three">
            {packages?.filter((p:any) => matchesPreparationCategory(p, category)).map((p: any) => (
              <PackageCard key={p.id} pack={p} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export function CourseDetail({ id }: { id: string }) {
  const { data: c, error } = useData(`courses/${id}`),
    { data: settings } = useData("settings");
  const [form, setForm] = useState({ name: "", phone: "", email: "", trx: "" }),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [paymentMethod, setPaymentMethod] = useState("bkash"),[couponCode,setCouponCode]=useState(""),[coupon,setCoupon]=useState<any>(null),[accessCode,setAccessCode]=useState(""),[accessError,setAccessError]=useState("");
  if (error)
    return (
      <div className="container section">
        <ErrorBox error={error} />
      </div>
    );
  if (!c) return <Loading />;
  const isFree = c.pricing_type === "free" || Number(c.price) === 0;
  return (
    <div className="container section">
      <a className="back-link" href="/courses">
        All Courses
      </a>
      <div className="course-detail">
        <section>
          {c.thumbnail && (
            <img
              className="course-hero-image"
              src={asset(c.thumbnail)}
              alt={`${c.name} thumbnail`}
            />
          )}
          <div className="eyebrow">COURSE DETAILS</div>
          <h1>{c.name}</h1>
          <ShareActions title={c.name} href={`/courses/${c.id}`} />
          <p className="lead">{c.description}</p>
          <div className="course-detail-actions">
            <a className="btn" href={`/courses/${c.id}/learn`}>
              <CirclePlay size={17} /> Start Learning / Continue Course
            </a>
          </div>
          <div className="detail-grid">
            <div>
              <span>Video Classes</span>
              <b>{c.class_count}</b>
            </div>
            <div>
              <span>Exams</span>
              <b>{c.exam_count}</b>
            </div>
            <div>
              <span>Notes / Sheets</span>
              <b>{c.sheet_count}</b>
            </div>
          </div>
          {c.details && (
            <div className="course-inclusions">
              <h2>What This Course Includes</h2>
              <ul>
                {c.details
                  .split(/\r?\n/)
                  .map((item: string) => item.trim())
                  .filter(Boolean)
                  .map((item: string, index: number) => (
                    <li key={`${item}-${index}`}>
                      <CheckCircle2 size={17} />
                      <span>{item}</span>
                    </li>
                  ))}
              </ul>
            </div>
          )}
        </section>
        <aside className="card checkout-panel" id="enroll">
          <div className="package-existing-access">
            <h2>Already enrolled?</h2>
            <p>Enter your unique code to open the course on this device.</p>
            <form onSubmit={async event=>{event.preventDefault();setAccessError("");try{await api(`course-learning/${id}/access`,{code:accessCode});window.location.href=`/courses/${id}/learn`}catch(issue:any){setAccessError(issue.message)}}}>
              <Field label="Course access code" required value={accessCode} onChange={(event:any)=>setAccessCode(event.target.value.toUpperCase())} placeholder="LVA-XXXX-XXXX-XXXX" />
              <button type="submit" className="btn">Open My Course</button>
            </form>
            {accessError && <ErrorBox error={accessError} />}
          </div>
          <h2>Course Enrollment</h2>
          <div className="summary-line">
            <span>Course Fee</span>
            <strong>{isFree ? "Free" : money(c.price)}</strong>
          </div>
          {!isFree && <PaymentMethodPicker
            settings={settings}
            value={paymentMethod}
            onChange={setPaymentMethod}
            amount={money(c.price)}
          />}
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setMessage("");
              try {
                const o = await api("orders", {
                  type: "course",
                  courseId: id,
                  ...form,
                  email: form.email || undefined,
                  trx: isFree ? "FREE" : form.trx,
                  paymentMethod: isFree ? "other" : paymentMethod,
                  couponCode: coupon?.code || undefined,
                });
                window.location.href = `/orders/${o.id}`;
              } catch (x: any) {
                setMessage(x.message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <Field
              label="Name"
              required
              value={form.name}
              onChange={(e: any) => setForm({ ...form, name: e.target.value })}
            />
            <Field
              label="Phone Number"
              required
              inputMode="tel"
              value={form.phone}
              onChange={(e: any) => setForm({ ...form, phone: e.target.value })}
            />
            <Field label="Email (optional)" type="email" value={form.email} onChange={(e:any)=>setForm({...form,email:e.target.value})}/>
            {!isFree && <><Field label="Coupon code"><div className="coupon-entry"><input value={couponCode} onChange={e=>{setCouponCode(e.target.value.toUpperCase());setCoupon(null)}}/><button type="button" className="btn secondary" onClick={async()=>{try{setCoupon(await api("coupons/validate",{code:couponCode,amount:c.price,orderType:"course",productIds:[c.id]}))}catch(x:any){setMessage(x.message)}}}>Apply</button></div></Field>
            {coupon&&<p className="notice success">Coupon applied: −{money(coupon.discount)}</p>}
            <Field
              label="TrxID"
              required
              value={form.trx}
              onChange={(e: any) => setForm({ ...form, trx: e.target.value })}
            /></>}
            <ErrorBox error={message} />
            <button className="btn full" disabled={busy || !c.active}>
              {busy
                ? "Submitting…"
                : c.active
                  ? isFree ? "Enroll Free" : "ভর্তি হোন"
                  : "Enrollment Closed"}
            </button>
          </form>
        </aside>
      </div>
    </div>
  );
}

export function TeamSection({ settings, initialData }: any = {}) {
  const { data, error } = useData("team", initialData);
  if (settings && settings.teamVisible === false) return null;
  if (error || !data?.length) return null;
  return (
    <section className="team-band">
      <div className="container section">
        <div className="section-head">
          <div>
            <div className="eyebrow">
              {settings?.teamSubtitle || "THE PEOPLE BEHIND THE ACADEMY"}
            </div>
            <h2>{settings?.teamTitle || "Our Team"}</h2>
          </div>
        </div>
        <div className="team-grid">
          {data.map((m: any) => (
            <article className="team-card" key={m.id}>
              <div className="team-photo">
                {m.photo ? (
                  <img
                    loading="lazy"
                    decoding="async"
                    src={asset(m.photo)}
                    alt={`${m.name}, ${m.role}`}
                  />
                ) : (
                  <Users size={52} />
                )}
              </div>
              <div>
                <span className="eyebrow">{m.role}</span>
                <h3>{m.name}</h3>
                <p className="pre-wrap">{m.details}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function HomeNotes({ settings, initialData }: any = {}) {
  const { data, error } = useData("notes", initialData);
  if (settings?.notesVisible === false) return null;
  const labels: Record<string, string> = {
    bjs: settings?.bjsNotesLabel || "BJS Notes",
    bar: settings?.barNotesLabel || "BAR Notes",
    general: settings?.generalNotesLabel || "General Subject Notes",
    academic: settings?.academicNotesLabel || "Academic Notes",
  };
  return (
    <section className="home-notes-band">
      <div className="container section">
        <div className="section-head">
          <div>
            <div className="eyebrow">STUDY MATERIALS</div>
            <h2>Free Notes &amp; Study Resources</h2>
            <p>Recent materials for BJS, Bar Council, Law Officer and academic preparation.</p>
          </div>
          <a className="text-link" href="/notes">
            Explore All Notes <ArrowRight size={16} />
          </a>
        </div>
        <ErrorBox error={error} />
        {!data && !error ? (
          <Loading />
        ) : data?.length ? (
          <div className="home-note-groups">
            {Object.entries(labels).map(([category, label]) => {
              const notes = data
                .filter((note: any) => parseTaxonomy(note.categories||note.category).includes(category))
                .slice(0, 1);
              return (
                <section className="home-note-group" key={category}>
                  <div className="home-note-group-head">
                    <h3>{label}</h3>
                    <a href={`/notes/${category}`}>
                      View all <ArrowRight size={14} />
                    </a>
                  </div>
                  <div className="home-note-list">
                    {notes.length ? (
                      notes.map((note: any) => (
                        <HomeNoteCard note={note} label={label} key={note.id} />
                      ))
                    ) : (
                      <p className="home-note-empty">
                        No published notes in this category yet.
                      </p>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        ) : (
          <div className="announcement">
            <FileText size={30} />
            <div>
              <h3>No Published Notes Yet</h3>
              <p>Notes will appear here after the Academy publishes them.</p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function HomeNoteCard({ note, label }: { note: any; label: string }) {
  const mime = String(note.file_mime || "");
  const type = mime.startsWith("image/")
    ? "Image"
    : note.file
      ? "PDF"
      : "Article";
  const metric =
    Number(note.page_count) > 0
      ? `${Number(note.page_count)} ${Number(note.page_count) === 1 ? "page" : "pages"}`
      : Number(note.reading_minutes) > 0
        ? `${Number(note.reading_minutes)} min read`
        : type === "PDF"
          ? "PDF resource"
          : type === "Image"
            ? "Image resource"
            : "Quick read";
  const cardBody = (
    <>
      <div className="home-note-card-top">
        <span className={`note-type note-type-${type.toLowerCase()}`}>
          {type}
        </span>
        <time>{date(note.created_at)}</time>
      </div>
      <h4>{note.title}</h4>
      <p className="home-note-subject">{parseTaxonomy(note.subject).join(", ") || label}</p>
      <div className="home-note-card-foot">
        <span>{metric}</span>
        <strong>
          Read Note <ArrowRight size={14} />
        </strong>
      </div>
    </>
  );
  return (
    <a className="home-note-card" href={`/notes/item/${note.id}`}>
      <NoteThumbnail note={note} className="home-note-thumb" />
      {cardBody}
    </a>
  );
}

function NoteThumbnail({note,className="note-thumb"}:{note:any;className?:string}) {
  const mime=String(note.file_mime||"");
  return <div className={className} aria-label={`${note.title} preview`}>
    {note.thumbnail ? <img loading="lazy" decoding="async" src={asset(note.thumbnail)} alt={`${note.title} preview`}/>
      : note.file && mime.startsWith("image/") ? <img loading="lazy" decoding="async" src={asset(note.file)} alt={`${note.title} preview`}/>
      : note.file && mime === "application/pdf" ? <div className="note-title-thumb"><FileText size={30}/><strong>{note.title}</strong></div>
      : <div className="note-title-thumb"><FileText size={30}/><strong>{note.title}</strong></div>}
  </div>;
}

const categoryNames: Record<string, string> = {
  bjs: "BJS Notes",
  bar: "BAR Notes",
  general: "General Subject Notes",
  academic: "Academic Notes",
};
const parseTaxonomy = (value:any): string[] => {
  if (Array.isArray(value)) return value;
  try { const parsed=JSON.parse(value||""); if(Array.isArray(parsed)) return parsed; } catch {}
  return value ? [String(value)] : [];
};
export function NotesPage({ category }: { category?: string }) {
  const valid = category || "",
    { data, error, reload } = useData(
      `notes${valid ? `/${encodeURIComponent(valid)}` : ""}`,
    ),
    { data: allNotes } = useData("notes"),
    { data: settings } = useData("settings");
  const labels: Record<string, string> = {
    bjs: settings?.bjsNotesLabel || categoryNames.bjs,
    bar: settings?.barNotesLabel || categoryNames.bar,
    general: settings?.generalNotesLabel || categoryNames.general,
    academic: settings?.academicNotesLabel || categoryNames.academic,
  };
  const categories = Array.from(
    new Set([
      ...Object.keys(labels),
      ...(allNotes || []).flatMap((note: any) => parseTaxonomy(note.categories||note.category)).filter(Boolean),
    ]),
  );
  useEffect(() => {
    if (!data?.length || !window.location.hash) return;
    const target = document.getElementById(window.location.hash.slice(1));
    target?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [data]);
  return (
    <div className="container section">
      <div className="page-heading">
        <div className="eyebrow">LEGAL STUDY MATERIALS</div>
        <h1>
          {valid ? labels[valid] || valid : settings?.notesMenuLabel || "Notes"}
        </h1>
        <p>Browse published study notes by category.</p>
      </div>
      <div className="note-categories">
        {categories.map((key: string) => (
          <a
            className={valid === key ? "active" : ""}
            href={`/notes/${encodeURIComponent(key)}`}
            key={key}
          >
            {labels[key] || key}
          </a>
        ))}
      </div>
      <ErrorBox error={error} />
      {!data && !error ? (
        <Loading />
      ) : data?.length ? (
        <div className="grid three">
          {data.map((n: any) => {
            const mime = String(n.file_mime || "");
            const type = mime.startsWith("image/")
              ? "Image"
              : n.file
                ? "PDF"
                : "Article";
            const metric = Number(n.page_count) > 0
              ? `${Number(n.page_count)} ${Number(n.page_count) === 1 ? "page" : "pages"}`
              : Number(n.reading_minutes) > 0
                ? `${Number(n.reading_minutes)} min read`
                : type === "PDF" ? "PDF resource" : type === "Image" ? "Image resource" : "Quick read";
            return (
            <article className="note-card" id={`note-${n.id}`} key={n.id}>
              <NoteThumbnail note={n} />
              <div className="note-body">
                <div className="note-card-meta-row">
                  <span className={`note-type note-type-${type.toLowerCase()}`}>{type}</span>
                  <time>{date(n.created_at)}</time>
                </div>
                <h2><a href={`/notes/item/${n.id}`}>{n.title}</a></h2>
                <p className="note-card-subject">
                  {parseTaxonomy(n.subjects||n.subject).join(", ") || parseTaxonomy(n.categories||n.category).map((x)=>labels[x]||x).join(", ") || "Study Note"} · {metric}
                </p>
                <p>{n.description}</p>
                <div className="note-download-row">
                  <a className="btn" href={`/notes/item/${n.id}`}>
                    Read Note <BookOpen size={16} />
                  </a>
                  <a
                    className="btn outline"
                    href={`/api/notes/${n.id}/download`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => window.setTimeout(reload, 800)}
                  >
                    Download Note <Download size={16} />
                  </a>
                  <span className="note-download-count">
                    <Download size={15} aria-hidden="true" />
                    {Number(n.download_count || 0).toLocaleString()} Downloads
                  </span>
                  <ShareActions title={n.title} href={`/notes/item/${n.id}`} compact />
                </div>
              </div>
            </article>
            );
          })}
        </div>
      ) : (
        <div className="announcement">
          <FileText size={30} />
          <div>
            <h3>No Published Notes Yet</h3>
            <p>Notes will appear here after the Academy publishes them.</p>
          </div>
        </div>
      )}
    </div>
  );
}

export function NoteDetail({ id }: { id: string }) {
  const { data: note, error } = useData(`notes/${id}/view`);
  if (error) return <div className="container section"><ErrorBox error={error} /></div>;
  if (!note) return <Loading />;
  const mime = String(note.file_mime || "");
  return (
    <article className="container section note-detail-page">
      <a className="back-link" href="/notes">All Notes</a>
      <div className="page-heading">
        <div className="eyebrow">{parseTaxonomy(note.categories||note.category).map((x)=>categoryNames[x]||x).join(" · ") || "STUDY NOTE"}</div>
        <h1>{note.title}</h1>
        <p>{parseTaxonomy(note.subject).join(", ") || "LexVeritas Academy Study Resource"}</p>
      </div>
      <div className="note-detail-actions">
        <ShareActions title={note.title} href={`/notes/item/${note.id}`} />
        {(note.file || note.link) && <a className="btn outline" href={`/api/notes/${note.id}/download`} target="_blank" rel="noopener noreferrer"><Download size={16}/> Download Note</a>}
      </div>
      {note.description && <p className="lead pre-wrap">{note.description}</p>}
      {note.file && mime === "application/pdf" ? (
        <PdfDocumentViewer src={`/api/files/${note.file}`} title={note.title} />
      ) : note.file && mime.startsWith("image/") ? (
        <img className="note-detail-image" src={`/api/files/${note.file}`} alt={note.title} />
      ) : note.link ? (
        <a className="btn" href={note.link} target="_blank" rel="noopener noreferrer">Open Note <ArrowRight size={16}/></a>
      ) : null}
    </article>
  );
}
