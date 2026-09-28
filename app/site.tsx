"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Scale,
  ArrowUpRight,
  ArrowRight,
  BookOpen,
  GraduationCap,
  ClipboardCheck,
  Clock,
  ShoppingBag,
  Menu,
  CheckCircle2,
  MessageCircle,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  Download,
  Maximize2,
  X,
  ZoomIn,
  ZoomOut,
  Flag,
  Search,
  Mail,
  Headphones,
  HelpCircle,
  ShieldCheck,
} from "lucide-react";
import { Toaster, toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Progress } from "@/components/ui/progress";
import {
  api,
  useData,
  Field,
  Choice,
  Confirm,
  EmptyState,
  Loading,
  ErrorBox,
  ActionButton,
  money,
  date,
  duration,
  deliveryNames,
} from "@/lib/client";
import { defaults } from "@/lib/rules";
import { academyNavigation, currentAcademyNavigation } from "@/lib/academy-navigation";
import Admin from "./admin-ui";
import { useBookTools } from "@/lib/webmcp";
import { ExamQr } from "@/components/exam-qr";
import { HomePackages, PackageDetail, Packages } from "./packages-ui";
import {
  CourseCarousel,
  CourseDetail,
  CoursesPage,
  HomeNotes,
  NotesPage,
  NoteDetail,
  NoticeDetail,
  NoticeSection,
  NoticesPage,
  StatisticsSection,
  TeamSection,
  VerifiedReviews,
} from "./content-ui";
import {
  AuthorProfile,
  BlogDetail,
  BlogsPage,
  HomeBlogs,
  WriteBlogPage,
} from "./blog-ui";
import { ShareActions } from "@/components/share-actions";
import { PaymentMethodPicker } from "./payment-method";
import { CourseLearning } from "./course-learning";
import { StudyHomepage } from "./study-entry";
import { StudyRoutineApp } from "./study-simple";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
export function Brand({ settings = defaults, tone = "light" }: any = {}) {
  const defaultLogo =
    tone === "dark"
      ? "/assets/lexveritas-logo-white.png"
      : "/assets/lexveritas-logo.png";
  const logo = settings.websiteLogo || defaultLogo;
  const usesAcademyWordmark = logo === defaultLogo;
  return (
    <a
      className={`brand brand-${tone} ${usesAcademyWordmark ? "brand-wordmark" : "brand-custom"}`}
      href="/"
      aria-label="LexVeritas Academy home"
    >
      <span
        className={`brand-logo ${usesAcademyWordmark ? "brand-logo-full" : ""}`}
        aria-hidden="true"
      >
        <img src={logo.startsWith("/") ? logo : `/api/files/${logo}`} alt="" />
      </span>
      {tone !== "dark" &&
        !usesAcademyWordmark &&
        settings.showBrandText !== false && (
          <strong>
            {settings.brandText || settings.websiteName || "LexVeritas Academy"}
          </strong>
        )}
    </a>
  );
}
function ContactLinks({ settings = sFallback }: any) {
  return (
    <div className="contact-links">
      {[
        ["WhatsApp", `https://wa.me/88${settings.whatsapp}`],
        ["Facebook Group", settings.facebookGroup],
        ["Facebook Page", settings.facebookPage],
        ["Telegram Group", settings.telegram],
        ["WhatsApp Group", settings.whatsappGroup],
      ].map(([label, url]) => (
        <a key={label} href={url} target="_blank" rel="noopener noreferrer">
          {label}
          <ArrowUpRight size={15} />
        </a>
      ))}
    </div>
  );
}
function ManagedMenu({ items, path, mobile = false }: any) {
  const [blogOpen, setBlogOpen] = useState(false);
  const [expanded, setExpanded] = useState<Record<string,boolean>>({});
  const roots = items.filter((x: any) => !x.parentId && x.visible !== false);
  const renderItem = (item: any, trail: string[] = []): any => {
    if (trail.includes(item.id) || trail.length > 4) return null;
    const children = items.filter(
      (x: any) => x.parentId === item.id && x.visible !== false,
    );
    const cls = `academy-nav-item ${item.emphasis ? "nav-emphasis" : ""} ${item.divider ? "nav-divider" : ""}`;
    if (item.url === "/blog") return (
      <div className={`${cls} nav-group blog-nav-group ${mobile ? "nav-group-mobile" : "nav-dropdown"}`} key={item.id}>
        <button type="button" className="nav-group-heading blog-nav-toggle" aria-expanded={blogOpen} aria-controls={mobile ? "mobile-blog-categories" : "desktop-blog-categories"} onClick={() => setBlogOpen(!blogOpen)}>
          {item.label}<ChevronDown size={14} aria-hidden="true" />
        </button>
        {blogOpen && <div id={mobile ? "mobile-blog-categories" : "desktop-blog-categories"} className={mobile ? "mobile-submenu" : "nav-submenu"}>
          <a className="academy-nav-item" href="/blog">All Blogs</a>
          {children.map((child: any) => renderItem(child, [...trail, item.id]))}
        </div>}
      </div>
    );
    if (children.length) return (
      <div className={`${cls} nav-group ${mobile ? "nav-group-mobile" : "nav-dropdown"}`} key={item.id}>
        <span className="nav-heading-row"><a className="nav-group-heading" href={safeHref(item.url)} aria-current={path === item.url ? "page" : undefined}>{item.label}</a>{mobile&&<button className="nav-expand" type="button" aria-label={`${expanded[item.id]?"Collapse":"Expand"} ${item.label}`} aria-expanded={!!expanded[item.id]} onClick={()=>setExpanded({...expanded,[item.id]:!expanded[item.id]})}><ChevronDown size={17}/></button>}</span>
        {(!mobile||expanded[item.id])&&<div className={mobile ? "mobile-submenu" : "nav-submenu"}>
          {children.map((child: any) => renderItem(child, [...trail, item.id]))}
        </div>}
      </div>
    );
    return (
      <a
        href={safeHref(item.url)}
        target={item.newTab ? "_blank" : undefined}
        rel={item.newTab ? "noreferrer" : undefined}
        className={`${cls} ${path === item.url ? "active" : ""} ${item.style === "button" ? "nav-button" : ""}`}
        aria-current={path === item.url ? "page" : undefined}
        key={item.id || item.url}
      >
        {item.label}
      </a>
    );
  };
  return <>{roots.map((item: any) => renderItem(item))}</>;
}
const sFallback = defaults;
const pathSegment = (value = "") => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};
const defaultMainNav = academyNavigation;
const isRemovedFeatureLink = (item: any) =>
  String(item?.url || "").startsWith("/bd-laws-ai") ||
  /bd laws ai/i.test(String(item?.label || ""));
function withBlogCategories(items: any[], categories: string[]) {
  items = items.filter((item) => !isRemovedFeatureLink(item));
  const blog = items.find((item) => !item.parentId && item.url === "/blog");
  if (!blog) return items;
  const parentId = blog.id || "blog";
  const existing = items.filter((item) => item.parentId === parentId);
  const otherChildren = existing.filter((item) => item.url !== "/blog" && !item.id?.startsWith("blog-category-") && !String(item.url || "").startsWith("/blog?category="));
  const dynamic = [...new Set(categories.map((category) => category.trim()).filter(Boolean))]
    .filter((category) => !otherChildren.some((item) => item.url === `/blog?category=${encodeURIComponent(category)}`))
    .map((category) => ({
      id: `blog-category-${category}`,
      parentId,
      label: category,
      url: `/blog?category=${encodeURIComponent(category)}`,
      visible: true,
    }));
  return [
    ...items.filter((item) => item.parentId !== parentId).map((item) => item.id === parentId ? { ...item, emphasis: true } : item),
    ...otherChildren,
    ...dynamic,
  ];
}
export default function Site({ initialSettings = null, initialHomeData = null }: { initialSettings?: any; initialHomeData?: any } = {}) {
  const routePath = usePathname() || "/",
    search = useSearchParams(),
    previewMode = routePath === "/website-preview",
    path = previewMode ? search.get("path") || "/" : routePath,
    { data: settings, error: settingsError } = useData(
      previewMode ? "settings?preview=1" : "settings", previewMode ? null : initialSettings,
    ),
    { data: blogCategories } = useData("blog-categories"),
    [cartCount, setCartCount] = useState(0),
    [visitorCount, setVisitorCount] = useState<number | null>(null),
    [onlineCount, setOnlineCount] = useState<number | null>(null),
    [popupOpen, setPopupOpen] = useState(false),
    [dismissedAnnouncement, setDismissedAnnouncement] = useState("");
  const s: any = settings || defaults;
  const activeWindow = (item: any) => {
    const now = Date.now(),
      start = item?.start ? new Date(item.start).getTime() : 0,
      end = item?.end ? new Date(item.end).getTime() : Infinity;
    return !!item?.enabled && now >= start && now <= end;
  };
  const announcementItems = Array.isArray(s.cms_announcement?.items)
      ? s.cms_announcement.items
      : [s.cms_announcement].filter(Boolean),
    announcement = announcementItems.find(
      (x: any) => activeWindow(x) && x.id !== dismissedAnnouncement,
    ),
    popupItems = Array.isArray(s.cms_popups?.items)
      ? s.cms_popups.items
      : [s.cms_popups].filter(Boolean),
    popup = popupItems.find((x: any) => {
      const pages = String(x.pages || "all");
      return (
        activeWindow(x) &&
        x.audience !== "logged-in" &&
        (pages === "all" ||
          pages
            .split(",")
            .map((p: string) => p.trim())
            .includes(path))
      );
    }),
    navigation = s.cms_navigation || {},
    savedMainNav = (navigation.main?.length ? navigation.main : navigation.items) || [],
    mainNav = withBlogCategories(currentAcademyNavigation(savedMainNav.length ? savedMainNav : defaultMainNav), blogCategories || []),
    savedMobileNav = navigation.mobile?.length ? navigation.mobile : savedMainNav,
    mobileNav = withBlogCategories(currentAcademyNavigation(savedMobileNav.length ? savedMobileNav : defaultMainNav), blogCategories || []),
    footerNav = Array.isArray(navigation.footer)
      ? navigation.footer.filter((item: any) => item.visible !== false && !isRemovedFeatureLink(item))
      : [],
    layout = s["cms_global-layout"] || {};
  useEffect(() => {
    const refresh = () => {
      try {
        setCartCount(
          readCart().reduce((s: number, x: any) => s + x.quantity, 0),
        );
      } catch {}
    };
    refresh();
    window.addEventListener("cart", refresh);
    return () => window.removeEventListener("cart", refresh);
  }, []);
  useEffect(() => {
    if (path.startsWith("/admin")) return;
    fetch("/api/visitors", {
      method: "POST",
      headers: { "X-LVA-Request": "1" },
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((result: any) => {
        if (!result) return;
        setVisitorCount(Number(result.total));
        setOnlineCount(Number(result.online));
      })
      .catch(() => undefined);
  }, []);
  useEffect(() => {
    const href = s.favicon
      ? s.favicon.startsWith("/")
        ? s.favicon
        : `/api/files/${s.favicon}`
      : "/assets/lexveritas-logo.png";
    let icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!icon) {
      icon = document.createElement("link");
      icon.rel = "icon";
      document.head.appendChild(icon);
    }
    icon.href = href;
    let shortcut = document.querySelector<HTMLLinkElement>(
      'link[rel="shortcut icon"]',
    );
    if (!shortcut) {
      shortcut = document.createElement("link");
      shortcut.rel = "shortcut icon";
      document.head.appendChild(shortcut);
    }
    shortcut.href = href;
  }, [s.favicon]);
  useEffect(() => {
    if (!popup) return;
    if (
      (window.innerWidth <= 640 && popup.mobile === false) ||
      (window.innerWidth > 640 && popup.desktop === false)
    )
      return;
    if (
      popup.frequency === "once" &&
      localStorage.getItem(`lva-popup-${popup.id}`)
    )
      return;
    const show = () => {
      setPopupOpen(true);
      if (popup.frequency === "once")
        localStorage.setItem(`lva-popup-${popup.id}`, "1");
    };
    if (popup.trigger === "exit-intent") {
      const leave = (e: MouseEvent) => {
        if (e.clientY <= 2) {
          show();
          document.removeEventListener("mouseleave", leave);
        }
      };
      document.addEventListener("mouseleave", leave);
      return () => document.removeEventListener("mouseleave", leave);
    }
    const timer = window.setTimeout(
      show,
      Math.max(0, Number(popup.delay || 0)) * 1000,
    );
    return () => window.clearTimeout(timer);
  }, [popup?.id, path]);
  if (routePath.startsWith("/admin"))
    return (
      <>
        <Admin path={path} />
        <Toaster richColors position="top-center" />
      </>
    );
  if (previewMode && settingsError)
    return (
      <div className="container section">
        <h1>Preview unavailable</h1>
        <p>{settingsError}</p>
        <a className="btn" href="/admin/website/builder">
          Return to Website Builder
        </a>
      </div>
    );
  if (settings && s.cms_maintenance?.enabled)
    return (
      <div className="maintenance-page">
        <Brand settings={s} />
        <div className="maintenance-card">
          <Clock size={44} />
          <div className="eyebrow">MAINTENANCE MODE</div>
          <h1>{s.cms_maintenance.title}</h1>
          <p>{s.cms_maintenance.message}</p>
          {s.cms_maintenance.expectedReturn && (
            <small>Expected return: {s.cms_maintenance.expectedReturn}</small>
          )}
        </div>
        <a href="/admin" className="text-link">
          Admin access
        </a>
      </div>
    );
  const theme = s.cms_theme || {},
    appearance = s.cms_appearance || {},
    header = s.cms_header || {},
    footer = s.cms_footer || {};
  return (
    <div
      className={`site-shell button-${appearance.buttonStyle || s.buttonStyle} card-${appearance.cardStyle || "default"} motion-${appearance.animation || "default"} cms-layout-${layout.layout || "full-width"} ${previewMode ? `cms-preview-mode cms-preview-${search.get("device") || "desktop"}` : ""}`}
      style={
        {
          "--primary": theme.primary || s.primaryColor,
          "--gold": theme.secondary || s.secondaryColor,
          "--paper": theme.background || s.backgroundColor,
          "--ink": theme.text || s.textColor,
          "--radius": `${appearance.cardRadius ?? theme.radius ?? s.borderRadius}px`,
          "--section-space": `${appearance.sectionSpacing ?? theme.sectionSpacing ?? s.sectionSpacing}px`,
          "--button-weight": appearance.buttonWeight ?? 600,
          "--surface-border-width": `${appearance.borderWidth ?? 1}px`,
          "--motion-duration": `${appearance.animationDuration ?? 300}ms`,
          "--heading-color": theme.heading || theme.text || s.textColor,
          "--link-color": theme.link || theme.primary || s.primaryColor,
          "--border-color": theme.border || "#dce4e8",
          "--body-font": theme.fontFamily || "inherit",
          "--heading-font": theme.headingFont || "inherit",
          "--body-size": `${theme.bodySize ?? 16}px`,
          "--line-height": theme.lineHeight ?? 1.6,
          "--heading-weight": theme.headingWeight ?? 600,
          "--surface-shadow": appearance.shadow === "none" ? "none" : appearance.shadow === "strong" ? "0 16px 36px rgba(15,35,50,.16)" : appearance.shadow === "subtle" ? "0 4px 14px rgba(15,35,50,.05)" : "0 8px 26px rgba(15,35,50,.09)",
          "--container-width": `${layout.containerWidth || theme.container || 1200}px`,
          "--website-width": `${layout.websiteWidth || 1440}px`,
          "--page-top-space": `${layout.pageTopSpacing || 48}px`,
          "--page-bottom-space": `${layout.pageBottomSpacing || 72}px`,
          background: layout.background || undefined,
        } as any
      }
    >
      {previewMode && (
        <div className="cms-preview-banner">
          Draft preview · This version is visible only to administrators
        </div>
      )}
      {announcement ? (
        <div
          className={`cms-announcement ${announcement.desktop === false ? "hide-desktop" : ""} ${announcement.mobile === false ? "hide-mobile" : ""}`}
          style={{
            background: announcement.background,
            color: announcement.textColor,
          }}
        >
          <a href={announcement.link ? safeHref(announcement.link) : undefined}>
            {announcement.icon && <span>{announcement.icon}</span>}
            {announcement.message || announcement.text}
            {announcement.buttonLabel && <b>{announcement.buttonLabel}</b>}
          </a>
          {announcement.dismissible && (
            <button
              aria-label="Dismiss announcement"
              onClick={() => setDismissedAnnouncement(announcement.id)}
            >
              <X size={16} />
            </button>
          )}
        </div>
      ) : (
        <div className="topline">
          BJS · BAR COUNCIL · LAW OFFICER · ACADEMIC LEGAL EDUCATION{" "}
          <span>Learn with purpose. Prepare with confidence.</span>
        </div>
      )}
      <header
        className={`header cms-header-desktop-${header.desktopLayout || "logo-menu-actions"} cms-header-tablet-${header.tabletLayout || "logo-menu"} cms-header-mobile-${header.mobileLayout || "logo-toggle"} ${header.sticky ? "cms-sticky-header" : ""} ${header.transparent ? "cms-transparent-header" : ""}`}
        style={
          {
            height: header.height || undefined,
            background: header.background || undefined,
            "--header-logo-size": `${header.logoSize || 180}px`,
          } as any
        }
      >
        <Brand
          settings={{
            ...s,
            websiteLogo:
              (header.transparent ? header.darkLogo : header.logo) ||
              header.logo ||
              s.websiteLogo,
          }}
        />
        {header.navigation !== false && (
          <nav className="desktop-nav" aria-label="Main navigation">
            <ManagedMenu items={mainNav} path={path} />
          </nav>
        )}
        <div className="header-actions">
          {header.search && (
            <a className="icon-btn" href="/blog" aria-label="Search articles">
              <Search size={19} />
            </a>
          )}
          {header.enterExam && (
            <a className="btn secondary header-cta" href="/exams">
              Enter Exam
            </a>
          )}
          {header.ctaLabel && header.ctaUrl && (
            <a className="btn header-cta" href={safeHref(header.ctaUrl)}>
              {header.ctaLabel}
            </a>
          )}
          {(header.cart ?? s.showCart) && (
            <a
              className="cart-link"
              href="/cart"
              aria-label={`Cart, ${cartCount} items`}
            >
              <ShoppingBag size={20} />
              <span className="cart-word">Cart</span>
              {cartCount > 0 && <b>{cartCount}</b>}
            </a>
          )}
          {header.whatsapp !== false && (
            <a
              className="mobile-contact"
              href={`https://wa.me/88${s.whatsapp}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Contact LexVeritas Academy on WhatsApp"
            >
              <MessageCircle size={20} />
              <span>{s.headerContactLabel}</span>
            </a>
          )}
          {header.mobileMenu !== false && (
            <Sheet>
              <SheetTrigger
                className="mobile-menu"
                aria-label="Open navigation"
              >
                <Menu />
                <span>Menu</span>
              </SheetTrigger>
              <SheetContent className="academy-mobile-sheet">
                <SheetHeader className="academy-mobile-sheet-header">
                  <SheetTitle>LexVeritas Academy</SheetTitle>
                </SheetHeader>
                <nav className="mobile-nav" aria-label="Mobile navigation">
                  <ManagedMenu items={mobileNav} path={path} mobile />
                </nav>
              </SheetContent>
            </Sheet>
          )}
        </div>
      </header>
      <main>
        {path === "/" ? (
          <Home settings={s} initialHomeData={initialHomeData} />
        ) : path === "/study-routine" ? (
          <StudyRoutineApp examHint={search.get("exam") || ""} />
        ) : path === "/exams" ? (
          <Exams />
        ) : path.startsWith("/exams/") ? (
          <ExamEntry
            id={path.split("/")[2]}
            access={search.get("access") || ""}
            packageId={search.get("package") || ""}
            courseId={search.get("course") || ""}
            settings={s}
          />
        ) : path.startsWith("/attempts/") ? (
          <ExamSession id={path.split("/")[2]} />
        ) : path === "/courses" ? (
          <CoursesPage category={search.get("category") || ""} />
        ) : path.startsWith("/courses/") && path.endsWith("/learn") ? (
          <CourseLearning courseId={path.split("/")[2]} />
        ) : path.startsWith("/courses/") ? (
          <CourseDetail id={path.split("/")[2]} />
        ) : path === "/notes" ? (
          <NotesPage />
        ) : path.startsWith("/notes/item/") ? (
          <NoteDetail id={path.split("/")[3]} />
        ) : path.startsWith("/notes/") ? (
          <NotesPage category={pathSegment(path.split("/")[2])} />
        ) : path === "/notices" ? (
          <NoticesPage />
        ) : path.startsWith("/notices/") ? (
          <NoticeDetail id={path.split("/")[2]} />
        ) : path === "/blog" ? (
          <BlogsPage />
        ) : path === "/write-a-blog" ? (
          <WriteBlogPage />
        ) : path.startsWith("/blog/") ? (
          <BlogDetail slug={pathSegment(path.split("/")[2])} />
        ) : path.startsWith("/authors/") ? (
          <AuthorProfile slug={pathSegment(path.split("/")[2])} />
        ) : path === "/packages" ? (
          <Packages category={search.get("category") || ""} />
        ) : path.startsWith("/packages/") ? (
          <PackageDetail id={path.split("/")[2]} />
        ) : path === "/books" ? (
          <Books initialType={search.get("type") || "all"} />
        ) : path.startsWith("/books/") && path.endsWith("/read") ? (
          <BookReader id={path.split("/")[2]} />
        ) : path.startsWith("/books/") ? (
          <BookDetail id={path.split("/")[2]} />
        ) : path === "/cart" ? (
          <Cart />
        ) : path === "/checkout" ? (
          <Checkout />
        ) : path === "/track-order" ? (
          <TrackOrder />
        ) : path.startsWith("/orders/") ? (
          <OrderReceipt id={path.split("/")[2]} />
        ) : path === "/contact" && findBuilderPage(s, "contact") ? (
          <BuilderPage page={findBuilderPage(s, "contact")} settings={s} />
        ) : path === "/contact" ? (
          <Contact settings={settings || defaults} />
        ) : path === "/about" && findBuilderPage(s, "about") ? (
          <BuilderPage page={findBuilderPage(s, "about")} settings={s} />
        ) : path === "/about" ? (
          <About settings={settings || defaults} />
        ) : path === "/faq" ? (
          <SupportFaq settings={settings || defaults} />
        ) : path === "/privacy-policy" ? (
          <PolicyPage type="privacy" />
        ) : path === "/terms-and-conditions" ? (
          <PolicyPage type="terms" />
        ) : path === "/refund-policy" ? (
          <PolicyPage type="refund" />
        ) : path === "/shipping-delivery-policy" ? (
          <PolicyPage type="shipping" />
        ) : path === "/digital-product-policy" ? (
          <PolicyPage type="digital" />
        ) : path === "/bd-laws-ai" ? (
          <div className="container section">
            <h1>Page not found</h1>
            <a href="/" className="btn">Return home</a>
          </div>
        ) : findBuilderPageByPath(s, path) ? (
          <BuilderPage page={findBuilderPageByPath(s, path)} settings={s} />
        ) : s.cms_pages?.items?.find(
            (x: any) =>
              pageIsAvailable(x, !!s.cms_preview) &&
              `/${String(x.slug).replace(/^\/+/, "")}` === path,
          ) ? (
          <CustomPage
            page={s.cms_pages.items.find(
              (x: any) =>
                pageIsAvailable(x, !!s.cms_preview) &&
                `/${String(x.slug).replace(/^\/+/, "")}` === path,
            )}
          />
        ) : (
          <div className="container section">
            <h1>Page not found</h1>
            <a href="/" className="btn">
              Return home
            </a>
          </div>
        )}
      </main>
      <footer
        style={{
          background: footer.background || undefined,
          color: footer.textColor || undefined,
        }}
      >
        {footer.cta?.enabled && (
          <div className="footer-cta container">
            <div>
              <h2>{footer.cta.title}</h2>
              <p>{footer.cta.text}</p>
            </div>
            {footer.cta.url && (
              <a className="btn gold" href={safeHref(footer.cta.url)}>
                {footer.cta.buttonLabel || "Learn more"}
              </a>
            )}
          </div>
        )}
        <div className="footer-inner">
          <div className="footer-brand-column">
            <Brand
              tone="dark"
              settings={{
                ...s,
                websiteLogo:
                  footer.logo ||
                  s.footerLogo ||
                  "/assets/lexveritas-logo-white.png",
              }}
            />
            <p>{s.shortDescription}</p>
            <p>{footer.description || s.footerDescription}</p>
            {footer.address && <p>{footer.address}</p>}
            {footer.email && (
              <a href={`mailto:${footer.email}`}>{footer.email}</a>
            )}
          </div>
          {footer.columns?.length || footerNav.length ? (
            <>
              {[
                ...(footer.columns || []),
                ...(footerNav.length
                  ? [
                      {
                        id: "managed-footer-navigation",
                        title: "Navigation",
                        links: footerNav,
                      },
                    ]
                  : []),
                ...(footer.quickLinks?.length
                  ? [
                      {
                        id: "quick",
                        title: "Quick Links",
                        links: footer.quickLinks,
                      },
                    ]
                  : []),
                ...(footer.legalLinks?.length
                  ? [{ id: "legal", title: "Legal", links: footer.legalLinks }]
                  : []),
                ...(footer.socialLinks?.length
                  ? [
                      {
                        id: "social",
                        title: "Connect",
                        links: footer.socialLinks,
                      },
                    ]
                  : []),
                ...(![
                  ...(footer.columns || []),
                  { links: footerNav },
                  { links: footer.quickLinks || [] },
                  { links: footer.legalLinks || [] },
                  { links: footer.socialLinks || [] },
                ].some((column: any) => column.links?.some((link: any) => link.url === "/exams"))
                  ? [{ id: "mcq-exams-footer", title: "Exams", links: [{ label: "MCQ Exams", url: "/exams" }] }]
                  : []),
              ].map((column: any) => (
                <div className="footer-link-column" key={column.id}>
                  <h3>{column.title}</h3>
                  {(column.links || []).filter((link: any) => !isRemovedFeatureLink(link)).map((link: any) => (
                    <a
                      href={safeHref(link.url)}
                      key={`${link.label}-${link.url}`}
                    >
                      {link.label}
                    </a>
                  ))}
                </div>
              ))}
            </>
          ) : (
            <>
              <div className="footer-link-column">
                <h3>Explore</h3>
                <a href="/exams">MCQ Exams</a>
                <a href="/packages">Exam Packages</a>
                <a href="/courses">Courses</a>
                <a href="/books">Books</a>
                <a href="/notes">Notes</a>
                <a href="/blog">Blog</a>
              </div>
              <div className="footer-link-column">
                <h3>Support</h3>
                <a href="/contact">Contact</a>
                <a href="/faq">FAQ</a>
                <a href="/track-order">Order Tracking</a>
              </div>
              <div className="footer-link-column">
                <h3>Legal</h3>
                <a href="/privacy-policy">Privacy Policy</a>
                <a href="/terms-and-conditions">Terms &amp; Conditions</a>
                <a href="/refund-policy">Refund Policy</a>
                <a href="/shipping-delivery-policy">
                  Shipping &amp; Delivery Policy
                </a>
                <a href="/digital-product-policy">Digital Product Policy</a>
              </div>
              <div className="footer-link-column">
                <h3>Connect</h3>
                <a
                  href={s.facebookPage}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Facebook <ArrowUpRight size={14} />
                </a>
                <a
                  href={`https://wa.me/88${s.whatsapp}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  WhatsApp <ArrowUpRight size={14} />
                </a>
              </div>
            </>
          )}
        </div>
        <div className="footer-bottom">
          <span>
            © {new Date().getFullYear()} {footer.copyright || s.copyrightText}
          </span>
          <span className="footer-status-line">
            <span>
              Total Visitor:{" "}
              <strong>
                {visitorCount === null
                  ? "—"
                  : visitorCount.toLocaleString("en-BD")}
              </strong>
            </span>
            <b aria-hidden="true">|</b>
            <span className="footer-live-metrics">
              <i aria-hidden="true" /> Online:{" "}
              <strong>
                {onlineCount === null
                  ? "—"
                  : onlineCount.toLocaleString("en-BD")}
              </strong>
            </span>
            <b aria-hidden="true">|</b>
            <span className="footer-location">
              <a className="footer-admin-entry" href="/admin">
                Bangladesh
              </a>{" "}
              · All times Asia/Dhaka
            </span>
          </span>
        </div>
      </footer>
      <Dialog open={popupOpen} onOpenChange={setPopupOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{popup?.title}</DialogTitle>
          </DialogHeader>
          {popup?.media && (
            <img
              className="cms-popup-image"
              src={publicMedia(popup.media)}
              alt={popup.title || "Promotion"}
            />
          )}
          <p>{popup?.message}</p>
          {popup?.link && (
            <a className="btn" href={safeHref(popup.link)}>
              {popup.buttonLabel || "Learn more"}
            </a>
          )}
        </DialogContent>
      </Dialog>
      <Toaster richColors position="top-center" />
    </div>
  );
}
function CustomPage({ page }: any) {
  return (
    <article className="container section custom-page">
      <div className="eyebrow">LEXVERITAS ACADEMY</div>
      <h1>{page.title}</h1>
      <div>
        {String(page.content || "")
          .split(/\n{2,}/)
          .map((p: string, i: number) => (
            <p key={i}>{p}</p>
          ))}
      </div>
    </article>
  );
}
function findBuilderPage(settings: any, id: string) {
  const page = settings?.["cms_page-builder"]?.pages?.[id],
    meta = settings?.cms_pages?.items?.find((x: any) => x.id === id);
  return page?.sections?.length &&
    pageIsAvailable(meta || page, !!settings?.cms_preview)
    ? { ...page, slug: meta?.slug || page.slug }
    : null;
}
function pageIsAvailable(page: any, preview = false) {
  if (!page) return false;
  if (preview) return page.status !== "archived";
  if ((page.visibility || "public") !== "public") return false;
  if (page.status === "scheduled")
    return (
      !!page.scheduledAt && new Date(page.scheduledAt).getTime() <= Date.now()
    );
  return page.published || page.status === "published";
}
function findBuilderPageByPath(settings: any, path: string) {
  const items = settings?.cms_pages?.items || [],
    meta = items.find(
      (x: any) =>
        pageIsAvailable(x, !!settings?.cms_preview) &&
        (x.slug === "/"
          ? path === "/"
          : `/${String(x.slug).replace(/^\/+/, "")}` === path),
    );
  return meta ? findBuilderPage(settings, meta.id) : null;
}
function sanitizeMarkup(value: string) {
  return String(value || "")
    .replace(
      /<(script|style|iframe|object|embed|form)\b[^>]*>[\s\S]*?<\/\1>/gi,
      "",
    )
    .replace(/<\/?(?:script|style|iframe|object|embed|form)\b[^>]*>/gi, "")
    .replace(/\son\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/(?:javascript|vbscript|data\s*:\s*text\/html)\s*:/gi, "");
}
function safeHref(value: string) {
  const href = String(value || "").trim();
  return /^(?:\/|https:\/\/|mailto:|tel:|#)/i.test(href) ? href : "#";
}
function youtubeId(value: string) {
  try {
    const u = new URL(value);
    if (u.hostname.includes("youtu.be")) return u.pathname.split("/")[1];
    if (u.pathname.startsWith("/shorts/")) return u.pathname.split("/")[2];
    return u.searchParams.get("v") || "";
  } catch {
    return "";
  }
}
function publicMedia(value: string) {
  if (!value) return "";
  return value.startsWith("/") || value.startsWith("http")
    ? value
    : `/api/files/${value}`;
}
function BuilderPage({ page, settings }: any) {
  const globalLayout = settings?.["cms_global-layout"] || {},
    showTitle =
      page.showTitle !== false && globalLayout.pageTitleLayout !== "hidden",
    showBreadcrumbs = page.breadcrumbs ?? globalLayout.breadcrumbs ?? true;
  return (
    <article
      className={`builder-page builder-page-${page.layout || "global"} title-${globalLayout.pageTitleLayout || "standard"}`}
      style={{ background: page.background || undefined }}
    >
      {showTitle && (
        <header className="container builder-page-title">
          {showBreadcrumbs && (
            <small>
              <a href="/">Home</a> / {page.title}
            </small>
          )}
          <h1>{page.title}</h1>
        </header>
      )}
      {(page.sections || []).map((section: any) => (
        <BuilderSection
          key={section.id}
          section={section}
          settings={settings}
        />
      ))}
    </article>
  );
}
function BuilderSection({ section, settings, builtIn }: any) {
  const linked = settings?.["cms_reusable-sections"]?.items?.find(
      (x: any) => x.id === section.reusableId,
    ),
    s = linked?.section
      ? { ...linked.section, id: section.id, reusableId: section.reusableId }
      : section;
  if (s.visible === false || s.type === "bd-laws-ai") return null;
  const c = s.content || {},
    st = s.style || {},
    responsive = settings?.cms_responsive || {},
    cls = `public-builder-section type-${s.type} ${builtIn ? "home-native-section" : ""} ${s.desktop === false ? "hide-desktop" : ""} ${s.tablet === false ? "hide-tablet" : ""} ${s.mobile === false ? "hide-mobile" : ""}`,
    style: any = {
      background: st.background || undefined,
      textAlign: st.alignment || undefined,
      "--builder-pad-d": `${st.padding?.desktop ?? responsive.desktop?.padding ?? 48}px`,
      "--builder-pad-t": `${st.padding?.tablet ?? responsive.tablet?.padding ?? 36}px`,
      "--builder-pad-m": `${st.padding?.mobile ?? responsive.mobile?.padding ?? 24}px`,
      "--builder-margin-d": `${st.margin?.desktop ?? responsive.desktop?.margin ?? 0}px`,
      "--builder-margin-t": `${st.margin?.tablet ?? responsive.tablet?.margin ?? 0}px`,
      "--builder-margin-m": `${st.margin?.mobile ?? responsive.mobile?.margin ?? 0}px`,
      "--builder-font-d": `${st.fontSize?.desktop ?? responsive.desktop?.fontSize ?? 16}px`,
      "--builder-font-t": `${st.fontSize?.tablet ?? responsive.tablet?.fontSize ?? 16}px`,
      "--builder-font-m": `${st.fontSize?.mobile ?? responsive.mobile?.fontSize ?? 15}px`,
      "--builder-cols-d":
        st.columns?.desktop || responsive.desktop?.columns || 3,
      "--builder-cols-t": st.columns?.tablet || responsive.tablet?.columns || 2,
      "--builder-cols-m": st.columns?.mobile || responsive.mobile?.columns || 1,
      "--builder-image-d": `${st.imageSize?.desktop ?? responsive.desktop?.imageSize ?? 100}%`,
      "--builder-image-t": `${st.imageSize?.tablet ?? responsive.tablet?.imageSize ?? 100}%`,
      "--builder-image-m": `${st.imageSize?.mobile ?? responsive.mobile?.imageSize ?? 100}%`,
    };
  const dynamicBlocks: Record<string, any> = {
      notice: <NoticeSection settings={settings} />,
      statistics: <StatisticsSection settings={settings} />,
      "exam-packages": <HomePackages settings={settings} />,
      courses: <CourseCarousel settings={settings} />,
      books: <HomeBooks settings={settings} />,
      notes: <HomeNotes settings={settings} />,
      blog: <HomeBlogs settings={settings} />,
      reviews: <VerifiedReviews settings={settings} />,
    },
    dynamicBlock = dynamicBlocks[s.type];
  if (builtIn || dynamicBlock)
    return (
      <div className={cls} id={st.anchor || undefined} style={style}>
        {builtIn || dynamicBlock}
      </div>
    );
  const yid = s.type === "youtube-video" ? youtubeId(c.url) : "";
  return (
    <section className={cls} id={st.anchor || undefined} style={style}>
      <div
        className="container"
        style={{ maxWidth: st.containerWidth || undefined }}
      >
        {s.type === "divider" ? (
          <hr />
        ) : s.type === "spacer" ? (
          <div className="builder-spacer" />
        ) : (
          <>
            {["video", "youtube-video"].includes(s.type) &&
              (yid ? (
                <div className="builder-video">
                  <iframe
                    src={`https://www.youtube-nocookie.com/embed/${yid}`}
                    title={c.title || "Video"}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  />
                </div>
              ) : s.type === "video" && c.media ? (
                <video controls src={publicMedia(c.media)} />
              ) : null)}
            {s.type === "pdf-document" && c.media && (
              <iframe
                className="builder-document"
                src={publicMedia(c.media)}
                title={c.title || "Document"}
              />
            )}{" "}
            {s.type === "image-gallery" && (
              <div className="builder-grid">
                {String(c.media || "")
                  .split(/[,\n]/)
                  .filter(Boolean)
                  .map((x: string) => (
                    <img key={x} src={publicMedia(x.trim())} alt="" />
                  ))}
              </div>
            )}
            {["hero", "image-text"].includes(s.type) && c.media && (
              <img
                className="builder-feature-image"
                src={publicMedia(c.media)}
                alt={c.title || ""}
              />
            )}
            {s.type === "custom-html" ? (
              <div
                dangerouslySetInnerHTML={{ __html: sanitizeMarkup(c.text) }}
              />
            ) : (
              <>
                {c.title && <h2>{c.title}</h2>}
                {c.text && <p>{c.text}</p>}
              </>
            )}
            {Array.isArray(c.items) && c.items.length > 0 && (
              <div className={`builder-content-grid builder-${s.type}`}>
                {c.items.map((item: any, index: number) =>
                  s.type === "faq" ? (
                    <details key={item.id || index}>
                      <summary>{item.title}</summary>
                      <p>{item.text}</p>
                    </details>
                  ) : (
                    <article key={item.id || index}>
                      <h3>{item.title}</h3>
                      {item.text && <p>{item.text}</p>}
                      {item.url && <a href={safeHref(item.url)}>Learn more</a>}
                    </article>
                  ),
                )}
              </div>
            )}
            {s.type === "contact" && (c.address || c.phone || c.email) && (
              <address className="builder-contact">
                {c.address && <span>{c.address}</span>}
                {c.phone && (
                  <a href={`tel:${String(c.phone).replace(/[^+\d]/g, "")}`}>
                    {c.phone}
                  </a>
                )}
                {c.email && <a href={`mailto:${c.email}`}>{c.email}</a>}
              </address>
            )}
            {s.type === "countdown" && c.end && (
              <time className="builder-countdown" dateTime={c.end}>
                Ends{" "}
                {new Date(c.end).toLocaleString("en-BD", {
                  timeZone: "Asia/Dhaka",
                })}
              </time>
            )}
            {c.url && !["youtube-video"].includes(s.type) && c.buttonLabel && (
              <a className="btn" href={safeHref(c.url)}>
                {c.buttonLabel}
              </a>
            )}
          </>
        )}
      </div>
    </section>
  );
}
function Home({ settings, initialHomeData }: any) {
  const countdowns = settings?.["cms_page-builder"]?.pages?.home?.countdowns || [];
  const sections: Record<string, any> = {
    notice: settings.noticeVisible ? (
      <NoticeSection settings={settings} initialData={initialHomeData?.notices} />
    ) : null,
    statistics: settings.statisticsVisible ? (
      <StatisticsSection settings={settings} />
    ) : null,
    courses: settings.courseVisible ? (
      <CourseCarousel settings={settings} initialData={initialHomeData?.courses} />
    ) : null,
    packages: settings.packageVisible ? (
      <HomePackages settings={settings} initialData={initialHomeData?.packages} />
    ) : null,
    books: settings.booksVisible ? <HomeBooks settings={settings} initialData={initialHomeData?.books} /> : null,
    notes: settings.notesVisible ? <HomeNotes settings={settings} initialData={initialHomeData?.notes} /> : null,
    blog: settings.blogVisible ? <HomeBlogs settings={settings} initialData={initialHomeData?.blogs} /> : null,
    reviews: settings.reviewsVisible ? (
      <VerifiedReviews settings={settings} initialData={initialHomeData?.reviews} />
    ) : null,
    team: settings.teamVisible ? <TeamSection settings={settings} initialData={initialHomeData?.team} /> : null,
  };
  const preferred = [
    "notice",
    "courses",
    "packages",
    "notes",
    "books",
    "blog",
    "statistics",
    "reviews",
    "team",
  ];
  const central = settings?.["cms_page-builder"]?.pages?.home;
  const builder =
    Array.isArray(central?.sections) && central.sections.length
      ? central.sections
      : Array.isArray(settings.cms_homepage?.sections) && settings.cms_homepage.sections.length
        ? settings.cms_homepage.sections
        : null;
  const saved = builder
    ? builder
        .filter((x: any) => x.visible !== false && x.type !== "hero")
        .map((x: any) => (x.type === "exam-packages" ? "packages" : x.type))
    : Array.isArray(settings.homeSectionOrder)
      ? settings.homeSectionOrder.filter((key: string) =>
          preferred.includes(key),
        )
      : [];
  const order = builder ? saved : [...new Set([...saved, ...preferred])];
  let orderedSections = builder
    ? builder
        .filter((x: any) => x.visible !== false && x.type !== "hero")
        .map((x: any) => ({
          ...x,
          type: x.type === "exam-packages" ? "packages" : x.type,
        }))
    : order.map((type: string) => ({
        type,
        desktop: true,
        tablet: true,
        mobile: true,
      }));
  const noteSection = orderedSections.find(
    (item: any) => item.type === "notes",
  ) || { type: "notes", desktop: true, tablet: true, mobile: true };
  orderedSections = orderedSections.filter(
    (item: any) => item.type !== "notes",
  );
  const insertAfter = Math.max(
    orderedSections.findIndex((item: any) => item.type === "courses"),
    orderedSections.findIndex((item: any) => item.type === "packages"),
  );
  orderedSections.splice(
    insertAfter >= 0 ? insertAfter + 1 : orderedSections.length,
    0,
    noteSection,
  );
  const heroVisible =
    !builder ||
    builder.some((x: any) => x.type === "hero" && x.visible !== false);
  return (
    <>
      {heroVisible && (
        <section className="hero">
          <div className="hero-inner">
            <div className="hero-copy">
              <div className="eyebrow">
                <span />
                {settings.heroEyebrow}
              </div>
              <h1>
                {settings.heroTitle}
                <br />
                <em>{settings.heroAccent}</em>
              </h1>
              <p>{settings.heroDescription}</p>
              <div className="actions">
                {settings.heroPrimaryVisible && (
                  <a className="btn gold" href={settings.heroPrimaryUrl}>
                    {settings.heroPrimaryText}
                    <ArrowRight size={18} />
                  </a>
                )}
                {settings.heroSecondaryVisible && (
                  <a className="btn ghost" href={settings.heroSecondaryUrl}>
                    {settings.heroSecondaryText}
                    <BookOpen size={18} />
                  </a>
                )}
              </div>
              <a className="hero-tertiary-link" href="/notes">
                Browse Free Notes <ArrowRight size={15} />
              </a>
            </div>
            <HeroAcademicVisual />
          </div>
        </section>
      )}
      <ExamCountdowns items={countdowns} />
      <StudyHomepage config={initialHomeData?.study} />
      {orderedSections.map((item: any, index: number) => (
        <BuilderSection
          section={item}
          settings={settings}
          builtIn={
            sections[item.type] ? (
              <>
                {sections[item.type]}
                {item.type === "books" && <HomeTrackOrder />}
              </>
            ) : null
          }
          key={`${item.id || item.type}-${index}`}
        />
      ))}
    </>
  );
}
function ExamCountdowns({ items }: { items: any[] }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const active = items.filter(item => item.enabled && item.date && Number.isFinite(Date.parse(item.date)));
  if (!active.length) return null;
  return <section className={`container exam-countdowns ${active.length === 1 ? "exam-countdowns-single" : ""}`} aria-label="Upcoming exam countdowns">
    {active.map(item => {
      const seconds = Math.max(0, Math.floor((Date.parse(item.date) - now) / 1000));
      const parts = [
        ["Days", Math.floor(seconds / 86400)],
        ["Hours", Math.floor(seconds % 86400 / 3600)],
        ["Minutes", Math.floor(seconds % 3600 / 60)],
        ["Seconds", seconds % 60],
      ] as const;
      return <article className="exam-countdown-card" key={item.id}>
        <span className="exam-countdown-kicker">UPCOMING EXAMINATION</span><h2>{item.label}</h2>
        {seconds ? <div className="exam-countdown-clock" role="timer" aria-label={`${parts.map(([unit, value]) => `${value} ${unit.toLowerCase()}`).join(", ")} remaining`}>
          {parts.map(([unit, value]) => <div className="exam-countdown-unit" key={unit}><strong>{String(value).padStart(2,"0")}</strong><small>{unit}</small></div>)}
        </div> : <p className="exam-countdown-ended">Exam date reached</p>}
        <time dateTime={item.date}>{new Intl.DateTimeFormat("en-BD", { timeZone: "Asia/Dhaka", dateStyle: "medium", timeStyle: "short" }).format(Date.parse(item.date))} Bangladesh time</time>
      </article>;
    })}
  </section>;
}
function HeroAcademicVisual() {
  return (
    <div className="hero-panel hero-academic-visual">
      <div className="panel-kicker">
        <span>LEGAL PREPARATION WORKSPACE</span>
        <Scale size={24} strokeWidth={1.35} />
      </div>
      <div className="hero-learning-console">
        <span className="hero-visual-label">ONE FOCUSED PATH</span>
        <h2>Learn The Law. Test Your Preparation.</h2>
        <p>
          Structured courses, secure examinations and carefully prepared study
          resources in one place.
        </p>
        <div className="hero-path-grid" aria-label="LexVeritas learning areas">
          <a href="/courses">
            <GraduationCap aria-hidden="true" />
            <span>
              <strong>Learn</strong>
              <small>Courses &amp; Classes</small>
            </span>
          </a>
          <a href="/packages">
            <ClipboardCheck aria-hidden="true" />
            <span>
              <strong>Practise</strong>
              <small>MCQ Exam Packages</small>
            </span>
          </a>
          <a href="/notes">
            <BookOpen aria-hidden="true" />
            <span>
              <strong>Revise</strong>
              <small>Free Study Notes</small>
            </span>
          </a>
        </div>
        <div className="hero-console-status">
          <CheckCircle2 size={17} aria-hidden="true" />
          <span>
            Built For BJS, Bar Council, Law Officer &amp; Academic Preparation
          </span>
        </div>
      </div>
      <div className="panel-bottom">KNOWLEDGE. PRACTICE. PROGRESS.</div>
    </div>
  );
}
function HomeBooks({ settings, initialData }: any) {
  const { data: books, error } = useData("books", initialData);
  return (
    <section className="book-band">
      <div className="container section">
        <div className="section-head">
          <div>
            <div className="eyebrow">THE ACADEMY BOOKSHELF</div>
            <h2>{settings.booksTitle}</h2>
            <p>{settings.booksSubtitle}</p>
          </div>
          <div className="book-section-actions">
            <a href="/books" className="text-link">
              Browse All Books <ArrowUpRight size={18} />
            </a>
          </div>
        </div>
        <ErrorBox error={error} />
        {!books && !error ? (
          <Loading />
        ) : books?.length ? (
          <HomeBookCarousel books={books} settings={settings} />
        ) : (
          !error && (
            <EmptyState title="New books are coming soon">
              Books will appear here as soon as the Academy publishes them.
            </EmptyState>
          )
        )}
      </div>
    </section>
  );
}
function HomeTrackOrder() {
  return (
    <section className="home-track-order">
      <div className="container">
        <div>
          <div className="eyebrow">ORDER SUPPORT</div>
          <h2>Track Your Order</h2>
          <p>
            Use your Order ID to check payment approval, dispatch and delivery
            status.
          </p>
        </div>
        <a className="btn gold" href="/track-order">
          Track Your Order <ArrowRight size={17} />
        </a>
      </div>
    </section>
  );
}
function HomeBookCarousel({ books, settings }: any) {
  const rail = useRef<HTMLDivElement>(null);
  const paused = useRef(false);
  const moving = books.length > 3;
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
        node.scrollLeft += Math.min(1.1, ((now - previous) / 1000) * 28);
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
  }, [moving, books.length]);
  return (
    <div
      ref={rail}
      className={`home-book-carousel ${moving ? "is-moving" : ""}`}
      aria-label="Books and study materials"
      onPointerDown={() => (paused.current = true)}
      onPointerUp={() => (paused.current = false)}
      onPointerCancel={() => (paused.current = false)}
      onMouseEnter={() => (paused.current = true)}
      onMouseLeave={() => (paused.current = false)}
      onFocus={() => (paused.current = true)}
      onBlur={() => (paused.current = false)}
    >
      <div className="home-book-track">
        {books.map((b: any) => (
          <BookCard key={b.id} b={b} settings={settings} home />
        ))}
        {moving &&
          books.map((b: any) => (
            <BookCard
              key={`copy-${b.id}`}
              b={b}
              settings={settings}
              clone
              home
            />
          ))}
      </div>
    </div>
  );
}
function Heading({ eyebrow, title, children }: any) {
  return (
    <div className="page-heading">
      <div className="eyebrow">{eyebrow}</div>
      <h1>{title}</h1>
      {children && <p>{children}</p>}
    </div>
  );
}
function examState(e: any) {
  return e.end <= Date.now() || e.status === "closed"
    ? "Completed"
    : e.start > Date.now()
      ? "Upcoming"
      : "Live";
}
function ExamCard({ exam: e }: any) {
  const state = examState(e);
  return (
    <article className="exam-card">
      <div className="card-top">
        <span className={"badge " + state.toLowerCase()}>{state}</span>
        <ClipboardCheck size={23} />
      </div>
      <h3>{e.title}</h3>
      <p className="exam-description">
        {e.description || "Review the exam details before you begin."}
      </p>
      <div className="exam-meta">
        <span>
          <Clock size={16} />
          {e.duration} minutes
        </span>
        <span>{e.question_count} questions</span>
        <span>−{e.negative_mark / 100} per wrong answer</span>
      </div>
      <div className="card-foot">
        <small>{date(e.start)} BST</small>
        <a href={"/exams/" + e.id} className="text-link">
          {state === "Live"
            ? "Participate Now"
            : state === "Upcoming"
              ? "View details"
              : "Exam Ended · Results"}{" "}
          <ArrowRight size={16} />
        </a>
      </div>
    </article>
  );
}
function Exams() {
  const { data, error } = useData("exams"),
    [filter, setFilter] = useState("All");
  return (
    <div className="container section">
      <Heading
        eyebrow="THE EXAMINATION ROOM"
        title="Practice. Evaluate. Improve."
      >
        Timed MCQ examinations for your legal education journey. All schedules
        are shown in Bangladesh time.
      </Heading>
      <div className="toolbar">
        <Choice
          label="Filter examinations"
          value={filter}
          onChange={setFilter}
          options={["All", "Live", "Upcoming", "Completed"]}
        />
        <a href="/contact" className="text-link">
          Need an access code? <ArrowUpRight size={16} />
        </a>
      </div>
      <ErrorBox error={error} />
      {!data && !error ? (
        <Loading />
      ) : data?.filter((e: any) => filter === "All" || examState(e) === filter)
          .length ? (
        <div className="grid three">
          {data
            .filter((e: any) => filter === "All" || examState(e) === filter)
            .map((e: any) => (
              <ExamCard key={e.id} exam={e} />
            ))}
        </div>
      ) : (
        <EmptyState title="No examinations available">
          Check back for the next scheduled examination, or contact the Academy
          for updates.
        </EmptyState>
      )}
    </div>
  );
}
function ExamEntry({ id, access, packageId, courseId, settings }: any) {
  const query = courseId ? `?course=${encodeURIComponent(courseId)}` : access
    ? `?access=${encodeURIComponent(access)}`
    : packageId
      ? `?package=${encodeURIComponent(packageId)}`
      : "";
  const { data: e, error } = useData("exams/" + id + query),
    [form, setForm] = useState({ name: "", university: "", code: "" }),
    [err, setErr] = useState(""),
    [busy, setBusy] = useState(false),
    [ready, setReady] = useState(false),
    [result, setResult] = useState<any>(null),
    [saved, setSaved] = useState("");
  useEffect(() => {
    setSaved(localStorage.getItem(`lva-exam-${packageId||courseId||"direct"}-${id}`) || "");
  }, [id,packageId,courseId]);
  useEffect(()=>{if(e?.package_student)setForm(current=>({...current,name:current.name||e.package_student.name,university:current.university||e.package_student.university}))},[e?.package_student?.name,e?.package_student?.university]);
  if (error)
    return (
      <div className="container section">
        <ErrorBox error={error} />
      </div>
    );
  if (!e) return <Loading />;
  const state = examState(e);
  const protectedEntry = e.package_requires_code || e.course_requires_code || (e.access_mode !== "open" && !e.package_open && !e.course_open);
  return (
    <div className="container section">
      <a
        className="back-link"
        href={packageId ? `/packages/${packageId}` : "/exams"}
      >
        <ChevronLeft size={16} /> {packageId ? "Exam Packages" : "MCQ Exams"}
      </a>
      <Heading eyebrow={state.toUpperCase()} title={e.title}>
        {e.description}
      </Heading>
      <div className="split">
        <div>
          <div className="detail-grid">
            {[
              ["Duration", e.duration + " minutes"],
              ["Questions", e.question_count],
              ["Total marks", (e.question_count * e.correct_mark) / 100],
              ["Correct answer", "+" + e.correct_mark / 100],
              ["Wrong answer", "−" + e.negative_mark / 100],
              ["Unanswered", "0 marks"],
            ].map(([k, v]) => (
              <div key={k}>
                <span>{k}</span>
                <b>{v}</b>
              </div>
            ))}
          </div>
          <div className="notice">
            <h3>Before you begin</h3>
            <ul>
              <li>Starts: {date(e.start)} (Asia/Dhaka)</li>
              <li>Closes: {date(e.end)} (Asia/Dhaka)</li>
              <li>
                Your attempt ends when your allotted time runs out or the exam
                closes, whichever is earlier.
              </li>
              <li>{packageId?"One attempt per exam is included with your exam batch.":e.access_mode==="open"?"No code required. Each browser can make "+(e.attempt_limit||1)+" attempt(s).":"Each assigned code permits "+(e.attempt_limit||1)+" attempt(s) on its bound browser."}</li>
              <li>
                Keep this browser for session recovery and save your code for
                result lookup.
              </li>
              <li>
                Answers and results are available only after the exam closes and
                results are released.
              </li>
            </ul>
          </div>
        </div>
        <div className="card">
          <h2>
            {state === "Completed"
              ? "Find your result"
              : ready
                ? "Confirm examination"
                : "Enter examination"}
          </h2>
          <p>
            {ready
              ? "Review the details below. The timer begins only when you press Start Examination."
              : "No student account required."}
          </p>
          {ready && state !== "Completed" && (
            <div className="exam-confirmation">
              <dl>
                <div>
                  <dt>Exam Name</dt>
                  <dd>{e.title}</dd>
                </div>
                <div>
                  <dt>Questions</dt>
                  <dd>{e.question_count}</dd>
                </div>
                <div>
                  <dt>Duration</dt>
                  <dd>{e.duration} Minutes</dd>
                </div>
                <div>
                  <dt>Negative Marking</dt>
                  <dd>{e.negative_mark / 100}</dd>
                </div>
                <div>
                  <dt>Starts</dt>
                  <dd>{date(e.start)}</dd>
                </div>
                <div>
                  <dt>Ends</dt>
                  <dd>{date(e.end)}</dd>
                </div>
              </dl>
            </div>
          )}
          <form
            onSubmit={async (ev) => {
              ev.preventDefault();
              if (state !== "Completed" && !ready) {
                setReady(true);
                return;
              }
              setBusy(true);
              setErr("");
              try {
                if (state === "Completed") {
                  if(saved)window.location.href="/attempts/"+saved;
                  else if(!protectedEntry)throw Error("Open exam results are available on the original browser only.");
                  else setResult(await api("lookup", { exam: id, code: form.code }));
                } else {
                  const d = await api("exams/" + id + "/start", {
                    ...form,
                    access,
                    packageId:packageId||undefined,
                    courseId:courseId||undefined,
                  });
                  localStorage.setItem(`lva-exam-${packageId||courseId||"direct"}-${id}`, d.id);
                  window.location.href = "/attempts/" + d.id;
                }
              } catch (err: any) {
                setErr(err.message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {state !== "Completed" && !ready && (
              <>
                <Field
                  label="Name"
                  required
                  autoComplete="name"
                  value={form.name}
                  onChange={(v: any) =>
                    setForm({ ...form, name: v.target.value })
                  }
                />
                <Field
                  label="University Name"
                  required
                  value={form.university}
                  onChange={(v: any) =>
                    setForm({ ...form, university: v.target.value })
                  }
                />
              </>
            )}
            {!ready && protectedEntry && (state==="Completed" || (!e.course_session && !e.package_session)) && (
              <Field
                label="Unique Code"
                required
                autoComplete="off"
                value={form.code}
                placeholder="LVA-XXXX-XXXX-XXXX"
                onChange={(v: any) =>
                  setForm({ ...form, code: v.target.value })
                }
              />
            )}
            <ErrorBox error={err} />
            <button
              className="btn full"
              disabled={busy || state === "Upcoming"}
            >
              {busy
                ? "Please wait…"
                : state === "Completed"
                  ? "View result"
                  : state === "Upcoming"
                    ? "Examination has not started"
                    : ready
                      ? "Start Examination"
                      : "Review Examination"}
              <ArrowRight size={17} />
            </button>
            {ready && state !== "Completed" && (
              <button
                type="button"
                className="text-link confirmation-back"
                onClick={() => setReady(false)}
              >
                Edit participant details
              </button>
            )}
          </form>
          {saved && (
            <a href={"/attempts/" + saved} className="resume-link">
              Resume / view my saved attempt
            </a>
          )}
        </div>
      </div>
      {result && <Result a={result} />}
    </div>
  );
}
function Result({ a }: any) {
  if (!a.result)
    return (
      <div className="notice">
        <CheckCircle2 />
        <h2>Your examination has been submitted</h2>
        <p>
          Your saved answers are final. Results and correct answers will appear
          after the examination closes and results are released.
        </p>
        <a href={"/exams/" + a.exam_id} className="text-link">
          Return to exam details
        </a>
      </div>
    );
  const r = a.result;
  return (
    <section className="result section">
      <div className="section-head">
        <div>
          <div className="eyebrow">YOUR PERFORMANCE</div>
          <h2>{a.title}</h2>
          <p>
            {a.student_name} · {a.university}
          </p>
        </div>
        <div className="rank-medal">
          Position <strong>#{r.position}</strong>
        </div>
      </div>
      <div className="detail-grid">
        {[
          ["Final score", r.score / 100],
          ["Percentage", (r.percentage / 100).toFixed(2) + "%"],
          ["Total questions", a.questions.length],
          ["Correct", r.correct],
          ["Wrong", r.wrong],
          ["Unanswered", r.unanswered],
          ["Positive marks", r.positive / 100],
          ["Negative marks", r.negative / 100],
          ["Time taken", duration(r.duration)],
        ].map(([k, v]) => (
          <div key={k}>
            <span>{k}</span>
            <b>{v}</b>
          </div>
        ))}
      </div>
      <h2 className="mt-8">Answer review</h2>
      {a.questions.map((q: any, i: number) => (
        <article className="review-card" key={q.id}>
          <span
            className={
              "badge " +
              (q.selected == null
                ? "upcoming"
                : q.selected === q.correct_option
                  ? "live"
                  : "wrong")
            }
          >
            {q.selected == null
              ? "Unanswered"
              : q.selected === q.correct_option
                ? "Correct"
                : "Wrong"}
          </span>
          <h3>
            {i + 1}. {q.question}
          </h3>
          {q.image && (
            <img
              className="question-image"
              src={"/api/files/" + q.image}
              alt="Question illustration"
            />
          )}
          <p>
            Your answer:{" "}
            {q.selected == null ? "Unanswered" : q.options[q.selected]}
          </p>
          <p className="correct-text">
            Correct answer: {q.options[q.correct_option]}
          </p>
          {q.explanation && <p className="explanation">{q.explanation}</p>}
        </article>
      ))}
    </section>
  );
}
function ExamSession({ id }: any) {
  const [a, setA] = useState<any>(null),
    [error, setError] = useState(""),
    [remaining, setRemaining] = useState(0),
    [confirm, setConfirm] = useState(false),
    [pending, setPending] = useState(0),
    [saveError, setSaveError] = useState(false);
  const offset = useRef(0),
    queue = useRef(Promise.resolve()),
    latest = useRef<any>(null),
    submitting = useRef(false),
    answerVersion = useRef(0);
  const refresh = async () => {
    try {
      const version = answerVersion.current;
      await queue.current;
      const d = await api("attempts/" + id);
      if (version !== answerVersion.current) return;
      offset.current = d.serverTime - Date.now();
      latest.current = d;
      setA(d);
      setRemaining(Math.max(0, d.deadline - d.serverTime));
      setError("");
    } catch (e: any) {
      setError(e.message);
    }
  };
  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 15000);
    return () => clearInterval(t);
  }, [id]);
  const submit = async () => {
    if (submitting.current) return;
    submitting.current = true;
    try {
      await queue.current;
      const d = await api("attempts/" + id + "/submit", {});
      latest.current = d;
      setA(d);
      setConfirm(false);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      submitting.current = false;
    }
  };
  useEffect(() => {
    const t = setInterval(() => {
      const d = latest.current;
      if (d?.status === "active") {
        const n = Math.max(0, d.deadline - (Date.now() + offset.current));
        setRemaining(n);
        if (n === 0) submit();
      }
    }, 1000);
    return () => clearInterval(t);
  }, [id]);
  const save = (qid: string, selected: number | null) => {
    answerVersion.current++;
    setPending((n) => n + 1);
    setA((v: any) => ({
      ...v,
      questions: v.questions.map((q: any) =>
        q.id === qid ? { ...q, selected } : q,
      ),
    }));
    queue.current = queue.current.then(async () => {
      try {
        await api("attempts/" + id + "/answers", { questionId: qid, selected });
        setSaveError(false);
      } catch (e: any) {
        setSaveError(true);
        toast.error("Answer not saved: " + e.message);
      } finally {
        setPending((n) => n - 1);
      }
    });
  };
  const flagQuestion = (qid: string, flagged: boolean) => {
    answerVersion.current++;
    setPending((n) => n + 1);
    setA((v: any) => ({
      ...v,
      questions: v.questions.map((q: any) =>
        q.id === qid ? { ...q, flagged: +flagged } : q,
      ),
    }));
    queue.current = queue.current.then(async () => {
      try {
        await api("attempts/" + id + "/flags", { questionId: qid, flagged });
        setSaveError(false);
      } catch (e: any) {
        setSaveError(true);
        toast.error("Review flag not saved: " + e.message);
      } finally {
        setPending((n) => n - 1);
      }
    });
  };
  if (!a)
    return (
      <div className="container section">
        <ErrorBox error={error} />
        {!error && <Loading />}
      </div>
    );
  if (a.status !== "active")
    return (
      <div className="container section">
        <Result a={a} />
        <ActionButton action={refresh} className="btn outline">
          Refresh result
        </ActionButton>
      </div>
    );
  const answered = a.questions.filter((v: any) => v.selected != null).length;
  return (
    <div className="container section">
      <ErrorBox error={error} />
      <div className="exam-running-head">
        <div>
          <div className="eyebrow">EXAMINATION IN PROGRESS</div>
          <h1>{a.title}</h1>
          <p>
            {a.student_name} · {a.university}
          </p>
        </div>
        <div className={"timer " + (remaining < 60000 ? "urgent" : "")}>
          <Clock size={19} />
          <span>
            {String(Math.floor(remaining / 60000)).padStart(2, "0")}:
            {String(Math.floor(remaining / 1000) % 60).padStart(2, "0")}
            <small>TIME REMAINING</small>
          </span>
        </div>
      </div>
      <div className="exam-all-questions">
        <aside className="card exam-progress-bar">
          <h3>Your progress</h3>
          <p>
            {answered} of {a.questions.length} answered
          </p>
          <Progress value={(answered / a.questions.length) * 100} />
          <span className={saveError ? "error-text" : "save-status"}>
            {pending
              ? "Saving Answers…"
              : saveError
                ? "Some Answers Are Not Saved. Select Them Again."
                : "All Answers Saved To Server"}
          </span>
          <nav className="question-palette" aria-label="Question palette">
            {a.questions.map((q: any, index: number) => (
              <a
                key={q.id}
                href={`#question-${index + 1}`}
                className={`${q.selected != null ? "answered" : "unanswered"} ${q.flagged ? "flagged" : ""}`}
                aria-label={`Question ${index + 1}: ${q.selected != null ? "answered" : "unanswered"}${q.flagged ? ", flagged for review" : ""}`}
              >
                {index + 1}
              </a>
            ))}
          </nav>
          <div className="palette-legend">
            <span className="answered">Answered</span>
            <span>Unanswered</span>
            <span className="flagged">Review</span>
          </div>
        </aside>
        {a.questions.map((q: any, index: number) => (
          <article
            className="card exam-question-full"
            id={`question-${index + 1}`}
            key={q.id}
          >
            <div className="section-head">
              <span className="eyebrow">
                QUESTION {index + 1} OF {a.questions.length}
              </span>
              <div className="question-actions">
                <span
                  className={`badge ${q.selected != null ? "live" : "upcoming"}`}
                >
                  {q.selected != null ? "Answered" : "Unanswered"}
                </span>
                <button
                  type="button"
                  className={`flag-button ${q.flagged ? "active" : ""}`}
                  onClick={() => flagQuestion(q.id, !q.flagged)}
                  aria-pressed={!!q.flagged}
                >
                  <Flag size={15} /> {q.flagged ? "Flagged" : "Flag for review"}
                </button>
              </div>
            </div>
            <h2 className="question-text">{q.question}</h2>
            {q.image && (
              <img
                className="question-image"
                src={`/api/files/${q.image}`}
                alt="Question illustration"
              />
            )}
            <RadioGroup
              value={q.selected == null ? "" : String(q.selected)}
              onValueChange={(v) => save(q.id, Number(v))}
            >
              {q.options.map((o: string, i: number) => (
                <label
                  className={`option ${q.selected === i ? "selected" : ""}`}
                  key={q.id + i}
                >
                  <RadioGroupItem value={String(i)} id={q.id + i} />
                  <b>{String.fromCharCode(65 + i)}</b>
                  <span>{o}</span>
                </label>
              ))}
            </RadioGroup>
            <button
              className="text-link clear-answer"
              onClick={() => save(q.id, null)}
            >
              Clear Answer
            </button>
          </article>
        ))}
        <div className="card final-submit">
          <h2>Ready To Submit?</h2>
          <p>
            Answered: {answered} · Unanswered: {a.questions.length - answered} ·
            Flagged: {a.questions.filter((q: any) => q.flagged).length}
          </p>
          <button
            className="btn full"
            disabled={pending > 0 || saveError}
            onClick={() => setConfirm(true)}
          >
            Submit Exam
          </button>
          <p className="muted small">
            Your original deadline remains unchanged after refreshing.
          </p>
        </div>
      </div>
      <Confirm
        open={confirm}
        onOpenChange={setConfirm}
        title="Submit your examination?"
        description={`You cannot participate in this examination again using this code. Answered: ${answered}. Unanswered: ${a.questions.length - answered}. Choose Cancel to continue your exam.`}
        action="Submit Exam"
        onConfirm={submit}
      />
    </div>
  );
}
function readCart(): any[] {
  try {
    return JSON.parse(localStorage.getItem("lva-cart") || "[]");
  } catch {
    return [];
  }
}
function writeCart(c: any[]) {
  localStorage.setItem("lva-cart", JSON.stringify(c));
  window.dispatchEvent(new Event("cart"));
}
function addCart(b: any) {
  let c = readCart(),
    item = c.find((x) => x.id === b.id);
  if (item) item.quantity = Math.min(99, item.quantity + 1);
  else c.push({ id: b.id, quantity: 1 });
  writeCart(c);
  toast.success("Book added to your cart");
}
function bookCategories(value: any): string[] {
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value || "");
    if (Array.isArray(parsed)) return parsed;
  } catch {}
  return value
    ? String(value)
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
}
function BookCover({ b }: any) {
  return b.cover ? (
    <div className="book-cover-stage">
      <div className="book-cover-flat">
        <img
          loading="lazy"
          decoding="async"
          width={1200}
          height={1800}
          sizes="(max-width: 600px) 70vw, 190px"
          src={"/api/files/" + b.cover}
          alt={b.title + " cover"}
        />
      </div>
    </div>
  ) : (
    <div className="book-no-cover">
      <BookOpen size={42} strokeWidth={1} />
      <span>
        {b.type === "softcopy" ? "DIGITAL EDITION" : "HARDCOPY EDITION"}
      </span>
    </div>
  );
}
function PdfDocumentViewer({
  src,
  title,
  onClose,
}: {
  src: string;
  title: string;
  onClose?: () => void;
}) {
  const viewer = useRef<HTMLDivElement>(null);
  const pages = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState("Loading PDF…");
  const [pageCount, setPageCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [layoutVersion, setLayoutVersion] = useState(0);

  useEffect(() => {
    const resize = () =>
      requestAnimationFrame(() => setLayoutVersion((value) => value + 1));
    document.addEventListener("fullscreenchange", resize);
    window.addEventListener("resize", resize);
    return () => {
      document.removeEventListener("fullscreenchange", resize);
      window.removeEventListener("resize", resize);
    };
  }, []);

  useEffect(() => {
    const container = pages.current;
    if (!container) return;
    let cancelled = false;
    let loadingTask: any;
    container.replaceChildren();
    setStatus("Loading PDF…");
    setPageCount(0);
    setCurrentPage(1);

    const render = async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
        loadingTask = pdfjs.getDocument(src);
        const pdf = await loadingTask.promise;
        if (cancelled) return;
        setPageCount(pdf.numPages);

        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
          if (cancelled) return;
          const page = await pdf.getPage(pageNumber);
          const baseViewport = page.getViewport({ scale: 1 });
          const availableWidth = Math.max(280, container.clientWidth - 24);
          const fitScale = Math.min(1, availableWidth / baseViewport.width);
          const cssScale = fitScale * zoom;
          const outputScale = Math.min(window.devicePixelRatio || 1, 2);
          const viewport = page.getViewport({ scale: cssScale * outputScale });
          const sheet = document.createElement("div");
          const canvas = document.createElement("canvas");
          const context = canvas.getContext("2d");
          if (!context) throw new Error("PDF canvas is unavailable.");

          sheet.className = "book-pdf-page";
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          canvas.style.width = `${Math.floor(viewport.width / outputScale)}px`;
          canvas.style.height = `${Math.floor(viewport.height / outputScale)}px`;
          canvas.setAttribute("role", "img");
          canvas.setAttribute(
            "aria-label",
            `${title}, page ${pageNumber} of ${pdf.numPages}`,
          );
          sheet.appendChild(canvas);
          container.appendChild(sheet);
          await page.render({ canvas, canvasContext: context, viewport })
            .promise;
          setStatus(`Rendering page ${pageNumber} of ${pdf.numPages}…`);
        }
        setStatus("");
      } catch {
        if (!cancelled)
          setStatus("The PDF could not be displayed. Please try again.");
      }
    };

    void render();
    return () => {
      cancelled = true;
      loadingTask?.destroy();
    };
  }, [src, title, zoom, layoutVersion]);

  const goToPage = (page: number) => {
    const container = pages.current;
    if (!container || !pageCount) return;
    const targetPage = Math.max(1, Math.min(pageCount, page));
    const target = container.children.item(
      targetPage - 1,
    ) as HTMLElement | null;
    if (!target) return;
    container.scrollTo({ top: target.offsetTop - 8, behavior: "smooth" });
    setCurrentPage(targetPage);
  };

  const updateCurrentPage = () => {
    const container = pages.current;
    if (!container?.children.length) return;
    let closestPage = 1;
    let closestDistance = Number.POSITIVE_INFINITY;
    Array.from(container.children).forEach((child, index) => {
      const distance = Math.abs(
        (child as HTMLElement).offsetTop - container.scrollTop - 8,
      );
      if (distance < closestDistance) {
        closestDistance = distance;
        closestPage = index + 1;
      }
    });
    setCurrentPage(closestPage);
  };

  const enterFullscreen = async () => {
    const element = viewer.current as any;
    if (!element) return;
    setZoom(1);
    if (document.fullscreenElement) await document.exitFullscreen();
    else if (element.requestFullscreen) await element.requestFullscreen();
    else element.webkitRequestFullscreen?.();
  };

  return (
    <div
      className="book-pdf-viewer"
      aria-label={`${title} PDF viewer`}
      ref={viewer}
    >
      <div className="book-pdf-toolbar" aria-label="PDF controls">
        <div className="book-pdf-toolbar-group">
          <button
            type="button"
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage <= 1}
            aria-label="Previous page"
            title="Previous page"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="book-pdf-page-number" aria-live="polite">
            {pageCount ? `${currentPage} / ${pageCount}` : "— / —"}
          </span>
          <button
            type="button"
            onClick={() => goToPage(currentPage + 1)}
            disabled={!pageCount || currentPage >= pageCount}
            aria-label="Next page"
            title="Next page"
          >
            <ChevronRight size={18} />
          </button>
        </div>
        <div className="book-pdf-toolbar-group">
          <button
            type="button"
            onClick={() => setZoom((value) => Math.max(0.75, value - 0.25))}
            disabled={zoom <= 0.75}
            aria-label="Zoom out"
            title="Zoom out"
          >
            <ZoomOut size={18} />
          </button>
          <span className="book-pdf-zoom">{Math.round(zoom * 100)}%</span>
          <button
            type="button"
            onClick={() => setZoom((value) => Math.min(2, value + 0.25))}
            disabled={zoom >= 2}
            aria-label="Zoom in"
            title="Zoom in"
          >
            <ZoomIn size={18} />
          </button>
          <button
            type="button"
            onClick={enterFullscreen}
            aria-label="Toggle fullscreen"
            title="Fullscreen"
          >
            <Maximize2 size={18} />
          </button>
          <a
            href={src}
            download
            aria-label={`Download ${title}`}
            title="Download PDF"
          >
            <Download size={18} />
          </a>
          {onClose && (
            <button
              type="button"
              className="book-pdf-close"
              onClick={onClose}
              aria-label="Close PDF viewer"
              title="Close"
            >
              <X size={18} />
              <span>Close</span>
            </button>
          )}
        </div>
      </div>
      {status && <div className="book-pdf-status">{status}</div>}
      <div
        className="book-pdf-pages"
        ref={pages}
        onScroll={updateCurrentPage}
      />
    </div>
  );
}
function BookPreviewDialog({ book, open, onOpenChange }: any) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="book-reader-dialog" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{book.title}</DialogTitle>
        </DialogHeader>
        <PdfDocumentViewer
          src={`/api/files/${book.preview}`}
          title={book.title}
          onClose={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
function BookCard({
  b,
  settings = defaults,
  clone = false,
  home = false,
}: any) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const coverHref = b.preview ? "/api/files/" + b.preview : "/books/" + b.id;
  const inStock =
    !!b.available && !(b.type === "hardcopy" && b.stock_count === 0);
  return (
    <article
      className="book-card"
      aria-hidden={clone || undefined}
      {...(clone ? ({ inert: "" } as any) : {})}
    >
      <button
        type="button"
        className="book-cover-preview-link"
        data-preview-href={coverHref}
        tabIndex={clone ? -1 : undefined}
        onClick={() =>
          b.preview
            ? setPreviewOpen(true)
            : (window.location.href = "/books/" + b.id)
        }
        aria-label={
          b.preview ? `Open preview PDF for ${b.title}` : `View ${b.title}`
        }
      >
        <BookCover b={b} />
      </button>
      <div className="book-card-content">
        <span className="eyebrow">
          {b.type === "hardcopy" ? "HARDCOPY" : "SOFTCOPY / EBOOK"}
        </span>
        <h3>
          <a href={"/books/" + b.id}>{b.title}</a>
        </h3>
        <p className="book-meta">
          {b.author || "Lex Veritas Academy"} · {b.subject}
        </p>
        <div className="book-price">
          {b.old_price > b.price && <del>{money(b.old_price)}</del>}
          <strong>{money(b.price)}</strong>
          {b.old_price > b.price && (
            <span className="badge discount">
              {Math.round((1 - b.price / b.old_price) * 100)}% OFF
            </span>
          )}
          {!inStock ? (
            <span className="badge stock-out">Stock Out</span>
          ) : b.type === "hardcopy" && b.stock_count !== null ? (
            <span className="badge live">{b.stock_count} in stock</span>
          ) : null}
        </div>
        <div className="book-card-actions">
          {!home && (
            <button
              type="button"
              className="btn outline"
              tabIndex={clone ? -1 : undefined}
              disabled={!b.preview || clone}
              onClick={() =>
                b.preview
                  ? setPreviewOpen(true)
                  : (window.location.href = "/books/" + b.id)
              }
            >
              Preview
            </button>
          )}
          <a
            className="btn outline"
            href={`/books/${b.id}`}
            tabIndex={clone ? -1 : undefined}
          >
            {settings.booksViewText || "View Book"}
          </a>
          <button
            className="btn"
            disabled={clone || !inStock}
            onClick={() => {
              if (b.type === "hardcopy") {
                addCart(b);
                window.location.href = "/checkout";
              } else window.location.href = "/checkout?book=" + b.id;
            }}
          >
            {settings.booksBuyText || "Buy Now"}
          </button>
        </div>
        {!clone && (
          <ShareActions title={b.title} href={`/books/${b.id}`} compact />
        )}
      </div>
      {b.preview && !clone && (
        <BookPreviewDialog
          book={b}
          open={previewOpen}
          onOpenChange={setPreviewOpen}
        />
      )}
    </article>
  );
}
function BookReader({ id }: any) {
  const { data: b, error } = useData("books/" + id);
  return (
    <div className="container section book-reader-page">
      <a className="back-link" href={`/books/${id}`}>
        <ChevronLeft size={16} /> Back to book
      </a>
      <ErrorBox error={error} />
      {!b && !error ? (
        <Loading />
      ) : b?.preview ? (
        <>
          <div className="book-reader-heading">
            <div>
              <span className="eyebrow">BOOK PREVIEW</span>
              <h1>{b.title}</h1>
            </div>
            <a className="btn outline" href={`/books/${id}`}>
              Book Details
            </a>
          </div>
          <PdfDocumentViewer src={`/api/files/${b.preview}`} title={b.title} />
        </>
      ) : (
        <EmptyState title="Preview not available">
          This book does not have a preview PDF yet.
        </EmptyState>
      )}
    </div>
  );
}
function Books({ initialType = "all" }: { initialType?: string }) {
  const { data, error } = useData("books"),
    [search, setSearch] = useState(""),
    [type, setType] = useState(
      ["hardcopy", "softcopy"].includes(initialType) ? initialType : "all",
    ),
    [exam, setExam] = useState("all"),
    [subject, setSubject] = useState("all"),
    [sort, setSort] = useState("newest");
  useBookTools(data || [], setSearch, setType);
  const subjects = Array.from(
    new Set((data || []).map((b: any) => b.subject).filter(Boolean)),
  ) as string[];
  const rows = data
    ?.filter((b: any) => {
      const term = search.toLowerCase();
      return (
        (type === "all" || b.type === type) &&
        (exam === "all" || bookCategories(b.exam_category).includes(exam)) &&
        (subject === "all" || b.subject === subject) &&
        [b.title, b.author, b.subject].some((v) =>
          String(v || "")
            .toLowerCase()
            .includes(term),
        )
      );
    })
    .sort((a: any, b: any) =>
      sort === "popular"
        ? b.sold_count - a.sold_count
        : sort === "price"
          ? a.price - b.price
          : b.created_at - a.created_at,
    );
  return (
    <div className="container section">
      <Heading
        eyebrow="THE ACADEMY BOOKSHELF"
        title="Read deeper. Prepare better."
      >
        Law books and digital materials for BJS, Bar Council, Law Officer, and
        academic legal preparation.
      </Heading>
      <div className="books-filter-grid">
        <label className="book-filter-field">
          <span>Search Books</span>
          <input
            aria-label="Search books"
            placeholder="Title, Author or Subject"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <div className="book-filter-field">
          <span>Exam</span>
          <Choice
            label="Exam"
            value={exam}
            onChange={setExam}
            options={[
              { value: "all", label: "All Exams" },
              "BJS",
              "Bar Council",
              "Academic",
              "General Subject",
            ]}
          />
        </div>
        <div className="book-filter-field">
          <span>Format</span>
          <Choice
            label="Format"
            value={type}
            onChange={setType}
            options={[
              { value: "all", label: "All Formats" },
              { value: "hardcopy", label: "Hardcopy" },
              { value: "softcopy", label: "Softcopy / eBook" },
            ]}
          />
        </div>
        <div className="book-filter-field">
          <span>Subject</span>
          <Choice
            label="Subject"
            value={subject}
            onChange={setSubject}
            options={[{ value: "all", label: "All Subjects" }, ...subjects]}
          />
        </div>
        <div className="book-filter-field">
          <span>Sort</span>
          <Choice
            label="Sort books"
            value={sort}
            onChange={setSort}
            options={[
              { value: "newest", label: "Newest" },
              { value: "popular", label: "Popular" },
              { value: "price", label: "Price Low–High" },
            ]}
          />
        </div>
      </div>
      <ErrorBox error={error} />
      {!data && !error ? (
        <Loading />
      ) : rows?.length ? (
        <div className="grid four">
          {rows.map((b: any) => (
            <BookCard b={b} key={b.id} />
          ))}
        </div>
      ) : (
        <EmptyState title="No books available">
          New titles will appear here when published by the Academy.
        </EmptyState>
      )}
    </div>
  );
}
function BookDetail({ id }: any) {
  const { data: b, error } = useData("books/" + id);
  const [previewOpen, setPreviewOpen] = useState(false);
  return (
    <div className="container section">
      <a className="back-link" href="/books">
        <ChevronLeft size={16} />
        All books
      </a>
      <ErrorBox error={error} />
      {!b && !error ? (
        <Loading />
      ) : (
        b && (
          <div className="book-detail">
            {b.preview ? (
              <button
                type="button"
                className="book-detail-cover-button"
                onClick={() => setPreviewOpen(true)}
                aria-label={`Open preview PDF for ${b.title}`}
              >
                <BookCover b={b} />
              </button>
            ) : (
              <BookCover b={b} />
            )}
            <div>
              <div className="eyebrow">
                {b.type === "hardcopy"
                  ? "HARDCOPY EDITION"
                  : "SOFTCOPY / EBOOK"}
              </div>
              <h1>{b.title}</h1>
              <ShareActions title={b.title} href={`/books/${b.id}`} />
              <p className="book-meta">
                By {b.author || "Lex Veritas Academy"} ·{" "}
                {bookCategories(b.exam_category).join(", ")} · {b.subject}
              </p>
              <div className="book-price">
                {b.old_price > b.price && <del>{money(b.old_price)}</del>}
                <strong>{money(b.price)}</strong>
                {b.old_price > b.price && (
                  <span className="badge discount">
                    {Math.round((1 - b.price / b.old_price) * 100)}% OFF
                  </span>
                )}
                {b.type === "hardcopy" && b.stock_count === 0 ? (
                  <span className="badge stock-out">Stock Out</span>
                ) : b.type === "hardcopy" && b.stock_count !== null ? (
                  <span className="badge live">{b.stock_count} in stock</span>
                ) : null}
              </div>
              <p className="pre-wrap">{b.description}</p>
              {b.preview && (
                <button
                  type="button"
                  className="preview-link"
                  onClick={() => setPreviewOpen(true)}
                >
                  <BookOpen size={19} />
                  কিছু অংশ পড়ে দেখুন
                </button>
              )}
              <div className="actions">
                {b.type === "hardcopy" && (
                  <button
                    className="btn outline"
                    disabled={!b.available || b.stock_count === 0}
                    onClick={() => addCart(b)}
                  >
                    Add to Cart
                  </button>
                )}
                <button
                  className="btn"
                  disabled={
                    !b.available ||
                    (b.type === "hardcopy" && b.stock_count === 0)
                  }
                  onClick={() => {
                    if (b.type === "hardcopy") {
                      addCart(b);
                      window.location.href = "/checkout";
                    } else window.location.href = "/checkout?book=" + b.id;
                  }}
                >
                  Buy Now <ArrowRight size={17} />
                </button>
              </div>
              <div className="notice">
                {b.type === "hardcopy"
                  ? "Delivery options are available at checkout. Cash on delivery is available for home delivery with the delivery charge paid in advance."
                  : "No address needed. Your digital download becomes available only after the Academy verifies payment and has uploaded the full file."}
              </div>
              {b.preview && (
                <BookPreviewDialog
                  book={b}
                  open={previewOpen}
                  onOpenChange={setPreviewOpen}
                />
              )}
            </div>
          </div>
        )
      )}
    </div>
  );
}
function useCart() {
  const { data: books, error } = useData("books"),
    [cart, setCart] = useState<any[]>([]);
  useEffect(() => setCart(readCart()), []);
  const change = (c: any[]) => {
    setCart(c);
    writeCart(c);
  };
  return {
    rows: cart.map((i) => ({
      ...i,
      book: books?.find((b: any) => b.id === i.id),
    })),
    cart,
    change,
    loading: !books,
    error,
  };
}
function Cart() {
  const { rows, change, loading, error } = useCart();
  return (
    <div className="container section">
      <Heading eyebrow="YOUR BOOKS" title="Shopping cart" />
      <ErrorBox error={error} />
      {loading ? (
        <Loading />
      ) : !rows.length ? (
        <EmptyState title="Your cart is empty">
          <a href="/books" className="text-link">
            Explore the bookstore
          </a>
        </EmptyState>
      ) : (
        <div className="split">
          <div>
            {rows.map((x: any) => (
              <div className="cart-row" key={x.id}>
                <BookOpen size={27} />
                <div>
                  <h3>{x.book?.title || "Unavailable book"}</h3>
                  <p>{money(x.book?.price)} each</p>
                  <button
                    className="text-link"
                    onClick={() =>
                      change(
                        rows
                          .filter((i: any) => i.id !== x.id)
                          .map(({ id, quantity }: any) => ({ id, quantity })),
                      )
                    }
                  >
                    Remove
                  </button>
                </div>
                <div className="quantity">
                  <button
                    aria-label="Decrease quantity"
                    disabled={x.quantity <= 1}
                    onClick={() =>
                      change(
                        rows.map((i: any) => ({
                          id: i.id,
                          quantity: i.id === x.id ? i.quantity - 1 : i.quantity,
                        })),
                      )
                    }
                  >
                    −
                  </button>
                  <span>{x.quantity}</span>
                  <button
                    aria-label="Increase quantity"
                    disabled={x.quantity >= 99}
                    onClick={() =>
                      change(
                        rows.map((i: any) => ({
                          id: i.id,
                          quantity: i.id === x.id ? i.quantity + 1 : i.quantity,
                        })),
                      )
                    }
                  >
                    +
                  </button>
                </div>
                <b>{money(x.book?.price * x.quantity)}</b>
              </div>
            ))}
            <button className="text-link" onClick={() => change([])}>
              Clear cart
            </button>
          </div>
          <div className="card">
            <h2>Order summary</h2>
            <div className="summary-line">
              <span>Book subtotal</span>
              <b>
                {money(
                  rows.reduce(
                    (s: number, i: any) =>
                      s + (i.book?.price || 0) * i.quantity,
                    0,
                  ),
                )}
              </b>
            </div>
            <p>One delivery charge per order, selected at checkout.</p>
            <a className="btn full" href="/checkout">
              Continue to checkout <ArrowRight size={17} />
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
function Checkout() {
  const { rows, loading, error } = useCart(),
    { data: settings } = useData("settings"),
    [soft, setSoft] = useState<any>(null),
    [softId, setSoftId] = useState(""),
    [delivery, setDelivery] = useState("dhaka"),
    [paymentType, setPayment] = useState("full"),
    [paymentMethod, setPaymentMethod] = useState("bkash"),
    [couponCode, setCouponCode] = useState(""),
    [coupon, setCoupon] = useState<any>(null),
    [form, setForm] = useState({
      name: "",
      phone: "",
      email: "",
      address: "",
      trx: "",
    }),
    [err, setErr] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("book");
    if (id) {
      setSoftId(id);
      api("books/" + id)
        .then(setSoft)
        .catch((e) => setErr(e.message));
    }
  }, []);
  const s = settings || defaults,
    subtotal = soft
      ? soft.price
      : rows.reduce(
          (v: number, x: any) => v + (x.book?.price || 0) * x.quantity,
          0,
        ),
    charge = softId ? 0 : s[delivery],
    discount = Number(coupon?.discount || 0),
    discountedSubtotal = Math.max(0, subtotal - discount),
    total = discountedSubtotal + charge,
    pay = softId || paymentType === "full" ? total : charge;
  return (
    <div className="container section">
      <Heading
        eyebrow="SECURE ORDER DETAILS"
        title={softId ? "Purchase softcopy" : "Checkout"}
      >
        No account needed. Payments are reviewed manually by the Academy.
      </Heading>
      <ErrorBox error={error} />
      {loading || !settings || (softId && !soft) ? (
        <>
          <ErrorBox error={err} />
          {!err && <Loading />}
        </>
      ) : !softId && !rows.length ? (
        <EmptyState title="Your cart is empty">
          <a href="/books">Browse books</a>
        </EmptyState>
      ) : (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setErr("");
            setBusy(true);
            try {
              const d = await api("orders", {
                type: softId ? "softcopy" : "hardcopy",
                name: form.name,
                phone: form.phone,
                email: form.email || undefined,
                trx: form.trx,
                paymentMethod,
                couponCode: coupon?.code || undefined,
                ...(softId
                  ? { bookId: softId }
                  : {
                      address: form.address,
                      delivery,
                      paymentType,
                      items: rows.map(({ id, quantity }: any) => ({
                        id,
                        quantity,
                      })),
                    }),
              });
              if (!softId) writeCart([]);
              window.location.href = "/orders/" + d.id;
            } catch (e: any) {
              setErr(e.message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="split">
            <div className="card">
              <h2>
                {softId ? "Buyer information" : "Delivery & customer details"}
              </h2>
              <Field
                label="Name"
                required
                autoComplete="name"
                value={form.name}
                onChange={(e: any) =>
                  setForm({ ...form, name: e.target.value })
                }
              />
              <Field
                label="Phone Number"
                required
                type="tel"
                autoComplete="tel"
                placeholder="01XXXXXXXXX"
                value={form.phone}
                onChange={(e: any) =>
                  setForm({ ...form, phone: e.target.value })
                }
              />
              <Field
                label="Email (optional)"
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={(e: any) =>
                  setForm({ ...form, email: e.target.value })
                }
              />
              {!softId && (
                <>
                  <Field label="Address">
                    <textarea
                      required
                      autoComplete="street-address"
                      rows={3}
                      value={form.address}
                      onChange={(e) =>
                        setForm({ ...form, address: e.target.value })
                      }
                    />
                  </Field>
                  <Field label="Delivery option">
                    <Choice
                      label="Delivery option"
                      value={delivery}
                      onChange={(v: string) => {
                        setDelivery(v);
                        if (v === "sundarban") setPayment("full");
                      }}
                      options={Object.entries(deliveryNames).map(
                        ([value, label]) => ({
                          value,
                          label: label + " — " + money(s[value]),
                        }),
                      )}
                    />
                  </Field>
                  <Field label="Payment choice">
                    <Choice
                      label="Payment choice"
                      value={paymentType}
                      onChange={setPayment}
                      options={[
                        { value: "full", label: "Full Pay" },
                        ...(delivery !== "sundarban"
                          ? [
                              {
                                value: "cod",
                                label: "COD — pay delivery charge now",
                              },
                            ]
                          : []),
                      ]}
                    />
                  </Field>
                </>
              )}
              <PaymentMethodPicker
                settings={s}
                value={paymentMethod}
                onChange={setPaymentMethod}
                amount={money(pay)}
              />
              <Field label="Coupon code">
                <div className="coupon-entry">
                  <input
                    value={couponCode}
                    onChange={(e: any) => {
                      setCouponCode(e.target.value.toUpperCase());
                      setCoupon(null);
                    }}
                    placeholder="Enter coupon code"
                  />
                  <ActionButton
                    type="button"
                    className="btn secondary"
                    disabled={!couponCode.trim()}
                    action={async () => {
                      const c = await api("coupons/validate", {
                        code: couponCode,
                        amount: subtotal,
                        orderType: softId ? "softcopy" : "hardcopy",
                        productIds: softId
                          ? [softId]
                          : rows.map((x: any) => x.id),
                      });
                      setCoupon(c);
                      toast.success("Coupon applied");
                    }}
                  >
                    Apply
                  </ActionButton>
                </div>
              </Field>
              <Field
                label="TrxID"
                required
                autoComplete="off"
                value={form.trx}
                onChange={(e: any) => setForm({ ...form, trx: e.target.value })}
              />
              <ErrorBox error={err} />
              <button className="btn full" disabled={busy}>
                {busy ? "Submitting…" : "Place order"}
                <ArrowRight size={17} />
              </button>
            </div>
            <aside className="card order-summary">
              <h2>Your order</h2>
              {softId ? (
                <div className="summary-line">
                  <span>{soft.title}</span>
                  <b>{money(soft.price)}</b>
                </div>
              ) : (
                rows.map((x) => (
                  <div className="summary-line" key={x.id}>
                    <span>
                      {x.book?.title || "Unavailable book"} × {x.quantity}
                    </span>
                    <b>{money((x.book?.price || 0) * x.quantity)}</b>
                  </div>
                ))
              )}
              <hr />
              <div className="summary-line">
                <span>Book subtotal</span>
                <b>{money(subtotal)}</b>
              </div>
              {discount > 0 && (
                <div className="summary-line discount">
                  <span>Coupon discount ({coupon.code})</span>
                  <b>−{money(discount)}</b>
                </div>
              )}
              {!softId && (
                <div className="summary-line">
                  <span>Delivery charge</span>
                  <b>{money(charge)}</b>
                </div>
              )}
              <div className="summary-line total">
                <span>Grand total</span>
                <b>{money(total)}</b>
              </div>
              <div className="summary-line">
                <span>Pay now</span>
                <b>{money(pay)}</b>
              </div>
              {!softId && paymentType === "cod" && (
                <div className="summary-line">
                  <span>Due on delivery</span>
                  <b>{money(subtotal)}</b>
                </div>
              )}
              <p className="small muted">
                Entering a TrxID does not verify payment. Keep your order
                confirmation for reference.
              </p>
            </aside>
          </div>
        </form>
      )}
    </div>
  );
}
function TrackOrder() {
  const [id, setId] = useState(""),
    [order, setOrder] = useState<any>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const lookup = async (e: any) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    setOrder(null);
    try {
      setOrder(await api("orders/track", { id: id.trim().toUpperCase() }));
    } catch (x: any) {
      setError(x.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="container section narrow track-order-page">
      <Heading eyebrow="ORDER STATUS" title="Track Your Order">
        Enter the Order ID shown on your confirmation page.
      </Heading>
      <form className="card track-order-form" onSubmit={lookup}>
        <Field
          label="Order ID"
          required
          value={id}
          placeholder="LVA-H-2026-XXXXXXXXXXXX"
          onChange={(e: any) => setId(e.target.value)}
        />
        <button className="btn full" disabled={busy}>
          <Search size={17} />
          {busy ? "Searching…" : "Find Order"}
        </button>
        <ErrorBox error={error} />
      </form>
      {order && (
        <div className="card tracked-order">
          <div className="tracked-order-head">
            <div>
              <span>Order ID</span>
              <strong className="order-id">{order.id}</strong>
            </div>
            <span className={`badge ${order.verified ? "live" : "upcoming"}`}>
              {order.verified ? "Payment Approved" : "Approval Pending"}
            </span>
          </div>
          <div className="grid two">
            <div>
              <h3>Customer</h3>
              <p>
                <b>{order.name}</b>
                <br />
                {order.phone}
                {order.email && (
                  <>
                    <br />
                    {order.email}
                  </>
                )}
                {order.address && (
                  <>
                    <br />
                    {order.address}
                  </>
                )}
              </p>
            </div>
            <div>
              <h3>Order</h3>
              <p>
                <b>
                  {order.title ||
                    order.items
                      ?.map((x: any) => `${x.title} (${x.quantity})`)
                      .join(", ")}
                </b>
                <br />
                {order.payment_method?.replaceAll("_", " ")} · TrxID:{" "}
                {order.trx}
              </p>
            </div>
          </div>
          {order.items?.length > 0 && (
            <div className="tracked-items">
              {order.items.map((x: any) => (
                <div className="summary-line" key={`${x.title}-${x.quantity}`}>
                  <span>
                    {x.title} ({x.quantity})
                  </span>
                  <b>{money(x.price * x.quantity)}</b>
                </div>
              ))}
            </div>
          )}
          <div className="tracked-money">
            <div className="summary-line">
              <span>Total</span>
              <b>{money(order.total)}</b>
            </div>
            <div className="summary-line">
              <span>Paid</span>
              <b>{money(order.paid)}</b>
            </div>
            <div className="summary-line">
              <span>Due</span>
              <b>{money(order.due)}</b>
            </div>
          </div>
          <div className="order-timeline">
            <span className={order.verified ? "done" : ""}>Order received</span>
            <span className={order.verified ? "done" : ""}>Approved</span>
            {order.type === "hardcopy" ? (
              <>
                <span className={order.delivered ? "done" : ""}>
                  Sent for delivery
                </span>
                <span className={order.received ? "done" : ""}>
                  Delivery received
                </span>
              </>
            ) : (
              <span
                className={
                  order.verified && !order.access_suspended ? "done" : ""
                }
              >
                {order.access_suspended ? "Access suspended" : "Access active"}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
function OrderReceipt({ id }: any) {
  const { data: o, error, reload } = useData("orders/" + id);
  return (
    <div className="container section narrow">
      <ErrorBox error={error} />
      {!o && !error ? (
        <Loading />
      ) : (
        o && (
          <div className="card receipt">
            <CheckCircle2 size={42} />
            <h1>Your order has been received</h1>
            <p>Order ID</p>
            <strong className="order-id">{o.id}</strong>
            <p className="notice">
              {o.verified
                ? "Payment verified by the Academy."
                : "Payment verification is pending."}
            </p>
            <div className="summary-line">
              <span>Order total</span>
              <b>{money(o.total)}</b>
            </div>
            <div className="summary-line">
              <span>Submitted payment amount</span>
              <b>{money(o.paid)}</b>
            </div>
            {o.due > 0 && (
              <div className="summary-line">
                <span>Amount due on delivery</span>
                <b>{money(o.due)}</b>
              </div>
            )}
            {o.type === "hardcopy" ? (
              <p>
                Product dispatched: {o.delivered ? "Yes" : "No"} · Delivery
                received: {o.received ? "Yes" : "No"}
              </p>
            ) : o.type === "package" || o.type === "course" ? (
              o.verified ? (
                <div className="notice success">
                  <h2>
                    {o.type === "course"
                      ? "Course Enrollment Confirmed"
                      : "Your Exam Access Code"}
                  </h2>
                  {o.accessCode ? (
                    <>
                      <strong className="order-id">{o.accessCode}</strong>
                      <p>
                        This code works once for each included examination. Keep
                        it private.
                      </p>
                      <a className="btn" href="/exams">
                        View Examinations
                      </a>
                    </>
                  ) : (
                    <p>
                      Your payment has been verified. The Academy will contact
                      you with course access information.
                    </p>
                  )}
                </div>
              ) : (
                <p>
                  Your{" "}
                  {o.type === "course" ? "enrollment" : "package access code"}{" "}
                  will be confirmed after the Admin verifies payment.
                </p>
              )
            ) : o.downloadAvailable ? (
              <a
                className="btn"
                href={"/api/orders/" + id + "/download"}
                onClick={() => window.setTimeout(reload, 1200)}
              >
                Download softcopy
              </a>
            ) : o.downloadedAt ? (
              <div className="notice">
                <h3>Download Already Used</h3>
                <p>
                  This softcopy was downloaded once. Please contact the Academy
                  with your Order ID if you need assistance.
                </p>
              </div>
            ) : o.verified ? (
              <p>
                Your payment is verified. The download will appear here as soon
                as the digital file is available.
              </p>
            ) : null}
            <p>
              Bookmark this page in this browser to check your order. Contact us
              with your Order ID if you need help.
            </p>
            <div className="actions">
              <ActionButton className="btn outline" action={reload}>
                Refresh status
              </ActionButton>
              <a className="text-link" href="/contact">
                Contact the Academy
              </a>
            </div>
          </div>
        )
      )}
    </div>
  );
}
function Contact({ settings }: any) {
  return (
    <div className="container section contact-page">
      <Heading eyebrow="LET’S CONNECT" title="Contact LexVeritas Academy">
        Questions about examinations, access codes, books, or an order? We’re
        here to help.
      </Heading>
      <div className="contact-support-grid">
        <div className="contact-primary">
          <MessageCircle size={37} />
          <h2>WhatsApp Support</h2>
          <a
            href={"https://wa.me/88" + settings.whatsapp}
            target="_blank"
            rel="noopener noreferrer"
            className="phone-number"
          >
            {settings.whatsapp}
            <ArrowUpRight />
          </a>
          <p className="small">{settings.responseTime}</p>
        </div>
        <div className="contact-detail-list card">
          <div>
            <Mail />
            <span>
              <small>Email</small>
              <a href={`mailto:${settings.email || "parvezbupllb@gmail.com"}`}>
                {settings.email || "parvezbupllb@gmail.com"}
              </a>
            </span>
          </div>
          <div>
            <Clock />
            <span>
              <small>Support Hours</small>
              <strong>{settings.supportHours}</strong>
            </span>
          </div>
          <div>
            <ShoppingBag />
            <span>
              <small>Order Support</small>
              <strong>{settings.orderSupport}</strong>
            </span>
          </div>
          <div>
            <Headphones />
            <span>
              <small>Exam Access Support</small>
              <strong>{settings.examAccessSupport}</strong>
            </span>
          </div>
        </div>
      </div>
      <section className="contact-community card">
        <div>
          <h2>Connect With The Academy</h2>
          <p>Follow announcements and join our legal learning community.</p>
        </div>
        <ContactLinks settings={settings} />
      </section>
      <ContactFaq />
    </div>
  );
}
function About({ settings }: any) {
  return (
    <>
      <div className="container section narrow">
        <Heading
          eyebrow="KNOWLEDGE. PRACTICE. PROGRESS."
          title="About LexVeritas Academy"
        />
        <p className="lead pre-wrap">{settings.about}</p>
        <div className="notice">
          <h2>BJS • Bar Council • Law Officer • Academic Legal Education</h2>
          <p>
            Practice through timed examinations, review your answers, and find
            reading materials for your next stage in law.
          </p>
          <div className="actions">
            <a href="/packages" className="btn">
              Explore Exam Packages
            </a>
            <a href="/books" className="btn outline">
              Browse Books
            </a>
          </div>
        </div>
      </div>
      <div id="our-team">
        <TeamSection settings={settings} />
      </div>
    </>
  );
}

function ContactFaq({ showAllLink = true }: { showAllLink?: boolean } = {}) {
  return (
    <section className="contact-faq">
      <div className="eyebrow">QUICK ANSWERS</div>
      <h2>Frequently Asked Questions</h2>
      <div className="faq-list">
        <details>
          <summary>How do I get help with an order?</summary>
          <p>
            Message the Academy on WhatsApp and include the Order ID shown on
            your confirmation page.
          </p>
        </details>
        <details>
          <summary>What should I send for exam access support?</summary>
          <p>
            Send the Exam or Package name, your name and your access code. Never
            share an Admin password.
          </p>
        </details>
        <details>
          <summary>When will my payment be confirmed?</summary>
          <p>
            Payments are checked manually. You can follow the current status
            from Track Your Order.
          </p>
        </details>
      </div>
      {showAllLink && (
        <a className="text-link" href="/faq">
          View All FAQs <ArrowRight size={16} />
        </a>
      )}
    </section>
  );
}

function SupportFaq({ settings }: any) {
  return (
    <div className="container section narrow">
      <Heading eyebrow="SUPPORT" title="Frequently Asked Questions">
        Quick guidance for orders, digital products and examination access.
      </Heading>
      <ContactFaq showAllLink={false} />
      <div className="final-support-card">
        <HelpCircle />
        <div>
          <h2>Still Need Help?</h2>
          <p>{settings.responseTime}</p>
        </div>
        <a
          className="btn"
          href={`https://wa.me/88${settings.whatsapp}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          WhatsApp Support
        </a>
      </div>
    </div>
  );
}

const policyCopy: Record<
  string,
  { title: string; intro: string; sections: [string, string][] }
> = {
  privacy: {
    title: "Privacy Policy",
    intro:
      "How LexVeritas Academy handles information needed for examinations, orders and support.",
    sections: [
      [
        "Information We Collect",
        "We collect only the information needed to provide the requested service, including names, contact details, order information and exam participation data.",
      ],
      [
        "How We Use It",
        "Information is used to deliver purchases, verify payments, provide exam access, respond to support requests and protect the service.",
      ],
      [
        "Private Information",
        "Phone numbers, addresses, transaction IDs and access codes are not published and are available only to authorized administrators where required.",
      ],
    ],
  },
  terms: {
    title: "Terms & Conditions",
    intro: "The rules that apply when using LexVeritas Academy services.",
    sections: [
      [
        "Use Of The Website",
        "Use the website lawfully and do not attempt to bypass exam, payment, download or administrative controls.",
      ],
      [
        "Examinations",
        "Exam access is subject to the published schedule, duration, package access and attempt rules.",
      ],
      [
        "Orders",
        "An order is received when submitted. Manual payment verification is required before it is treated as approved.",
      ],
    ],
  },
  refund: {
    title: "Refund Policy",
    intro:
      "Refund requests are reviewed according to product type and order status.",
    sections: [
      [
        "Eligibility",
        "Contact support promptly with your Order ID and payment information. Eligibility depends on whether a physical order has been dispatched or a digital product has been accessed.",
      ],
      [
        "Digital Products",
        "A downloaded or accessed digital product is normally not refundable unless the file is defective or the Academy is unable to provide access.",
      ],
      [
        "Review Process",
        "Approved refunds are processed through the agreed payment method after manual review.",
      ],
    ],
  },
  shipping: {
    title: "Shipping & Delivery Policy",
    intro: "Delivery information for hardcopy book orders.",
    sections: [
      [
        "Delivery Methods",
        "Available delivery methods and charges are shown at checkout and applied once per order.",
      ],
      [
        "Dispatch",
        "Dispatch begins after the required payment is verified. Delivery time can vary by location and courier operations.",
      ],
      [
        "Support",
        "Use Track Your Order or contact WhatsApp support with your Order ID for dispatch and receipt assistance.",
      ],
    ],
  },
  digital: {
    title: "Digital Product Policy",
    intro:
      "Access rules for eBooks, softcopy materials and other digital products.",
    sections: [
      [
        "Payment Verification",
        "Digital access is activated only after an administrator verifies the submitted payment.",
      ],
      [
        "Protected Access",
        "Download links are controlled and must not be shared, redistributed or used to bypass access limits.",
      ],
      [
        "Technical Support",
        "If an approved file cannot be accessed, contact support with the Order ID and the phone number used for the order.",
      ],
    ],
  },
};
function PolicyPage({ type }: { type: string }) {
  const page = policyCopy[type] || policyCopy.terms;
  return (
    <article className="container section narrow policy-page">
      <div className="eyebrow">LEXVERITAS ACADEMY</div>
      <h1>{page.title}</h1>
      <p className="lead">{page.intro}</p>
      {page.sections.map(([title, content]) => (
        <section key={title}>
          <h2>{title}</h2>
          <p>{content}</p>
        </section>
      ))}
      <p className="policy-contact">
        Questions? <a href="/contact">Contact LexVeritas Academy</a>.
      </p>
    </article>
  );
}
