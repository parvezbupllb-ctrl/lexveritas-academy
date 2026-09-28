"use client";

import { useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { MediaUpload } from "./media-upload";
import {
  api,
  cash,
  Confirm,
  EmptyState,
  ErrorBox,
  Field,
  Loading,
  money,
  useData,
} from "@/lib/client";

type Kind = "team" | "notices" | "courses" | "notes" | "reviews";
const titles = {
  team: "Team Members",
  notices: "Notice Management",
  courses: "Course Management",
  notes: "Notes Management",
  reviews: "Verified Reviews",
};
const empty = {
  team: {
    name: "",
    role: "",
    details: "",
    photo: null,
    active: true,
    display_order: 0,
  },
  notices: {
    title: "",
    content: "",
    attachment: null,
    notice_date: new Date().toISOString().slice(0, 10),
    published: false,
  },
  courses: {
    name: "",
    thumbnail: null,
    description: "",
    class_count: 0,
    exam_count: 0,
    sheet_count: 0,
    price: "0",
    details: "",
    package_id: "",
    active: true,
    published: false,
  },
  notes: {
    category: ["bjs"],
    subcategory: [],
    title: "",
    description: "",
    subject: [],
    page_count: 0,
    reading_minutes: 0,
    thumbnail: null,
    file: null,
    link: "",
    published: false,
  },
  reviews: {
    review_text: "",
    reviewer_name: "",
    reviewer_photo: null,
    university: "",
    rating: 5,
    verified: true,
    published: false,
    active: true,
    display_order: 0,
  },
};

export function ContentManager({ kind }: { kind: Kind }) {
  const { data, error, reload } = useData(`admin/${kind}`),
    { data: packages } = useData(
      kind === "courses" ? "admin/packages" : "admin/dashboard",
    );
  const [editing, setEditing] = useState<any>(null),
    [deleting, setDeleting] = useState<any>(null);
  const label = (r: any) =>
    kind === "reviews"
      ? r.reviewer_name
      : kind === "team"
        ? r.name
        : kind === "courses"
          ? r.name
          : r.title;
  const listValue = (value: any) => {
    if (Array.isArray(value)) return value;
    try { const parsed = JSON.parse(value || ""); if (Array.isArray(parsed)) return parsed; } catch {}
    return value ? [String(value)] : [];
  };
  return (
    <>
      <div className="section-head admin-page-heading">
        <div>
          <div className="eyebrow">LEXVERITAS ACADEMY</div>
          <h1>{titles[kind]}</h1>
          <p>
            Published and active records appear automatically on the public
            website.
          </p>
        </div>
        <button className="btn" onClick={() => setEditing({ ...empty[kind] })}>
          <Plus size={17} />
          Add{" "}
          {kind === "team"
            ? "Team Member"
            : kind === "notices"
              ? "Notice"
              : kind === "courses"
                ? "Course"
                : kind === "reviews"
                  ? "Review"
                  : "Note"}
        </button>
      </div>
      <ErrorBox error={error} />
      {!data && !error ? (
        <Loading />
      ) : data?.length ? (
        <div className="table-card cms-table">
          <table>
            <thead>
              <tr>
                <th>Title / Name</th>
                <th>Type / Details</th>
                {kind === "notes" && <th>Download Count</th>}
                <th>Status</th>
                <th>Manage</th>
              </tr>
            </thead>
            <tbody>
              {data.map((r: any) => (
                <tr key={r.id}>
                  <td>
                    <strong>{label(r)}</strong>
                  </td>
                  <td>
                    {kind === "team"
                      ? r.role
                      : kind === "reviews"
                        ? `${r.university} · ${r.rating || 5}/5 · ${String(r.review_text).slice(0, 90)}${String(r.review_text).length > 90 ? "…" : ""}`
                        : kind === "notes"
                          ? listValue(r.category).map((x:string)=>(
                              { bjs: "BJS Notes", bar: "BAR Notes", general: "General Subject Notes", academic: "Academic Notes" } as any
                            )[x] || x).join(", ")
                          : kind === "courses"
                            ? `${r.class_count} Classes · ${r.exam_count} Exams · ${money(r.price)}`
                            : new Date(r.notice_date).toLocaleDateString(
                                "en-GB",
                              )}
                  </td>
                  {kind === "notes" && (
                    <td>{Number(r.download_count || 0).toLocaleString()}</td>
                  )}
                  <td>
                    <span className="badge">
                      {kind === "reviews"
                        ? r.active && r.published && r.verified
                          ? "Approved / Published"
                          : !r.verified && !r.published
                            ? "Pending approval"
                            : "Unpublished"
                        : (r.active ?? r.published)
                          ? "Active / Published"
                          : "Inactive / Draft"}
                    </span>
                  </td>
                  <td>
                    <div className="table-actions">
                      {kind === "reviews" && !r.verified && !r.published && (
                        <button className="btn small" type="button" onClick={async () => {
                          try {
                            await api(`admin/reviews/${r.id}/approve`, {});
                            toast.success("Review approved and published");
                            reload();
                          } catch (issue: any) { toast.error(issue.message); }
                        }}>Approve & Publish</button>
                      )}
                      <button
                        className="icon-btn"
                        aria-label={`Edit ${label(r)}`}
                        onClick={() =>
                          setEditing({
                            ...r,
                            active: r.active == null ? r.active : !!r.active,
                            published:
                              r.published == null ? r.published : !!r.published,
                            verified:
                              r.verified == null ? r.verified : !!r.verified,
                            price:
                              kind === "courses"
                                ? String(r.price / 100)
                                : r.price,
                            notice_date:
                              kind === "notices"
                                ? new Date(r.notice_date)
                                    .toISOString()
                                    .slice(0, 10)
                                : r.notice_date,
                            package_id: r.package_id || "",
                            ...(kind === "notes" ? { category:listValue(r.category), subcategory:listValue(r.subcategory), subject:listValue(r.subject) } : {}),
                          })
                        }
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        className="icon-btn danger"
                        aria-label={`Delete ${label(r)}`}
                        onClick={() => setDeleting(r)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState title={`No ${titles[kind]} Yet`}>
          Use the Add button to create the first record.
        </EmptyState>
      )}
      <Editor
        kind={kind}
        value={editing}
        packages={packages || []}
        records={data || []}
        close={() => setEditing(null)}
        saved={() => {
          setEditing(null);
          reload();
        }}
      />
      <Confirm
        open={!!deleting}
        onOpenChange={(v: boolean) => !v && setDeleting(null)}
        title={`Delete ${deleting ? label(deleting) : "record"}?`}
        description={
          kind === "courses"
            ? "The course will be removed from the public website. Historical course orders are preserved."
            : "The record will be permanently removed from the Admin Portal and public website."
        }
        action="Delete"
        onConfirm={async () => {
          const r = await api(
            `admin/${kind}/${deleting.id}`,
            undefined,
            "DELETE",
          );
          toast.success(r.message || "Deleted");
          setDeleting(null);
          reload();
        }}
      />
    </>
  );
}

function Editor({
  kind,
  value,
  packages,
  records,
  close,
  saved,
}: {
  kind: Kind;
  value: any;
  packages: any[];
  records: any[];
  close: () => void;
  saved: () => void;
}) {
  const [form, setForm] = useState<any>(value),
    [error, setError] = useState("");
  useEffect(() => setForm(value), [value]);
  if (!form) return null;
  const set = (key: string, val: any) =>
    setForm((f: any) => ({ ...f, [key]: val }));
  const save = async (e: any) => {
    e.preventDefault();
    setError("");
    try {
      let payload = { ...form };
      if (kind === "courses")
        payload = {
          ...payload,
          price: cash(payload.price),
          package_id: payload.package_id || null,
        };
      if (kind === "notices")
        payload = {
          ...payload,
          notice_date: new Date(
            payload.notice_date + "T12:00:00+06:00",
          ).getTime(),
        };
      if (kind === "notes")
        payload = { ...payload, link: payload.link || null };
      await api(
        `admin/${kind}${form.id ? `/${form.id}` : ""}`,
        payload,
        form.id ? "PATCH" : "POST",
      );
      toast.success("Saved successfully");
      saved();
    } catch (x: any) {
      setError(x.message);
    }
  };
  return (
    <Dialog open={!!value} onOpenChange={(v) => !v && close()}>
      <DialogContent className="wide-dialog">
        <DialogHeader>
          <DialogTitle>
            {form.id ? "Edit" : "Add"}{" "}
            {kind === "team"
              ? "Team Member"
              : kind === "notices"
                ? "Notice"
                : kind === "courses"
                  ? "Course"
                  : kind === "reviews"
                    ? "Review"
                    : "Note"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={save}>
          {kind === "team" && (
            <>
              <Field
                label="Name"
                required
                value={form.name}
                onChange={(e: any) => set("name", e.target.value)}
              />
              <Field
                label="Role"
                required
                value={form.role}
                onChange={(e: any) => set("role", e.target.value)}
              />
              <Field label="Description / Qualification / Information">
                <textarea
                  rows={4}
                  value={form.details}
                  onChange={(e) => set("details", e.target.value)}
                />
              </Field>
              <Field label="Team Member Photo">
                <Upload
                  kind="team"
                  value={form.photo}
                  onChange={(v: any) => set("photo", v)}
                />
              </Field>
              <Field
                label="Display Order"
                type="number"
                min="0"
                value={form.display_order}
                onChange={(e: any) =>
                  set("display_order", Number(e.target.value))
                }
              />
              <Toggle
                label="Active"
                value={form.active}
                set={(v: boolean) => set("active", v)}
              />
            </>
          )}
          {kind === "notices" && (
            <>
              <Field
                label="Notice Title"
                required
                value={form.title}
                onChange={(e: any) => set("title", e.target.value)}
              />
              <Field label="Notice Description / Content">
                <textarea
                  rows={6}
                  required
                  value={form.content}
                  onChange={(e) => set("content", e.target.value)}
                />
              </Field>
              <Field label="Notice PDF Or Photo (Optional)">
                <Upload
                  kind="noticeAttachment"
                  value={form.attachment}
                  onChange={(v: any) => set("attachment", v)}
                />
              </Field>
              <Field
                label="Notice Date"
                type="date"
                required
                value={form.notice_date}
                onChange={(e: any) => set("notice_date", e.target.value)}
              />
              <Toggle
                label="Published"
                value={form.published}
                set={(v: boolean) => set("published", v)}
              />
            </>
          )}
          {kind === "courses" && (
            <>
              <Field
                label="Course Name"
                required
                value={form.name}
                onChange={(e: any) => set("name", e.target.value)}
              />
              <Field label="Course Thumbnail">
                <Upload
                  kind="course"
                  value={form.thumbnail}
                  onChange={(v: any) => set("thumbnail", v)}
                />
              </Field>
              <Field label="Short Course Description">
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={(e) => set("description", e.target.value)}
                />
              </Field>
              <div className="grid three">
                <Field
                  label="Number Of Video Classes"
                  type="number"
                  min="0"
                  value={form.class_count}
                  onChange={(e: any) =>
                    set("class_count", Number(e.target.value))
                  }
                />
                <Field
                  label="Number Of Exams"
                  type="number"
                  min="0"
                  value={form.exam_count}
                  onChange={(e: any) =>
                    set("exam_count", Number(e.target.value))
                  }
                />
                <Field
                  label="Number Of Notes / Lecture Sheets"
                  type="number"
                  min="0"
                  value={form.sheet_count}
                  onChange={(e: any) =>
                    set("sheet_count", Number(e.target.value))
                  }
                />
              </div>
              <Field
                label="Course Price (BDT)"
                required
                inputMode="decimal"
                value={form.price}
                onChange={(e: any) => set("price", e.target.value)}
              />
              <Field label="Included Content & Course Details (One Item Per Line)">
                <textarea
                  rows={7}
                  placeholder={
                    "Live video classes\nRecorded classes\nWeekly exams\nDownloadable notes"
                  }
                  value={form.details}
                  onChange={(e) => set("details", e.target.value)}
                />
              </Field>
              <Field label="Linked Exam Package (Optional)">
                <select
                  className="choice"
                  value={form.package_id}
                  onChange={(e) => set("package_id", e.target.value)}
                >
                  <option value="">No Linked Exam Package</option>
                  {packages.map((p: any) => (
                    <option value={p.id} key={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
              </Field>
              <Toggle
                label="Enrollment Active"
                value={form.active}
                set={(v: boolean) => set("active", v)}
              />
              <Toggle
                label="Published"
                value={form.published}
                set={(v: boolean) => set("published", v)}
              />
            </>
          )}
          {kind === "notes" && (
            <>
              {(() => {
                const builtInCategories = [
                  { value: "bjs", label: "BJS Notes" },
                  { value: "bar", label: "BAR Notes" },
                  { value: "general", label: "General Subject Notes" },
                  { value: "academic", label: "Academic Notes" },
                ];
                const builtInValues = new Set(
                  builtInCategories.map((category) => category.value),
                );
                const parseList = (v: any) => {
                  if (Array.isArray(v)) return v;
                  try { const p = JSON.parse(v || ""); if (Array.isArray(p)) return p; } catch {}
                  return v ? [String(v)] : [];
                };
                const categories = [
                  ...builtInCategories,
                  ...Array.from(
                    new Set(
                      records
                        .flatMap((record: any) => parseList(record.category))
                        .filter(Boolean),
                    ),
                  )
                    .filter((category: any) => !builtInValues.has(category))
                    .map((category: any) => ({
                      value: category,
                      label: category,
                    })),
                ];
                const subcategories = Array.from(new Set(records.flatMap((record:any)=>parseList(record.subcategory)).filter(Boolean)));
                const subjects = Array.from(new Set(records.flatMap((record:any)=>parseList(record.subject)).filter(Boolean)));
                return (
                  <>
                    <MultiCreateSelect label="Select Note Category" value={parseList(form.category)} options={categories} onChange={(v:any)=>set("category",v)} required />
                    <MultiCreateSelect label="Select Note Subcategory" value={parseList(form.subcategory)} options={subcategories.map((x:any)=>({value:x,label:x}))} onChange={(v:any)=>set("subcategory",v)} />
                    <MultiCreateSelect label="Subject" value={parseList(form.subject)} options={subjects.map((x:any)=>({value:x,label:x}))} onChange={(v:any)=>set("subject",v)} />
                  </>
                );
              })()}
              <Field
                label="Note Title"
                required
                value={form.title}
                onChange={(e: any) => set("title", e.target.value)}
              />
              <Field label="Note Description">
                <textarea
                  rows={4}
                  value={form.description}
                  onChange={(e) => set("description", e.target.value)}
                />
              </Field>
              <div className="grid two">
                <Field
                  label="Page Count"
                  type="number"
                  min="0"
                  value={form.page_count || 0}
                  onChange={(e: any) =>
                    set("page_count", Number(e.target.value))
                  }
                />
                <Field
                  label="Estimated Reading Time (minutes)"
                  type="number"
                  min="0"
                  value={form.reading_minutes || 0}
                  onChange={(e: any) =>
                    set("reading_minutes", Number(e.target.value))
                  }
                />
              </div>
              <Field label="Preview / Thumbnail (optional — generated from the note file when omitted)">
                <Upload
                  kind="note"
                  value={form.thumbnail}
                  onChange={(v: any) => set("thumbnail", v)}
                />
              </Field>
              <Field label="Note PDF / Image">
                <Upload
                  kind="noteFile"
                  value={form.file}
                  onChange={(v: any) => set("file", v)}
                />
              </Field>
              <Field
                label="Or External HTTPS Link"
                type="url"
                value={form.link || ""}
                onChange={(e: any) => set("link", e.target.value)}
              />
              <Toggle
                label="Published"
                value={form.published}
                set={(v: boolean) => set("published", v)}
              />
            </>
          )}
          {kind === "reviews" && (
            <>
              <Field label="Review Text">
                <textarea
                  rows={7}
                  required
                  minLength={10}
                  value={form.review_text}
                  onChange={(e) => set("review_text", e.target.value)}
                />
              </Field>
              <div className="grid two">
                <Field
                  label="Reviewer Name"
                  required
                  value={form.reviewer_name}
                  onChange={(e: any) => set("reviewer_name", e.target.value)}
                />
                <Field
                  label="University Name"
                  required
                  value={form.university}
                  onChange={(e: any) => set("university", e.target.value)}
                />
              </div>
              <Field label="Rating (1–5)">
                <select className="choice" value={form.rating || 5} onChange={(e) => set("rating", Number(e.target.value))}>
                  {[1,2,3,4,5].map((n) => <option key={n} value={n}>{n} / 5</option>)}
                </select>
              </Field>
              <Field label="Reviewer Photo">
                <Upload
                  kind="review"
                  value={form.reviewer_photo}
                  onChange={(v: any) => set("reviewer_photo", v)}
                />
              </Field>
              <Field
                label="Display Order"
                type="number"
                min="0"
                value={form.display_order}
                onChange={(e: any) =>
                  set("display_order", Number(e.target.value))
                }
              />
              <Toggle
                label="Verified / Approved"
                value={form.verified}
                set={(v) => set("verified", v)}
              />
              <Toggle
                label="Published"
                value={form.published}
                set={(v) => set("published", v)}
              />
              <Toggle
                label="Active"
                value={form.active}
                set={(v) => set("active", v)}
              />
            </>
          )}
          <ErrorBox error={error} />
          <div className="actions">
            <button className="btn" type="submit">
              Save
            </button>
            <button className="btn outline" type="button" onClick={close}>
              Cancel
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function MultiCreateSelect({ label, value, options, onChange, required = false }: any) {
  const [adding, setAdding] = useState(false), [draft, setDraft] = useState("");
  const selected = Array.isArray(value) ? value : [];
  const add = () => {
    const next = draft.trim();
    if (!next) return;
    onChange([...new Set([...selected, next])]);
    setDraft(""); setAdding(false);
  };
  return <Field label={label} required={required}>
    <div className="multi-create-select">
      <div className="multi-create-options">
        {options.map((option:any)=><label key={option.value}><input type="checkbox" checked={selected.includes(option.value)} onChange={(e)=>onChange(e.target.checked?[...new Set([...selected,option.value])]:selected.filter((x:string)=>x!==option.value))}/><span>{option.label}</span></label>)}
      </div>
      {selected.length>0&&<div className="multi-create-chips">{selected.map((x:string)=><button type="button" key={x} onClick={()=>onChange(selected.filter((v:string)=>v!==x))}>{options.find((o:any)=>o.value===x)?.label||x} ×</button>)}</div>}
      {!adding?<button type="button" className="text-link" onClick={()=>setAdding(true)}><Plus size={15}/> Add New</button>:<div className="multi-create-new"><input autoFocus value={draft} maxLength={120} placeholder={`New ${label.toLowerCase()}`} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();add()}}}/><button type="button" className="btn small" onClick={add}>Add</button><button type="button" className="btn secondary small" onClick={()=>{setAdding(false);setDraft("")}}>Cancel</button></div>}
    </div>
  </Field>;
}

function Toggle({
  label,
  value,
  set,
}: {
  label: string;
  value: boolean;
  set: (v: boolean) => void;
}) {
  return (
    <div className="toggle-line">
      <span>{label}</span>
      <Switch checked={!!value} onCheckedChange={set} aria-label={label} />
    </div>
  );
}

function Upload({
  kind,
  value,
  onChange,
}: {
  kind: string;
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  return <MediaUpload kind={kind} value={value} onChange={onChange} />;
}
