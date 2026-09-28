"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Copy, Pencil, Plus, QrCode, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  Choice,
  Confirm,
  ErrorBox,
  Field,
  Loading,
  api,
  cash,
} from "@/lib/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ExamQr } from "@/components/exam-qr";
import { MediaUpload } from "./media-upload";
import { AccessCodesPanel } from "./access-codes";

const dhakaParts = (value: number) => {
  const d = new Date(value + 21600000),
    h24 = d.getUTCHours();
  return {
    date: d.toISOString().slice(0, 10),
    hour: String(h24 % 12 || 12).padStart(2, "0"),
    minute: String(d.getUTCMinutes()).padStart(2, "0"),
    period: h24 >= 12 ? "PM" : "AM",
  };
};
const toTime = (v: any) => {
  let hour = Number(v.hour) % 12;
  if (v.period === "PM") hour += 12;
  return new Date(
    `${v.date}T${String(hour).padStart(2, "0")}:${v.minute}:00+06:00`,
  ).getTime();
};
const blankQuestion = (order: number) => ({
  localId: crypto.randomUUID(),
  question: "",
  options: ["", "", "", ""],
  correct_option: 0,
  explanation: "",
  image: null,
  display_order: order,
  completed: false,
  editing: true,
});

function TimePicker({ label, value, onChange }: any) {
  const hours = Array.from({ length: 12 }, (_, i) =>
    String(i + 1).padStart(2, "0"),
  );
  const minutes = Array.from({ length: 60 }, (_, i) =>
    String(i).padStart(2, "0"),
  );
  return (
    <fieldset className="time-picker">
      <legend>{label}</legend>
      <Field
        label="Date"
        type="date"
        required
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

function QuestionImage({ value, onChange }: any) {
  return <MediaUpload kind="question" value={value} onChange={onChange} successMessage="Question image uploaded" />;
}

export function ExamBuilder({ id }: { id?: string }) {
  const fresh = !id;
  const [form, setForm] = useState<any>({
    title: "",
    description: "",
    start: dhakaParts(Date.now() + 3600000),
    end: dhakaParts(Date.now() + 7200000),
    duration: 60,
    correct_mark: "1",
    negative_mark: "0.25",
    pass_mark: "0",
    question_target: 0,
    result_mode: "auto",
    access_mode: "code",
    attempt_limit: 1,
    status: "draft",
  });
  const [questions, setQuestions] = useState<any[]>([]),
    [loaded, setLoaded] = useState(fresh),
    [error, setError] = useState("");
  const [remove, setRemove] = useState<any>(null),
    [shrinkTo, setShrinkTo] = useState<number | null>(null),
    [qr, setQr] = useState<any>(null),
    [examAction, setExamAction] = useState<any>(null);
  const completed = useMemo(
    () => questions.filter((q) => q.id && !q.editing).length,
    [questions],
  );
  const load = async () => {
    if (!id) return;
    try {
      const [e, qs] = await Promise.all([
        api(`admin/exams/${id}`),
        api(`admin/exams/${id}/questions`),
      ]);
      setForm({
        ...e,
        start: dhakaParts(e.start),
        end: dhakaParts(e.end),
        correct_mark: String(e.correct_mark / 100),
        negative_mark: String(e.negative_mark / 100),
        pass_mark: String((e.pass_mark || 0) / 100),
        question_target: Math.max(e.question_target || 0, qs.length),
      });
      const target = Math.max(e.question_target || 0, qs.length),
        existing = qs.map((q: any) => ({
          ...q,
          localId: q.id,
          completed: true,
          editing: false,
        }));
      setQuestions([
        ...existing,
        ...Array.from({ length: target - existing.length }, (_, i) =>
          blankQuestion(existing.length + i + 1),
        ),
      ]);
      setLoaded(true);
    } catch (x: any) {
      setError(x.message);
    }
  };
  useEffect(() => {
    load();
  }, [id]);
  const patchQuestion = (key: string, changes: any) =>
    setQuestions((list) =>
      list.map((q) => (q.localId === key ? { ...q, ...changes } : q)),
    );
  const examPayload = (questionTarget = Number(form.question_target)) => ({
    title: form.title,
    description: form.description,
    start: toTime(form.start),
    end: toTime(form.end),
    duration: Number(form.duration),
    correct_mark: cash(form.correct_mark),
    negative_mark: cash(form.negative_mark),
    pass_mark: cash(form.pass_mark),
    question_target: questionTarget,
    result_mode: form.result_mode,
    access_mode: form.access_mode,
    attempt_limit: Number(form.attempt_limit),
  });
  const saveExam = async () => {
    const result = await api(
      `admin/exams${id ? `/${id}` : ""}`,
      examPayload(),
      id ? "PATCH" : "POST",
    );
    toast.success("Exam settings saved");
    if (!id) window.location.href = `/admin/exams/${result.id}`;
    else await load();
  };
  const applyCount = (next: number) => {
    next = Math.max(0, Math.min(1000, next));
    if (next < questions.length && questions.slice(next).some((q) => q.id)) {
      setShrinkTo(next);
      return;
    }
    setForm({ ...form, question_target: next });
    setQuestions((list) =>
      next > list.length
        ? [
            ...list,
            ...Array.from({ length: next - list.length }, (_, i) =>
              blankQuestion(list.length + i + 1),
            ),
          ]
        : list.slice(0, next),
    );
  };
  const saveQuestion = async (q: any) => {
    if (
      !q.question.trim() ||
      q.options.length < 4 ||
      q.options.some((o: string) => !o.trim())
    )
      throw Error("Enter the question and every option before clicking Done.");
    const result = await api(
      `admin/exams/${id}/questions${q.id ? `/${q.id}` : ""}`,
      {
        question: q.question,
        options: q.options,
        correct_option: Number(q.correct_option),
        explanation: q.explanation || "",
        image: q.image || null,
        display_order: q.display_order,
      },
      q.id ? "PATCH" : "POST",
    );
    patchQuestion(q.localId, {
      id: q.id || result.id,
      completed: true,
      editing: false,
    });
    toast.success(`Question ${q.display_order} saved`);
  };
  if (!loaded) return <Loading />;
  return (
    <>
      <div className="section-head admin-page-heading">
        <div>
          <div className="eyebrow">MCQ EXAM BUILDER</div>
          <h1>{fresh ? "Create MCQ Exam" : "Edit MCQ Exam"}</h1>
          <p>
            Set the schedule and manage every question on this page. All
            displayed times use Asia/Dhaka and a 12-hour clock.
          </p>
        </div>
        {id && (
          <div className="actions wrap">
            <button
              className="btn outline"
              onClick={async () => {
                const link = await api(`admin/exams/${id}/link`, {});
                await navigator.clipboard.writeText(
                  location.origin + link.path,
                );
                toast.success("Exam link copied");
              }}
            >
              <Copy size={16} /> Copy Exam Link
            </button>
            <button
              className="btn outline"
              onClick={async () =>
                setQr(await api(`admin/exams/${id}/link`, {}))
              }
            >
              <QrCode size={16} /> QR Code
            </button>
          </div>
        )}
      </div>
      <ErrorBox error={error} />
      <form
        className="card exam-basics"
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          try {
            await saveExam();
          } catch (x: any) {
            setError(x.message);
          }
        }}
      >
        <div className="grid two">
          <Field
            label="Exam Name"
            required
            value={form.title}
            onChange={(e: any) => setForm({ ...form, title: e.target.value })}
          />
          <Field label="Result Visibility">
            <Choice
              label="Result visibility"
              value={form.result_mode}
              onChange={(result_mode: string) =>
                setForm({ ...form, result_mode })
              }
              options={[
                { value: "auto", label: "Automatically After Exam Closes" },
                { value: "immediate", label: "Immediately After Submission (With Correct Answers)" },
                { value: "manual", label: "Manually Publish Result" },
              ]}
            />
          </Field>
        </div>
        <Field label="Exam Description / Instructions">
          <textarea
            rows={4}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </Field>
        <div className="grid two">
          <Field label="Exam access"><select value={form.access_mode||"code"} onChange={e=>setForm({...form,access_mode:e.target.value})}><option value="open">Open · anyone can take this exam</option><option value="code">Assigned access code required</option></select></Field>
          <Field label="Attempts per learner / code"><input type="number" min="1" max="10" value={form.attempt_limit||1} onChange={e=>setForm({...form,attempt_limit:Number(e.target.value)})}/></Field>
        </div>
        <div className="grid two">
          <TimePicker
            label="Exam Start Time"
            value={form.start}
            onChange={(start: any) => setForm({ ...form, start })}
          />
          <TimePicker
            label="Exam End Time"
            value={form.end}
            onChange={(end: any) => setForm({ ...form, end })}
          />
        </div>
        <div className="grid four">
          <Field
            label="Duration (Minutes)"
            type="number"
            min="1"
            max="1440"
            required
            value={form.duration}
            onChange={(e: any) =>
              setForm({ ...form, duration: e.target.value })
            }
          />
          <Field
            label="Mark Per Correct Answer"
            value={form.correct_mark}
            onChange={(e: any) =>
              setForm({ ...form, correct_mark: e.target.value })
            }
          />
          <Field
            label="Negative Mark"
            value={form.negative_mark}
            onChange={(e: any) =>
              setForm({ ...form, negative_mark: e.target.value })
            }
          />
          <Field
            label="Pass Mark"
            value={form.pass_mark}
            onChange={(e: any) =>
              setForm({ ...form, pass_mark: e.target.value })
            }
          />
        </div>
        <div className="builder-count">
          <Field
            label="Number Of MCQ Questions"
            type="number"
            min="0"
            max="1000"
            value={form.question_target}
            onChange={(e: any) => applyCount(Number(e.target.value))}
          />
          <span>
            {completed} Completed · {Math.max(0, questions.length - completed)}{" "}
            Incomplete
          </span>
        </div>
        <button className="btn">
          {fresh ? "Save & Continue To Questions" : "Save Exam Settings"}
        </button>
      </form>
      {id&&<AccessCodesPanel type="exam" id={id}/>}
      {id && (
        <section className="card exam-controls">
          <div>
            <h2>
              Exam Controls <span className="badge">{form.status}</span>
            </h2>
            <p>
              Questions and scoring are locked after participation begins.
              Participants and rankings are managed from this Exam.
            </p>
          </div>
          <div className="actions wrap">
            {[
              ["publish", "Publish"],
              ["unpublish", "Unpublish"],
              ["start", "Start Now"],
              ["release", "Publish Results"],
            ].map(([action, label]) => (
              <button
                type="button"
                className="btn outline"
                key={action}
                onClick={async () => {
                  try {
                    await api(`admin/exams/${id}/action`, { action });
                    toast.success(`${label} complete`);
                    load();
                  } catch (x: any) {
                    toast.error(x.message);
                  }
                }}
              >
                {label}
              </button>
            ))}
            <button
              type="button"
              className="btn outline"
              onClick={() =>
                setExamAction({
                  action: "close",
                  title: "Close This Examination Now?",
                  description:
                    "Active attempts will finish at the closing time.",
                })
              }
            >
              Close Now
            </button>
            <a className="btn outline" href={`/admin/exams/${id}/ranking`}>
              Participants & Rankings
            </a>
            <button
              type="button"
              className="btn danger"
              onClick={() =>
                setExamAction({
                  action: "delete",
                  title: "Are You Sure You Want To Delete This Exam?",
                  description:
                    "The Exam, Questions, Answers, Attempts and Package schedule associations will be permanently deleted.",
                })
              }
            >
              Delete Exam
            </button>
          </div>
        </section>
      )}
      {id && (
        <section className="question-builder">
          <div className="section-head">
            <div>
              <div className="eyebrow">ONE-PAGE QUESTION BUILDER</div>
              <h2>MCQ Questions</h2>
              <p>Click Done to save each completed question permanently.</p>
            </div>
            <button
              className="btn"
              onClick={() => {
                const q = blankQuestion(questions.length + 1);
                setQuestions([...questions, q]);
                setForm({ ...form, question_target: questions.length + 1 });
              }}
            >
              <Plus size={16} /> Add Question
            </button>
          </div>
          {questions.map((q, index) => (
            <article
              className={`card builder-question ${q.editing ? "editing" : q.id ? "completed" : "incomplete"}`}
              key={q.localId}
            >
              <div className="builder-question-head">
                <div>
                  <span className="eyebrow">QUESTION {index + 1}</span>
                  <span className="badge">
                    {q.editing
                      ? "Currently Editing"
                      : q.id
                        ? "Completed"
                        : "Incomplete"}
                  </span>
                </div>
                <div className="actions">
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={`Edit question ${index + 1}`}
                    onClick={() => patchQuestion(q.localId, { editing: true })}
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    type="button"
                    className="icon-btn danger"
                    aria-label={`Delete question ${index + 1}`}
                    onClick={() => setRemove(q)}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              {q.editing ? (
                <div className="builder-fields">
                  <Field label="Question Text">
                    <textarea
                      rows={3}
                      value={q.question}
                      onChange={(e) =>
                        patchQuestion(q.localId, { question: e.target.value })
                      }
                    />
                  </Field>
                  {q.options.map((option: string, oi: number) => (
                    <div className="option-editor" key={oi}>
                      <Field
                        label={`Option ${String.fromCharCode(65 + oi)}`}
                        value={option}
                        onChange={(e: any) =>
                          patchQuestion(q.localId, {
                            options: q.options.map((x: string, j: number) =>
                              j === oi ? e.target.value : x,
                            ),
                          })
                        }
                      />
                      {q.options.length > 4 && (
                        <button
                          type="button"
                          className="icon-btn danger"
                          aria-label={`Remove option ${oi + 1}`}
                          onClick={() =>
                            patchQuestion(q.localId, {
                              options: q.options.filter(
                                (_: any, j: number) => j !== oi,
                              ),
                              correct_option: Math.min(
                                q.correct_option,
                                q.options.length - 2,
                              ),
                            })
                          }
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    className="text-link"
                    disabled={q.options.length >= 5}
                    onClick={() =>
                      patchQuestion(q.localId, { options: [...q.options, ""] })
                    }
                  >
                    + Add Option E
                  </button>
                  <div className="grid two">
                    <Field label="Correct Answer">
                      <Choice
                        label="Correct answer"
                        value={q.correct_option}
                        onChange={(v: string) =>
                          patchQuestion(q.localId, {
                            correct_option: Number(v),
                          })
                        }
                        options={q.options.map((_: any, i: number) => ({
                          value: i,
                          label: `Option ${String.fromCharCode(65 + i)}`,
                        }))}
                      />
                    </Field>
                    <Field label="Question Image (Optional)">
                      <QuestionImage
                        value={q.image}
                        onChange={(image: any) =>
                          patchQuestion(q.localId, { image })
                        }
                      />
                    </Field>
                  </div>
                  <Field label="Explanation">
                    <textarea
                      rows={3}
                      value={q.explanation}
                      onChange={(e) =>
                        patchQuestion(q.localId, {
                          explanation: e.target.value,
                        })
                      }
                    />
                  </Field>
                  <div className="builder-done">
                    <button
                      type="button"
                      className="btn"
                      onClick={async () => {
                        try {
                          await saveQuestion(q);
                        } catch (x: any) {
                          toast.error(x.message);
                        }
                      }}
                    >
                      <Check size={16} /> Done
                    </button>
                  </div>
                </div>
              ) : (
                <div className="question-summary">
                  <h3>{q.question}</h3>
                  <p className="correct-text">
                    Correct: {String.fromCharCode(65 + q.correct_option)}.{" "}
                    {q.options[q.correct_option]}
                  </p>
                  {q.explanation && <p>{q.explanation}</p>}
                </div>
              )}
            </article>
          ))}
          {!questions.length && (
            <div className="card">
              <p>
                Enter the number of MCQ questions above or use Add Question.
              </p>
            </div>
          )}
        </section>
      )}
      <Confirm
        open={!!remove}
        onOpenChange={(v: boolean) => !v && setRemove(null)}
        title="Are You Sure You Want To Delete This Question?"
        description="Only this question will be removed. Other questions and exam data will remain unchanged."
        action="Delete Question"
        onConfirm={async () => {
          try {
            if (remove.id)
              await api(
                `admin/exams/${id}/questions/${remove.id}`,
                undefined,
                "DELETE",
              );
            setQuestions(
              questions
                .filter((q) => q.localId !== remove.localId)
                .map((q, i) => ({ ...q, display_order: i + 1 })),
            );
            setRemove(null);
            toast.success("Question deleted");
          } catch (x: any) {
            toast.error(x.message);
          }
        }}
      />
      <Confirm
        open={shrinkTo !== null}
        onOpenChange={(v: boolean) => !v && setShrinkTo(null)}
        title="Reduce The Question Count?"
        description={`Questions after number ${shrinkTo ?? 0} will be permanently removed. This action affects only this exam.`}
        action="Remove Extra Questions"
        onConfirm={async () => {
          if (shrinkTo === null) return;
          try {
            for (const q of questions.slice(shrinkTo))
              if (q.id)
                await api(
                  `admin/exams/${id}/questions/${q.id}`,
                  undefined,
                  "DELETE",
                );
            await api(`admin/exams/${id}`, examPayload(shrinkTo), "PATCH");
            setQuestions(questions.slice(0, shrinkTo));
            setForm({ ...form, question_target: shrinkTo });
            setShrinkTo(null);
            toast.success("Question count updated and saved");
          } catch (x: any) {
            toast.error(x.message);
          }
        }}
      />
      <Dialog open={!!qr} onOpenChange={(v) => !v && setQr(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form.title} — Exam QR Code</DialogTitle>
          </DialogHeader>
          {qr && <ExamQr examId={id!} title={form.title} path={qr.path} />}
        </DialogContent>
      </Dialog>
      <Confirm
        open={!!examAction}
        onOpenChange={(v: boolean) => !v && setExamAction(null)}
        title={examAction?.title}
        description={examAction?.description}
        action={examAction?.action === "delete" ? "Delete Exam" : "Close Exam"}
        onConfirm={async () => {
          try {
            if (examAction.action === "delete") {
              await api(`admin/exams/${id}`, undefined, "DELETE");
              location.href = "/admin/exams";
            } else {
              await api(`admin/exams/${id}/action`, {
                action: examAction.action,
              });
              setExamAction(null);
              load();
              toast.success("Exam closed");
            }
          } catch (x: any) {
            toast.error(x.message);
          }
        }}
      />
    </>
  );
}
