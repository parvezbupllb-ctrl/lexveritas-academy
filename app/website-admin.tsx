"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUp,
  Copy,
  Eye,
  FileText,
  GripVertical,
  History,
  Monitor,
  MoreHorizontal,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  Search,
  Smartphone,
  Tablet,
  Trash2,
  Undo2,
} from "lucide-react";
import { api, EmptyState, ErrorBox, Field, Loading, date } from "@/lib/client";
import { MediaUpload } from "./media-upload";
import { academyNavigation, currentAcademyNavigation } from "@/lib/academy-navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const sectionTypes = [
  "hero",
  "notice",
  "statistics",
  "exam-packages",
  "courses",
  "books",
  "notes",
  "blog",
  "reviews",
  "faq",
  "cta",
  "rich-text",
  "image-text",
  "image-gallery",
  "video",
  "youtube-video",
  "pdf-document",
  "features",
  "pricing",
  "contact",
  "social-links",
  "countdown",
  "announcement",
  "custom-html",
  "divider",
  "spacer",
];
const pageSeeds = [
  ["home", "Homepage", "/"],
  ["about", "About", "/about"],
  ["contact", "Contact", "/contact"],
  ["courses", "Courses", "/courses"],
  ["books", "Books", "/books"],
  ["packages", "Exam Packages", "/packages"],
  ["notes", "Notes", "/notes"],
  ["blog", "Blog", "/blog"],
];
const label = (s: string) =>
  s.replaceAll("-", " ").replace(/\b\w/g, (x) => x.toUpperCase());
const id = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
const defaultSection = (type = "rich-text") => ({
  id: id(),
  type,
  label: label(type),
  visible: true,
  desktop: true,
  tablet: true,
  mobile: true,
  content: {
    title: label(type),
    text: "",
    url: "",
    buttonLabel: "Learn more",
    media: "",
  },
  style: {
    background: "",
    padding: { desktop: 48, tablet: 36, mobile: 24 },
    margin: { desktop: 0, tablet: 0, mobile: 0 },
    alignment: "left",
    containerWidth: 1200,
    anchor: "",
    fontSize: { desktop: 16, tablet: 16, mobile: 15 },
    width: { desktop: 100, tablet: 100, mobile: 100 },
    columns: { desktop: 3, tablet: 2, mobile: 1 },
    imageSize: { desktop: 100, tablet: 100, mobile: 100 },
  },
});
const defaultHomeSections = () => [
  "hero", "notice", "courses", "exam-packages", "notes", "books",
  "blog", "statistics", "reviews", "team",
].map(type => ({ ...defaultSection(type), id: `home-${type}` }));
const withDefaultHomepage = (data: any) => {
  const home = data?.pages?.home;
  if (Array.isArray(home?.sections) && home.sections.length) return data;
  return {
    ...data,
    pages: {
      ...(data?.pages || {}),
      home: {
        id: "home", title: "Homepage", slug: "/", status: "published",
        ...(home || {}), sections: defaultHomeSections(),
      },
    },
  };
};
const defaults: any = {
  pages: {
    items: pageSeeds.map(([key, title, slug]) => ({
      id: key,
      title,
      slug,
      status: "published",
      visibility: "public",
      updatedAt: Date.now(),
      seoStatus: "Configured",
      protected: true,
    })),
    trash: [],
  },
  "page-builder": {
    selectedPage: "home",
    pages: {
      home: {
        id: "home",
        title: "Homepage",
        slug: "/",
        status: "published",
        sections: defaultHomeSections(),
      },
    },
    templates: [],
  },
  navigation: { main: [], mobile: [], footer: [] },
  header: {
    enabled: true,
    logo: "",
    darkLogo: "",
    logoSize: 180,
    height: 88,
    background: "#ffffff",
    transparent: false,
    sticky: true,
    search: false,
    navigation: true,
    cart: true,
    enterExam: true,
    whatsapp: true,
    ctaLabel: "",
    ctaUrl: "",
    mobileMenu: true,
    desktopLayout: "logo-menu-actions",
    tabletLayout: "logo-menu",
    mobileLayout: "logo-toggle",
  },
  footer: {
    logo: "",
    description: "Preparation for a career grounded in law.",
    address: "",
    phone: "",
    whatsapp: "",
    email: "",
    socialLinks: [],
    columns: [],
    legalLinks: [],
    copyright: "LexVeritas Academy",
    background: "#102d3c",
    textColor: "#e7eef1",
    cta: { enabled: false, title: "", text: "", buttonLabel: "", url: "" },
  },
  announcement: { items: [] },
  popups: { items: [] },
  "reusable-sections": { items: [] },
  "global-layout": {
    websiteWidth: 1440,
    containerWidth: 1200,
    sectionSpacing: 72,
    pageTopSpacing: 48,
    pageBottomSpacing: 72,
    sidebarWidth: 320,
    layout: "full-width",
    background: "#f7f8fa",
    pageTitleLayout: "standard",
    breadcrumbs: true,
    pageTransition: "subtle",
  },
  responsive: {
    device: "desktop",
    desktop: {
      fontSize: 16,
      padding: 32,
      margin: 0,
      alignment: "left",
      width: 100,
      columns: 3,
      imageSize: 100,
      visible: true,
    },
    tablet: {
      fontSize: 16,
      padding: 24,
      margin: 0,
      alignment: "left",
      width: 100,
      columns: 2,
      imageSize: 100,
      visible: true,
    },
    mobile: {
      fontSize: 15,
      padding: 18,
      margin: 0,
      alignment: "left",
      width: 100,
      columns: 1,
      imageSize: 100,
      visible: true,
    },
  },
};

const withoutRemovedFeature = (kind: string, data: any) => {
  if (!data || typeof data !== "object") return data;
  const keepLink = (item: any) =>
    !String(item?.url || "").startsWith("/bd-laws-ai") &&
    !/bd laws ai/i.test(String(item?.label || ""));
  const keepSection = (section: any) => section?.type !== "bd-laws-ai";
  if (kind === "navigation")
    return Object.fromEntries(Object.entries(data).map(([key, value]) =>
      [key, Array.isArray(value) ? value.filter(keepLink) : value]));
  if (kind === "pages") return { ...data, items: (data.items || []).filter((item: any) =>
    item.id !== "bd-laws-ai" && item.slug !== "bd-laws-ai" && item.slug !== "/bd-laws-ai") };
  if (kind === "page-builder") {
    const { ["bd-laws-ai"]: removed, ...pages } = data.pages || {};
    return { ...data, pages: Object.fromEntries(Object.entries(pages).map(([key, page]: any) =>
      [key, { ...page, sections: (page.sections || []).filter(keepSection) }])) };
  }
  if (kind === "homepage") return { ...data, sections: (data.sections || []).filter(keepSection) };
  if (kind === "footer") return {
    ...data,
    columns: (data.columns || []).map((column: any) => ({ ...column, links: (column.links || []).filter(keepLink) })),
    quickLinks: (data.quickLinks || []).filter(keepLink),
    legalLinks: (data.legalLinks || []).filter(keepLink),
  };
  if (kind === "header") { const { bdLaws, ...header } = data; return header; }
  return data;
};
function useControl(kind: string) {
  const [record, setRecord] = useState<any>(null),
    [value, setLocal] = useState<any>(defaults[kind] || {}),
    [error, setError] = useState(""),
    [dirty, setDirty] = useState(false);
  const load = () =>
    api(`admin/control/${kind}`)
      .then((r: any) => {
        setRecord(r);
        const loaded = withoutRemovedFeature(kind, r.draft || r.live || defaults[kind] || {});
        setLocal(kind === "page-builder" ? withDefaultHomepage(loaded) : loaded);
        setDirty(false);
      })
      .catch((e: any) => setError(e.message));
  useEffect(() => {
    void load();
  }, [kind]);
  const setValue = (v: any) => {
    setLocal(typeof v === "function" ? v(value) : v);
    setDirty(true);
  };
  const save = async (
    action: "draft" | "publish" | "restore",
    data = value,
    version?: number,
  ) => {
    setError("");
    try {
      await api(`admin/control/${kind}`, { action, data: withoutRemovedFeature(kind, data), version }, "PATCH");
      toast.success(
        action === "draft"
          ? "Draft saved"
          : action === "restore"
            ? "Version restored"
            : "Changes published",
      );
      await load();
    } catch (e: any) {
      setError(e.message);
    }
  };
  return { record, value, setValue, error, dirty, save, load };
}
const Input = ({ label: caption, value, set, type = "text", ...rest }: any) => (
  <Field
    label={caption}
    type={type}
    value={value ?? ""}
    onChange={(e: any) =>
      set(type === "number" ? Number(e.target.value) : e.target.value)
    }
    {...rest}
  />
);
const Toggle = ({ label: caption, value, set, hint }: any) => (
  <label className="wb-toggle">
    <span>
      <b>{caption}</b>
      {hint && <small>{hint}</small>}
    </span>
    <input
      type="checkbox"
      checked={!!value}
      onChange={(e) => set(e.target.checked)}
    />
  </label>
);
const Select = ({ label: caption, value, set, options }: any) => (
  <Field label={caption}>
    <select value={value || ""} onChange={(e) => set(e.target.value)}>
      {options.map((x: any) => (
        <option
          key={Array.isArray(x) ? x[0] : x}
          value={Array.isArray(x) ? x[0] : x}
        >
          {Array.isArray(x) ? x[1] : label(x)}
        </option>
      ))}
    </select>
  </Field>
);

function Header({
  eyebrow = "WEBSITE",
  title,
  description,
  dirty,
  onDraft,
  onPublish,
  preview = "/",
}: any) {
  return (
    <div className="cc-heading wb-heading">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{description}</p>
        {dirty && <span className="wb-unsaved">● Unsaved changes</span>}
      </div>
      <div className="cc-actions">
        <a className="btn secondary" href={preview} target="_blank">
          <Eye size={16} /> Preview
        </a>
        {onDraft && (
          <button className="btn secondary" onClick={onDraft}>
            <Save size={16} /> Save Draft
          </button>
        )}
        {onPublish && (
          <button className="btn" onClick={onPublish}>
            Publish
          </button>
        )}
      </div>
    </div>
  );
}
function Versions({ control }: any) {
  const [view, setView] = useState<any>(null);
  if (!control.record?.history?.length) return null;
  return (
    <section className="card cc-panel">
      <h2>
        <History size={19} /> Version History
      </h2>
      <p>Publishing and restoring create recoverable safety points.</p>
      <div className="cc-version-list">
        {control.record.history.slice(0, 8).map((v: any, i: number) => (
          <div key={v.at + i}>
            <span>
              <b>{date(v.at)}</b>
              <small>Published by {v.admin}</small>
            </span>
            <button
              className="btn secondary small"
              onClick={() => {
                const current = control.record?.live || {};
                const keys = [
                  ...new Set([
                    ...Object.keys(current),
                    ...Object.keys(v.data || {}),
                  ]),
                ];
                setView({
                  ...v,
                  changed: keys.filter(
                    (key) =>
                      JSON.stringify(current[key]) !==
                      JSON.stringify(v.data?.[key]),
                  ),
                });
              }}
            >
              View / Compare
            </button>
            <button
              className="btn secondary small"
              onClick={() => {
                if (
                  confirm(
                    "Restore this version? A safety snapshot of the current version will be kept.",
                  )
                )
                  control.save("restore", undefined, i);
              }}
            >
              <Undo2 size={14} /> Restore
            </button>
          </div>
        ))}
      </div>
      <Dialog open={!!view} onOpenChange={(v) => !v && setView(null)}>
        <DialogContent className="wide-dialog">
          <DialogHeader>
            <DialogTitle>Previous version</DialogTitle>
          </DialogHeader>
          <div className="notice">
            <b>Changed areas compared with the current live version:</b>{" "}
            {view?.changed?.length
              ? view.changed.join(", ")
              : "No top-level differences"}
          </div>
          <pre className="wb-json">{JSON.stringify(view?.data, null, 2)}</pre>
        </DialogContent>
      </Dialog>
    </section>
  );
}

export function WebsiteDashboard() {
  const [data, setData] = useState<any>(null),
    [error, setError] = useState("");
  useEffect(() => {
    Promise.all(
      [
        "pages",
        "page-builder",
        "navigation",
        "header",
        "footer",
        "announcement",
        "popups",
      ].map(async (kind) => [kind, await api(`admin/control/${kind}`)]),
    )
      .then((rows) => setData(Object.fromEntries(rows)))
      .catch((e) => setError(e.message));
  }, []);
  if (!data)
    return (
      <>
        <Header
          title="Website Dashboard"
          description="One place to see website publishing health and open the right editor."
        />
        <ErrorBox error={error} />
        {!error && <Loading />}
      </>
    );
  const pages =
      data.pages.live?.items || data.pages.draft?.items || defaults.pages.items,
    counts = (status: string) =>
      pages.filter((x: any) => x.status === status).length;
  const active = (kind: string) =>
    (data[kind].live?.items || []).filter(
      (x: any) =>
        x.enabled && (!x.end || new Date(x.end).getTime() > Date.now()),
    ).length;
  const cards = [
    [pages.length, "Total Pages"],
    [counts("published"), "Published Pages"],
    [counts("draft"), "Draft Pages"],
    [counts("hidden"), "Hidden Pages"],
    [
      data["page-builder"].live?.pages?.home ? "Published" : "Existing design",
      "Homepage Status",
    ],
    [active("announcement"), "Active Announcements"],
    [active("popups"), "Active Popups"],
    [
      data.header.live?.enabled !== false ? "Active" : "Hidden",
      "Header Status",
    ],
    [data.footer.live ? "Active" : "Default", "Footer Status"],
    [data.navigation.live ? "Configured" : "Default", "Navigation Status"],
  ];
  return (
    <>
      <Header
        title="Website Dashboard"
        description="Publishing status, recent edits and direct access to every website tool."
      />
      <div className="wb-stat-grid">
        {cards.map(([n, t]) => (
          <article className="card" key={String(t)}>
            <strong>{n}</strong>
            <span>{t}</span>
          </article>
        ))}
      </div>
      <section className="card cc-panel">
        <h2>Quick Actions</h2>
        <div className="wb-quick">
          {[
            ["Edit Homepage", "/admin/website/builder?page=home"],
            ["Add Page", "/admin/website/pages?action=new"],
            ["Edit Header", "/admin/website/header"],
            ["Edit Footer", "/admin/website/footer"],
            ["Edit Navigation", "/admin/website/navigation"],
            ["Add Announcement", "/admin/website/announcement?action=new"],
            ["Add Popup", "/admin/website/popups?action=new"],
            ["Preview Website", "/"],
          ].map(([t, u]) => (
            <a className="btn secondary" href={u} key={t}>
              {t}
            </a>
          ))}
        </div>
      </section>
      <section className="card cc-panel">
        <h2>Recently Edited Pages</h2>
        {pages
          .sort((a: any, b: any) => (b.updatedAt || 0) - (a.updatedAt || 0))
          .slice(0, 8)
          .map((p: any) => (
            <div className="wb-recent" key={p.id}>
              <span>
                <b>{p.title}</b>
                <small>{p.slug}</small>
              </span>
              <span className={`badge ${p.status}`}>{label(p.status)}</span>
              <small>{date(p.updatedAt)}</small>
              <a
                className="text-link"
                href={`/admin/website/builder?page=${p.id}`}
              >
                Edit
              </a>
            </div>
          ))}
      </section>
    </>
  );
}

export function PagesManager() {
  const c = useControl("pages"),
    [q, setQ] = useState(""),
    [edit, setEdit] = useState<any>(null);
  const value = { ...defaults.pages, ...c.value },
    items = (value.items || []).filter((x: any) =>
      `${x.title} ${x.slug}`.toLowerCase().includes(q.toLowerCase()),
    );
  useEffect(() => {
    if (new URLSearchParams(location.search).get("action") === "new")
      setEdit({
        id: id(),
        title: "Untitled Page",
        slug: "new-page",
        status: "draft",
        visibility: "public",
        seoStatus: "Needs attention",
        updatedAt: Date.now(),
      });
  }, []);
  if (!c.record) return <Loading />;
  const commit = (page: any) => {
    const duplicate = value.items.find(
      (x: any) =>
        x.id !== page.id &&
        x.slug.replace(/^\//, "") === page.slug.replace(/^\//, ""),
    );
    if (duplicate) return toast.error("That slug is already in use.");
    const next = {
      ...page,
      slug: page.slug === "/" ? "/" : page.slug.replace(/^\/+/, ""),
      updatedAt: Date.now(),
      published: page.status === "published",
    };
    c.setValue({
      ...value,
      items: [...value.items.filter((x: any) => x.id !== next.id), next],
    });
    setEdit(null);
  };
  const update = (page: any, changes: any) =>
    c.setValue({
      ...value,
      items: value.items.map((x: any) =>
        x.id === page.id
          ? {
              ...x,
              ...changes,
              updatedAt: Date.now(),
              published: (changes.status || x.status) === "published",
            }
          : x,
      ),
    });
  return (
    <>
      <Header
        title="Pages"
        description="Create, organize, publish and recover website pages without changing protected system routes."
        dirty={c.dirty}
        onDraft={() => c.save("draft")}
        onPublish={() => c.save("publish")}
      />
      <ErrorBox error={c.error} />
      <section className="card cc-panel">
        <div className="wb-toolbar">
          <label className="search-field">
            <Search size={17} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search pages or URLs"
            />
          </label>
          <button
            className="btn"
            onClick={() =>
              setEdit({
                id: id(),
                title: "Untitled Page",
                slug: "new-page",
                status: "draft",
                visibility: "public",
                seoStatus: "Needs attention",
                updatedAt: Date.now(),
              })
            }
          >
            <Plus size={16} /> Add Page
          </button>
        </div>
        <div className="table-card wb-table">
          <table>
            <thead>
              <tr>
                {[
                  "Page",
                  "URL / Slug",
                  "Status",
                  "Visibility",
                  "Last Updated",
                  "SEO",
                  "Actions",
                ].map((x) => (
                  <th key={x}>{x}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((p: any) => (
                <tr key={p.id}>
                  <td>
                    <b>{p.title}</b>
                    {p.protected && (
                      <small className="block muted">Protected route</small>
                    )}
                  </td>
                  <td>{p.slug}</td>
                  <td>
                    <span className={`badge ${p.status}`}>
                      {label(p.status)}
                    </span>
                  </td>
                  <td>{label(p.visibility || "public")}</td>
                  <td>{date(p.updatedAt)}</td>
                  <td>{p.seoStatus || "Needs attention"}</td>
                  <td>
                    <div className="wb-row-actions">
                      <a
                        className="icon-btn"
                        title="Edit layout"
                        href={`/admin/website/builder?page=${p.id}`}
                      >
                        <Pencil size={15} />
                      </a>
                      <a
                        className="icon-btn"
                        title="Preview"
                        target="_blank"
                        href={
                          p.slug === "/" ? "/" : `/${p.slug.replace(/^\//, "")}`
                        }
                      >
                        <Eye size={15} />
                      </a>
                      <button
                        className="icon-btn"
                        title="Duplicate"
                        onClick={() => {
                          const copy = {
                            ...p,
                            id: id(),
                            title: `${p.title} Copy`,
                            slug: `${p.slug.replace(/^\//, "")}-copy`,
                            status: "draft",
                            protected: false,
                            updatedAt: Date.now(),
                          };
                          c.setValue({
                            ...value,
                            items: [...value.items, copy],
                          });
                        }}
                      >
                        <Copy size={15} />
                      </button>
                      <button
                        className="icon-btn"
                        title="Page settings"
                        onClick={() => setEdit(p)}
                      >
                        <MoreHorizontal size={15} />
                      </button>
                      <button
                        className="icon-btn"
                        title={
                          p.status === "published" ? "Unpublish" : "Publish"
                        }
                        onClick={() =>
                          update(p, {
                            status:
                              p.status === "published" ? "draft" : "published",
                          })
                        }
                      >
                        {p.status === "published" ? (
                          <RotateCcw size={15} />
                        ) : (
                          <Save size={15} />
                        )}
                      </button>
                      {p.status === "archived" ? (
                        <button
                          className="icon-btn"
                          title="Restore to drafts"
                          onClick={() => update(p, { status: "draft" })}
                        >
                          <Undo2 size={15} />
                        </button>
                      ) : !p.protected ? (
                        <button
                          className="icon-btn danger"
                          title="Delete (recoverable)"
                          onClick={() => {
                            if (
                              confirm(
                                `Delete ${p.title}? It will move to Archived and can be restored later.`,
                              )
                            )
                              update(p, { status: "archived" });
                          }}
                        >
                          <Trash2 size={15} />
                        </button>
                      ) : (
                        <span />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <PageDialog page={edit} close={() => setEdit(null)} save={commit} />
      <Versions control={c} />
    </>
  );
}
function PageDialog({ page, close, save }: any) {
  const [p, setP] = useState<any>(page);
  useEffect(() => setP(page), [page]);
  return (
    <Dialog open={!!page} onOpenChange={(v) => !v && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Page settings</DialogTitle>
        </DialogHeader>
        {p && (
          <div className="grid two">
            <Input
              label="Page name"
              value={p.title}
              set={(v: string) => setP({ ...p, title: v })}
            />
            <Input
              label="URL / slug"
              value={p.slug}
              set={(v: string) => setP({ ...p, slug: v })}
              disabled={p.protected}
            />
            <Select
              label="Status"
              value={p.status}
              set={(v: string) => setP({ ...p, status: v })}
              options={[
                "draft",
                "published",
                "hidden",
                "scheduled",
                "archived",
              ]}
            />
            <Select
              label="Visibility"
              value={p.visibility}
              set={(v: string) => setP({ ...p, visibility: v })}
              options={["public", "logged-in", "private"]}
            />
            {p.status === "scheduled" && (
              <Input
                label="Publish date and time"
                type="datetime-local"
                value={p.scheduledAt}
                set={(v: string) => setP({ ...p, scheduledAt: v })}
              />
            )}
            <Select
              label="Template"
              value={p.template || "standard"}
              set={(v: string) => setP({ ...p, template: v })}
              options={[
                "standard",
                "landing-page",
                "course-landing-page",
                "book-landing-page",
                "legal-article-page",
                "contact-page",
                "blank-page",
              ]}
            />
            <Input
              label="SEO title override"
              value={p.seoTitle}
              set={(v: string) =>
                setP({
                  ...p,
                  seoTitle: v,
                  seoStatus: v ? "Configured" : "Needs attention",
                })
              }
            />
            <Input
              label="Canonical URL"
              value={p.canonicalUrl}
              set={(v: string) => setP({ ...p, canonicalUrl: v })}
            />
            <Field label="Meta description" className="span-two">
              <textarea
                rows={3}
                value={p.metaDescription || ""}
                onChange={(e) =>
                  setP({
                    ...p,
                    metaDescription: e.target.value,
                    seoStatus: e.target.value ? "Configured" : p.seoStatus,
                  })
                }
              />
            </Field>
            <Toggle
              label="Allow search indexing"
              value={p.indexable !== false}
              set={(v: boolean) => setP({ ...p, indexable: v })}
            />
            <div className="span-two actions">
              <button className="btn secondary" onClick={close}>
                Cancel
              </button>
              <button className="btn" onClick={() => save(p)}>
                Save Page
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function WebsiteBuilder() {
  const c = useControl("page-builder"),
    pages = useControl("pages"),
    reusable = useControl("reusable-sections"),
    [device, setDevice] = useState("desktop"),
    [edit, setEdit] = useState<any>(null),
    [library, setLibrary] = useState(false),
    [drag, setDrag] = useState<number | null>(null),
    [undoStack, setUndoStack] = useState<any[]>([]),
    [previewKey, setPreviewKey] = useState(0);
  if (!c.record || !pages.record || !reusable.record) return <Loading />;
  const queryPage = new URLSearchParams(location.search).get("page"),
    pageId = queryPage || "home",
    meta =
      (pages.value.items || []).find((x: any) => x.id === pageId) ||
      pages.value.items?.[0] ||
      defaults.pages.items[0];
  const page = c.value.pages?.[pageId] || {
      id: pageId,
      title: meta.title,
      slug: meta.slug,
      status: meta.status,
      sections: [],
    },
    sections = page.sections || [];
  const builtInTemplates = [
    {
      id: "builtin-standard",
      name: "Standard Page",
      sections: [defaultSection("rich-text")],
    },
    {
      id: "builtin-landing",
      name: "Landing Page",
      sections: [
        defaultSection("hero"),
        defaultSection("features"),
        defaultSection("cta"),
      ],
    },
    {
      id: "builtin-course",
      name: "Course Landing Page",
      sections: [
        defaultSection("hero"),
        defaultSection("courses"),
        defaultSection("reviews"),
        defaultSection("faq"),
        defaultSection("cta"),
      ],
    },
    {
      id: "builtin-book",
      name: "Book Landing Page",
      sections: [
        defaultSection("hero"),
        defaultSection("books"),
        defaultSection("reviews"),
        defaultSection("cta"),
      ],
    },
    {
      id: "builtin-legal",
      name: "Legal Article Page",
      sections: [defaultSection("rich-text"), defaultSection("pdf-document")],
    },
    {
      id: "builtin-contact",
      name: "Contact Page",
      sections: [defaultSection("contact"), defaultSection("social-links")],
    },
    { id: "builtin-blank", name: "Blank Page", sections: [] },
  ];
  const availableTemplates = [
    ...builtInTemplates,
    ...(c.value.templates || []),
  ];
  const setPage = (next: any) => {
      setUndoStack(previous => [...previous.slice(-29), JSON.parse(JSON.stringify(page))]);
      c.setValue({
        ...c.value,
        selectedPage: pageId,
        pages: { ...(c.value.pages || {}), [pageId]: next },
      });
    },
    setSections = (next: any[]) =>
      setPage({ ...page, sections: next, updatedAt: Date.now() });
  const undo = () => {
    const previous = undoStack.at(-1);
    if (!previous) return;
    c.setValue({ ...c.value, pages: { ...c.value.pages, [pageId]: previous } });
    setUndoStack(undoStack.slice(0, -1));
  };
  const move = (from: number, to: number) => {
    if (to < 0 || to >= sections.length) return;
    const n = [...sections],
      [x] = n.splice(from, 1);
    n.splice(to, 0, x);
    setSections(n);
  };
  const add = (type: string, global?: any, linked = true) => {
    const s = global
      ? {
          ...JSON.parse(JSON.stringify(global.section)),
          id: id(),
          reusableId: linked ? global.id : undefined,
          label: global.name,
        }
      : defaultSection(type);
    setSections([...sections, s]);
    setLibrary(false);
  };
  const pageUrl =
      meta.slug === "/" ? "/" : `/${String(meta.slug).replace(/^\//, "")}`,
    draftPreviewUrl = `/website-preview?path=${encodeURIComponent(pageUrl)}&device=${device}`;
  return (
    <>
      <Header
        title="Website Builder"
        description="Build every page with responsive sections from one central canvas."
        dirty={c.dirty}
        preview={draftPreviewUrl}
        onDraft={async () => {
          await c.save("draft", withDefaultHomepage(c.value));
          setUndoStack([]);
          setPreviewKey((n) => n + 1);
        }}
        onPublish={async () => {
          await c.save("publish", withDefaultHomepage(c.value));
          setUndoStack([]);
          setPreviewKey((n) => n + 1);
        }}
      />
      <ErrorBox error={c.error} />
      {pageId === "home" && <section className="card cc-panel countdown-admin-panel">
        <h2>Exam countdowns</h2><p>Set dates in Bangladesh time. Hide either countdown when no date has been announced.</p>
        <div className="grid two">{[
          { id: "bjs", label: "BJS Exam" },
          { id: "bar", label: "Bar Council Exam" },
        ].map(item => {
          const saved = (page.countdowns || []).find((x:any) => x.id === item.id) || { ...item, date: "", enabled: false };
          const update = (patch:any) => setPage({ ...page, countdowns: ["bjs","bar"].map(key => key === item.id ? { ...saved, ...patch } : (page.countdowns || []).find((x:any) => x.id === key) || { id:key,label:key === "bjs" ? "BJS Exam" : "Bar Council Exam",date:"",enabled:false }) });
          const localDate = saved.date && Number.isFinite(Date.parse(saved.date)) ? new Date(Date.parse(saved.date) + 21600000).toISOString().slice(0,16) : "";
          return <div className="countdown-admin-item" key={item.id}>
            <label><input type="checkbox" checked={!!saved.enabled} onChange={e=>update({enabled:e.target.checked})}/> Show {item.label}</label>
            <Field label="Exam date and time (Bangladesh)"><input type="datetime-local" value={localDate} onChange={e=>update({date:e.target.value ? new Date(`${e.target.value}:00+06:00`).toISOString() : ""})}/></Field>
          </div>;
        })}</div>
      </section>}
      <div className="wb-builder-top">
        <div className="wb-recovery-actions">
          <button type="button" className="btn secondary" disabled={!undoStack.length} onClick={undo}><Undo2 size={16}/> Undo</button>
          <button type="button" className="btn secondary" onClick={() => {
            const published = c.record?.live?.pages?.[pageId];
            if (published && confirm("Restore this page from the last published version? Publish to make it live.")) setPage(pageId === "home" ? withDefaultHomepage({ pages: { home: published } }).pages.home : JSON.parse(JSON.stringify(published)));
          }} disabled={!c.record?.live?.pages?.[pageId]}><History size={16}/> Restore Published</button>
          {pageId === "home" && <button type="button" className="btn secondary" onClick={() => {
            if (confirm("Restore the standard homepage sections? Your countdown dates will be kept. Publish to make it live.")) setPage({ ...page, sections: defaultHomeSections(), updatedAt: Date.now() });
          }}><RotateCcw size={16}/> Restore Default Homepage</button>}
        </div>
        <Field label="Page">
          <select
            value={pageId}
            onChange={(e) =>
              (location.href = `/admin/website/builder?page=${e.target.value}`)
            }
          >
            {(pages.value.items || [])
              .filter((x: any) => x.status !== "archived")
              .map((x: any) => (
                <option value={x.id} key={x.id}>
                  {x.title}
                </option>
              ))}
          </select>
        </Field>
        <div className="wb-devices">
          {[
            ["desktop", Monitor],
            ["tablet", Tablet],
            ["mobile", Smartphone],
          ].map(([d, I]: any) => (
            <button
              key={d}
              className={device === d ? "active" : ""}
              onClick={() => setDevice(d)}
            >
              <I size={16} />
              {label(d)}
            </button>
          ))}
        </div>
        <button
          className="btn secondary"
          onClick={() => {
            const name = prompt("Template name", `${page.title} template`);
            if (name)
              c.setValue({
                ...c.value,
                templates: [
                  ...(c.value.templates || []),
                  { id: id(), name, sections: page.sections },
                ],
              });
          }}
        >
          Save as Template
        </button>
        <Field label="Create from template">
          <select
            defaultValue=""
            onChange={(e) => {
              const t = availableTemplates.find(
                (x: any) => x.id === e.target.value,
              );
              if (
                t &&
                confirm("Replace this page canvas with the selected template?")
              )
                setSections(JSON.parse(JSON.stringify(t.sections)));
              e.currentTarget.value = "";
            }}
          >
            <option value="">Choose…</option>
            {availableTemplates.map((t: any) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="wb-builder-grid">
        <section className="card cc-panel">
          <div className="cc-panel-title">
            <div>
              <h2>{page.title}</h2>
              <small>
                {sections.length} sections · {label(device)} preview
              </small>
            </div>
            <button className="btn" onClick={() => setLibrary(true)}>
              <Plus size={16} /> Add Section
            </button>
          </div>
          <div className={`wb-canvas device-${device}`}>
            {sections.length ? (
              sections.map((s: any, i: number) => (
                <article
                  key={s.id}
                  draggable
                  onDragStart={() => setDrag(i)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (drag !== null) move(drag, i);
                    setDrag(null);
                  }}
                  className={`wb-section-row ${s.visible === false ? "is-hidden" : ""}`}
                >
                  <GripVertical size={19} />
                  <span className="wb-section-icon">
                    <FileText size={18} />
                  </span>
                  <span className="wb-section-title">
                    <b>{s.label || label(s.type)}</b>
                    <small>
                      {label(s.type)}
                      {s.reusableId ? " · Linked global block" : ""}
                    </small>
                  </span>
                  <div className="cc-device-toggles">
                    {[
                      ["desktop", Monitor],
                      ["tablet", Tablet],
                      ["mobile", Smartphone],
                    ].map(([d, I]: any) => (
                      <button
                        key={d}
                        className={s[d] !== false ? "active" : ""}
                        title={`${label(d)} visibility`}
                        onClick={() =>
                          setSections(
                            sections.map((x: any) =>
                              x.id === s.id ? { ...x, [d]: x[d] === false } : x,
                            ),
                          )
                        }
                      >
                        <I size={14} />
                      </button>
                    ))}
                  </div>
                  <button
                    className="icon-btn"
                    title="Edit"
                    onClick={() => setEdit(s)}
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    className="icon-btn"
                    title="Move up"
                    disabled={!i}
                    onClick={() => move(i, i - 1)}
                  >
                    <ArrowUp size={15} />
                  </button>
                  <button
                    className="icon-btn"
                    title="Move down"
                    disabled={i === sections.length - 1}
                    onClick={() => move(i, i + 1)}
                  >
                    <ArrowDown size={15} />
                  </button>
                  <button
                    className="icon-btn"
                    title="Duplicate"
                    onClick={() => {
                      const n = [...sections];
                      n.splice(i + 1, 0, {
                        ...JSON.parse(JSON.stringify(s)),
                        id: id(),
                        reusableId: undefined,
                        label: `${s.label} Copy`,
                      });
                      setSections(n);
                    }}
                  >
                    <Copy size={15} />
                  </button>
                  <button
                    className="icon-btn danger"
                    title="Delete"
                    onClick={() => {
                      if (confirm(`Delete ${s.label}?`))
                        setSections(sections.filter((x: any) => x.id !== s.id));
                    }}
                  >
                    <Trash2 size={15} />
                  </button>
                  <Toggle
                    label=""
                    value={s.visible !== false}
                    set={(v: boolean) =>
                      setSections(
                        sections.map((x: any) =>
                          x.id === s.id ? { ...x, visible: v } : x,
                        ),
                      )
                    }
                  />
                </article>
              ))
            ) : (
              <EmptyState title="This page uses its existing design">
                Add a section to begin customizing it. Nothing changes publicly
                until you publish.
              </EmptyState>
            )}
          </div>
        </section>
        <aside className="card cc-panel wb-inspector">
          <h2>Page Settings</h2>
          <Input
            label="Page title"
            value={page.title}
            set={(v: string) => setPage({ ...page, title: v })}
          />
          <Select
            label="Page layout"
            value={page.layout || "global"}
            set={(v: string) => setPage({ ...page, layout: v })}
            options={["global", "full-width", "boxed", "no-header-footer"]}
          />
          <Input
            label="Background"
            type="color"
            value={page.background || "#ffffff"}
            set={(v: string) => setPage({ ...page, background: v })}
          />
          <Toggle
            label="Show page title"
            value={page.showTitle !== false}
            set={(v: boolean) => setPage({ ...page, showTitle: v })}
          />
          <Toggle
            label="Breadcrumbs"
            value={page.breadcrumbs !== false}
            set={(v: boolean) => setPage({ ...page, breadcrumbs: v })}
          />
          <p className="muted">
            Global header, footer, navigation and layout remain managed in their
            dedicated modules.
          </p>
        </aside>
      </div>
      <section className="card cc-panel wb-live-preview">
        <div className="cc-panel-title">
          <div>
            <h2>Student-view draft preview</h2>
            <small>Save Draft to refresh unpublished changes safely.</small>
          </div>
          <button
            className="btn secondary"
            onClick={() => setPreviewKey((n) => n + 1)}
          >
            <RotateCcw size={16} /> Refresh Preview
          </button>
        </div>
        <div className={`wb-preview-frame ${device}`}>
          <iframe
            key={`${pageId}-${device}-${previewKey}`}
            src={draftPreviewUrl}
            title={`${page.title} ${device} draft preview`}
          />
        </div>
      </section>
      <SectionEditor
        section={edit}
        device={device}
        close={() => setEdit(null)}
        save={(s: any) => {
          setSections(sections.map((x: any) => (x.id === s.id ? s : x)));
          setEdit(null);
        }}
      />
      <SectionLibrary
        open={library}
        close={() => setLibrary(false)}
        add={add}
        reusable={reusable.value.items || []}
      />
      <Versions control={c} />
    </>
  );
}

function SectionLibrary({ open, close, add, reusable }: any) {
  const [q, setQ] = useState("");
  return (
    <Dialog open={open} onOpenChange={(v) => !v && close()}>
      <DialogContent className="wide-dialog">
        <DialogHeader>
          <DialogTitle>Add Section</DialogTitle>
        </DialogHeader>
        <label className="search-field">
          <Search size={16} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search section library"
          />
        </label>
        <h3>Section library</h3>
        <div className="wb-library">
          {sectionTypes
            .filter((x) => x.includes(q.toLowerCase().replaceAll(" ", "-")))
            .map((type) => (
              <button key={type} onClick={() => add(type)}>
                <Plus size={16} />
                <b>{label(type)}</b>
                <small>Add a new editable block</small>
              </button>
            ))}
        </div>
        {reusable.length > 0 && (
          <>
            <h3>Reusable sections</h3>
            <div className="wb-library">
              {reusable.map((x: any) => (
                <div className="wb-reusable-choice" key={x.id}>
                  <b>{x.name}</b>
                  <button
                    onClick={() => add(x.section?.type || "rich-text", x, true)}
                  >
                    <RotateCcw size={16} /> Link globally
                  </button>
                  <button
                    onClick={() =>
                      add(x.section?.type || "rich-text", x, false)
                    }
                  >
                    <Copy size={16} /> Add independent copy
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
function SectionEditor({ section, device, close, save }: any) {
  const [s, setS] = useState<any>(section);
  useEffect(() => setS(section), [section]);
  if (!s) return null;
  const style = s.style || defaultSection().style,
    d = device || "desktop",
    itemTypes = [
      "statistics",
      "reviews",
      "faq",
      "features",
      "pricing",
      "social-links",
    ],
    mediaTypes = [
      "hero",
      "image-text",
      "image-gallery",
      "video",
      "pdf-document",
    ];
  return (
    <Dialog open={!!section} onOpenChange={(v) => !v && close()}>
      <DialogContent className="wide-dialog">
        <DialogHeader>
          <DialogTitle>Edit {s.label}</DialogTitle>
        </DialogHeader>
        <div className="grid two">
          <Input
            label="Section name"
            value={s.label}
            set={(v: string) => setS({ ...s, label: v })}
          />
          <Input
            label="Section ID / anchor"
            value={style.anchor}
            set={(v: string) =>
              setS({
                ...s,
                style: { ...style, anchor: v.replace(/[^a-z0-9_-]/gi, "") },
              })
            }
          />
          <Input
            label="Title"
            value={s.content?.title}
            set={(v: string) =>
              setS({ ...s, content: { ...s.content, title: v } })
            }
          />
          {!["divider", "spacer"].includes(s.type) && (
            <Input
              label="Button label"
              value={s.content?.buttonLabel}
              set={(v: string) =>
                setS({ ...s, content: { ...s.content, buttonLabel: v } })
              }
            />
          )}
          {!["divider", "spacer"].includes(s.type) && (
            <Field
              label={
                s.type === "custom-html"
                  ? "Safe HTML / embed code"
                  : "Description / text"
              }
            >
              <textarea
                rows={5}
                value={s.content?.text || ""}
                onChange={(e) =>
                  setS({
                    ...s,
                    content: { ...s.content, text: e.target.value },
                  })
                }
              />
            </Field>
          )}
          {s.type === "custom-html" && (
            <p className="notice span-two">
              Script, iframe, form and executable embed code is unsupported and
              will be removed for safety. Use the dedicated YouTube, Video or
              PDF section instead.
            </p>
          )}
          {itemTypes.includes(s.type) && (
            <Field
              label={
                s.type === "faq"
                  ? "Items (Question | Answer)"
                  : "Items (Title | Text | Link, one per line)"
              }
            >
              <textarea
                rows={7}
                value={(s.content?.items || [])
                  .map((x: any) =>
                    [x.title, x.text, x.url].filter(Boolean).join(" | "),
                  )
                  .join("\n")}
                onChange={(e) =>
                  setS({
                    ...s,
                    content: {
                      ...s.content,
                      items: e.target.value
                        .split("\n")
                        .filter(Boolean)
                        .map((line) => {
                          const [title, text = "", url = ""] = line
                            .split("|")
                            .map((part) => part.trim());
                          return { id: id(), title, text, url };
                        }),
                    },
                  })
                }
              />
            </Field>
          )}
          {s.type === "contact" && (
            <div>
              <Input
                label="Address"
                value={s.content?.address}
                set={(v: string) =>
                  setS({ ...s, content: { ...s.content, address: v } })
                }
              />
              <Input
                label="Phone"
                value={s.content?.phone}
                set={(v: string) =>
                  setS({ ...s, content: { ...s.content, phone: v } })
                }
              />
              <Input
                label="Email"
                value={s.content?.email}
                set={(v: string) =>
                  setS({ ...s, content: { ...s.content, email: v } })
                }
              />
            </div>
          )}
          {s.type === "countdown" && (
            <Input
              label="Countdown end"
              type="datetime-local"
              value={s.content?.end}
              set={(v: string) =>
                setS({ ...s, content: { ...s.content, end: v } })
              }
            />
          )}
          {!["divider", "spacer"].includes(s.type) && (
            <div>
              <Input
                label={
                  s.type === "youtube-video" ? "YouTube URL" : "Link / URL"
                }
                value={s.content?.url}
                set={(v: string) =>
                  setS({ ...s, content: { ...s.content, url: v } })
                }
              />
              {mediaTypes.includes(s.type) && (
                <Input
                  label={
                    s.type === "image-gallery"
                      ? "Image URLs / media IDs (comma or new line)"
                      : "Image, video or document URL / media ID"
                  }
                  value={s.content?.media}
                  set={(v: string) =>
                    setS({ ...s, content: { ...s.content, media: v } })
                  }
                />
              )}
              {["hero", "image-text"].includes(s.type) && (
                <MediaUpload
                  kind="settingsHero"
                  value={s.content?.media || null}
                  onChange={(v: any) =>
                    setS({ ...s, content: { ...s.content, media: v || "" } })
                  }
                />
              )}
              {s.type === "pdf-document" && (
                <MediaUpload
                  kind="coursePdf"
                  value={s.content?.media || null}
                  onChange={(v: any) =>
                    setS({ ...s, content: { ...s.content, media: v || "" } })
                  }
                />
              )}
            </div>
          )}
          <Input
            label="Background"
            value={style.background}
            set={(v: string) =>
              setS({ ...s, style: { ...style, background: v } })
            }
            placeholder="Color, gradient or image URL"
          />
          <Select
            label="Alignment"
            value={style.alignment}
            set={(v: string) =>
              setS({ ...s, style: { ...style, alignment: v } })
            }
            options={["left", "center", "right"]}
          />
          <Input
            label={`${label(d)} padding (px)`}
            type="number"
            value={style.padding?.[d]}
            set={(v: number) =>
              setS({
                ...s,
                style: { ...style, padding: { ...style.padding, [d]: v } },
              })
            }
          />
          <Input
            label={`${label(d)} margin (px)`}
            type="number"
            value={style.margin?.[d]}
            set={(v: number) =>
              setS({
                ...s,
                style: { ...style, margin: { ...style.margin, [d]: v } },
              })
            }
          />
          <Input
            label={`${label(d)} font size`}
            type="number"
            value={style.fontSize?.[d]}
            set={(v: number) =>
              setS({
                ...s,
                style: { ...style, fontSize: { ...style.fontSize, [d]: v } },
              })
            }
          />
          <Input
            label={`${label(d)} width (%)`}
            type="number"
            value={style.width?.[d]}
            set={(v: number) =>
              setS({
                ...s,
                style: { ...style, width: { ...style.width, [d]: v } },
              })
            }
          />
          <Input
            label={`${label(d)} columns`}
            type="number"
            value={style.columns?.[d]}
            set={(v: number) =>
              setS({
                ...s,
                style: { ...style, columns: { ...style.columns, [d]: v } },
              })
            }
          />
          <Input
            label={`${label(d)} image size (%)`}
            type="number"
            value={style.imageSize?.[d]}
            set={(v: number) =>
              setS({
                ...s,
                style: { ...style, imageSize: { ...style.imageSize, [d]: v } },
              })
            }
          />
          <Input
            label="Container width (px)"
            type="number"
            value={style.containerWidth}
            set={(v: number) =>
              setS({ ...s, style: { ...style, containerWidth: v } })
            }
          />
          <div className="span-two actions">
            <button className="btn secondary" onClick={close}>
              Cancel
            </button>
            <button className="btn" onClick={() => save(s)}>
              Save Section
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const defaultNav = [
  {
    id: "home",
    label: "Home",
    url: "/",
    visible: true,
    newTab: false,
    parentId: "",
    style: "link",
  },
  {
    id: "courses",
    label: "Courses",
    url: "/courses",
    visible: true,
    newTab: false,
    parentId: "",
    style: "link",
  },
  {
    id: "packages",
    label: "Exam Packages",
    url: "/packages",
    visible: true,
    newTab: false,
    parentId: "",
    style: "link",
  },
  {
    id: "books",
    label: "Books",
    url: "/books",
    visible: true,
    newTab: false,
    parentId: "",
    style: "link",
  },
  {
    id: "notes",
    label: "Notes",
    url: "/notes",
    visible: true,
    newTab: false,
    parentId: "",
    style: "link",
  },
  {
    id: "blog",
    label: "Blog",
    url: "/blog",
    visible: true,
    newTab: false,
    parentId: "",
    style: "link",
  },
  {
    id: "about",
    label: "About",
    url: "/about",
    visible: true,
    newTab: false,
    parentId: "",
    style: "link",
  },
  {
    id: "contact",
    label: "Contact",
    url: "/contact",
    visible: true,
    newTab: false,
    parentId: "",
    style: "link",
  },
];
export function NavigationManager() {
  const c = useControl("navigation"),
    [tab, setTab] = useState("main"),
    [drag, setDrag] = useState<number | null>(null);
  if (!c.record) return <Loading />;
  const legacy = c.value.items,
    storedItems = c.value[tab]?.length
      ? c.value[tab]
      : tab === "main"
        ? legacy?.map((x: any) => ({
            ...x,
            id: x.id || id(),
            parentId: x.parentId || "",
            style: x.style || "link",
          })) || academyNavigation
        : [];
  const items = tab === "main" ? currentAcademyNavigation(storedItems) : tab === "mobile" ? currentAcademyNavigation(storedItems.length ? storedItems : c.value.main?.length ? c.value.main : legacy || academyNavigation) : storedItems;
  const change = (n: any[]) => c.setValue({ ...c.value, [tab]: n });
  const move = (a: number, b: number) => {
    if (b < 0 || b >= items.length) return;
    const n = [...items],
      [x] = n.splice(a, 1);
    n.splice(b, 0, x);
    change(n);
  };
  return (
    <>
      <Header
        title="Navigation"
        description="Manage desktop, mobile and footer menus. The mobile menu shows Courses and Buy Books children without opening a dropdown."
        dirty={c.dirty}
        onDraft={() => c.save("draft")}
        onPublish={() => c.save("publish")}
      />
      <div className="wb-tabs">
        {["main", "mobile", "footer"].map((x) => (
          <button
            className={tab === x ? "active" : ""}
            onClick={() => setTab(x)}
            key={x}
          >
            {label(x)} Navigation
          </button>
        ))}
      </div>
      <section className="card cc-panel">
        <div className="cc-panel-title">
          <h2>{label(tab)} menu</h2>
          <button
            className="btn"
            onClick={() =>
              change([
                ...items,
                {
                  id: id(),
                  label: "New item",
                  url: "/",
                  visible: true,
                  newTab: false,
                  parentId: "",
                  style: "link",
                },
              ])
            }
          >
            <Plus size={16} /> Add Item
          </button>
        </div>
        <div className="cc-section-list">
          {items.map((x: any, i: number) => (
            <div
              className="wb-nav-row"
              key={x.id}
              draggable
              onDragStart={() => setDrag(i)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (drag !== null) move(drag, i);
                setDrag(null);
              }}
            >
              <GripVertical size={18} />
              <Input
                label="Label"
                value={x.label}
                set={(v: string) =>
                  change(
                    items.map((a: any) =>
                      a.id === x.id ? { ...a, label: v } : a,
                    ),
                  )
                }
              />
              <Input
                label="Internal page or external URL"
                value={x.url}
                set={(v: string) =>
                  change(
                    items.map((a: any) =>
                      a.id === x.id ? { ...a, url: v } : a,
                    ),
                  )
                }
              />
              <Select
                label="Parent / dropdown"
                value={x.parentId || ""}
                set={(v: string) =>
                  change(
                    items.map((a: any) =>
                      a.id === x.id ? { ...a, parentId: v } : a,
                    ),
                  )
                }
                options={[
                  ["", "Top level"],
                  ...items
                    .filter((a: any) => a.id !== x.id)
                    .map((a: any) => [a.id, a.label]),
                ]}
              />
              <Select
                label="Style"
                value={x.style || "link"}
                set={(v: string) =>
                  change(
                    items.map((a: any) =>
                      a.id === x.id ? { ...a, style: v } : a,
                    ),
                  )
                }
                options={["link", "button"]}
              />
              <Toggle
                label="Visible"
                value={x.visible !== false}
                set={(v: boolean) =>
                  change(
                    items.map((a: any) =>
                      a.id === x.id ? { ...a, visible: v } : a,
                    ),
                  )
                }
              />
              <Toggle
                label="New tab"
                value={x.newTab}
                set={(v: boolean) =>
                  change(
                    items.map((a: any) =>
                      a.id === x.id ? { ...a, newTab: v } : a,
                    ),
                  )
                }
              />
              <button
                className="icon-btn"
                disabled={!i}
                onClick={() => move(i, i - 1)}
              >
                <ArrowUp size={14} />
              </button>
              <button
                className="icon-btn"
                disabled={i === items.length - 1}
                onClick={() => move(i, i + 1)}
              >
                <ArrowDown size={14} />
              </button>
              <button
                className="icon-btn danger"
                onClick={() =>
                  confirm(`Delete ${x.label}?`) &&
                  change(items.filter((a: any) => a.id !== x.id))
                }
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </section>
      <Versions control={c} />
    </>
  );
}

function SimpleBuilder({ kind, title, description, children }: any) {
  const c = useControl(kind);
  if (!c.record) return <Loading />;
  return (
    <>
      <Header
        title={title}
        description={description}
        dirty={c.dirty}
        onDraft={() => c.save("draft")}
        onPublish={() => c.save("publish")}
      />
      <ErrorBox error={c.error} />
      {children(c.value, c.setValue)}
      <Versions control={c} />
    </>
  );
}
export function HeaderBuilder() {
  return (
    <SimpleBuilder
      kind="header"
      title="Header Builder"
      description="Build the website header for desktop, tablet and mobile."
    >
      {(v: any, set: any) => {
        const x = { ...defaults.header, ...v },
          u = (k: string, n: any) => set({ ...x, [k]: n });
        return (
          <section className="card cc-panel">
            <div className="grid three">
              <div>
                <h2>Brand</h2>
                <MediaUpload
                  kind="settingsLogo"
                  value={x.logo || null}
                  onChange={(n: any) => u("logo", n)}
                />
                <small>Primary logo</small>
                <MediaUpload
                  kind="settingsLogo"
                  value={x.darkLogo || null}
                  onChange={(n: any) => u("darkLogo", n)}
                />
                <small>Dark / white logo</small>
                <Input
                  label="Logo size"
                  type="number"
                  value={x.logoSize}
                  set={(n: number) => u("logoSize", n)}
                />
                <Input
                  label="Header height"
                  type="number"
                  value={x.height}
                  set={(n: number) => u("height", n)}
                />
                <Input
                  label="Background"
                  type="color"
                  value={x.background}
                  set={(n: string) => u("background", n)}
                />
              </div>
              <div>
                <h2>Features</h2>
                {[
                  ["sticky", "Sticky header"],
                  ["transparent", "Transparent header"],
                  ["search", "Search"],
                  ["navigation", "Navigation"],
                  ["cart", "Cart"],
                  ["enterExam", "Enter Exam button"],
                  ["whatsapp", "WhatsApp button"],
                  ["mobileMenu", "Mobile menu"],
                ].map(([k, t]) => (
                  <Toggle
                    key={k}
                    label={t}
                    value={x[k]}
                    set={(n: boolean) => u(k, n)}
                  />
                ))}
              </div>
              <div>
                <h2>Layouts & CTA</h2>
                <Select
                  label="Desktop layout"
                  value={x.desktopLayout}
                  set={(n: string) => u("desktopLayout", n)}
                  options={[
                    "logo-menu-actions",
                    "menu-logo-actions",
                    "logo-centered",
                  ]}
                />
                <Select
                  label="Tablet layout"
                  value={x.tabletLayout}
                  set={(n: string) => u("tabletLayout", n)}
                  options={["logo-menu", "logo-toggle"]}
                />
                <Select
                  label="Mobile layout"
                  value={x.mobileLayout}
                  set={(n: string) => u("mobileLayout", n)}
                  options={["logo-toggle", "centered-logo"]}
                />
                <Input
                  label="CTA label"
                  value={x.ctaLabel}
                  set={(n: string) => u("ctaLabel", n)}
                />
                <Input
                  label="CTA URL"
                  value={x.ctaUrl}
                  set={(n: string) => u("ctaUrl", n)}
                />
              </div>
            </div>
          </section>
        );
      }}
    </SimpleBuilder>
  );
}
export function FooterBuilder() {
  return (
    <SimpleBuilder
      kind="footer"
      title="Footer Builder"
      description="Edit contact details, links, columns, colors and the optional footer CTA."
    >
      {(v: any, set: any) => {
        const x = { ...defaults.footer, ...v },
          u = (k: string, n: any) => set({ ...x, [k]: n }),
          cols = x.columns || [],
          linkText = (items: any[] = []) =>
            items.map((a: any) => `${a.label} | ${a.url}`).join("\n"),
          parseLinks = (text: string) =>
            text
              .split("\n")
              .filter(Boolean)
              .map((line) => {
                const [label, url] = line.split("|").map((part) => part.trim());
                return { label, url };
              });
        return (
          <section className="card cc-panel">
            <div className="grid two">
              <div>
                <h2>Brand & contact</h2>
                <MediaUpload
                  kind="settingsLogo"
                  value={x.logo || null}
                  onChange={(n: any) => u("logo", n)}
                />
                <Field label="Description">
                  <textarea
                    rows={4}
                    value={x.description}
                    onChange={(e) => u("description", e.target.value)}
                  />
                </Field>
                {["address", "phone", "whatsapp", "email", "copyright"].map(
                  (k) => (
                    <Input
                      key={k}
                      label={label(k)}
                      value={x[k]}
                      set={(n: string) => u(k, n)}
                    />
                  ),
                )}
              </div>
              <div>
                <h2>Design & CTA</h2>
                <Input
                  label="Background"
                  type="color"
                  value={x.background}
                  set={(n: string) => u("background", n)}
                />
                <Input
                  label="Text color"
                  type="color"
                  value={x.textColor}
                  set={(n: string) => u("textColor", n)}
                />
                <Toggle
                  label="Footer CTA"
                  value={x.cta?.enabled}
                  set={(n: boolean) => u("cta", { ...x.cta, enabled: n })}
                />
                <Input
                  label="CTA title"
                  value={x.cta?.title}
                  set={(n: string) => u("cta", { ...x.cta, title: n })}
                />
                <Input
                  label="CTA button"
                  value={x.cta?.buttonLabel}
                  set={(n: string) => u("cta", { ...x.cta, buttonLabel: n })}
                />
                <Input
                  label="CTA URL"
                  value={x.cta?.url}
                  set={(n: string) => u("cta", { ...x.cta, url: n })}
                />
              </div>
            </div>
            <div className="grid three">
              <Field label="Social links (Label | URL)">
                <textarea
                  rows={5}
                  value={linkText(x.socialLinks)}
                  onChange={(e) => u("socialLinks", parseLinks(e.target.value))}
                />
              </Field>
              <Field label="Quick links (Label | URL)">
                <textarea
                  rows={5}
                  value={linkText(x.quickLinks)}
                  onChange={(e) => u("quickLinks", parseLinks(e.target.value))}
                />
              </Field>
              <Field label="Legal links (Label | URL)">
                <textarea
                  rows={5}
                  value={linkText(x.legalLinks)}
                  onChange={(e) => u("legalLinks", parseLinks(e.target.value))}
                />
              </Field>
            </div>
            <div className="cc-panel-title">
              <h2>Footer columns</h2>
              <button
                className="btn secondary"
                onClick={() =>
                  u("columns", [
                    ...cols,
                    { id: id(), title: "New column", links: [] },
                  ])
                }
              >
                <Plus size={16} /> Add Column
              </button>
            </div>
            {cols.map((col: any, i: number) => (
              <div className="wb-footer-column" key={col.id}>
                <GripVertical />
                <Input
                  label="Column title"
                  value={col.title}
                  set={(n: string) =>
                    u(
                      "columns",
                      cols.map((a: any) =>
                        a.id === col.id ? { ...a, title: n } : a,
                      ),
                    )
                  }
                />
                <Field label="Links (one per line: Label | URL)">
                  <textarea
                    rows={4}
                    value={(col.links || [])
                      .map((a: any) => `${a.label} | ${a.url}`)
                      .join("\n")}
                    onChange={(e) =>
                      u(
                        "columns",
                        cols.map((a: any) =>
                          a.id === col.id
                            ? {
                                ...a,
                                links: e.target.value
                                  .split("\n")
                                  .filter(Boolean)
                                  .map((line) => {
                                    const [label, url] = line
                                      .split("|")
                                      .map((s) => s.trim());
                                    return { label, url };
                                  }),
                              }
                            : a,
                        ),
                      )
                    }
                  />
                </Field>
                <button
                  className="icon-btn"
                  disabled={!i}
                  title="Move column up"
                  onClick={() => {
                    const next = [...cols];
                    [next[i - 1], next[i]] = [next[i], next[i - 1]];
                    u("columns", next);
                  }}
                >
                  <ArrowUp size={15} />
                </button>
                <button
                  className="icon-btn"
                  disabled={i === cols.length - 1}
                  title="Move column down"
                  onClick={() => {
                    const next = [...cols];
                    [next[i + 1], next[i]] = [next[i], next[i + 1]];
                    u("columns", next);
                  }}
                >
                  <ArrowDown size={15} />
                </button>
                <button
                  className="icon-btn danger"
                  onClick={() =>
                    confirm("Delete this footer column?") &&
                    u(
                      "columns",
                      cols.filter((a: any) => a.id !== col.id),
                    )
                  }
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </section>
        );
      }}
    </SimpleBuilder>
  );
}

function CampaignManager({ kind, title, description, popup = false }: any) {
  return (
    <SimpleBuilder kind={kind} title={title} description={description}>
      {(v: any, set: any) => {
        const items = v.items || [],
          update = (n: any[]) => set({ ...v, items: n }),
          fresh = popup
            ? {
                id: id(),
                type: "promotional",
                title: "New popup",
                message: "",
                link: "",
                buttonLabel: "Learn more",
                enabled: false,
                start: "",
                end: "",
                delay: 3,
                trigger: "delay",
                frequency: "once",
                audience: "all",
                pages: "all",
                desktop: true,
                mobile: true,
              }
            : {
                id: id(),
                title: "New announcement",
                message: "",
                link: "",
                buttonLabel: "",
                background: "#102d3c",
                textColor: "#ffffff",
                icon: "",
                enabled: false,
                dismissible: true,
                start: "",
                end: "",
                desktop: true,
                mobile: true,
              };
        return (
          <section className="card cc-panel">
            <div className="cc-panel-title">
              <h2>Saved {popup ? "popups" : "announcements"}</h2>
              <button className="btn" onClick={() => update([...items, fresh])}>
                <Plus size={16} /> Add {popup ? "Popup" : "Announcement"}
              </button>
            </div>
            {items.length ? (
              items.map((x: any) => (
                <details className="wb-campaign" key={x.id} open>
                  <summary>
                    <span>
                      <b>{x.title}</b>
                      <small>
                        {x.enabled ? "Active when schedule matches" : "Hidden"}
                      </small>
                    </span>
                    <span
                      className={`badge ${x.enabled ? "published" : "draft"}`}
                    >
                      {x.enabled ? "Enabled" : "Hidden"}
                    </span>
                  </summary>
                  <div className="grid three">
                    <Input
                      label="Title"
                      value={x.title}
                      set={(n: string) =>
                        update(
                          items.map((a: any) =>
                            a.id === x.id ? { ...a, title: n } : a,
                          ),
                        )
                      }
                    />
                    <Input
                      label="Message"
                      value={x.message}
                      set={(n: string) =>
                        update(
                          items.map((a: any) =>
                            a.id === x.id ? { ...a, message: n } : a,
                          ),
                        )
                      }
                    />
                    <Input
                      label="Link"
                      value={x.link}
                      set={(n: string) =>
                        update(
                          items.map((a: any) =>
                            a.id === x.id ? { ...a, link: n } : a,
                          ),
                        )
                      }
                    />
                    <Input
                      label="Button label"
                      value={x.buttonLabel}
                      set={(n: string) =>
                        update(
                          items.map((a: any) =>
                            a.id === x.id ? { ...a, buttonLabel: n } : a,
                          ),
                        )
                      }
                    />
                    {!popup && (
                      <Input
                        label="Icon (emoji or short symbol)"
                        value={x.icon}
                        set={(n: string) =>
                          update(
                            items.map((a: any) =>
                              a.id === x.id ? { ...a, icon: n.slice(0, 8) } : a,
                            ),
                          )
                        }
                      />
                    )}
                    <Input
                      label="Start date"
                      type="datetime-local"
                      value={x.start}
                      set={(n: string) =>
                        update(
                          items.map((a: any) =>
                            a.id === x.id ? { ...a, start: n } : a,
                          ),
                        )
                      }
                    />
                    <Input
                      label="End date"
                      type="datetime-local"
                      value={x.end}
                      set={(n: string) =>
                        update(
                          items.map((a: any) =>
                            a.id === x.id ? { ...a, end: n } : a,
                          ),
                        )
                      }
                    />
                    {popup && (
                      <>
                        <Select
                          label="Popup type"
                          value={x.type}
                          set={(n: string) =>
                            update(
                              items.map((a: any) =>
                                a.id === x.id ? { ...a, type: n } : a,
                              ),
                            )
                          }
                          options={[
                            "promotional",
                            "notice",
                            "book-promotion",
                            "course-promotion",
                            "exam-promotion",
                            "image",
                            "text",
                            "cta",
                          ]}
                        />
                        <Select
                          label="Trigger"
                          value={x.trigger}
                          set={(n: string) =>
                            update(
                              items.map((a: any) =>
                                a.id === x.id ? { ...a, trigger: n } : a,
                              ),
                            )
                          }
                          options={["delay", "exit-intent"]}
                        />
                        <Input
                          label="Delay (seconds)"
                          type="number"
                          value={x.delay}
                          set={(n: number) =>
                            update(
                              items.map((a: any) =>
                                a.id === x.id ? { ...a, delay: n } : a,
                              ),
                            )
                          }
                        />
                        <Select
                          label="Frequency"
                          value={x.frequency}
                          set={(n: string) =>
                            update(
                              items.map((a: any) =>
                                a.id === x.id ? { ...a, frequency: n } : a,
                              ),
                            )
                          }
                          options={["once", "every-visit"]}
                        />
                        <Select
                          label="Audience"
                          value={x.audience}
                          set={(n: string) =>
                            update(
                              items.map((a: any) =>
                                a.id === x.id ? { ...a, audience: n } : a,
                              ),
                            )
                          }
                          options={["all", "public"]}
                        />
                        <Input
                          label="Pages (all or comma-separated paths)"
                          value={x.pages}
                          set={(n: string) =>
                            update(
                              items.map((a: any) =>
                                a.id === x.id ? { ...a, pages: n } : a,
                              ),
                            )
                          }
                        />
                        <Input
                          label="Image URL / media ID"
                          value={x.media}
                          set={(n: string) =>
                            update(
                              items.map((a: any) =>
                                a.id === x.id ? { ...a, media: n } : a,
                              ),
                            )
                          }
                        />
                        <p className="muted span-two">
                          Logged-in targeting is intentionally unavailable until
                          the website has a general learner sign-in. Choose All
                          or Public.
                        </p>
                      </>
                    )}
                    {!popup && (
                      <>
                        <Input
                          label="Background"
                          type="color"
                          value={x.background}
                          set={(n: string) =>
                            update(
                              items.map((a: any) =>
                                a.id === x.id ? { ...a, background: n } : a,
                              ),
                            )
                          }
                        />
                        <Input
                          label="Text color"
                          type="color"
                          value={x.textColor}
                          set={(n: string) =>
                            update(
                              items.map((a: any) =>
                                a.id === x.id ? { ...a, textColor: n } : a,
                              ),
                            )
                          }
                        />
                        <Toggle
                          label="Dismissible"
                          value={x.dismissible}
                          set={(n: boolean) =>
                            update(
                              items.map((a: any) =>
                                a.id === x.id ? { ...a, dismissible: n } : a,
                              ),
                            )
                          }
                        />
                      </>
                    )}
                    <Toggle
                      label="Enabled"
                      value={x.enabled}
                      set={(n: boolean) =>
                        update(
                          items.map((a: any) =>
                            a.id === x.id
                              ? { ...a, enabled: n }
                              : !popup && n
                                ? { ...a, enabled: false }
                                : a,
                          ),
                        )
                      }
                    />
                    <Toggle
                      label="Desktop"
                      value={x.desktop}
                      set={(n: boolean) =>
                        update(
                          items.map((a: any) =>
                            a.id === x.id ? { ...a, desktop: n } : a,
                          ),
                        )
                      }
                    />
                    <Toggle
                      label="Mobile"
                      value={x.mobile}
                      set={(n: boolean) =>
                        update(
                          items.map((a: any) =>
                            a.id === x.id ? { ...a, mobile: n } : a,
                          ),
                        )
                      }
                    />
                    <button
                      className="btn danger"
                      onClick={() =>
                        confirm(`Delete ${x.title}?`) &&
                        update(items.filter((a: any) => a.id !== x.id))
                      }
                    >
                      <Trash2 size={15} /> Delete
                    </button>
                  </div>
                </details>
              ))
            ) : (
              <EmptyState
                title={`No saved ${popup ? "popups" : "announcements"}`}
              >
                Create one, save a draft, then publish when ready.
              </EmptyState>
            )}
          </section>
        );
      }}
    </SimpleBuilder>
  );
}
export const AnnouncementManager = () => (
  <CampaignManager
    kind="announcement"
    title="Announcement Bar"
    description="Schedule, target and style site-wide announcements."
  />
);
export const PopupManager = () => (
  <CampaignManager
    kind="popups"
    title="Popup Manager"
    description="Create scheduled promotions and notices with controlled triggers and visibility."
    popup
  />
);

export function ReusableSections() {
  return (
    <SimpleBuilder
      kind="reusable-sections"
      title="Reusable Sections"
      description="Create a global block once and link it across multiple pages."
    >
      {(v: any, set: any) => {
        const items = v.items || [];
        return (
          <section className="card cc-panel">
            <div className="cc-panel-title">
              <h2>Global blocks</h2>
              <button
                className="btn"
                onClick={() => {
                  const name = prompt("Reusable section name", "New CTA");
                  if (name)
                    set({
                      ...v,
                      items: [
                        ...items,
                        {
                          id: id(),
                          name,
                          section: defaultSection("cta"),
                          updatedAt: Date.now(),
                        },
                      ],
                    });
                }}
              >
                <Plus size={16} /> New Reusable Section
              </button>
            </div>
            {items.length ? (
              <div className="wb-reusable-grid">
                {items.map((x: any) => (
                  <article className="card" key={x.id}>
                    <RotateCcw />
                    <div>
                      <b>{x.name}</b>
                      <small>
                        {label(x.section?.type || "section")} · changes update
                        every linked instance
                      </small>
                    </div>
                    <button
                      className="icon-btn"
                      onClick={() => {
                        const name = prompt("Section name", x.name);
                        const title = prompt(
                          "Section title",
                          x.section?.content?.title || "",
                        );
                        if (name)
                          set({
                            ...v,
                            items: items.map((a: any) =>
                              a.id === x.id
                                ? {
                                    ...a,
                                    name,
                                    section: {
                                      ...a.section,
                                      content: { ...a.section.content, title },
                                    },
                                    updatedAt: Date.now(),
                                  }
                                : a,
                            ),
                          });
                      }}
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      className="icon-btn"
                      onClick={() =>
                        set({
                          ...v,
                          items: [
                            ...items,
                            {
                              ...JSON.parse(JSON.stringify(x)),
                              id: id(),
                              name: `${x.name} Copy`,
                              updatedAt: Date.now(),
                            },
                          ],
                        })
                      }
                    >
                      <Copy size={15} />
                    </button>
                    <button
                      className="icon-btn danger"
                      onClick={() =>
                        confirm(
                          "Delete this reusable section? Existing linked instances will retain their last saved content.",
                        ) &&
                        set({
                          ...v,
                          items: items.filter((a: any) => a.id !== x.id),
                        })
                      }
                    >
                      <Trash2 size={15} />
                    </button>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState title="No reusable sections yet">
                Save frequently used CTAs, reviews, promotions or contact blocks
                here.
              </EmptyState>
            )}
          </section>
        );
      }}
    </SimpleBuilder>
  );
}

export function GlobalLayout() {
  return (
    <SimpleBuilder
      kind="global-layout"
      title="Global Layout"
      description="Set structural defaults without duplicating colors and typography from Theme Manager."
    >
      {(v: any, set: any) => {
        const x = { ...defaults["global-layout"], ...v },
          u = (k: string, n: any) => set({ ...x, [k]: n });
        return (
          <section className="card cc-panel">
            <div className="grid three">
              {[
                ["websiteWidth", "Website width"],
                ["containerWidth", "Content container width"],
                ["sectionSpacing", "Section spacing"],
                ["pageTopSpacing", "Default page top spacing"],
                ["pageBottomSpacing", "Default page bottom spacing"],
                ["sidebarWidth", "Sidebar width"],
              ].map(([k, t]) => (
                <Input
                  key={k}
                  label={t}
                  type="number"
                  value={x[k]}
                  set={(n: number) => u(k, n)}
                />
              ))}
            </div>
            <div className="grid three">
              <Select
                label="Layout"
                value={x.layout}
                set={(n: string) => u("layout", n)}
                options={["full-width", "boxed"]}
              />
              <Input
                label="Background"
                type="color"
                value={x.background}
                set={(n: string) => u("background", n)}
              />
              <Select
                label="Page title layout"
                value={x.pageTitleLayout}
                set={(n: string) => u("pageTitleLayout", n)}
                options={["standard", "centered", "minimal", "hidden"]}
              />
              <Toggle
                label="Breadcrumbs"
                value={x.breadcrumbs}
                set={(n: boolean) => u("breadcrumbs", n)}
              />
              <Select
                label="Page transitions"
                value={x.pageTransition}
                set={(n: string) => u("pageTransition", n)}
                options={["none", "subtle", "fade"]}
              />
            </div>
          </section>
        );
      }}
    </SimpleBuilder>
  );
}
export function ResponsivePreview() {
  return (
    <SimpleBuilder
      kind="responsive"
      title="Responsive Preview"
      description="Tune device defaults independently and preview without changing another breakpoint."
    >
      {(v: any, set: any) => {
        const x = { ...defaults.responsive, ...v },
          device = x.device || "desktop",
          d = x[device] || defaults.responsive[device],
          u = (k: string, n: any) => set({ ...x, [device]: { ...d, [k]: n } });
        return (
          <>
            <div className="wb-devices standalone">
              {[
                ["desktop", Monitor],
                ["tablet", Tablet],
                ["mobile", Smartphone],
              ].map(([name, I]: any) => (
                <button
                  className={device === name ? "active" : ""}
                  onClick={() => set({ ...x, device: name })}
                  key={name}
                >
                  <I size={17} />
                  {label(name)}
                </button>
              ))}
            </div>
            <div className="wb-responsive-layout">
              <section className="card cc-panel">
                <h2>{label(device)} controls</h2>
                <div className="grid two">
                  {[
                    ["fontSize", "Font size"],
                    ["padding", "Padding"],
                    ["margin", "Margin"],
                    ["width", "Width (%)"],
                    ["columns", "Columns"],
                    ["imageSize", "Image size (%)"],
                  ].map(([k, t]) => (
                    <Input
                      key={k}
                      label={t}
                      type="number"
                      value={d[k]}
                      set={(n: number) => u(k, n)}
                    />
                  ))}
                </div>
                <Select
                  label="Alignment"
                  value={d.alignment}
                  set={(n: string) => u("alignment", n)}
                  options={["left", "center", "right"]}
                />
                <Toggle
                  label="Visible by default"
                  value={d.visible}
                  set={(n: boolean) => u("visible", n)}
                />
              </section>
              <section
                className={`card wb-device-preview ${device}`}
                style={{
                  padding: d.padding,
                  textAlign: d.alignment,
                  fontSize: d.fontSize,
                }}
              >
                <small>{label(device)} preview</small>
                <h2>LexVeritas Academy</h2>
                <p>
                  Responsive settings are scoped to this breakpoint. Desktop
                  remains unchanged when mobile is edited.
                </p>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: `repeat(${Math.max(1, d.columns)},1fr)`,
                    gap: 12,
                  }}
                >
                  {Array.from({ length: Math.min(3, d.columns) }).map(
                    (_, i) => (
                      <span key={i} />
                    ),
                  )}
                </div>
              </section>
            </div>
          </>
        );
      }}
    </SimpleBuilder>
  );
}
