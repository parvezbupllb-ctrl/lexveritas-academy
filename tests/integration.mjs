import { DatabaseSync } from "node:sqlite";
import { build } from "esbuild";
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
import { hash } from "bcryptjs";
import { randomBytes } from "node:crypto";
const sql = new DatabaseSync(":memory:");
sql.exec("PRAGMA foreign_keys=ON");
for (const f of readdirSync("drizzle")
  .filter((f) => f.endsWith(".sql"))
  .sort())
  sql.exec(readFileSync("drizzle/" + f, "utf8"));
const wrap = (query, values = []) => ({
  bind(...v) {
    return wrap(query, v);
  },
  async first() {
    return sql.prepare(query).get(...values) || null;
  },
  async all() {
    return { results: sql.prepare(query).all(...values) };
  },
  async run() {
    const r = sql.prepare(query).run(...values);
    return { meta: { changes: Number(r.changes) } };
  },
});
const bucket = new Map();
globalThis.__testEnv = {
  DB: {
    prepare: wrap,
    async batch(list) {
      sql.exec("BEGIN");
      try {
        const results = [];
        for (const s of list) results.push(await s.run());
        sql.exec("COMMIT");
        return results;
      } catch (e) {
        sql.exec("ROLLBACK");
        throw e;
      }
    },
  },
  BUCKET: {
    async put(id, bytes, meta) {
      bucket.set(id, { bytes, meta });
    },
    async get(id) {
      const o = bucket.get(id);
      return o ? { body: o.bytes } : null;
    },
  },
};
mkdirSync(".sites-runtime/tests", { recursive: true });
await build({
  entryPoints: ["lib/server.ts"],
  outfile: ".sites-runtime/tests/server.mjs",
  bundle: true,
  platform: "node",
  format: "esm",
  plugins: [
    {
      name: "test-d1",
      setup(b) {
        b.onResolve({ filter: /^cloudflare:workers$/ }, () => ({
          path: "test-env",
          namespace: "test",
        }));
        b.onLoad({ filter: /.*/, namespace: "test" }, () => ({
          contents: "export const env=globalThis.__testEnv;",
          loader: "js",
        }));
      },
    },
  ],
});
const { handle } = await import("../.sites-runtime/tests/server.mjs");
const adminPassword = randomBytes(24).toString("hex");
sql
  .prepare(
    "INSERT INTO admins(id,username,password_hash,must_change,created_at) VALUES(?,?,?,?,?)",
  )
  .run(
    "admin",
    "lexveritas_admin",
    await hash(adminPassword, 4),
    0,
    Date.now(),
  );
sql.prepare("INSERT INTO settings VALUES('initial_codes_seeded','true')").run();
let checks = 0;
function ok(condition, label) {
  assert.ok(condition, label);
  checks++;
  console.log("PASS", label);
}
function client() {
  let cookies = {};
  return {
    cookies,
    async req(path, b, method) {
      const r = await handle(
        new Request("https://academy.test/api/" + path, {
          method: method || (b ? "POST" : "GET"),
          headers: {
            Origin: "https://academy.test",
            "X-LVA-Request": "1",
            "Content-Type": "application/json",
            Cookie: Object.entries(cookies)
              .map(([k, v]) => k + "=" + v)
              .join("; "),
          },
          body: b ? JSON.stringify(b) : undefined,
        }),
      );
      const ck = r.headers.get("set-cookie");
      if (ck) {
        let [k, v] = ck.split(";")[0].split("=");
        cookies[k] = v;
      }
      const ct = r.headers.get("content-type") || "";
      let d = ct.includes("application/json") ? await r.json() : await r.text();
      return { status: r.status, d, headers: r.headers };
    },
  };
}
const admin = client(),
  anon = client();
let r = await admin.req("login", {
  username: "lexveritas_admin",
  password: adminPassword,
});
ok(r.status === 200, "Admin password login");
ok(
  r.headers.get("set-cookie").includes("HttpOnly") &&
    r.headers.get("set-cookie").includes("Secure"),
  "Secure HTTP-only admin cookie",
);
for (const endpoint of [
  "dashboard",
  "codes",
  "settings",
  "exams",
  "packages",
  "books",
  "team",
  "notices",
  "courses",
  "notes",
  "authors",
  "blogs",
  "reviews",
  "orders/hardcopy",
  "orders/softcopy",
  "orders/package",
  "orders/course",
])
  ok(
    (await anon.req("admin/" + endpoint)).status === 401,
    "Unauthenticated admin " + endpoint + " blocked",
  );
const mkExam = async (title) => {
  let now = Date.now();
  const out = await admin.req("admin/exams", {
    title,
    description: "Test instructions",
    start: now - 60000,
    end: now + 3600000,
    duration: 60,
    correct_mark: 100,
    negative_mark: 25,
    result_mode: "manual",
  });
  assert.equal(out.status, 200, JSON.stringify(out));
  const e = sql.prepare("SELECT * FROM exams WHERE title=?").get(title);
  for (let i = 0; i < 3; i++) {
    const q = await admin.req("admin/exams/" + e.id + "/questions", {
      question: "প্রশ্ন " + (i + 1),
      options: ["ক", "খ", "গ", "ঘ"],
      correct_option: 0,
      explanation: "ব্যাখ্যা",
      display_order: i,
    });
    assert.equal(q.status, 200, JSON.stringify(q));
  }
  assert.equal(
    (await admin.req("admin/exams/" + e.id + "/action", { action: "publish" }))
      .status,
    200,
  );
  return e;
};
const a = await mkExam("Exam A"),
  b = await mkExam("Exam B");
for (let i = 0; i < 5; i++)
  sql
    .prepare("INSERT INTO codes VALUES(?,?,?,?)")
    .run("c" + i, "LVA-TEST-CODE-" + i, i === 4 ? 0 : 1, Date.now());
ok(
  (await anon.req("exams")).d.length === 0,
  "Individual MCQ Exams are not publicly discoverable",
);
ok(
  (await anon.req("exams/" + a.id)).status === 403,
  "Direct Exam detail requires an authorized route",
);
ok(
  (await anon.req("exams/" + a.id + "?access=" + a.direct_token)).status ===
    200,
  "Admin-generated direct Exam link works",
);
const student = client(),
  student2 = client();
const entry = {
  name: "রহিম উদ্দিন",
  university: "ঢাকা বিশ্ববিদ্যালয়",
  code: "LVA-TEST-CODE-0",
  access: a.direct_token,
};
r = await student.req("exams/" + a.id + "/start", entry);
ok(r.status === 200, "1. First exam attempt allowed");
const aid = r.d.id;
ok(
  (await student2.req("exams/" + a.id + "/start", entry)).status === 400,
  "2. Same code + same exam from another browser blocked",
);
ok(
  (await student.req("exams/" + a.id + "/start", entry)).d.id === aid,
  "Refresh recovery retains original attempt",
);
ok(
  (
    await student.req("exams/" + b.id + "/start", {
      ...entry,
      access: b.direct_token,
    })
  ).status === 200,
  "3. Same code + different exam allowed",
);
ok(
  (await student.req("exams/" + a.id + "/start", { ...entry, code: "INVALID" }))
    .status === 400,
  "4. Invalid code blocked",
);
ok(
  (
    await student.req("exams/" + a.id + "/start", {
      ...entry,
      code: "LVA-TEST-CODE-4",
    })
  ).status === 400,
  "5. Inactive code blocked",
);
r = await student.req("attempts/" + aid);
ok(
  !JSON.stringify(r.d).includes("correct_option") &&
    !JSON.stringify(r.d).includes("explanation"),
  "8. No answer key or explanation before results",
);
ok(r.d.deadline <= a.end, "Deadline never exceeds official closing time");
let questions = r.d.questions;
ok(
  (
    await student.req("attempts/" + aid + "/answers", {
      questionId: questions[0].id,
      selected: 0,
    })
  ).status === 200,
  "Save answer",
);
ok(
  (
    await student.req("attempts/" + aid + "/answers", {
      questionId: questions[1].id,
      selected: 1,
    })
  ).status === 200,
  "Save wrong answer",
);
ok(
  (await student2.req("attempts/" + aid)).status === 403,
  "Attempt details protected across browsers",
);
r = await student.req("attempts/" + aid + "/submit", {});
ok(r.status === 200 && r.d.status === "submitted", "Manual submission");
ok(r.d.result === null, "Submitted marks hidden until release");
ok(
  (
    await student.req("attempts/" + aid + "/answers", {
      questionId: questions[0].id,
      selected: 2,
    })
  ).status === 400,
  "Final answers cannot be changed",
);
ok(
  (await student.req("attempts/" + aid + "/submit", {})).status === 200,
  "Duplicate submission idempotent",
);
let scored = sql.prepare("SELECT * FROM attempts WHERE id=?").get(aid);
ok(
  scored.correct === 1 &&
    scored.wrong === 1 &&
    scored.unanswered === 1 &&
    scored.score === 75,
  "7. Negative marking 1 - 0.25 = 0.75",
);
const expiry = client();
r = await expiry.req("exams/" + b.id + "/start", {
  ...entry,
  code: "LVA-TEST-CODE-1",
  access: b.direct_token,
});
const eid = r.d.id;
sql
  .prepare("UPDATE attempts SET deadline=? WHERE id=?")
  .run(Date.now() - 1000, eid);
r = await expiry.req("attempts/" + eid);
ok(r.d.status === "submitted", "6. Expired attempt auto-finalized on access");
const c1 = client(),
  c2 = client();
let concurrent = await Promise.all([
  c1.req("exams/" + a.id + "/start", { ...entry, code: "LVA-TEST-CODE-2" }),
  c2.req("exams/" + a.id + "/start", { ...entry, code: "LVA-TEST-CODE-2" }),
]);
ok(
  concurrent.filter((v) => v.status === 200).length === 1 &&
    sql
      .prepare("SELECT COUNT(*) n FROM attempts WHERE exam_id=? AND code_id=?")
      .get(a.id, "c2").n === 1,
  "17. Concurrent requests create exactly one attempt",
);
ok(
  (
    await admin.req("admin/exams/" + a.id + "/questions", {
      question: "Late",
      options: ["1", "2", "3", "4"],
      correct_option: 0,
      display_order: 10,
    })
  ).status === 400,
  "Exam questions locked after attempts",
);
ok(
  (await admin.req("admin/exams/" + a.id + "/action", { action: "release" }))
    .status === 400,
  "Early answer release blocked",
);
ok(
  (await admin.req("admin/exams/" + a.id + "/action", { action: "close" }))
    .status === 200,
  "Admin closes exam and finalizes active attempts",
);
ok(
  (await admin.req("admin/exams/" + a.id + "/action", { action: "release" }))
    .status === 200,
  "Admin releases results after closing",
);
r = await student.req("attempts/" + aid);
ok(
  r.d.result.score === 75 &&
    r.d.result.position === 1 &&
    r.d.questions[0].correct_option === 0,
  "Released score, deterministic rank and review available",
);
ok(
  (await anon.req("lookup", { exam: a.id, code: entry.code })).d.result
    .score === 75,
  "Result lookup needs no student account",
);
const createBook = async (type) => {
  const v = await admin.req("admin/books", {
    title: "Test " + type,
    type,
    price: 50000,
    description: "Test law material",
    cover: null,
    preview: null,
    digital: null,
    available: true,
    published: true,
  });
  assert.equal(v.status, 200, JSON.stringify(v));
  return sql.prepare("SELECT id FROM books WHERE type=?").get(type).id;
};
const hard = await createBook("hardcopy"),
  soft = await createBook("softcopy");
const order = {
  type: "hardcopy",
  name: "Test Buyer",
  phone: "01712345678",
  trx: "TESTTRX123",
  address: "Test address, Dhaka",
  items: [{ id: hard, quantity: 1 }],
  delivery: "sundarban",
  paymentType: "cod",
};
ok(
  (await anon.req("orders", order)).status === 400,
  "9. COD + Sundarban blocked",
);
for (const delivery of ["dhaka", "outside"]) {
  r = await anon.req("orders", { ...order, delivery });
  ok(
    r.status === 201,
    (delivery === "dhaka" ? "10." : "11.") + " COD " + delivery + " allowed",
  );
  const o = sql.prepare("SELECT * FROM hard_orders WHERE id=?").get(r.d.id);
  ok(
    o.total === 50000 + (delivery === "dhaka" ? 8000 : 11000),
    "13. Hardcopy subtotal + one delivery charge",
  );
  ok(
    o.paid === (delivery === "dhaka" ? 8000 : 11000),
    "14. COD paid amount is delivery only",
  );
  ok(o.due === 50000, "15. COD amount due equals book subtotal");
  ok(o.verified === 0, "Manual TrxID remains unverified");
}
r = await anon.req("orders", { ...order, paymentType: "full" });
ok(r.status === 201, "12. Full pay + Sundarban allowed");
const oid = r.d.id;
r = await admin.req("admin/orders/hardcopy");
ok(
  r.d.rows.every((x) => x.trx_count >= 3),
  "Duplicate TrxIDs flagged for manual review",
);
ok(
  !JSON.stringify(r.d).includes("token_hash"),
  "Admin lists omit order authorization tokens",
);
for (const field of ["verified", "delivered", "received"]) {
  ok(
    (
      await admin.req(
        "admin/orders/hardcopy/" + oid,
        { field, value: true },
        "PATCH",
      )
    ).status === 200,
    "Hardcopy " + field + " switch",
  );
  ok(
    sql.prepare("SELECT * FROM hard_orders WHERE id=?").get(oid)[
      field + "_at"
    ] > 0,
    field + " timestamp saved",
  );
}
r = await anon.req("orders", {
  type: "softcopy",
  bookId: soft,
  name: "Test Buyer",
  phone: "01712345678",
  trx: "SOFTTEST1",
});
ok(r.status === 201, "Softcopy order without address");
const soid = r.d.id;
ok(
  (await anon.req("orders/" + soid + "/download")).status === 403,
  "Softcopy download blocked before verification",
);
const upload = new FormData();
upload.append("kind", "digital");
upload.append(
  "file",
  new File(["%PDF-1.4\n%%EOF"], "law.pdf", { type: "application/pdf" }),
);
const ur = await handle(
  new Request("https://academy.test/api/admin/upload", {
    method: "POST",
    headers: {
      Origin: "https://academy.test",
      Cookie: Object.entries(admin.cookies)
        .map(([k, v]) => k + "=" + v)
        .join("; "),
    },
    body: upload,
  }),
);
const ud = await ur.json();
ok(ur.status === 200, "Authorized PDF upload");
sql.prepare("UPDATE books SET digital=? WHERE id=?").run(ud.id, soft);
ok(
  (await anon.req("files/" + ud.id)).status === 404,
  "Private raw file URL blocked",
);
await admin.req(
  "admin/orders/softcopy/" + soid,
  { field: "verified", value: true },
  "PATCH",
);
ok(
  (await anon.req("orders/" + soid)).d.downloadAvailable === true,
  "Verified softcopy order creates a download option",
);
ok(
  (await anon.req("orders/" + soid + "/download")).status === 200,
  "Verified buyer can download protected softcopy once",
);
ok(
  (await anon.req("orders/" + soid + "/download")).status === 410,
  "Softcopy second download is blocked server-side",
);
r = await anon.req("orders/" + soid);
ok(
  r.d.downloadAvailable === false && r.d.downloadedAt > 0,
  "Used download is removed from the buyer order page",
);
ok(
  (await client().req("orders/" + soid)).status === 403,
  "Orders protected from other browsers",
);
// Exam package purchase, verification, access restriction, and order deletion.
r = await admin.req("admin/packages", {
  title: "BJS Model Test Package",
  description: "Three scheduled model tests",
  thumbnail: null,
  details: "Complete package details",
  price: 90000,
  status: "active",
  maxParticipants: 500,
  accessDays: 30,
  available: true,
  published: true,
  examIds: [a.id, b.id],
  routines: [
    {
      exam_id: b.id,
      start: Date.now() - 60000,
      end: Date.now() + 3600000,
      display_order: 1,
    },
  ],
});
ok(
  r.status === 200,
  "Admin creates a multi-exam package with seats, duration and Routine",
);
const packageId = r.d.id;
ok(
  sql
    .prepare("SELECT COUNT(*) n FROM package_routines WHERE package_id=?")
    .get(packageId).n === 1,
  "Package Routine persists in the database",
);
r = await anon.req("packages/" + packageId);
ok(
  r.status === 200 && r.d.exams.length === 2,
  "Public package shows every included exam and schedule",
);
const packageBuyer = client();
r = await packageBuyer.req("orders", {
  type: "package",
  packageId,
  name: "Package Buyer",
  phone: "01712345678",
  trx: "PACKAGETRX1",
});
ok(r.status === 201, "Package purchase follows softcopy-style checkout");
const poid = r.d.id;
r = await packageBuyer.req("orders/" + poid);
ok(
  !r.d.accessCode && !r.d.verified,
  "Package code hidden before payment verification",
);
ok(
  (
    await admin.req(
      "admin/orders/package/" + poid,
      { field: "verified", value: true },
      "PATCH",
    )
  ).status === 200,
  "Admin verifies package payment",
);
r = await packageBuyer.req("orders/" + poid);
ok(
  r.d.verified &&
    /^LVA-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(r.d.accessCode),
  "Verified package buyer receives a secure access code",
);
const packageCode = r.d.accessCode,
  packageStudent = client();
const packageAttempt = await packageStudent.req("exams/" + b.id + "/start", {
  name: "Package Student",
  university: "University",
  code: packageCode,
});
ok(packageAttempt.status === 200, "Package code enters an included exam");
const outside = await mkExam("Exam outside package");
ok(
  (
    await packageStudent.req("exams/" + outside.id + "/start", {
      name: "Package Student",
      university: "University",
      code: packageCode,
    })
  ).status === 400,
  "Package code is blocked from exams outside the package",
);
ok(
  (
    await admin.req(
      "admin/exams/" + b.id + "/participants/" + packageAttempt.d.id,
      undefined,
      "DELETE",
    )
  ).status === 200,
  "Admin removes an individual Exam participant",
);
ok(
  !sql.prepare("SELECT id FROM attempts WHERE id=?").get(packageAttempt.d.id),
  "Participant removal persists without affecting other attempts",
);
ok(
  (await admin.req("admin/orders/package/" + poid, undefined, "DELETE"))
    .status === 200,
  "Admin can delete a package order",
);
ok(
  sql.prepare("SELECT active FROM codes WHERE code=?").get(packageCode)
    .active === 0,
  "Deleting package order deactivates its access code",
);
const softDeleteBuyer = client();
r = await softDeleteBuyer.req("orders", {
  type: "softcopy",
  bookId: soft,
  name: "Delete Buyer",
  phone: "01712345678",
  trx: "DELETE-SOFT",
});
ok(
  (await admin.req("admin/orders/softcopy/" + r.d.id, undefined, "DELETE"))
    .status === 200,
  "Admin can delete softcopy orders",
);
const hardDeleteBuyer = client();
r = await hardDeleteBuyer.req("orders", {
  ...order,
  trx: "DELETE-HARD",
  delivery: "dhaka",
});
ok(
  (await admin.req("admin/orders/hardcopy/" + r.d.id, undefined, "DELETE"))
    .status === 200,
  "Admin can delete hardcopy orders and items",
);
// Persistent Team, Notice, Course and Notes management.
r = await anon.req("team");
ok(
  r.status === 200 &&
    r.d.some(
      (x) =>
        x.name === "MD. Parvez Mosarof" &&
        x.photo === "/assets/md-parvez-mosarof.jpeg",
    ),
  "Instructor profile is persistently seeded with supplied image",
);
r = await admin.req("admin/team", {
  name: "Second Instructor",
  role: "Instructor",
  details: "LL.B.",
  photo: null,
  active: true,
  display_order: 2,
});
const teamId = r.d.id;
ok(
  r.status === 200 && (await anon.req("team")).d.some((x) => x.id === teamId),
  "Admin creates a public team member",
);
ok(
  (
    await admin.req(
      "admin/team/" + teamId,
      {
        name: "Updated Instructor",
        role: "Mentor",
        details: "LL.M.",
        photo: null,
        active: false,
        display_order: 2,
      },
      "PATCH",
    )
  ).status === 200,
  "Admin edits and deactivates a team member",
);
ok(
  !(await anon.req("team")).d.some((x) => x.id === teamId),
  "Inactive team member is hidden publicly",
);
ok(
  (await admin.req("admin/team/" + teamId, undefined, "DELETE")).status === 200,
  "Admin deletes a team member",
);
const noticeUpload = new FormData();
noticeUpload.append("kind", "noticeAttachment");
noticeUpload.append(
  "file",
  new File(["%PDF-1.4\n%%EOF"], "notice.pdf", { type: "application/pdf" }),
);
const noticeUploadResponse = await handle(
  new Request("https://academy.test/api/admin/upload", {
    method: "POST",
    headers: {
      Origin: "https://academy.test",
      Cookie: Object.entries(admin.cookies)
        .map(([k, v]) => k + "=" + v)
        .join("; "),
    },
    body: noticeUpload,
  }),
);
const noticeUploadData = await noticeUploadResponse.json();
ok(
  noticeUploadResponse.status === 200,
  "Admin uploads a PDF notice attachment",
);
r = await admin.req("admin/notices", {
  title: "Admission Notice",
  content: "Course enrollment is open.",
  attachment: noticeUploadData.id,
  notice_date: Date.now(),
  published: true,
});
const noticeId = r.d.id;
ok(
  (await anon.req("notices")).d[0].id === noticeId,
  "Published notice appears newest first",
);
r = await anon.req("notices/" + noticeId);
ok(
  r.status === 200 &&
    r.d.attachment === noticeUploadData.id &&
    r.d.attachment_mime === "application/pdf",
  "Notice detail exposes its inline PDF attachment",
);
r = await anon.req("notices/" + noticeId + "/download");
ok(
  r.status === 200 &&
    r.headers.get("content-disposition").startsWith("attachment"),
  "Notice attachment has a separate download route",
);
ok(
  (
    await admin.req(
      "admin/notices/" + noticeId,
      {
        title: "Updated Notice",
        content: "Updated content.",
        notice_date: Date.now(),
        published: false,
      },
      "PATCH",
    )
  ).status === 200,
  "Admin edits and unpublishes a notice",
);
ok(
  !(await anon.req("notices")).d.some((x) => x.id === noticeId),
  "Unpublished notice is hidden publicly",
);
ok(
  (await admin.req("admin/notices/" + noticeId, undefined, "DELETE")).status ===
    200,
  "Admin deletes a notice",
);
r = await admin.req("admin/courses", {
  name: "BJS Complete Course",
  thumbnail: null,
  description: "Structured preparation",
  class_count: 20,
  exam_count: 15,
  sheet_count: 30,
  price: 120000,
  details: "Full course details",
  package_id: packageId,
  active: true,
  published: true,
});
const courseId = r.d.id;
ok(
  r.status === 200 &&
    (await anon.req("courses")).d.some((x) => x.id === courseId),
  "Published course appears publicly",
);
r = await anon.req("courses/" + courseId);
ok(
  r.d.class_count === 20 && r.d.exam_count === 15 && r.d.sheet_count === 30,
  "Course details expose classes, exams and lecture sheets",
);
const courseBuyer = client();
r = await courseBuyer.req("orders", {
  type: "course",
  courseId,
  name: "Course Buyer",
  phone: "01712345678",
  trx: "COURSETRX1",
});
const courseOrderId = r.d.id;
ok(r.status === 201, "Course enrollment order uses manual payment flow");
ok(
  (
    await admin.req(
      "admin/orders/course/" + courseOrderId,
      { field: "verified", value: true },
      "PATCH",
    )
  ).status === 200,
  "Admin verifies course enrollment payment",
);
r = await courseBuyer.req("orders/" + courseOrderId);
ok(
  r.d.verified && r.d.type === "course" && r.d.accessCode,
  "Verified linked course receives exam access code",
);
ok(
  (
    await admin.req(
      "admin/courses/" + courseId,
      {
        name: "BJS Complete Course",
        thumbnail: null,
        description: "Updated",
        class_count: 20,
        exam_count: 15,
        sheet_count: 30,
        price: 120000,
        details: "Updated details",
        package_id: packageId,
        active: true,
        published: false,
      },
      "PATCH",
    )
  ).status === 200,
  "Admin edits and unpublishes a course",
);
ok(
  !(await anon.req("courses")).d.some((x) => x.id === courseId),
  "Unpublished course is hidden publicly",
);
r = await admin.req("admin/notes", {
  category: "bjs",
  title: "Constitution Note",
  description: "Preview note",
  thumbnail: null,
  file: null,
  link: "https://example.com/note.pdf",
  published: true,
});
const noteId = r.d.id;
ok(
  r.status === 200 &&
    (await anon.req("notes/bjs")).d.some((x) => x.id === noteId),
  "Published note appears in selected category",
);
ok(
  !(await anon.req("notes/bar")).d.some((x) => x.id === noteId),
  "Note does not leak into another category",
);
ok(
  (await anon.req("notes/" + noteId + "/download")).status === 302,
  "Published Note download route works",
);
ok(
  (await anon.req("notes/bjs")).d.find((x) => x.id === noteId)
    .download_count === 1,
  "Visitor sees persistent Note download count",
);
ok(
  (await admin.req("admin/notes/" + noteId)).d.download_count === 1,
  "Admin sees persistent Note download count",
);
ok(
  (
    await admin.req(
      "admin/notes/" + noteId,
      {
        category: "general",
        title: "General Note",
        description: "Updated",
        thumbnail: null,
        file: null,
        link: "https://example.com/note.pdf",
        published: false,
      },
      "PATCH",
    )
  ).status === 200,
  "Admin edits note category and publication",
);
ok(
  (await admin.req("admin/notes/" + noteId, undefined, "DELETE")).status ===
    200,
  "Admin deletes a note",
);
// Blog CRUD, selectable DOCX-style HTML preservation and sanitization.
r = await admin.req("admin/blogs", {
  title: "Constitutional Guidance",
  slug: "বাংলা-আইন-ব্লগ",
  thumbnail: null,
  excerpt: "A short legal guide.",
  author_name: "Test Author",
  author_photo: null,
  author_description: "Legal educator",
  content:
    '<h2>Heading</h2><p style="text-align:center;margin-left:40px;color:red"><strong>Bold</strong> and <em>italic</em> <a href="https://example.com">link</a>.</p><script>alert(1)</script><table><tbody><tr><td>Cell</td></tr></tbody></table>',
  publish_date: Date.now(),
  published: true,
});
const blogId = r.d.id;
const blogAuthorId = r.d.author_id;
ok(
  r.status === 200 && !!blogAuthorId,
  "Admin creates a Blog and saves its author profile",
);
r = await anon.req("blogs/" + encodeURIComponent("বাংলা-আইন-ব্লগ"));
ok(
  r.status === 200 &&
    r.d.content.includes("<strong>Bold</strong>") &&
    r.d.content.includes("<em>italic</em>") &&
    r.d.content.includes('style="text-align:center;margin-left:40px"') &&
    !r.d.content.includes("color:red") &&
    r.d.content.includes("<table>") &&
    !r.d.content.includes("<script"),
  "Encoded Blog URL works and safe rich formatting is preserved",
);
ok(
  (await admin.req("admin/authors")).d.some(
    (author) => author.id === blogAuthorId && author.name === "Test Author",
  ),
  "Saved author appears in the searchable author library",
);
r = await anon.req("authors/test-author");
ok(
  r.status === 200 &&
    r.d.name === "Test Author" &&
    r.d.blogs.some((blog) => blog.id === blogId),
  "Clickable author profile lists the author's Blogs",
);
ok(
  (
    await admin.req("admin/blogs", {
      title: "Excerpt Limit Test",
      slug: "excerpt-limit-test",
      thumbnail: null,
      excerpt: Array.from({ length: 51 }, () => "word").join(" "),
      author_name: "Test Author",
      author_photo: null,
      author_description: "Legal educator",
      content: "<p>Content</p>",
      publish_date: Date.now(),
      published: false,
    })
  ).status === 400,
  "Blog Short Excerpt enforces the 50-word limit",
);
ok(
  (
    await admin.req(
      "admin/blogs/" + blogId,
      {
        title: "Constitutional Guidance",
        slug: "বাংলা-আইন-ব্লগ",
        thumbnail: null,
        excerpt: Array.from({ length: 50 }, () => "word").join(" "),
        author_name: "Test Author",
        author_photo: null,
        author_description: "Legal educator",
        content: "<p>Content</p>",
        publish_date: Date.now(),
        published: true,
      },
      "PATCH",
    )
  ).status === 200,
  "Blog Short Excerpt accepts exactly 50 words",
);
ok(
  (
    await admin.req(
      "admin/blogs/" + blogId,
      {
        title: "Updated Guidance",
        slug: "বাংলা-আইন-ব্লগ",
        thumbnail: null,
        excerpt: "Updated",
        author_name: "Test Author",
        author_photo: null,
        author_description: "Legal educator",
        content: "<p>Updated content</p>",
        publish_date: Date.now(),
        published: false,
      },
      "PATCH",
    )
  ).status === 200,
  "Admin edits and unpublishes a Blog",
);
ok(
  (await anon.req("blogs")).d.every((x) => x.id !== blogId),
  "Draft Blog is hidden publicly",
);
ok(
  (await admin.req("admin/blogs/" + blogId, undefined, "DELETE")).status ===
    200,
  "Admin deletes a Blog",
);
// Academy-verified reviews are persistent and require every public visibility flag.
r = await admin.req("admin/reviews", {
  review_text: "A detailed and useful review for testing.",
  reviewer_name: "Review Tester",
  reviewer_photo: null,
  university: "Test University",
  verified: false,
  published: true,
  active: true,
  display_order: 2,
});
const reviewId = r.d.id;
ok(
  r.status === 200 &&
    !(await anon.req("reviews")).d.some((x) => x.id === reviewId),
  "Unverified review remains private",
);
ok(
  (
    await admin.req(
      "admin/reviews/" + reviewId,
      {
        review_text: "An updated, detailed and useful review.",
        reviewer_name: "Review Tester",
        reviewer_photo: null,
        university: "Updated University",
        verified: true,
        published: true,
        active: true,
        display_order: 1,
      },
      "PATCH",
    )
  ).status === 200,
  "Admin edits and approves a verified review",
);
r = await anon.req("reviews");
ok(
  r.d.some((x) => x.id === reviewId && x.university === "Updated University"),
  "Only approved, published and active review appears publicly",
);
ok(
  (await admin.req("admin/reviews/" + reviewId, undefined, "DELETE")).status ===
    200 && !(await anon.req("reviews")).d.some((x) => x.id === reviewId),
  "Admin deletes a verified review persistently",
);
// Extensive Settings remain persistent and public components read one authoritative configuration.
const originalSettings = (await admin.req("admin/settings")).d;
const changedSettings = {
  ...originalSettings,
  websiteName: "LexVeritas Test Academy",
  brandText: "Test Brand",
  heroTitle: "Test Homepage Heading",
  heroPrimaryText: "Test Explore",
  heroPrimaryUrl: "/packages",
  noticeTitle: "Test Notices",
  teamTitle: "Test Team",
  blogTitle: "Test Blog",
  reviewsTitle: "Test Reviews",
  stat1Label: "Learners",
  stat1Value: "7000+",
  footerDescription: "Test Footer",
  whatsapp: "01712345678",
  primaryColor: "#123456",
};
ok(
  (await admin.req("admin/settings", changedSettings, "PATCH")).status === 200,
  "Admin saves extensive Website Settings",
);
r = await anon.req("settings");
ok(
  r.d.websiteName === "LexVeritas Test Academy" &&
    r.d.heroTitle === "Test Homepage Heading" &&
    r.d.primaryColor === "#123456" &&
    r.d.stat1Value === "7000+" &&
    r.d.reviewsTitle === "Test Reviews",
  "Public Settings and statistics persist after refresh",
);
ok(
  (await admin.req("admin/settings", originalSettings, "PATCH")).status === 200,
  "Default Website Settings restore without changing existing design",
);
const homeSource = readFileSync("app/site.tsx", "utf8"),
  cssSource = readFileSync("app/globals.css", "utf8");
ok(
  !homeSource.includes("A SIMPLE WAY TO BEGIN") &&
    homeSource.includes("footer-admin-entry"),
  "Old learning steps are removed and Bangladesh provides the discreet Admin entry",
);
ok(
  cssSource.includes("color:#FFFFFF!important") &&
    homeSource.includes('className="book-cover-flat"'),
  "Hero CTA uses exact white and Book covers use the requested flat presentation",
);
ok(
  homeSource.includes(
    'const coverHref = b.preview ? "/api/files/" + b.preview',
  ) && homeSource.includes("Open preview PDF for"),
  "Book cover opens its uploaded preview PDF when available",
);
ok(
  homeSource.includes("usesAcademyWordmark") &&
    cssSource.includes(".brand-wordmark .brand-logo-full img") &&
    cssSource.includes("object-fit:contain"),
  "Header preserves the supplied logo wordmark without cropping or stretching",
);
const csrf = await handle(
  new Request("https://academy.test/api/admin/settings", {
    method: "PATCH",
    headers: {
      Origin: "https://evil.test",
      "Content-Type": "application/json",
    },
    body: "{}",
  }),
);
ok(csrf.status === 403, "Cross-origin mutation rejected");
ok(
  (await admin.req("admin/exams/" + a.id, undefined, "DELETE")).status === 200,
  "Admin can delete an Exam even when attempts exist",
);
ok(
  !sql.prepare("SELECT id FROM attempts WHERE exam_id=?").get(a.id) &&
    !sql.prepare("SELECT id FROM exams WHERE id=?").get(a.id),
  "Exam deletion removes its attempts and related records",
);
await admin.req("admin/books/" + hard, undefined, "DELETE");
ok(
  sql.prepare("SELECT published FROM books WHERE id=?").get(hard).published ===
    0 &&
    sql.prepare("SELECT COUNT(*) n FROM hard_items WHERE book_id=?").get(hard)
      .n > 0,
  "Historical book order snapshots preserved",
);

// Verify an empty deployment initializes the requested hashed admin and 10,000 codes.
sql.exec("PRAGMA foreign_keys=OFF");
for (const t of ["sessions", "admins", "settings", "codes"])
  sql.exec("DELETE FROM " + t);
sql.exec("PRAGMA foreign_keys=ON");
globalThis.__testEnv.INITIAL_ADMIN_HASH = await hash(adminPassword, 4);
r = await anon.req("settings");
ok(r.status === 200, "Initial site bootstrap succeeds");
ok(
  sql.prepare("SELECT COUNT(*) n FROM codes").get().n === 10000,
  "Initial seed creates exactly 10,000 access codes",
);
await Promise.all([anon.req("settings"), anon.req("settings")]);
ok(
  sql.prepare("SELECT COUNT(*) n FROM codes").get().n === 10000,
  "Seed is idempotent",
);
const boot = client();
r = await boot.req("login", {
  username: "lexveritas_admin",
  password: adminPassword,
});
ok(r.d.mustChange === true, "Temporary admin password must be changed");
ok(
  (await boot.req("admin/dashboard")).status === 403,
  "Temporary password cannot access management",
);
const newPassword = randomBytes(24).toString("hex");
ok(
  (
    await boot.req("admin/password", {
      current: adminPassword,
      password: newPassword,
    })
  ).status === 200,
  "Admin password change succeeds",
);
ok(
  (await boot.req("admin/me")).status === 401,
  "Password change revokes old sessions",
);
ok(
  (
    await boot.req("login", {
      username: "lexveritas_admin",
      password: newPassword,
    })
  ).status === 200,
  "Changed password can log in",
);
console.log(
  `\n${checks} integration assertions passed against the actual API and migrated SQLite schema.`,
);
writeFileSync(
  ".sites-runtime/tests/results.json",
  JSON.stringify(
    { checks, passed: true, date: new Date().toISOString() },
    null,
    2,
  ),
);
