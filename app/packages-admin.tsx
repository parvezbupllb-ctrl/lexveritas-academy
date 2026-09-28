"use client";
import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import {
  api,
  cash,
  Choice,
  Confirm,
  EmptyState,
  ErrorBox,
  Field,
  Loading,
  money,
  useData,
} from "@/lib/client";
import { MediaUpload } from "./media-upload";
import { AccessCodesPanel } from "./access-codes";

const dhakaParts = (value: number) => {
  const d = new Date(value + 21600000),
    h = d.getUTCHours();
  return {
    date: d.toISOString().slice(0, 10),
    hour: String(h % 12 || 12).padStart(2, "0"),
    minute: String(d.getUTCMinutes()).padStart(2, "0"),
    period: h >= 12 ? "PM" : "AM",
  };
};
const toTime = (v: any) => {
  let h = Number(v.hour) % 12;
  if (v.period === "PM") h += 12;
  return new Date(
    `${v.date}T${String(h).padStart(2, "0")}:${v.minute}:00+06:00`,
  ).getTime();
};
function TimePicker({ label, value, onChange }: any) {
  const hours = Array.from({ length: 12 }, (_, i) =>
      String(i + 1).padStart(2, "0"),
    ),
    minutes = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));
  return (
    <fieldset className="time-picker">
      <legend>{label}</legend>
      <Field
        label="Date"
        type="date"
        value={value.date}
        onChange={(e: any) => onChange({ ...value, date: e.target.value })}
      />
      <div className="time-row">
        <Field label="Hour">
          <Choice
            label={`${label} hour`}
            value={value.hour}
            onChange={(hour: string) => onChange({ ...value, hour })}
            options={hours}
          />
        </Field>
        <Field label="Minute">
          <Choice
            label={`${label} minute`}
            value={value.minute}
            onChange={(minute: string) => onChange({ ...value, minute })}
            options={minutes}
          />
        </Field>
        <Field label="AM / PM">
          <Choice
            label={`${label} AM or PM`}
            value={value.period}
            onChange={(period: string) => onChange({ ...value, period })}
            options={["AM", "PM"]}
          />
        </Field>
      </div>
    </fieldset>
  );
}
function UploadImage({ value, onChange }: any) {
  return (
    <MediaUpload
      kind="course"
      value={value}
      onChange={onChange}
      successMessage="Thumbnail uploaded"
    />
  );
}

export function AdminPackages({ id }: { id?: string }) {
  return id ? <PackageEditor id={id} /> : <PackageList />;
}

function PackageList() {
  const { data, error, reload } = useData("admin/packages"),
    [deleting, setDeleting] = useState<any>(null);
  return (
    <>
      <div className="section-head admin-page-heading">
        <div>
          <div className="eyebrow">MCQ EXAM</div>
          <h1>Exam Packages</h1>
          <p>
            Create saleable packages containing multiple MCQ Exams, seats,
            access duration and routines.
          </p>
        </div>
        <a className="btn" href="/admin/packages/new">
          <Plus size={17} /> Create Package
        </a>
      </div>
      <ErrorBox error={error} />
      {!data && !error ? (
        <Loading />
      ) : data?.length ? (
        <div className="table-card">
          <table>
            <thead>
              <tr>
                <th>Package</th>
                <th>Price</th>
                <th>Exams</th>
                <th>Seats</th>
                <th>Validity</th>
                <th>Entry</th>
                <th>Status</th>
                <th>Manage</th>
              </tr>
            </thead>
            <tbody>
              {data.map((p: any) => (
                <tr key={p.id}>
                  <td>
                    <strong>{p.title}</strong>
                  </td>
                  <td>{money(p.price)}</td>
                  <td>{p.exam_count}</td>
                  <td>{p.max_participants || "Unlimited"}</td>
                  <td>{p.access_days} Days</td>
                  <td>{p.access_mode==="open"?"Open":"Code required"}</td>
                  <td>
                    <span className="badge">
                      {p.published ? "Published" : "Draft"}
                    </span>
                  </td>
                  <td>
                    <div className="table-actions">
                      <a className="text-link" href={`/admin/packages/${p.id}`}>
                        Edit
                      </a>
                      <button
                        className="icon-btn danger"
                        aria-label={`Delete ${p.title}`}
                        onClick={() => setDeleting(p)}
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
        <EmptyState title="Create Your First Exam Package">
          Bundle multiple MCQ Exams and define their routine.
        </EmptyState>
      )}
      <Confirm
        open={!!deleting}
        onOpenChange={(v: boolean) => !v && setDeleting(null)}
        title="Are You Sure You Want To Delete This Package?"
        description="Packages with orders are safely unpublished so historical records remain available."
        action="Delete Package"
        onConfirm={async () => {
          const r = await api(
            `admin/packages/${deleting.id}`,
            undefined,
            "DELETE",
          );
          toast.success(r.message || "Package deleted");
          setDeleting(null);
          reload();
        }}
      />
    </>
  );
}

function PackageEditor({ id }: { id: string }) {
  const fresh = id === "new",
    [form, setForm] = useState<any>({
      title: "",
      description: "",
      thumbnail: null,
      details: "",
      price: "0",
      accessMode: "code",
      oldPrice: "",
      detailedExplanations: true,
      leaderboard: true,
      status: "active",
      maxParticipants: "",
      accessDays: 30,
      available: true,
      published: false,
      examIds: [],
      examMaterials: {},
      routines: [],
    }),
    [exams, setExams] = useState<any[]>([]),
    [error, setError] = useState(""),
    [loaded, setLoaded] = useState(false),
    [removeRoutine, setRemoveRoutine] = useState<any>(null);
  useEffect(() => {
    Promise.all([
      api("admin/exams"),
      fresh ? Promise.resolve(null) : api(`admin/packages/${id}`),
    ])
      .then(([all, p]) => {
        setExams(all);
        if (p)
          setForm({
            ...p,
            price: String(p.price / 100),
            oldPrice: p.old_price ? String(p.old_price / 100) : "",
            detailedExplanations: !!p.detailed_explanations,
            leaderboard: !!p.leaderboard,
            maxParticipants: p.max_participants || "",
            accessDays: p.access_days,
            accessMode: p.access_mode||"code",
            examIds: p.exams.map((e: any) => e.id),
            examMaterials: Object.fromEntries(p.exams.map((e:any)=>[e.id,e.support_pdf||null])),
            routines: (p.routines || []).map((r: any) => ({
              ...r,
              startPicker: dhakaParts(r.start),
              endPicker: dhakaParts(r.end),
            })),
          });
        setLoaded(true);
      })
      .catch((e) => setError(e.message));
  }, [id, fresh]);
  const toggle = (examId: string) =>
    setForm((f: any) => {
      const removing = f.examIds.includes(examId);
      const start = Date.now() + 86400000;
      return {
        ...f,
        examIds: removing ? f.examIds.filter((x: string) => x !== examId) : [...f.examIds, examId],
        routines: removing ? f.routines.filter((r: any) => r.exam_id !== examId) : [
          ...f.routines,
          { localId: crypto.randomUUID(), exam_id: examId, startPicker: dhakaParts(start), endPicker: dhakaParts(start + 7200000), display_order: f.routines.length + 1 },
        ],
      };
    });
  const addRoutine = () => {
    if (!form.examIds.length) return toast.error("Select an MCQ Exam first.");
    const start = Date.now() + 86400000,
      end = start + 7200000;
    setForm({
      ...form,
      routines: [
        ...form.routines,
        {
          localId: crypto.randomUUID(),
          exam_id: form.examIds[0],
          startPicker: dhakaParts(start),
          endPicker: dhakaParts(end),
          display_order: form.routines.length + 1,
        },
      ],
    });
  };
  const updateRoutine = (key: string, part: any) =>
    setForm({
      ...form,
      routines: form.routines.map((r: any) =>
        (r.id || r.localId) === key ? { ...r, ...part } : r,
      ),
    });
  if (!loaded) return <Loading />;
  return (
    <>
      <div className="section-head admin-page-heading">
        <div>
          <div className="eyebrow">MCQ EXAM · EXAM PACKAGE</div>
          <h1>{fresh ? "Create Exam Package" : "Edit Exam Package"}</h1>
          <p>
            Build the exam routine first, then complete the package details.
          </p>
        </div>
        {!fresh && (
          <a className="btn outline" href="#participants">
            <Users size={16} /> Package Participants
          </a>
        )}
      </div>
      <ErrorBox error={error} />
      <form
        className="card"
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          try {
            if (form.examIds.some((examId: string) => !form.routines.some((r: any) => r.exam_id === examId)))
              throw Error("Set a routine for every selected exam before saving the package.");
            const payload = {
              ...form,
              price: cash(form.price),
              oldPrice: form.oldPrice ? cash(form.oldPrice) : null,
              maxParticipants: form.maxParticipants
                ? Number(form.maxParticipants)
                : null,
              accessDays: Number(form.accessDays),
              routines: form.routines.map((r: any, i: number) => ({
                id: r.id,
                exam_id: r.exam_id,
                start: toTime(r.startPicker),
                end: toTime(r.endPicker),
                display_order: i + 1,
              })),
            };
            const result = await api(
              `admin/packages${fresh ? "" : "/" + id}`,
              payload,
              fresh ? "POST" : "PATCH",
            );
            toast.success("Exam Package saved");
            window.location.href = fresh
              ? `/admin/packages/${result.id}`
              : "/admin/packages";
          } catch (x: any) {
            setError(x.message);
          }
        }}
      >
        <div className="package-build-step">Step 1 · Build exam routine</div>
        <div className="section-head">
          <div>
            <h2>Included MCQ Exams</h2>
            <p>
              Select multiple Exams. Removing one only removes its Package
              association.
            </p>
          </div>
          <a className="btn outline" href="/admin/exams/new">
            Create MCQ Exam
          </a>
        </div>
        <div className="package-picker">
          {exams.map((exam: any) => (
            <label className="card" key={exam.id}>
              <input
                type="checkbox"
                checked={form.examIds.includes(exam.id)}
                onChange={() => toggle(exam.id)}
              />
              <span>
                <strong>{exam.title}</strong>
                <small>
                  {exam.question_count} Questions · {exam.status}
                </small>
              </span>
            </label>
          ))}
        </div>
        <div className="selected-exams">
          {form.examIds.map((examId: string, i: number) => {
            const exam = exams.find((x) => x.id === examId);
            return (
              <div className="routine-mini" key={examId}>
                <span>
                  {i + 1}. {exam?.title}
                </span>
                <div className="actions">
                  <button
                    type="button"
                    className="icon-btn"
                    disabled={!i}
                    onClick={() => {
                      const ids = [...form.examIds];
                      [ids[i - 1], ids[i]] = [ids[i], ids[i - 1]];
                      setForm({ ...form, examIds: ids });
                    }}
                  >
                    <ArrowUp size={15} />
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    disabled={i === form.examIds.length - 1}
                    onClick={() => {
                      const ids = [...form.examIds];
                      [ids[i + 1], ids[i]] = [ids[i], ids[i + 1]];
                      setForm({ ...form, examIds: ids });
                    }}
                  >
                    <ArrowDown size={15} />
                  </button>
                  <button
                    type="button"
                    className="icon-btn danger"
                    onClick={() => toggle(examId)}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        {!!form.examIds.length && <div className="package-materials"><h3>Optional study materials</h3><p>Attach a PDF to any included exam. Students with package access can download it from their dashboard.</p>{form.examIds.map((examId:string)=><div className="card package-material-row" key={examId}><strong>{exams.find((e:any)=>e.id===examId)?.title}</strong><MediaUpload kind="coursePdf" value={form.examMaterials?.[examId]||null} onChange={value=>setForm((previous:any)=>({...previous,examMaterials:{...previous.examMaterials,[examId]:value}}))}/></div>)}</div>}
        <div className="section-head">
          <div>
            <h2>Exam Routine</h2>
            <p>This window is enforced for Package students.</p>
          </div>
          <button type="button" className="btn outline" onClick={addRoutine}>
            <Plus size={16} /> Add Routine Entry
          </button>
        </div>
        <div className="routine-list">
          {form.routines.map((r: any, i: number) => {
            const key = r.id || r.localId;
            return (
              <article className="card routine-entry" key={key}>
                <div className="builder-question-head">
                  <strong>Routine {i + 1}</strong>
                  <button
                    type="button"
                    className="icon-btn danger"
                    onClick={() => setRemoveRoutine(r)}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <Field label="MCQ Exam">
                  <select
                    className="choice"
                    value={r.exam_id}
                    onChange={(e) =>
                      updateRoutine(key, { exam_id: e.target.value })
                    }
                  >
                    {form.examIds.map((eid: string) => (
                      <option key={eid} value={eid}>
                        {exams.find((x) => x.id === eid)?.title}
                      </option>
                    ))}
                  </select>
                </Field>
                <div className="grid two">
                  <TimePicker
                    label="Routine Start Time"
                    value={r.startPicker}
                    onChange={(startPicker: any) =>
                      updateRoutine(key, { startPicker })
                    }
                  />
                  <TimePicker
                    label="Routine End Time"
                    value={r.endPicker}
                    onChange={(endPicker: any) =>
                      updateRoutine(key, { endPicker })
                    }
                  />
                </div>
              </article>
            );
          })}
        </div>
        <div className="package-build-step">Step 2 · Package details</div>
        <div className="grid three">
          <Field label="Package entry"><select value={form.accessMode} onChange={e=>setForm({...form,accessMode:e.target.value,price:e.target.value==="open"?"0":form.price})}><option value="open">Open · no code required</option><option value="code">Assigned access code required</option></select></Field>
          <Field
            label="Package Name"
            required
            value={form.title}
            onChange={(e: any) => setForm({ ...form, title: e.target.value })}
          />
          <Field
            label="Sale Price (BDT)"
            required
            value={form.price}
            onChange={(e: any) => setForm({ ...form, price: e.target.value })}
          />
          <Field
            label="Old Price (BDT) — optional"
            value={form.oldPrice}
            onChange={(e: any) =>
              setForm({ ...form, oldPrice: e.target.value })
            }
          />
        </div>
        <Field label="Package Thumbnail">
          <UploadImage
            value={form.thumbnail}
            onChange={(thumbnail: any) => setForm({ ...form, thumbnail })}
          />
        </Field>
        <Field label="Package Description">
          <textarea
            rows={3}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </Field>
        <Field label="Package Details">
          <textarea
            rows={6}
            value={form.details}
            onChange={(e) => setForm({ ...form, details: e.target.value })}
          />
        </Field>
        <div className="grid two">
          <label className="toggle-line">
            <span>Detailed Explanations Included</span>
            <input
              type="checkbox"
              checked={!!form.detailedExplanations}
              onChange={(e) =>
                setForm({ ...form, detailedExplanations: e.target.checked })
              }
            />
          </label>
          <label className="toggle-line">
            <span>Leaderboard Included</span>
            <input
              type="checkbox"
              checked={!!form.leaderboard}
              onChange={(e) =>
                setForm({ ...form, leaderboard: e.target.checked })
              }
            />
          </label>
        </div>
        <div className="grid three">
          <Field label="Maximum Participants / Seats">
            <input
              type="number"
              min="1"
              placeholder="Blank = Unlimited"
              value={form.maxParticipants}
              onChange={(e) =>
                setForm({ ...form, maxParticipants: e.target.value })
              }
            />
          </Field>
          <Field
            label="Access Duration (Days)"
            type="number"
            min="1"
            max="3650"
            value={form.accessDays}
            onChange={(e: any) =>
              setForm({ ...form, accessDays: e.target.value })
            }
          />
          <Field label="Package Status">
            <Choice
              label="Package status"
              value={form.status}
              onChange={(status: string) => setForm({ ...form, status })}
              options={[
                { value: "active", label: "Active" },
                { value: "inactive", label: "Inactive" },
              ]}
            />
          </Field>
        </div>
        <div className="grid two">
          <label className="toggle-line">
            <span>Available For Purchase</span>
            <input
              type="checkbox"
              checked={!!form.available}
              onChange={(e) =>
                setForm({ ...form, available: e.target.checked })
              }
            />
          </label>
          <label className="toggle-line">
            <span>Published Publicly</span>
            <input
              type="checkbox"
              checked={!!form.published}
              onChange={(e) =>
                setForm({ ...form, published: e.target.checked })
              }
            />
          </label>
        </div>
        <ErrorBox error={error} />
        <button className="btn" disabled={!form.examIds.length || form.examIds.some((examId: string) => !form.routines.some((r: any) => r.exam_id === examId))}>
          Save Exam Package
        </button>
      </form>
      {!fresh && <><AccessCodesPanel type="package" id={id}/><PackageParticipants id={id}/></>}
      <Confirm
        open={!!removeRoutine}
        onOpenChange={(v: boolean) => !v && setRemoveRoutine(null)}
        title="Are You Sure You Want To Delete This Routine Entry?"
        description="Only this Routine entry will be removed. The MCQ Exam remains unchanged."
        action="Delete Routine"
        onConfirm={async () => {
          try {
            if (removeRoutine.id)
              await api(
                `admin/packages/${id}/routines/${removeRoutine.id}`,
                undefined,
                "DELETE",
              );
            setForm({
              ...form,
              routines: form.routines.filter(
                (r: any) =>
                  (r.id || r.localId) !==
                  (removeRoutine.id || removeRoutine.localId),
              ),
            });
            setRemoveRoutine(null);
            toast.success("Routine entry deleted");
          } catch (x: any) {
            toast.error(x.message);
          }
        }}
      />
    </>
  );
}
function PackageParticipants({ id }: { id: string }) {
  const { data, error, reload } = useData(`admin/packages/${id}/participants`),
    [remove, setRemove] = useState<any>(null);
  return (
    <section id="participants" className="section">
      <div className="section-head">
        <div>
          <h2>Package Participants</h2>
          <p>Participants from every included MCQ Exam.</p>
        </div>
      </div>
      <ErrorBox error={error} />
      {data?.length ? (
        <div className="table-card">
          <table>
            <thead>
              <tr>
                <th>Student</th>
                <th>Exam</th>
                <th>Access Code</th>
                <th>Status</th>
                <th>Score</th>
                <th>Remove</th>
              </tr>
            </thead>
            <tbody>
              {data.map((a: any) => (
                <tr key={a.id}>
                  <td>
                    <strong>{a.student_name}</strong>
                    <small className="block muted">{a.university}</small>
                  </td>
                  <td>{a.exam_title}</td>
                  <td>
                    <code>{a.code}</code>
                  </td>
                  <td>{a.status}</td>
                  <td>{a.status === "submitted" ? a.score / 100 : "—"}</td>
                  <td>
                    <button
                      className="icon-btn danger"
                      aria-label={`Remove ${a.student_name}`}
                      onClick={() => setRemove(a)}
                    >
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="muted">No Package participants yet.</p>
      )}
      <Confirm
        open={!!remove}
        onOpenChange={(v: boolean) => !v && setRemove(null)}
        title="Are You Sure You Want To Remove This Participant?"
        description="Only this participant's attempt for the selected Exam will be removed."
        action="Remove Participant"
        onConfirm={async () => {
          await api(
            `admin/exams/${remove.exam_id}/participants/${remove.id}`,
            undefined,
            "DELETE",
          );
          setRemove(null);
          reload();
          toast.success("Participant removed");
        }}
      />
    </section>
  );
}
