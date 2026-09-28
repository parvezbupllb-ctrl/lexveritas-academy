"use client";

import { useEffect, useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  PackageCheck,
  Download, UserRound, Camera, LogOut, BookOpen, Clock3, Trophy,
} from "lucide-react";
import {
  ActionButton,
  ErrorBox,
  Field,
  Loading,
  api,
  date,
  money,
  useData,
} from "@/lib/client";
import { PaymentMethodPicker } from "./payment-method";
import { ShareActions } from "@/components/share-actions";
import { matchesPreparationCategory } from "@/lib/academy-navigation";

export function Packages({ category = "" }: { category?: string }) {
  const { data, error } = useData("packages");
  const filtered = (data || []).filter((p: any) => matchesPreparationCategory(p, category));
  return (
    <div className="container section">
      <div className="page-heading">
        <div className="eyebrow">EXAM PACKAGE STORE</div>
        <h1>{category ? category.replaceAll("-", " ").replace(/\b\w/g, c => c.toUpperCase()) + " Exam Batches" : "Prepare with a complete exam series."}</h1>
        <p>Choose an open exam series or use an assigned code for a restricted package.</p>
      </div>
      <ErrorBox error={error} />
      {!data && !error ? (
        <Loading />
      ) : (
        <div className="grid three">
          {filtered.map((p: any) => (
            <PackageCard key={p.id} pack={p} />
          ))}
          {data && !filtered.length && <p>No published exam batches in this category yet.</p>}
        </div>
      )}
    </div>
  );
}

export function PackageCard({ pack: p }: any) {
  return (
    <article className="card package-card">
      {p.thumbnail ? (
        <img
          loading="lazy"
          decoding="async"
          className="package-thumbnail"
          src={`/api/files/${p.thumbnail}`}
          alt={`${p.title} thumbnail`}
        />
      ) : (
        <PackageCheck size={28} />
      )}
      <span className="badge">{p.exam_count} Exams</span>
      <h2>{p.title}</h2>
      <p>{p.description || "A structured MCQ examination package."}</p>
      <ul className="package-feature-list">
        <li>{p.total_mcqs} MCQs</li>
        {p.detailed_explanations ? <li>Detailed Explanations</li> : null}
        {p.leaderboard ? <li>Leaderboard</li> : null}
        <li>Validity: {p.access_days} Days</li>
      </ul>
      <div className="package-price">
        {p.old_price > p.price && <del>{money(p.old_price)}</del>}
        <strong>{money(p.price)}</strong>
      </div>
      <div className="package-card-actions">
        <a className="btn outline" href={`/packages/${p.id}`}>
          View Package
        </a>
        <a className="btn" href={`/packages/${p.id}${p.access_mode==="open"?"":"#buy-package"}`}>
          {p.access_mode==="open"?"Open Package":"Get Access"} <ArrowRight size={16} />
        </a>
      </div>
      <ShareActions title={p.title} href={`/packages/${p.id}`} compact />
    </article>
  );
}

export function PackageDetail({ id }: { id: string }) {
  const { data: p, error } = useData(`packages/${id}`);
  const { data: settings } = useData("settings");
  const [form, setForm] = useState({ name: "", phone: "", email: "", trx: "" });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("bkash");
  const [couponCode,setCouponCode]=useState(""),[coupon,setCoupon]=useState<any>(null);
  const [accessCode,setAccessCode]=useState(""),[dashboard,setDashboard]=useState<any>(null),[accessError,setAccessError]=useState(""),[sessionLoading,setSessionLoading]=useState(true);
  const loadDashboard = () => api(`packages/${id}/dashboard`).then(setDashboard).catch(()=>setDashboard(null));
  useEffect(() => { setSessionLoading(true);api(`packages/${id}/dashboard`).then(setDashboard).catch(()=>setDashboard(null)).finally(()=>setSessionLoading(false)); }, [id]);
  if (error)
    return (
      <div className="container section">
        <ErrorBox error={error} />
      </div>
    );
  if (!p) return <Loading />;
  return (
    <div className="container section">
      <a className="back-link" href="/packages">
        All exam packages
      </a>
      <div className="page-heading">
        <div className="eyebrow">{p.exam_count} EXAMINATION PACKAGE</div>
        <h1>{p.title}</h1>
        <p>{p.description}</p>
        <ShareActions title={p.title} href={`/packages/${p.id}`} />
      </div>
      {sessionLoading && p.access_mode!=="open" ? <Loading/> : <div className={dashboard ? "package-detail-learner" : "split"}>
        <section>
          {dashboard && <PackageLearningDashboard packId={id} dashboard={dashboard} onRefresh={loadDashboard} onLogout={()=>setDashboard(null)} />}
          {!dashboard && <><h2>Included examinations</h2>
          <div className="package-exams">
            {p.exams.map((e: any, i: number) => (
              <div className="card" key={e.id}>
                <a
                  className="table-title"
                  href={`/exams/${e.id}?package=${p.id}`}
                >
                  <b>
                    {String(i + 1).padStart(2, "0")}. {e.title}
                  </b>
                </a>
                <span>
                  <CalendarDays size={16} />
                  {date(e.start)} BST
                </span>
                <small>
                  {e.question_count} Questions · Duration: {e.duration} minutes
                  · Closes {date(e.end)} BST
                </small>
                {(e.syllabus || e.description) && (
                  <p className="package-syllabus">
                    <strong>Syllabus / Topics:</strong>{" "}
                    {e.syllabus || e.description}
                  </p>
                )}
                <span
                  className={`badge ${Date.now() >= e.start && Date.now() < e.end && e.status === "published" ? "live" : Date.now() < e.start ? "upcoming" : ""}`}
                >
                  {Date.now() < e.start
                    ? "Upcoming"
                    : Date.now() < e.end && e.status === "published"
                      ? "Live"
                      : "Completed"}
                </span>
              </div>
            ))}
          </div>
          {!!p.routines?.length && (
            <>
              <div className="section-head package-routine-head"><div><span className="eyebrow">PLAN YOUR PRACTICE</span><h2>Exam Routine</h2><p>Know exactly when each exam opens and closes.</p></div></div>
              <div className="package-routine-table-wrap"><table className="package-routine-table"><thead><tr><th>Exam</th><th>Opens</th><th>Closes</th><th>Status</th></tr></thead><tbody>{p.routines.map((r:any)=><tr key={r.id}><td data-label="Exam"><b>{r.exam_title}</b></td><td data-label="Opens">{date(r.start)} BST</td><td data-label="Closes">{date(r.end)} BST</td><td data-label="Status"><span className={`badge ${Date.now()>=r.start&&Date.now()<r.end?"live":Date.now()<r.start?"upcoming":""}`}>{Date.now()<r.start?"Upcoming":Date.now()<r.end?"Live":"Ended"}</span></td></tr>)}</tbody></table></div>
            </>
          )}
          {p.details && <div className="notice pre-wrap">{p.details}</div>}</>}
        </section>
        {p.access_mode!=="open"&&!dashboard&&<aside className="card checkout-panel" id="buy-package">
          <div className="package-existing-access">
            <h2>Already purchased?</h2>
            <p>Enter your unique code to open all exams and see your performance.</p>
            <form onSubmit={async event=>{event.preventDefault();setAccessError("");try{await api(`packages/${id}/access`,{code:accessCode});await loadDashboard();setAccessCode("")}catch(issue:any){setAccessError(issue.message)}}}>
              <Field label="Unique code" required value={accessCode} onChange={(event:any)=>setAccessCode(event.target.value.toUpperCase())} placeholder="LVA-XXXX-XXXX-XXXX" />
              <button className="btn" type="submit">Open My Exam Batch</button>
            </form>
            {accessError && <ErrorBox error={accessError} />}
          </div>
          <h2>Buy this package</h2>
          <div className="summary-line">
            <span>Amount to pay</span>
            <strong>{money(p.price)}</strong>
          </div>
          <PaymentMethodPicker
            settings={settings}
            value={paymentMethod}
            onChange={setPaymentMethod}
            amount={money(p.price)}
          />
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setMessage("");
              try {
                const o = await api("orders", {
                  type: "package",
                  packageId: id,
                  ...form,
                  email: form.email || undefined,
                  paymentMethod,
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
            <Field label="Coupon code"><div className="coupon-entry"><input value={couponCode} onChange={e=>{setCouponCode(e.target.value.toUpperCase());setCoupon(null)}}/><button type="button" className="btn secondary" onClick={async()=>{try{setCoupon(await api("coupons/validate",{code:couponCode,amount:p.price,orderType:"package",productIds:[p.id]}))}catch(x:any){setMessage(x.message)}}}>Apply</button></div></Field>
            {coupon&&<p className="notice success">Coupon applied: −{money(coupon.discount)}</p>}
            <Field
              label="TrxID"
              required
              value={form.trx}
              onChange={(e: any) => setForm({ ...form, trx: e.target.value })}
            />
            <ErrorBox error={message} />
            <button className="btn full" disabled={busy || !p.available}>
              {busy
                ? "Submitting…"
                : p.available
                  ? "Submit Package Order"
                  : "Currently unavailable"}
            </button>
          </form>
        </aside>}
      </div>}
    </div>
  );
}

function PackageLearningDashboard({ packId, dashboard, onRefresh, onLogout }: { packId:string; dashboard:any; onRefresh:()=>Promise<any>; onLogout:()=>void }) {
  const [showReview,setShowReview]=useState(false),[editing,setEditing]=useState(false),[profile,setProfile]=useState(dashboard.profile),[error,setError]=useState(""),[saving,setSaving]=useState(false),[photoBusy,setPhotoBusy]=useState(false);
  useEffect(()=>setProfile(dashboard.profile),[dashboard.profile]);
  const attempted=dashboard.exams.filter((exam:any)=>exam.result);
  const correct=attempted.reduce((total:number,exam:any)=>total+exam.result.correct,0);
  const wrong=attempted.reduce((total:number,exam:any)=>total+exam.result.wrong,0);
  const unanswered=attempted.reduce((total:number,exam:any)=>total+exam.result.unanswered,0);
  const downloadRoutine=async()=>{try{const {packageRoutinePdf}=await import("@/lib/package-pdf");await packageRoutinePdf(dashboard)}catch(e:any){setError(e.message)}};
  return <section className="package-dashboard">
    <div className="package-learner-hero"><div className="package-avatar">{profile.photo?<img src={`/api/packages/${packId}/photo?v=${profile.photo}`} alt="Your profile"/>:<UserRound size={34}/>}</div><div><span className="eyebrow">MY EXAM BATCH · {dashboard.packageTitle}</span><h2>Welcome, {profile.name}</h2><p>{profile.university||"Your exam preparation space"}</p></div><div className="package-learner-actions"><button type="button" className="btn secondary" onClick={()=>setEditing(!editing)}>Edit profile</button><button type="button" className="btn outline" onClick={async()=>{await api(`packages/${packId}/logout`,{});onLogout()}}><LogOut size={15}/> Log out</button></div></div>
    {error&&<ErrorBox error={error}/>}
    {editing&&<form className="card package-profile-form" onSubmit={async e=>{e.preventDefault();setSaving(true);setError("");try{await api(`packages/${packId}/profile`,profile,"PATCH");await onRefresh();setEditing(false)}catch(issue:any){setError(issue.message)}finally{setSaving(false)}}}><h3>Edit your profile</h3><div className="grid three"><Field label="Full name" required value={profile.name} onChange={(e:any)=>setProfile({...profile,name:e.target.value})}/><Field label="University" value={profile.university||""} onChange={(e:any)=>setProfile({...profile,university:e.target.value})}/><Field label="Phone" inputMode="tel" value={profile.phone||""} onChange={(e:any)=>setProfile({...profile,phone:e.target.value})}/></div><label className="package-photo-upload"><Camera size={17}/> {photoBusy?"Uploading…":"Upload profile picture (optional)"}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={photoBusy} onChange={async e=>{const file=e.target.files?.[0];if(!file)return;setPhotoBusy(true);setError("");try{const body=new FormData();body.append("file",file);const response=await fetch(`/api/packages/${packId}/photo`,{method:"POST",headers:{"X-LVA-Request":"1"},body});const result:any=await response.json();if(!response.ok)throw Error(result.error||"Upload failed");setProfile((p:any)=>({...p,photo:result.id}))}catch(issue:any){setError(issue.message)}finally{setPhotoBusy(false)}}}/></label><div className="package-learner-actions"><button className="btn" disabled={saving}>{saving?"Saving…":"Save profile"}</button><button type="button" className="btn outline" onClick={()=>setEditing(false)}>Cancel</button></div></form>}
    <div className="package-performance-grid"><span><strong>{attempted.length}/{dashboard.exams.length}</strong>Results available</span><span><strong>{correct}</strong>Correct</span><span><strong>{wrong}</strong>Wrong</span><span><strong>{unanswered}</strong>Skipped</span></div>
    <div className="section-head package-routine-head"><div><span className="eyebrow">YOUR SCHEDULE</span><h3>Exam routine</h3><p>See when each exam opens and closes.</p></div><button className="btn secondary" type="button" onClick={downloadRoutine}><Download size={16}/> Download routine PDF</button></div>
    <div className="package-routine-table-wrap"><table className="package-routine-table"><thead><tr><th>Exam</th><th>Opens</th><th>Closes</th><th>Status</th></tr></thead><tbody>{dashboard.routines.map((r:any,i:number)=><tr key={`${r.exam_id}-${i}`}><td data-label="Exam"><b>{r.exam_title}</b></td><td data-label="Opens">{date(r.start)} BST</td><td data-label="Closes">{date(r.end)} BST</td><td data-label="Status"><span className={`badge ${Date.now()>=r.start&&Date.now()<r.end?"live":Date.now()<r.start?"upcoming":""}`}>{Date.now()<r.start?"Upcoming":Date.now()<r.end?"Live":"Ended"}</span></td></tr>)}</tbody></table></div>
    <h3>My exams and performance</h3><div className="package-learner-exams">{dashboard.exams.map((exam:any)=><article className="package-dashboard-exam" key={exam.id}>
      <div className="package-exam-icon"><BookOpen size={20}/></div><div className="package-exam-copy"><b>{exam.title}</b><small><Clock3 size={14}/> {date(exam.start)} BST · {exam.duration} minutes</small><small>{exam.result ? <><Trophy size={14}/> Score {(exam.result.score/100).toFixed(2)} · Position #{exam.result.position} · {exam.result.correct} correct</> : exam.attempt_id ? "Submitted · result pending" : Date.now()<exam.start?"Upcoming exam":"Ready to take"}</small>{exam.support_pdf&&<a className="text-link" href={`/api/packages/${packId}/materials/${exam.id}`}><Download size={14}/> Study material PDF</a>}</div>
      <a href={exam.attempt_id ? `/attempts/${exam.attempt_id}` : `/exams/${exam.id}?package=${packId}`} className="btn secondary">{exam.attempt_id ? "View result" : "Enter exam"}</a>
    </article>)}</div>
    <button type="button" className="btn secondary" onClick={()=>setShowReview(!showReview)}>{showReview ? "Hide" : "Show"} wrong and skipped questions</button>
    {showReview && <div className="package-review-list">{attempted.flatMap((exam:any)=>exam.review.map((question:any,index:number)=><article key={`${exam.id}-${index}`}><b>{exam.title}: {question.question}</b><p>Your answer: {question.selected == null ? "Skipped" : question.options[question.selected]}</p><p>Correct answer: {question.options[question.correct_option]}</p>{question.explanation&&<p>{question.explanation}</p>}</article>))}{!attempted.some((exam:any)=>exam.review.length)&&<p>No wrong or skipped questions in released results.</p>}</div>}
  </section>;
}

export function HomePackages({ settings, initialData }: any = {}) {
  const { data, error } = useData("packages", initialData);
  if (error || !data?.length || settings?.packageVisible === false) return null;
  return (
    <section className="container section">
      <div className="section-head">
        <div>
          <div className="eyebrow">OUR COURSES · EXAM SERIES</div>
          <h2>Exam Package</h2>
          <p>
            {settings?.packageSubtitle ||
              "One purchase gives you secure access to every scheduled exam in the package."}
          </p>
        </div>
        <a className="text-link" href="/packages">
          {settings?.viewAllText || "View All"} Packages{" "}
          <ArrowRight size={17} />
        </a>
      </div>
      <div className="grid three">
        {data.slice(0, 3).map((p: any) => (
          <PackageCard key={p.id} pack={p} />
        ))}
      </div>
    </section>
  );
}
