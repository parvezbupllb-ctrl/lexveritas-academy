"use client";
import { Fragment, useEffect, useState } from "react";
import { toast } from "sonner";
import { MediaUpload } from "./media-upload";
import {
  LayoutDashboard,
  ClipboardList,
  KeyRound,
  BookOpen,
  ShoppingBag,
  FileText,
  FileSearch,
  Settings,
  Users,
  Trophy,
  Plus,
  ArrowUpRight,
  ArrowRight,
  Download,
  LogOut,
  Search,
  Copy,
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  Trash2,
  Pencil,
  CheckCircle2,
  PackageCheck,
  QrCode,
  Bell,
  GraduationCap,
  NotebookTabs,
  Newspaper,
  BadgeCheck,
  PanelsTopLeft,
  PanelTop,
  PanelBottom,
  Palette,
  Images,
  CreditCard,
  SearchCheck,
  Shield,
  ChevronDown,
  Eye,
  History,
  ShieldCheck,
  Database,
  RefreshCw,
  LockKeyhole,
} from "lucide-react";
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Switch } from "@/components/ui/switch";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  api,
  useData,
  Field,
  Choice,
  Confirm,
  EmptyState,
  Loading,
  ErrorBox,
  DataTable,
  Pages,
  ActionButton,
  money,
  date,
  duration,
  cash,
  deliveryNames,
} from "@/lib/client";
import { Brand } from "./site";
import { AdminPackages } from "./packages-admin";
import { ExamQr } from "@/components/exam-qr";
import { ContentManager } from "./content-admin";
import { StudyAdmin } from "./study-admin";
import { CourseBuilder, CourseManager } from "./course-builder";
import { ExamBuilder } from "./exam-builder";
import { BlogManager } from "./blog-admin";
import { WebsiteSettings } from "./settings-admin";
import { SeoManager } from "./seo-admin";
import {
  ActivityLogs,
  AdminUsers,
  CommerceDashboard,
  CouponManager,
  DeliveryPricingManager,
  MediaLibrary,
  PaymentsManager,
  RolesManager,
  SettingsStudio,
  VersionHistoryPage,
} from "./control-center";
import { BackupCenter } from "./backup-admin";
import {
  AnnouncementManager,
  FooterBuilder,
  GlobalLayout,
  HeaderBuilder,
  NavigationManager,
  PagesManager,
  PopupManager,
  ResponsivePreview,
  ReusableSections,
  WebsiteBuilder,
  WebsiteDashboard,
} from "./website-admin";
const menuGroups: any[] = [
  ["", [["Dashboard", "/admin", LayoutDashboard]]],
  [
    "Content",
    [
      ["Notices", "/admin/notices", Bell],
      ["Notes", "/admin/notes", NotebookTabs],
      ["Study Routine Builder", "/admin/study-routine", NotebookTabs],
      ["Books", "/admin/books", BookOpen],
      ["Blog", "/admin/blogs", Newspaper],
      ["Reviews", "/admin/reviews", BadgeCheck],
      ["Team Members", "/admin/team", Users],
    ],
  ],
  ["Learning & Exams", [
    ["Courses", "/admin/courses", GraduationCap],
    ["Exam Packages", "/admin/packages", PackageCheck],
    ["MCQ Exams", "/admin/exams", ClipboardList],
    ["Access Codes", "/admin/codes", KeyRound],
  ]],
  [
    "Website",
    [
      ["Website Dashboard", "/admin/website", LayoutDashboard],
      ["Pages", "/admin/website/pages", FileText],
      ["Website Builder", "/admin/website/builder", PanelsTopLeft],
      ["Navigation", "/admin/website/navigation", Settings],
      ["Header Builder", "/admin/website/header", PanelTop],
      ["Footer Builder", "/admin/website/footer", PanelBottom],
      ["Announcement Bar", "/admin/website/announcement", Bell],
      ["Popup Manager", "/admin/website/popups", PanelsTopLeft],
      ["Reusable Sections", "/admin/website/reusable", Copy],
      ["Global Layout", "/admin/website/layout", Settings],
      ["Responsive Preview", "/admin/website/responsive", Eye],
    ],
  ],
  [
    "Appearance",
    [
      ["Theme Manager", "/admin/appearance/theme", Palette],
      ["Colors & Typography", "/admin/appearance/design", Palette],
      ["Buttons & Cards", "/admin/appearance/components", PanelsTopLeft],
      [
        "Spacing, Borders & Shadows",
        "/admin/appearance/surfaces",
        PanelsTopLeft,
      ],
      ["Animations", "/admin/appearance/animations", ArrowUpRight],
      [
        "Desktop / Tablet / Mobile",
        "/admin/appearance/responsive",
        PanelsTopLeft,
      ],
    ],
  ],
  [
    "Media",
    [
      ["Media Library", "/admin/media", Images],
      ["Images", "/admin/media/images", Images],
      ["PDFs & Documents", "/admin/media/documents", FileText],
    ],
  ],
  [
    "Commerce",
    [
      ["Commerce Dashboard", "/admin/commerce", LayoutDashboard],
      ["Orders", "/admin/orders/hardcopy", ShoppingBag],
      ["Payments", "/admin/commerce/payments", CreditCard],
      ["Coupons", "/admin/commerce/coupons", BadgeCheck],
      ["Delivery & Pricing", "/admin/commerce/settings", Settings],
    ],
  ],
  [
    "SEO",
    [
      ["SEO Dashboard", "/admin/seo/dashboard", LayoutDashboard],
      ["Global SEO", "/admin/seo/global", SearchCheck],
      ["Page SEO", "/admin/seo/pages", FileSearch],
      ["Social & Open Graph", "/admin/seo/social", ArrowUpRight],
      ["Sitemap", "/admin/seo/sitemap", FileText],
      ["Robots & Crawling", "/admin/seo/robots", Shield],
      ["Redirects", "/admin/seo/redirects", ArrowRight],
      ["Schema / Structured Data", "/admin/seo/schema", PanelsTopLeft],
      ["SEO Audit", "/admin/seo/audit", SearchCheck],
      ["Search Engine Verification", "/admin/seo/verification", BadgeCheck],
    ],
  ],
  [
    "System",
    [
      ["Admin Users", "/admin/system/users", Users],
      ["Roles & Permissions", "/admin/system/roles", Shield],
      ["Activity Logs", "/admin/system/logs", ClipboardList],
      ["Recovery Center", "/admin/system/backup-restore", ShieldCheck],
      ["Version History", "/admin/system/versions", History],
      ["Maintenance Mode", "/admin/system/maintenance", Settings],
      ["Site Settings", "/admin/settings", Settings],
    ],
  ],
];
const menus = menuGroups.flatMap(([, items]) => items);
const menuModule = (url: string) => {
  const part = url.split("/")[2];
  if (!part) return "dashboard";
  if (part === "website" || part === "appearance") return "control";
  if (part === "seo") return "seo";
  if (part === "system") {
    if (url.includes("/users")) return "users";
    if (url.includes("/roles")) return "roles";
    if (url.includes("/logs")) return "logs";
    if (url.includes("/versions") || url.includes("/maintenance")) return "control";
    return "backup";
  }
  if (part === "commerce") return url.includes("/payments") ? "payments" : url.includes("/coupons") ? "coupons" : url.includes("/settings") ? "pricing" : "commerce-dashboard";
  if (part === "orders") return "orders";
  if (part === "settings") return "me";
  if (part === "reviews") return "reviews";
  if (part === "study-routine") return "study";
  return part;
};
const superAdminOnly = (url: string) =>
  url.startsWith("/admin/system/backup") ||
  [
    "/admin/system/users",
    "/admin/system/roles",
    "/admin/system/history",
    "/admin/system/scheduled",
    "/admin/system/storage",
    "/admin/system/import-export",
    "/admin/system/migration",
    "/admin/system/health",
    "/admin/system/source-code",
  ].includes(url);
export default function Admin({ path }: any) {
  const [user, setUser] = useState<any>(null),
    [error, setError] = useState("");
  useEffect(() => {
    if (path === "/admin/login") return;
    api("admin/me")
      .then((u) => {
        setUser(u);
        if (u.mustChange && path !== "/admin/settings")
          window.location.href = "/admin/settings";
      })
      .catch((e) => {
        if (e.status === 401) window.location.href = "/admin/login";
        else setError(e.message);
      });
  }, [path]);
  if (path === "/admin/login") return <Login />;
  if (!user)
    return (
      <div className="container section">
        <ErrorBox error={error} />
        {!error && <Loading />}
      </div>
    );
  const parts = path.split("/"),
    name = menus.find((x) => x[1] === path)?.[0] || ({history:"Backup History",scheduled:"Scheduled Backups",storage:"Google Drive", "import-export":"Import / Export",migration:"Migration Package",health:"Backup Health","source-code":"Source Code Backup Status"} as Record<string,string>)[parts[3]] || ({courses:"Courses",packages:"Exam Packages",exams:"MCQ Exams",codes:"Access Codes"} as Record<string,string>)[parts[2]] || "Dashboard";
  const canAccess = (url: string) =>
    (user.role === "super_admin" || !superAdminOnly(url)) &&
    (user.allowedModules?.includes("*") || user.allowedModules?.includes(menuModule(url)) || menuModule(url) === "me");
  const availableMenus = menus.filter((x: any) => canAccess(x[1]));
  return (
    <SidebarProvider>
      <Sidebar className="admin-sidebar">
        <SidebarHeader>
          <Brand
            tone="dark"
            settings={{
              websiteLogo: "/assets/lexveritas-logo-white.png",
              websiteName: "LexVeritas Academy",
              brandText: "LexVeritas Academy",
              showBrandText: true,
            }}
          />
          <span className="sidebar-caption">LEXVERITAS CONTROL CENTER</span>
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            {menuGroups.map(([group, rawItems]) => {
              const items = rawItems.filter((x: any) => canAccess(x[1]));
              if (!items.length) return null;
              return group ? (
                <details
                  className="admin-menu-group"
                  key={group}
                  open={items.some(
                    (x: any) => path === x[1] || path.startsWith(x[1] + "/"),
                  )}
                >
                  <summary>
                    <span>{group}</span>
                    <ChevronDown size={14} />
                  </summary>
                  {items.map(([label, url, Icon]: any) => (
                    <SidebarMenuItem key={url}>
                      <SidebarMenuButton asChild isActive={path === url}>
                        <a href={url}>
                          <Icon size={18} />
                          <span>{label}</span>
                        </a>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </details>
              ) : (
                items.map(([label, url, Icon]: any) => (
                  <SidebarMenuItem key={url}>
                    <SidebarMenuButton asChild isActive={path === url}>
                      <a href={url}>
                        <Icon size={18} />
                        <span>{label}</span>
                      </a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))
              );
            })}
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter>
          <a href="/" className="text-link">
            View public website <ArrowUpRight size={16} />
          </a>
          <ActionButton
            className="sidebar-logout"
            action={async () => {
              await api("logout", {});
              window.location.href = "/admin/login";
            }}
          >
            <LogOut size={17} /> Sign out
          </ActionButton>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="admin-inset">
        <header className="admin-header">
          <div className="admin-header-title">
            <SidebarTrigger />
            <span>
              Control Center <b>/</b> {name}
            </span>
          </div>
          <div className="admin-top-actions">
            <label className="admin-global-search">
              <Search size={16} />
              <input
                placeholder="Search menu…"
                list="available-admin-menus"
                onKeyDown={(e: any) => {
                  if (e.key === "Enter") {
                    const q = e.currentTarget.value.trim().toLowerCase();
                    if (!q) return;
                    const hit = availableMenus.find((x: any) =>
                      x[0].toLowerCase().includes(q),
                    );
                    if (hit) window.location.href = hit[1];
                    else toast.info("No matching menu is available for your role.");
                  }
                }}
              />
              <datalist id="available-admin-menus">{availableMenus.map((x:any)=><option key={x[1]} value={x[0]}/>)}</datalist>
            </label>
            <a
              className="icon-btn"
              href="/"
              target="_blank"
              title="Preview website"
            >
              <Eye size={17} />
            </a>
            <span className="admin-user">
              <span className="avatar">
                {user.username.slice(0, 2).toUpperCase()}
              </span>
              <span>
                {user.username}
                <small>{String(user.role).replaceAll("_", " ")}</small>
              </span>
            </span>
            <ActionButton
              className="icon-btn"
              title="Logout"
              action={async () => {
                await api("logout", {});
                window.location.href = "/admin/login";
              }}
            >
              <LogOut size={17} />
            </ActionButton>
          </div>
        </header>
        <main className="admin-main">
          {user.mustChange && (
            <div className="notice warning">
              Change your temporary password before using the Admin Dashboard.
              You will sign in again after changing it.
            </div>
          )}
          {path === "/admin" ? (
            <Dashboard role={user.role} />
          ) : path === "/admin/website" ? (
            <WebsiteDashboard />
          ) : ["/admin/website/builder", "/admin/website/homepage"].includes(
              path,
            ) ? (
            <WebsiteBuilder />
          ) : path === "/admin/website/pages" ? (
            <PagesManager />
          ) : path === "/admin/website/navigation" ? (
            <NavigationManager />
          ) : path === "/admin/website/header" ? (
            <HeaderBuilder />
          ) : path === "/admin/website/footer" ? (
            <FooterBuilder />
          ) : path === "/admin/website/announcement" ? (
            <AnnouncementManager />
          ) : path === "/admin/website/popups" ? (
            <PopupManager />
          ) : path === "/admin/website/reusable" ? (
            <ReusableSections />
          ) : path === "/admin/website/layout" ? (
            <GlobalLayout />
          ) : path === "/admin/website/responsive" ? (
            <ResponsivePreview />
          ) : path.startsWith("/admin/appearance/responsive") ? (
            <SettingsStudio kind="responsive" />
          ) : path.startsWith("/admin/appearance/theme") ? (
            <SettingsStudio kind="theme" />
          ) : path.startsWith("/admin/appearance/design") ? (
            <SettingsStudio kind="theme" focus="design" />
          ) : path.startsWith("/admin/appearance/components") ? (
            <SettingsStudio kind="appearance" focus="components" />
          ) : path.startsWith("/admin/appearance/surfaces") ? (
            <SettingsStudio kind="appearance" focus="surfaces" />
          ) : path.startsWith("/admin/appearance/animations") ? (
            <SettingsStudio kind="appearance" focus="animations" />
          ) : path.startsWith("/admin/appearance/") ? (
            <SettingsStudio kind="appearance" />
          ) : path.startsWith("/admin/media") ? (
            <MediaLibrary />
          ) : path === "/admin/commerce" ? (
            <CommerceDashboard />
          ) : path === "/admin/commerce/payments" ? (
            <PaymentsManager />
          ) : path === "/admin/commerce/coupons" ? (
            <CouponManager />
          ) : path === "/admin/commerce/settings" ? (
            <DeliveryPricingManager />
          ) : path.startsWith("/admin/commerce/") ? (
            <SettingsStudio kind="commerce" />
          ) : path === "/admin/seo" || path.startsWith("/admin/seo/") ? (
            <SeoManager section={path.split("/")[3] || "dashboard"} />
          ) : path === "/admin/system/users" ? (
            <AdminUsers />
          ) : path === "/admin/system/roles" ? (
            <RolesManager />
          ) : path === "/admin/system/logs" ? (
            <ActivityLogs />
          ) : path === "/admin/system/backups" ? (
            <BackupCenter section="backup-restore" />
          ) : [
              "backup-restore",
              "history",
              "scheduled",
              "storage",
              "import-export",
              "migration",
              "health",
              "source-code",
            ].includes(path.split("/")[3]) ? (
            <BackupCenter section={path.split("/")[3]} />
          ) : path === "/admin/system/maintenance" ? (
            <SettingsStudio kind="maintenance" />
          ) : path === "/admin/system/versions" ? (
            <VersionHistoryPage />
          ) : path === "/admin/settings" ? (
            <AdminSettings mustChange={user.mustChange} />
          ) : path === "/admin/codes" ? (
            <Codes />
          ) : path === "/admin/books" ? (
            <AdminBooks />
          ) : path === "/admin/team" ? (
            <ContentManager kind="team" />
          ) : path === "/admin/notices" ? (
            <ContentManager kind="notices" />
          ) : path === "/admin/courses" ? (
            <CourseManager />
          ) : path === "/admin/courses/new" ? (
            <CourseBuilder />
          ) : parts[2] === "courses" && parts[3] ? (
            <CourseBuilder id={parts[3]} />
          ) : path === "/admin/notes" ? (
            <ContentManager kind="notes" />
          ) : path === "/admin/study-routine" ? (
            <StudyAdmin />
          ) : path === "/admin/blogs" ? (
            <BlogManager />
          ) : path === "/admin/reviews" ? (
            <ContentManager kind="reviews" />
          ) : path === "/admin/packages" ? (
            <AdminPackages />
          ) : parts[2] === "packages" && parts[3] ? (
            <AdminPackages id={parts[3]} />
          ) : parts[2] === "orders" ? (
            <Orders type={parts[3]} />
          ) : path === "/admin/exams" ? (
            <AdminExams />
          ) : path === "/admin/exams/new" ? (
            <ExamBuilder />
          ) : parts[2] === "exams" && parts[4] === "questions" ? (
            <ExamBuilder id={parts[3]} />
          ) : parts[2] === "exams" &&
            ["participants", "ranking"].includes(parts[4]) ? (
            <Ranking id={parts[3]} />
          ) : parts[2] === "exams" && parts[3] ? (
            <ExamBuilder id={parts[3]} />
          ) : (
            <ExamChooser kind={parts[2]} />
          )}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
function AdminHeading({ title, description, children }: any) {
  return (
    <div className="section-head admin-page-heading">
      <div>
        <div className="eyebrow">LEXVERITAS ACADEMY</div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {children}
    </div>
  );
}
function Login() {
  const [username, setUsername] = useState(""),
    [password, setPassword] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <div className="login-page">
      <div className="login-card">
        <Brand />
        <div className="eyebrow">ACADEMY ADMINISTRATION</div>
        <h1>Welcome back.</h1>
        <p>Sign in to manage your Academy.</p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            try {
              const r = await api("login", { username, password });
              window.location.href = r.mustChange
                ? "/admin/settings"
                : "/admin";
            } catch (e: any) {
              setError(e.message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <Field
            label="Username"
            value={username}
            onChange={(e: any) => setUsername(e.target.value)}
            required
            autoComplete="username"
          />
          <Field
            label="Password"
            value={password}
            onChange={(e: any) => setPassword(e.target.value)}
            required
            type="password"
            autoComplete="current-password"
          />
          <ErrorBox error={error} />
          <button className="btn full" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <a className="back-link" href="/">
          <ArrowLeft size={15} />
          Return to the Academy
        </a>
      </div>
    </div>
  );
}
function BackupHealthWidget() {
  const { data } = useData("admin/backup/overview");
  if (!data) return null;
  const good = data.health.status === "healthy";
  return (
    <a
      href="/admin/system/health"
      className={`card dashboard-backup-health ${good ? "good" : "warning"}`}
    >
      <ShieldCheck />
      <span>
        <small>BACKUP HEALTH</small>
        <strong>{data.health.status}</strong>
        <em>
          Last verified: {date(data.health.lastVerifiedBackup)} · Drive:{" "}
          {String(data.health.driveStatus).replaceAll("_", " ")}
        </em>
      </span>
      <ArrowUpRight />
    </a>
  );
}
function Dashboard({ role }: any) {
  const { data, error } = useData("admin/dashboard");
  return (
    <>
      <AdminHeading
        title="Academy overview"
        description="Your examinations, students, and orders at a glance."
      />
      <ErrorBox error={error} />
      {!data && !error ? (
        <Loading />
      ) : (
        data && (
          <>
            <div className="stats-grid">
              {[
                ["Total Exams", "exams", ClipboardList],
                ["Active Exams", "active", CheckCircle2],
                ["Exam Participants", "participants", Users],
                ["Total Codes", "codes", KeyRound],
                ["Hardcopy Orders", "hardcopy", ShoppingBag],
                ["Softcopy Orders", "softcopy", FileText],
                ["Exam Packages", "packages", PackageCheck],
                ["Package Orders", "package_orders", PackageCheck],
                ["Courses", "courses", GraduationCap],
                ["Course Orders", "course_orders", GraduationCap],
                ["Blogs", "blogs", Newspaper],
                ["Unverified Payments", "unverified", Trophy],
              ].map(([label, key, Icon]: any) => (
                <div className="stat" key={key}>
                  <div>
                    <span>{label}</span>
                    <Icon size={21} />
                  </div>
                  <strong>{data[key].toLocaleString()}</strong>
                </div>
              ))}
            </div>
            {role === "super_admin" && <BackupHealthWidget />}
            <div className="admin-welcome">
              <div>
                <div className="eyebrow">BUILD YOUR NEXT EXAMINATION</div>
                <h2>From preparation to progress.</h2>
                <p>
                  Create questions, set the marking rules, and publish when
                  you’re ready.
                </p>
                <a href="/admin/exams/new" className="btn gold">
                  <Plus size={17} />
                  Create examination
                </a>
              </div>
              <ClipboardList size={75} strokeWidth={0.8} />
            </div>
            {data.codes === 0 && (
              <div className="notice warning">
                <h3>Generate your initial access codes</h3>
                <p>
                  Generate 10,000 secure codes in Unique Codes before admitting
                  students.
                </p>
                <a className="btn" href="/admin/codes">
                  Open Unique Codes
                </a>
              </div>
            )}
            <div className="grid three">
              <a href="/admin/codes" className="card quick-link">
                <KeyRound />
                <h3>Manage access codes</h3>
                <p>Generate, export, and review code usage.</p>
                <ArrowUpRight />
              </a>
              <a href="/admin/orders/hardcopy" className="card quick-link">
                <ShoppingBag />
                <h3>Review hardcopy orders</h3>
                <p>Verify payments and track deliveries.</p>
                <ArrowUpRight />
              </a>
              <a href="/admin/books" className="card quick-link">
                <BookOpen />
                <h3>Manage the bookshelf</h3>
                <p>Publish books, covers, and previews.</p>
                <ArrowUpRight />
              </a>
            </div>
          </>
        )
      )}
    </>
  );
}
function AdminExams() {
  const { data, error, reload } = useData("admin/exams");
  const [qr, setQr] = useState<any>(null);
  const [deleting, setDeleting] = useState<any>(null);
  return (
    <>
      <AdminHeading
        title="Examinations"
        description="Create, schedule, and manage your MCQ examinations."
      >
        <a className="btn" href="/admin/exams/new">
          <Plus size={17} />
          Create exam
        </a>
      </AdminHeading>
      <ErrorBox error={error} />
      {!data && !error ? (
        <Loading />
      ) : data?.length ? (
        <div className="table-card">
          <DataTable
            headers={[
              "Examination",
              "Schedule (Dhaka)",
              "Status",
              "Access",
              "Questions",
              "Participants",
              "Manage",
            ]}
            rows={data.map((e: any) => [
              <a key="exam" href={"/admin/exams/" + e.id} className="table-title">
                {e.title}
              </a>,
              date(e.start),
              <span key="status" className="badge">{e.status}</span>,
              e.access_mode==="open"?"Open":"Code required",
              e.question_count,
              e.participants,
              <div key="manage" className="table-actions">
                <a className="text-link" href={"/admin/exams/" + e.id}>
                  Edit
                </a>
                <a
                  className="text-link"
                  href={"/admin/exams/" + e.id + "/questions"}
                >
                  Questions
                </a>
                <a
                  className="text-link"
                  href={"/admin/exams/" + e.id + "/ranking"}
                >
                  Ranking
                </a>
                <ActionButton
                  className="icon-btn"
                  aria-label="Duplicate exam"
                  action={async () => {
                    await api("admin/exams/" + e.id + "/duplicate", {});
                    toast.success("Exam duplicated");
                    reload();
                  }}
                >
                  <Copy size={16} />
                </ActionButton>
                <button
                  className="icon-btn"
                  aria-label="Show exam QR code"
                  onClick={async () => {
                    try {
                      const link = await api(`admin/exams/${e.id}/link`, {});
                      setQr({ ...e, path: link.path });
                    } catch (x: any) {
                      toast.error(x.message);
                    }
                  }}
                >
                  <QrCode size={16} />
                </button>
                <button
                  className="icon-btn danger"
                  aria-label="Delete exam"
                  onClick={() => setDeleting(e)}
                >
                  <Trash2 size={16} />
                </button>
              </div>,
            ])}
          />
        </div>
      ) : (
        <EmptyState title="Create your first examination">
          Start with a title, schedule, and marking rules. Add questions before
          publishing.
        </EmptyState>
      )}
      <Dialog open={!!qr} onOpenChange={(v) => !v && setQr(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{qr?.title} — QR Code</DialogTitle>
          </DialogHeader>
          {qr && <ExamQr examId={qr.id} title={qr.title} path={qr.path} />}
        </DialogContent>
      </Dialog>
      <Confirm
        open={!!deleting}
        onOpenChange={(v: boolean) => !v && setDeleting(null)}
        title="Delete this examination?"
        description="The exam, questions, answers, attempts and Package schedule associations will be permanently removed. Other Exams and Packages will remain unchanged."
        action="Delete exam"
        onConfirm={async () => {
          try {
            await api(`admin/exams/${deleting.id}`, undefined, "DELETE");
            toast.success("Exam deleted");
            setDeleting(null);
            reload();
          } catch (e: any) {
            toast.error(e.message);
          }
        }}
      />
    </>
  );
}
function ExamChooser({ kind }: any) {
  const { data, error } = useData("admin/exams");
  const target =
    kind === "questions"
      ? "questions"
      : kind === "participants"
        ? "participants"
        : "ranking";
  return (
    <>
      <AdminHeading
        title={
          kind === "pdf"
            ? "Generate Position PDF"
            : kind === "questions"
              ? "MCQ Questions"
              : kind === "participants"
                ? "Participants"
                : "Results & Rankings"
        }
        description="Choose an examination to continue."
      />
      <ErrorBox error={error} />
      {!data && !error ? (
        <Loading />
      ) : data?.length ? (
        <div className="grid two">
          {data.map((e: any) => (
            <a
              className="card quick-link"
              href={"/admin/exams/" + e.id + "/" + target}
              key={e.id}
            >
              <h3>{e.title}</h3>
              <p>
                {e.question_count} questions · {e.participants} participants
              </p>
              <ArrowUpRight size={19} />
            </a>
          ))}
        </div>
      ) : (
        <EmptyState title="No examinations yet">
          Create an examination first.
        </EmptyState>
      )}
    </>
  );
}
function Upload({ kind, value, onChange }: any) {
  return <MediaUpload kind={kind} value={value} onChange={onChange} />;
}
function Questions({ id }: any) {
  const {
      data: qs,
      error,
      reload,
    } = useData("admin/exams/" + id + "/questions"),
    { data: exam } = useData("admin/exams/" + id),
    [edit, setEdit] = useState<any>(null),
    [preview, setPreview] = useState(false),
    [remove, setRemove] = useState<any>(null),
    [err, setErr] = useState("");
  const blank = () => ({
    question: "",
    options: ["", "", "", ""],
    correct_option: 0,
    explanation: "",
    image: null,
    display_order: (qs?.length || 0) + 1,
  });
  const set = (key: string, v: any) =>
    setEdit((e: any) => ({ ...e, [key]: v }));
  async function save(q: any) {
    await api(
      "admin/exams/" + id + "/questions" + (q.id ? "/" + q.id : ""),
      {
        question: q.question,
        options: q.options,
        correct_option: Number(q.correct_option),
        explanation: q.explanation,
        image: q.image || null,
        display_order: Number(q.display_order),
      },
      q.id ? "PATCH" : "POST",
    );
    reload();
  }
  return (
    <>
      <AdminHeading title="MCQ Questions" description={exam?.title}>
        <div className="actions">
          <button className="btn outline" onClick={() => setPreview(true)}>
            Preview exam
          </button>
          <button
            className="btn"
            onClick={() => {
              setErr("");
              setEdit(blank());
            }}
          >
            <Plus size={17} />
            Add question
          </button>
        </div>
      </AdminHeading>
      <a className="back-link" href={"/admin/exams/" + id}>
        <ArrowLeft size={15} />
        Exam settings
      </a>
      <ErrorBox error={error} />
      {!qs && !error ? (
        <Loading />
      ) : qs?.length ? (
        <div>
          {qs.map((q: any, i: number) => (
            <div className="admin-question card" key={q.id}>
              <div>
                <span className="eyebrow">
                  QUESTION {i + 1} · ORDER {q.display_order}
                </span>
                <h3>{q.question}</h3>
                <p className="correct-text">
                  Correct: {String.fromCharCode(65 + q.correct_option)}.{" "}
                  {q.options[q.correct_option]}
                </p>
              </div>
              <div className="table-actions">
                <button
                  aria-label="Edit question"
                  className="icon-btn"
                  onClick={() => {
                    setErr("");
                    setEdit({ ...q });
                  }}
                >
                  <Pencil size={17} />
                </button>
                <ActionButton
                  aria-label="Duplicate question"
                  className="icon-btn"
                  action={async () => {
                    await save({
                      ...q,
                      id: undefined,
                      display_order: qs.length + 1,
                    });
                    toast.success("Question duplicated");
                  }}
                >
                  <Copy size={17} />
                </ActionButton>
                <ActionButton
                  aria-label="Move question up"
                  className="icon-btn"
                  disabled={i === 0}
                  action={async () => {
                    const ids = qs.map((x: any) => x.id);
                    [ids[i], ids[i - 1]] = [ids[i - 1], ids[i]];
                    await api("admin/exams/" + id + "/questions/reorder", {
                      ids,
                    });
                    reload();
                    toast.success("Question moved");
                  }}
                >
                  <ArrowUp size={17} />
                </ActionButton>
                <ActionButton
                  aria-label="Move question down"
                  className="icon-btn"
                  disabled={i === qs.length - 1}
                  action={async () => {
                    const ids = qs.map((x: any) => x.id);
                    [ids[i], ids[i + 1]] = [ids[i + 1], ids[i]];
                    await api("admin/exams/" + id + "/questions/reorder", {
                      ids,
                    });
                    reload();
                    toast.success("Question moved");
                  }}
                >
                  <ArrowDown size={17} />
                </ActionButton>
                <button
                  aria-label="Delete question"
                  className="icon-btn"
                  onClick={() => setRemove(q)}
                >
                  <Trash2 size={17} />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState title="Add your first question">
          Every question needs four or five options and one correct answer.
        </EmptyState>
      )}
      <Dialog open={!!edit} onOpenChange={(v) => !v && setEdit(null)}>
        <DialogContent className="wide-dialog">
          <DialogHeader>
            <DialogTitle>
              {edit?.id ? "Edit question" : "Add question"}
            </DialogTitle>
          </DialogHeader>
          {edit && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setErr("");
                try {
                  await save(edit);
                  setEdit(null);
                  toast.success("Question saved");
                } catch (e: any) {
                  setErr(e.message);
                }
              }}
            >
              <Field label="Question">
                <textarea
                  required
                  rows={3}
                  value={edit.question}
                  onChange={(e) => set("question", e.target.value)}
                />
              </Field>
              {edit.options.map((o: string, i: number) => (
                <Field
                  key={i}
                  label={"Option " + String.fromCharCode(65 + i)}
                  required
                  value={o}
                  onChange={(e: any) =>
                    set(
                      "options",
                      edit.options.map((v: string, j: number) =>
                        i === j ? e.target.value : v,
                      ),
                    )
                  }
                />
              ))}
              <button
                type="button"
                className="text-link"
                onClick={() => {
                  if (edit.options.length === 4)
                    set("options", [...edit.options, ""]);
                  else {
                    set("options", edit.options.slice(0, 4));
                    if (edit.correct_option === 4) set("correct_option", 0);
                  }
                }}
              >
                {edit.options.length === 4
                  ? "+ Add option E"
                  : "Remove option E"}
              </button>
              <div className="grid two">
                <Field label="Correct answer">
                  <Choice
                    label="Correct answer"
                    value={edit.correct_option}
                    onChange={(v: string) => set("correct_option", Number(v))}
                    options={edit.options.map((_: any, i: number) => ({
                      value: i,
                      label: "Option " + String.fromCharCode(65 + i),
                    }))}
                  />
                </Field>
                <Field
                  label="Display order"
                  type="number"
                  min="0"
                  max="10000"
                  value={edit.display_order}
                  onChange={(e: any) => set("display_order", e.target.value)}
                />
              </div>
              <Field label="Explanation (optional)">
                <textarea
                  rows={2}
                  value={edit.explanation}
                  onChange={(e) => set("explanation", e.target.value)}
                />
              </Field>
              <Field label="Question image (PNG/JPEG, optional)">
                <Upload
                  kind="question"
                  value={edit.image}
                  onChange={(v: string) => set("image", v)}
                />
              </Field>
              <ErrorBox error={err} />
              <button className="btn">Save question</button>
            </form>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={preview} onOpenChange={setPreview}>
        <DialogContent className="wide-dialog">
          <DialogHeader>
            <DialogTitle>{exam?.title} — Admin preview</DialogTitle>
          </DialogHeader>
          {qs?.map((q: any, i: number) => (
            <div className="preview-question" key={q.id}>
              <h3>
                {i + 1}. {q.question}
              </h3>
              {q.image && (
                <img
                  className="question-image"
                  src={"/api/files/" + q.image}
                  alt="Question image"
                />
              )}
              {q.options.map((o: string, j: number) => (
                <p
                  className={j === q.correct_option ? "correct-text" : ""}
                  key={j}
                >
                  {String.fromCharCode(65 + j)}. {o}
                  {j === q.correct_option ? " ✓" : ""}
                </p>
              ))}
              {q.explanation && <p>{q.explanation}</p>}
            </div>
          ))}
        </DialogContent>
      </Dialog>
      <Confirm
        open={!!remove}
        onOpenChange={(v: boolean) => !v && setRemove(null)}
        title="Delete this question?"
        description="This removes the question. Deletion is blocked after an exam attempt exists."
        onConfirm={async () => {
          try {
            await api(
              "admin/exams/" + id + "/questions/" + remove.id,
              undefined,
              "DELETE",
            );
            setRemove(null);
            reload();
          } catch (e: any) {
            toast.error(e.message);
          }
        }}
      />
    </>
  );
}
function Codes() {
  const [page, setPage] = useState(1),
    [search, setSearch] = useState(""),
    [active, setActive] = useState("all"),
    [quantity, setQuantity] = useState("10000"),
    [history, setHistory] = useState<any>(null);
  const { data, error, reload } = useData(
    `admin/codes?page=${page}&search=${encodeURIComponent(search)}&active=${active === "all" ? "" : active}`,
  );
  return (
    <>
      <AdminHeading
        title="Unique Codes"
        description="Assign each code to exams, packages or courses. Bulk-generated codes stay unassigned until you attach them. First use binds each code to one browser."
      >
        <a className="btn outline" href="/api/admin/codes/csv">
          <Download size={17} />
          Download CSV
        </a>
      </AdminHeading>
      <div className="card code-generate">
        <div>
          <h3>Generate secure access codes</h3>
          <p>Each code contains 60 bits of cryptographic randomness.</p>
        </div>
        <Choice
          label="Number of codes"
          value={quantity}
          onChange={setQuantity}
          options={["100", "500", "1000", "5000", "10000"]}
        />
        <ActionButton
          action={async () => {
            const d = await api("admin/codes/generate", {
              quantity: Number(quantity),
            });
            toast.success(d.count.toLocaleString() + " codes generated");
            reload();
          }}
        >
          <Plus size={17} />
          Generate codes
        </ActionButton>
      </div>
      <div className="toolbar">
        <div className="search-input">
          <Search size={17} />
          <input
            aria-label="Search codes"
            placeholder="Search access codes…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <Choice
          label="Code status"
          value={active}
          onChange={(v: string) => {
            setActive(v);
            setPage(1);
          }}
          options={[
            { value: "all", label: "All statuses" },
            { value: "1", label: "Active" },
            { value: "0", label: "Inactive" },
          ]}
        />
      </div>
      <ErrorBox error={error} />
      {!data && !error ? (
        <Loading />
      ) : (
        data && (
          <div className="table-card">
            <DataTable
              headers={[
                "Access code",
                "Active",
                "Assigned to",
                "Browser",
                "Exam usage",
                "Created (Dhaka)",
                "Actions",
              ]}
              rows={data.rows.map((c: any) => [
                <code key="code">{c.code}</code>,
                <Switch
                  key="active"
                  aria-label={"Activate " + c.code}
                  checked={!!c.active}
                  onCheckedChange={async (v) => {
                    try {
                      await api("admin/codes/" + c.id, { active: v }, "PATCH");
                      reload();
                    } catch (e: any) {
                      toast.error(e.message);
                    }
                  }}
                />,
                c.assignments||"Unassigned",
                c.claimed_at?"Bound":"Unused",
                c.uses,
                date(c.created_at),
                <div key="actions" className="table-actions">
                  <ActionButton
                    className="icon-btn"
                    aria-label="Copy code"
                    action={async () => {
                      await navigator.clipboard.writeText(c.code);
                      toast.success("Code copied");
                    }}
                  >
                    <Copy size={16} />
                  </ActionButton>
                  <ActionButton
                    className="text-link"
                    action={async()=>{if(!window.confirm(`Reset the browser linked to ${c.code}? The next device to enter this code will take ownership.`))return;await api(`admin/codes/${c.id}/reset-device`,{});reload();toast.success("Browser released")}}
                  >Reset browser</ActionButton>
                  <ActionButton
                    className="text-link"
                    action={async () =>
                      setHistory({
                        code: c.code,
                        rows: await api("admin/codes/" + c.id),
                      })
                    }
                  >
                    View usage
                  </ActionButton>
                </div>,
              ])}
            />
            {data.rows.length === 0 && (
              <EmptyState title="No access codes found">
                Generate codes or try another search.
              </EmptyState>
            )}
            <Pages page={page} total={data.total} setPage={setPage} />
          </div>
        )
      )}
      <Sheet open={!!history} onOpenChange={(v) => !v && setHistory(null)}>
        <SheetContent className="details-sheet">
          <SheetHeader>
            <SheetTitle>Code usage</SheetTitle>
          </SheetHeader>
          <div className="sheet-body">
            <h3>{history?.code}</h3>
            {history?.rows.length ? (
              history.rows.map((x: any, i: number) => (
                <div className="notice" key={i}>
                  <h3>{x.title}</h3>
                  <p>Started: {date(x.started_at)}</p>
                  <p>Submitted: {date(x.submitted_at)}</p>
                  <span className="badge">{x.status}</span>
                </div>
              ))
            ) : (
              <p>This code has not been used in an examination.</p>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
function Ranking({ id }: any) {
  const [page, setPage] = useState(1),
    [search, setSearch] = useState(""),
    [sort, setSort] = useState("rank"),
    [status, setStatus] = useState("all"),
    [details, setDetails] = useState<any>(null),
    [deleting, setDeleting] = useState<any>(null);
  const { data, error, reload } = useData(
    `admin/exams/${id}/ranking?page=${page}&search=${encodeURIComponent(search)}&sort=${sort}&status=${status === "all" ? "" : status}`,
  );
  return (
    <>
      <AdminHeading
        title="Participants & Rankings"
        description={data?.exam?.title}
      >
        <ActionButton
          action={async () => {
            toast.info("Preparing ranking PDF…");
            const { downloadRanking } = await import("@/lib/ranking-pdf");
            await downloadRanking(id);
            toast.success("Position PDF downloaded");
          }}
        >
          <Download size={17} />
          Generate Position PDF
        </ActionButton>
      </AdminHeading>
      <p className="muted">
        Ranking: highest score, fewer wrong answers, shorter completion time,
        then earlier submission. Active attempts have no final position.
      </p>
      <div className="toolbar wrap">
        <input
          aria-label="Search participants"
          value={search}
          placeholder="Name, university, or access code…"
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <Choice
          label="Sort participants"
          value={sort}
          onChange={setSort}
          options={[
            { value: "rank", label: "Position" },
            { value: "name", label: "Name" },
            { value: "start", label: "Start time" },
          ]}
        />
        <Choice
          label="Attempt status"
          value={status}
          onChange={setStatus}
          options={[
            { value: "all", label: "All attempts" },
            { value: "active", label: "In progress" },
            { value: "submitted", label: "Submitted" },
          ]}
        />
        <ActionButton className="btn outline" action={reload}>
          Refresh
        </ActionButton>
      </div>
      <ErrorBox error={error} />
      {!data && !error ? (
        <Loading />
      ) : (
        data && (
          <div className="table-card">
            <DataTable
              headers={[
                "Position",
                "Student / University",
                "Access code",
                "Correct",
                "Wrong",
                "Unanswered",
                "Score",
                "Percentage",
                "Time",
                "Submitted (Dhaka)",
                "Status",
                "Details",
                "Remove",
              ]}
              rows={data.rows.map((a: any) => [
                a.status === "submitted" ? "#" + a.position : "—",
                <Fragment key="student">
                  <strong>{a.student_name}</strong>
                  <small className="block muted">{a.university}</small>
                </Fragment>,
                <code key="code">{a.code}</code>,
                a.correct,
                a.wrong,
                a.unanswered,
                a.status === "submitted" ? a.score / 100 : "—",
                a.status === "submitted"
                  ? (a.percentage / 100).toFixed(2) + "%"
                  : "—",
                a.duration == null ? "—" : duration(a.duration),
                date(a.submitted_at),
                <span key="status" className="badge">{a.status}</span>,
                <ActionButton
                  key="details"
                  className="text-link"
                  action={async () =>
                    setDetails({
                      ...a,
                      ...(await api(`admin/exams/${id}/submission/${a.id}`)),
                    })
                  }
                >
                  View
                </ActionButton>,
                <button
                  key="remove"
                  className="icon-btn danger"
                  aria-label={`Remove participant ${a.student_name}`}
                  onClick={() => setDeleting(a)}
                >
                  <Trash2 size={16} />
                </button>,
              ])}
            />
            {!data.rows.length && (
              <EmptyState title="No participants found">
                Participants appear when students enter this examination.
              </EmptyState>
            )}
            <Pages page={page} total={data.total} setPage={setPage} />
          </div>
        )
      )}
      <Sheet open={!!details} onOpenChange={(v) => !v && setDetails(null)}>
        <SheetContent className="details-sheet">
          <SheetHeader>
            <SheetTitle>Attempt details</SheetTitle>
          </SheetHeader>
          <div className="sheet-body">
            {details &&
              [
                ["Student", details.student_name],
                ["University", details.university],
                ["Access code", details.code],
                ["Started", date(details.started_at)],
                ["Deadline", date(details.deadline)],
                ["Submitted", date(details.submitted_at)],
                [
                  "Completion time",
                  details.duration == null ? "—" : duration(details.duration),
                ],
                ["Positive marks", details.positive / 100],
                ["Negative marks", details.negative / 100],
                ["Final score", details.score / 100],
                ["Status", details.status],
              ].map(([k, v]) => (
                <div className="summary-line" key={k}>
                  <span>{k}</span>
                  <strong>{v}</strong>
                </div>
              ))}
            {details?.questions?.map((q: any, i: number) => (
              <div className="notice" key={i}>
                <h3>
                  {i + 1}. {q.question}
                </h3>
                <p>
                  Selected:{" "}
                  {q.selected == null ? "Unanswered" : q.options[q.selected]}
                </p>
                <p className="correct-text">
                  Correct: {q.options[q.correct_option]}
                </p>
                {q.explanation && <p>{q.explanation}</p>}
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>
      <Confirm
        open={!!deleting}
        onOpenChange={(v: boolean) => !v && setDeleting(null)}
        title="Are You Sure You Want To Remove This Participant?"
        description="This participant's attempt and saved answers for this Exam will be permanently deleted. Other participants are not affected."
        action="Remove Participant"
        onConfirm={async () => {
          try {
            await api(
              `admin/exams/${id}/participants/${deleting.id}`,
              undefined,
              "DELETE",
            );
            if (details?.id === deleting.id) setDetails(null);
            setDeleting(null);
            reload();
            toast.success("Participant removed");
          } catch (x: any) {
            toast.error(x.message);
          }
        }}
      />
    </>
  );
}
function AdminBooks() {
  const { data, error, reload } = useData("admin/books"),
    [edit, setEdit] = useState<any>(null),
    [remove, setRemove] = useState<any>(null),
    [err, setErr] = useState("");
  const set = (key: string, v: any) =>
    setEdit((e: any) => ({ ...e, [key]: v }));
  const categories = ["BJS", "Bar Council", "Academic", "General Subject"];
  const selectedCategories = (value: any): string[] => {
    if (Array.isArray(value)) return value;
    try {
      const parsed = JSON.parse(value || "");
      if (Array.isArray(parsed)) return parsed;
    } catch {}
    return value
      ? String(value)
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean)
      : [];
  };
  const uniqueValues = (key: string) =>
    Array.from(
      new Set(
        (data || [])
          .flatMap((book: any) =>
            selectedCategories(book[key] ?? book[key.replace(/s$/, "")]),
          )
          .filter(Boolean),
      ),
    );
  return (
    <>
      <AdminHeading
        title="Books"
        description="Manage hardcopy and digital editions, covers, and preview pages."
      >
        <button
          className="btn"
          onClick={() => {
            setErr("");
            setEdit({
              title: "",
              authors: [],
              author: "",
              exam_category: ["Academic"],
              subjects: ["General"],
              subject: "General",
              type: "hardcopy",
              book_types: ["hardcopy"],
              price: "",
              old_price: "",
              description: "",
              cover: null,
              preview: null,
              digital: null,
              stock_count: null,
              available: true,
              published: false,
            });
          }}
        >
          <Plus size={17} />
          Add book
        </button>
      </AdminHeading>
      <ErrorBox error={error} />
      {!data && !error ? (
        <Loading />
      ) : data?.length ? (
        <div className="table-card">
          <DataTable
            headers={[
              "Book",
              "Type",
              "Price",
              "Stock",
              "Available",
              "Published",
              "Actions",
            ]}
            rows={data.map((b: any) => [
              <strong key="book">{b.title}</strong>,
              b.type,
              money(b.price),
              b.type === "hardcopy"
                ? b.stock_count === null
                  ? "Not tracked"
                  : b.stock_count === 0
                    ? "Stock Out"
                    : `${b.stock_count} in stock`
                : "Digital",
              b.available ? "Yes" : "No",
              b.published ? "Yes" : "No",
              <div key="actions" className="table-actions">
                <button
                  className="text-link"
                  onClick={() => {
                    setErr("");
                    setEdit({
                      ...b,
                      exam_category: selectedCategories(b.exam_category),
                      authors: selectedCategories(b.authors || b.author),
                      subjects: selectedCategories(b.subjects || b.subject),
                      book_types: selectedCategories(b.book_types || b.type),
                      price: String(b.price / 100),
                      old_price: b.old_price ? String(b.old_price / 100) : "",
                      available: !!b.available,
                      published: !!b.published,
                    });
                  }}
                >
                  Edit
                </button>
                <button
                  className="icon-btn"
                  aria-label="Delete book"
                  onClick={() => setRemove(b)}
                >
                  <Trash2 size={16} />
                </button>
              </div>,
            ])}
          />
        </div>
      ) : (
        <EmptyState title="Add your first book">
          Upload a cover, set a price, and provide a separate preview PDF.
        </EmptyState>
      )}
      <Dialog open={!!edit} onOpenChange={(v) => !v && setEdit(null)}>
        <DialogContent className="wide-dialog">
          <DialogHeader>
            <DialogTitle>{edit?.id ? "Edit book" : "Add book"}</DialogTitle>
          </DialogHeader>
          {edit && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setErr("");
                try {
                  await api(
                    "admin/books" + (edit.id ? "/" + edit.id : ""),
                    {
                      ...edit,
                      price: cash(edit.price),
                      old_price: edit.old_price ? cash(edit.old_price) : null,
                    },
                    edit.id ? "PATCH" : "POST",
                  );
                  setEdit(null);
                  reload();
                  toast.success("Book saved");
                } catch (e: any) {
                  setErr(e.message);
                }
              }}
            >
              <Field
                label="Book title"
                required
                value={edit.title}
                onChange={(e: any) => set("title", e.target.value)}
              />
              <div className="grid two">
                <AdminMultiCreate
                  label="Author"
                  value={edit.authors || []}
                  options={uniqueValues("authors")}
                  set={(v: string[]) => set("authors", v)}
                  required
                />
                <AdminMultiCreate
                  label="Subject"
                  value={edit.subjects || []}
                  options={uniqueValues("subjects")}
                  set={(v: string[]) => set("subjects", v)}
                  required
                />
              </div>
              <div className="grid two">
                <AdminMultiCreate
                  label="Exam category"
                  value={selectedCategories(edit.exam_category)}
                  options={[
                    ...new Set([
                      ...categories,
                      ...uniqueValues("exam_category"),
                    ]),
                  ]}
                  set={(v: string[]) => set("exam_category", v)}
                  required
                />
                <AdminMultiCreate
                  label="Book type"
                  value={edit.book_types || []}
                  options={["hardcopy", "softcopy"]}
                  set={(v: string[]) =>
                    setEdit((current: any) => ({
                      ...current,
                      book_types: v,
                      type: v.includes("hardcopy") ? "hardcopy" : "softcopy",
                    }))
                  }
                  required
                />
                <Field
                  label="Price (BDT)"
                  required
                  inputMode="decimal"
                  value={edit.price}
                  onChange={(e: any) => set("price", e.target.value)}
                />
                <Field
                  label="Old price (BDT) — optional discount"
                  inputMode="decimal"
                  value={edit.old_price || ""}
                  onChange={(e: any) => set("old_price", e.target.value)}
                />
              </div>
              <Field label="Description">
                <textarea
                  rows={3}
                  value={edit.description}
                  onChange={(e) => set("description", e.target.value)}
                />
              </Field>
              {(edit.book_types || [edit.type]).includes("hardcopy") && (
                <Field label="Stock quantity — 0 means Stock Out; blank means not tracked">
                  <input
                    type="number"
                    min="0"
                    max="1000000"
                    value={edit.stock_count ?? ""}
                    placeholder="Not tracked"
                    onChange={(e) => {
                      const stock =
                        e.target.value === "" ? null : Number(e.target.value);
                      setEdit((current: any) => ({
                        ...current,
                        stock_count: stock,
                        available: stock === 0 ? false : current.available,
                      }));
                    }}
                  />
                </Field>
              )}
              <Field label="Cover image — PNG/JPEG, up to 25 MB">
                <Upload
                  kind="cover"
                  value={edit.cover}
                  onChange={(v: any) => set("cover", v)}
                />
              </Field>
              <Field label="Preview PDF — selected pages only">
                <Upload
                  kind="preview"
                  value={edit.preview}
                  onChange={(v: any) => set("preview", v)}
                />
              </Field>
              {(edit.book_types || [edit.type]).includes("softcopy") && (
                <Field label="Full softcopy PDF — private, verified buyers only">
                  <Upload
                    kind="digital"
                    value={edit.digital}
                    onChange={(v: any) => set("digital", v)}
                  />
                </Field>
              )}
              <div className="toggle-line">
                <label htmlFor="book-available">Available to purchase</label>
                <Switch
                  id="book-available"
                  checked={edit.available}
                  onCheckedChange={(v) => set("available", v)}
                />
              </div>
              <div className="toggle-line">
                <label htmlFor="book-published">Published on website</label>
                <Switch
                  id="book-published"
                  checked={edit.published}
                  onCheckedChange={(v) => set("published", v)}
                />
              </div>
              <ErrorBox error={err} />
              <button className="btn">Save book</button>
            </form>
          )}
        </DialogContent>
      </Dialog>
      <Confirm
        open={!!remove}
        onOpenChange={(v: boolean) => !v && setRemove(null)}
        title="Remove this book?"
        description="If it has existing orders, it will be unpublished and historical order details will be preserved."
        onConfirm={async () => {
          try {
            const d = await api(
              "admin/books/" + remove.id,
              undefined,
              "DELETE",
            );
            toast.success(d.message || "Book removed");
            setRemove(null);
            reload();
          } catch (e: any) {
            toast.error(e.message);
          }
        }}
      />
    </>
  );
}
function AdminMultiCreate({
  label,
  value,
  options,
  set,
  required = false,
}: any) {
  const [adding, setAdding] = useState(false),
    [draft, setDraft] = useState("");
  const selected = Array.isArray(value) ? value : [];
  const add = () => {
    const x = draft.trim();
    if (!x) return;
    set([...new Set([...selected, x])]);
    setDraft("");
    setAdding(false);
  };
  return (
    <Field label={label} required={required}>
      <div className="multi-create-select">
        <div className="multi-create-options">
          {options.map((x: string) => (
            <label key={x}>
              <input
                type="checkbox"
                checked={selected.includes(x)}
                onChange={(e) =>
                  set(
                    e.target.checked
                      ? [...new Set([...selected, x])]
                      : selected.filter((v: string) => v !== x),
                  )
                }
              />
              <span>{x}</span>
            </label>
          ))}
        </div>
        {selected.length > 0 && (
          <div className="multi-create-chips">
            {selected.map((x: string) => (
              <button
                type="button"
                key={x}
                onClick={() => set(selected.filter((v: string) => v !== x))}
              >
                {x} ×
              </button>
            ))}
          </div>
        )}
        {!adding ? (
          <button
            type="button"
            className="text-link"
            onClick={() => setAdding(true)}
          >
            <Plus size={15} /> Add New
          </button>
        ) : (
          <div className="multi-create-new">
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  add();
                }
              }}
            />
            <button type="button" className="btn small" onClick={add}>
              Add
            </button>
            <button
              type="button"
              className="btn secondary small"
              onClick={() => setAdding(false)}
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </Field>
  );
}
function Orders({ type }: any) {
  const hard = type === "hardcopy",
    packageOrder = type === "package",
    courseOrder = type === "course",
    softcopyOrder = type === "softcopy",
    [page, setPage] = useState(1),
    [search, setSearch] = useState(""),
    [filters, setFilters] = useState<any>({
      verified: "all",
      delivered: "all",
      received: "all",
      payment_type: "all",
      from: "",
      to: "",
    }),
    [detail, setDetail] = useState<any>(null),
    [deleting, setDeleting] = useState<any>(null),
    [optimistic, setOptimistic] = useState<Record<string, boolean>>({}),
    [updating, setUpdating] = useState<Record<string, boolean>>({});
  const query = Object.entries(filters)
    .filter(([, v]) => v && v !== "all")
    .map(([k, v]) =>
      k === "from" || k === "to"
        ? `${k}=${new Date(v + (k === "from" ? "T00:00:00+06:00" : "T23:59:59+06:00")).getTime()}`
        : `${k}=${v}`,
    )
    .join("&");
  const { data, error, reload } = useData(
    `admin/orders/${type}?page=${page}&search=${encodeURIComponent(search)}&${query}`,
  );
  const update = async (id: string, field: string, value: boolean | number) => {
    const key = `${id}:${field}`;
    setOptimistic((current) => ({ ...current, [key]: !!value }));
    setUpdating((current) => ({ ...current, [key]: true }));
    if (detail?.id === id)
      setDetail((current: any) =>
        current ? { ...current, [field]: value } : current,
      );
    try {
      await api(`admin/orders/${type}/${id}`, { field, value }, "PATCH");
      if (detail?.id === id) setDetail(await api(`admin/orders/${type}/${id}`));
      toast.success("Order status updated");
    } catch (e: any) {
      setOptimistic((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
      if (detail?.id === id) setDetail(await api(`admin/orders/${type}/${id}`));
      toast.error(e.message);
    } finally {
      setUpdating((current) => ({ ...current, [key]: false }));
      reload();
    }
  };
  const control = (o: any, f: string) => {
    const key = `${o.id}:${f}`;
    return (
      <Switch
        aria-label={`${f} ${o.id}`}
        checked={key in optimistic ? optimistic[key] : !!o[f]}
        disabled={!!updating[key]}
        onCheckedChange={(v) => update(o.id, f, v)}
      />
    );
  };
  return (
    <>
      <AdminHeading
        title={
          hard
            ? "Hardcopy Orders"
            : packageOrder
              ? "Exam Package Orders"
              : courseOrder
                ? "Course Orders"
                : "Softcopy Orders"
        }
        description={
          hard
            ? "Verify payments, record courier dispatch, and confirm customer receipt."
            : packageOrder
              ? "Verify package payments. A secure exam access code is created only after verification."
              : courseOrder
                ? "Verify course enrollment payments and review linked exam access."
                : "Verify digital-book payments. Each verified order permits one protected download."
        }
      />
      <nav className="order-type-tabs" aria-label="Order types">
        <a className={hard ? "active" : ""} href="/admin/orders/hardcopy">
          Hardcopy Orders
        </a>
        <a
          className={softcopyOrder ? "active" : ""}
          href="/admin/orders/softcopy"
        >
          Softcopy Orders
        </a>
        <a className={courseOrder ? "active" : ""} href="/admin/orders/course">
          Complete Package Orders
        </a>
        <a
          className={packageOrder ? "active" : ""}
          href="/admin/orders/package"
        >
          Exam Package Orders
        </a>
      </nav>
      <div className="toolbar wrap">
        <input
          aria-label="Search orders"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Order ID, phone, TrxID, or name…"
        />
        {[
          "verified",
          ...(hard ? ["payment_type", "delivered", "received"] : []),
        ].map((k) => (
          <Choice
            key={k}
            label={k}
            value={filters[k]}
            onChange={(v: string) => {
              setFilters({ ...filters, [k]: v });
              setPage(1);
            }}
            options={[
              { value: "all", label: "All " + k.replace("_", " ") },
              ...(k === "payment_type"
                ? [
                    { value: "full", label: "Full Pay" },
                    { value: "cod", label: "COD" },
                  ]
                : [
                    {
                      value: "1",
                      label:
                        k === "verified"
                          ? "Verified"
                          : k === "delivered"
                            ? "Dispatched"
                            : "Received",
                    },
                    {
                      value: "0",
                      label:
                        k === "verified"
                          ? "Not verified"
                          : k === "delivered"
                            ? "Not dispatched"
                            : "Not received",
                    },
                  ]),
            ]}
          />
        ))}
        <Field
          label="From date"
          type="date"
          value={filters.from}
          onChange={(e: any) => {
            setFilters({ ...filters, from: e.target.value });
            setPage(1);
          }}
        />
        <Field
          label="To date"
          type="date"
          value={filters.to}
          onChange={(e: any) => {
            setFilters({ ...filters, to: e.target.value });
            setPage(1);
          }}
        />
        <a
          className="btn secondary"
          href={`/api/admin/orders/${type}?export=csv&search=${encodeURIComponent(search)}&${query}`}
        >
          <Download size={16} /> Export CSV
        </a>
      </div>
      <ErrorBox error={error} />
      {!data && !error ? (
        <Loading />
      ) : (
        data && (
          <div className="table-card">
            <DataTable
              headers={[
                "Order / Date",
                "Customer",
                "Product",
                "Quantity",
                "TrxID",
                "Amount",
                ...(hard ? ["Type", "Due"] : []),
                "PAYMENT VERIFIED",
                ...(softcopyOrder ? ["DOWNLOAD"] : []),
                ...(hard ? ["PRODUCT DELIVERED", "DELIVERY RECEIVED"] : []),
                "Manage",
              ]}
              rows={data.rows.map((o: any) => [
                <>
                  <strong className="small">{o.id}</strong>
                  <small className="block muted">{date(o.created_at)}</small>
                </>,
                <>
                  <b>{o.name}</b>
                  <small className="block muted">{o.phone}</small>
                  {o.address && (
                    <small className="block muted">{o.address}</small>
                  )}
                  <button
                    className="text-link small"
                    onClick={() =>
                      navigator.clipboard
                        .writeText(
                          [o.name, o.phone, o.address]
                            .filter(Boolean)
                            .join("\n"),
                        )
                        .then(() =>
                          toast.success("Customer information copied"),
                        )
                    }
                  >
                    <Copy size={13} /> Copy
                  </button>
                </>,
                o.product_summary || "—",
                o.product_quantity || 1,
                <>
                  <code>{o.trx}</code>
                  {o.trx_count > 1 && (
                    <span className="badge wrong block">
                      Duplicate TrxID — review
                    </span>
                  )}
                </>,
                money(o.total ?? o.price),
                ...(hard
                  ? [
                      o.payment_type === "cod" ? "COD" : "Full Pay",
                      money(o.due),
                    ]
                  : []),
                control(o, "verified"),
                ...(softcopyOrder
                  ? [
                      o.downloaded_at ? (
                        <span className="badge">Used</span>
                      ) : (
                        <span className="badge upcoming">
                          {o.verified ? "Available" : "After Verification"}
                        </span>
                      ),
                    ]
                  : []),
                ...(hard
                  ? [control(o, "delivered"), control(o, "received")]
                  : []),
                <div key="actions" className="table-actions">
                  <ActionButton
                    className="text-link"
                    action={async () =>
                      setDetail(await api(`admin/orders/${type}/${o.id}`))
                    }
                  >
                    View
                  </ActionButton>
                  <button
                    className="icon-btn danger"
                    aria-label={`Delete order ${o.id}`}
                    onClick={() => setDeleting(o)}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>,
              ])}
            />
            {!data.rows.length && (
              <EmptyState title="No orders found">
                Orders will appear here when buyers submit their details.
              </EmptyState>
            )}
            <Pages page={page} total={data.total} setPage={setPage} />
          </div>
        )
      )}
      <Sheet open={!!detail} onOpenChange={(v) => !v && setDetail(null)}>
        <SheetContent className="details-sheet">
          <SheetHeader>
            <SheetTitle>Order details</SheetTitle>
          </SheetHeader>
          <div className="sheet-body">
            {detail && (
              <>
                <strong className="order-id">{detail.id}</strong>
                {[
                  ["Date", date(detail.created_at)],
                  ["Name", detail.name],
                  ["Phone", detail.phone],
                  ["Email", detail.email || "—"],
                  [
                    "Payment method",
                    String(detail.payment_method || "—").replaceAll("_", " "),
                  ],
                  ["TrxID", detail.trx],
                  ...(hard
                    ? [
                        ["Address", detail.address],
                        ["Delivery", deliveryNames[detail.delivery]],
                        [
                          "Payment type",
                          detail.payment_type === "cod" ? "COD" : "Full Pay",
                        ],
                        ["Book subtotal", money(detail.subtotal)],
                        ["Delivery charge", money(detail.delivery_charge)],
                        ["Submitted amount", money(detail.paid)],
                        ["Amount due", money(detail.due)],
                        ["Grand total", money(detail.total)],
                      ]
                    : [
                        [
                          packageOrder
                            ? "Package"
                            : courseOrder
                              ? "Course"
                              : "Book",
                          packageOrder
                            ? detail.package_title
                            : courseOrder
                              ? detail.course_name
                              : detail.book_title,
                        ],
                        ["Expected / submitted amount", money(detail.price)],
                      ]),
                  ...((packageOrder || courseOrder) && detail.access_code
                    ? [["Generated access code", detail.access_code]]
                    : []),
                  ...(packageOrder || courseOrder
                    ? [
                        ["Access start", date(detail.activated_at)],
                        ["Access expiry", date(detail.expires_at)],
                        [
                          "Access status",
                          detail.access_suspended
                            ? "Suspended"
                            : detail.verified
                              ? "Active"
                              : "Pending",
                        ],
                      ]
                    : []),
                  ["Verified by", detail.verified_by || "Not verified"],
                  ["Verified at", date(detail.verified_at)],
                  ...(softcopyOrder
                    ? [
                        [
                          "Downloaded at",
                          detail.downloaded_at
                            ? date(detail.downloaded_at)
                            : "Not downloaded",
                        ],
                      ]
                    : []),
                  ...(hard
                    ? [
                        ["Dispatched at", date(detail.delivered_at)],
                        ["Received at", date(detail.received_at)],
                      ]
                    : []),
                ].map(([k, v]) => (
                  <div className="summary-line" key={k}>
                    <span>{k}</span>
                    <strong>{v}</strong>
                  </div>
                ))}
                {hard && (
                  <>
                    <h3>Ordered books</h3>
                    {detail.items?.map((i: any) => (
                      <div className="notice" key={i.id}>
                        {i.title} × {i.quantity}
                        <br />
                        {money(i.price)} each
                      </div>
                    ))}
                  </>
                )}
                {(packageOrder || courseOrder) &&
                  detail.access_code &&
                  detail.verified && (
                    <div className="notice success">
                      <b>Access code created</b>
                      <p>
                        The buyer can now see this code on their private order
                        receipt.
                      </p>
                    </div>
                  )}
                {(packageOrder || courseOrder) && (
                  <div className="access-actions">
                    <div className="toggle-line">
                      <span>Suspend Access</span>
                      <Switch
                        checked={!!detail.access_suspended}
                        onCheckedChange={(v) =>
                          update(detail.id, "access_suspended", v)
                        }
                      />
                    </div>
                    <button
                      className="btn secondary"
                      onClick={() =>
                        update(
                          detail.id,
                          "expires_at",
                          Math.max(Date.now(), Number(detail.expires_at || 0)) +
                            30 * 86400000,
                        )
                      }
                    >
                      Extend Validity 30 Days
                    </button>
                    <a
                      className="btn outline"
                      href={
                        packageOrder
                          ? `/packages/${detail.package_id}`
                          : `/courses/${detail.course_id}`
                      }
                      target="_blank"
                    >
                      View Purchased Package
                    </a>
                  </div>
                )}
                {["verified", ...(hard ? ["delivered", "received"] : [])].map(
                  (f) => (
                    <div className="toggle-line" key={f}>
                      <span>
                        {f === "verified"
                          ? "PAYMENT VERIFIED"
                          : f === "delivered"
                            ? "PRODUCT DELIVERED"
                            : "DELIVERY RECEIVED"}
                      </span>
                      {control(detail, f)}
                    </div>
                  ),
                )}
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>
      <Confirm
        open={!!deleting}
        onOpenChange={(v: boolean) => !v && setDeleting(null)}
        title="Delete this order?"
        description={
          packageOrder || courseOrder
            ? "The order will be permanently removed and any generated package access code will be deactivated."
            : "The order will be permanently removed from the Admin order list."
        }
        action="Delete order"
        onConfirm={async () => {
          try {
            await api(
              `admin/orders/${type}/${deleting.id}`,
              undefined,
              "DELETE",
            );
            toast.success("Order deleted");
            if (detail?.id === deleting.id) setDetail(null);
            setDeleting(null);
            reload();
          } catch (e: any) {
            toast.error(e.message);
          }
        }}
      />
    </>
  );
}
function AdminSettings({ mustChange }: any) {
  const [err, setErr] = useState(""),
    [p, setP] = useState({ current: "", password: "", confirm: "" });
  return (
    <>
      <AdminHeading
        title="Settings"
        description="Manage your Academy information and administrator password."
      />
      <ErrorBox error={err} />
      <Tabs defaultValue={mustChange ? "password" : "website"}>
        <TabsList>
          <TabsTrigger value="website" disabled={!!mustChange}>
            Website Management
          </TabsTrigger>
          <TabsTrigger value="password">Change Password</TabsTrigger>
        </TabsList>
        <TabsContent value="website">
          {!mustChange && <WebsiteSettings />}
        </TabsContent>
        <TabsContent value="password">
          <form
            className="card password-form"
            onSubmit={async (e) => {
              e.preventDefault();
              setErr("");
              try {
                if (p.password !== p.confirm)
                  throw Error("New passwords do not match.");
                await api("admin/password", {
                  current: p.current,
                  password: p.password,
                });
                toast.success("Password changed. Please sign in again.");
                window.location.href = "/admin/login";
              } catch (e: any) {
                setErr(e.message);
              }
            }}
          >
            <h2>Change Admin password</h2>
            <p>
              Use at least 14 characters. Changing the password signs out all
              admin sessions.
            </p>
            <Field
              label="Current password"
              type="password"
              autoComplete="current-password"
              required
              value={p.current}
              onChange={(e: any) => setP({ ...p, current: e.target.value })}
            />
            <Field
              label="New password"
              type="password"
              autoComplete="new-password"
              minLength={14}
              maxLength={72}
              required
              value={p.password}
              onChange={(e: any) => setP({ ...p, password: e.target.value })}
            />
            <Field
              label="Confirm new password"
              type="password"
              autoComplete="new-password"
              required
              value={p.confirm}
              onChange={(e: any) => setP({ ...p, confirm: e.target.value })}
            />
            <button className="btn">Change Password</button>
          </form>
        </TabsContent>
      </Tabs>
    </>
  );
}
