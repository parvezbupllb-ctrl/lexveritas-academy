"use client";
import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Choice, ErrorBox, Field, api, cash } from "@/lib/client";
import { MediaUpload } from "./media-upload";

function ImageSetting({ kind, value, onChange }: any) {
  return <MediaUpload kind={kind} value={value} onChange={onChange} successMessage="Website image uploaded" />;
}
const textFields = (form: any, set: any, fields: [string, string][]) =>
  fields.map(([key, label]) => (
    <Field
      key={key}
      label={label}
      value={form[key] ?? ""}
      onChange={(e: any) => set(key, e.target.value)}
    />
  ));
const Tog = ({ label, value, onChange }: any) => (
  <label className="toggle-line">
    <span>{label}</span>
    <input
      type="checkbox"
      checked={!!value}
      onChange={(e) => onChange(e.target.checked)}
    />
  </label>
);
const sectionKeys = [
  "notice",
  "statistics",
  "packages",
  "courses",
  "books",
  "blog",
  "reviews",
  "team",
];
const normalizedOrder = (value: any) => {
  const current = Array.isArray(value)
    ? value.filter((x: string) => sectionKeys.includes(x))
    : [];
  return [...new Set([...current, ...sectionKeys])];
};
export function WebsiteSettings() {
  const [s, setS] = useState<any>(null),
    [error, setError] = useState("");
  useEffect(() => {
    api("admin/settings")
      .then((v) =>
        setS({
          ...v,
          homeSectionOrder: normalizedOrder(v.homeSectionOrder),
          sundarban: String(v.sundarban / 100),
          dhaka: String(v.dhaka / 100),
          outside: String(v.outside / 100),
        }),
      )
      .catch((e) => setError(e.message));
  }, []);
  if (!s) return <ErrorBox error={error} />;
  const set = (k: string, v: any) => setS({ ...s, [k]: v });
  const save = async () => {
    setError("");
    try {
      await api(
        "admin/settings",
        {
          ...s,
          sundarban: cash(s.sundarban),
          dhaka: cash(s.dhaka),
          outside: cash(s.outside),
          noticeMaxVisible: Number(s.noticeMaxVisible),
          blogHomeCount: Number(s.blogHomeCount),
          reviewsHomeCount: Number(s.reviewsHomeCount),
          borderRadius: Number(s.borderRadius),
          sectionSpacing: Number(s.sectionSpacing),
        },
        "PATCH",
      );
      toast.success(
        "Website Settings saved. Public pages now use the updated values.",
      );
    } catch (e: any) {
      setError(e.message);
    }
  };
  const order = s.homeSectionOrder || [];
  return (
    <>
      <div className="section-head admin-page-heading">
        <div>
          <div className="eyebrow">WEBSITE MANAGEMENT</div>
          <h1>Website Settings</h1>
          <p>
            Manage public content, section visibility, labels and appearance
            without changing source code.
          </p>
        </div>
        <button className="btn" onClick={save}>
          Save Changes
        </button>
      </div>
      <ErrorBox error={error} />
      <Tabs defaultValue="general" className="settings-tabs">
        <TabsList className="settings-tabs-list">
          {[
            ["general", "General"],
            ["header", "Header"],
            ["home", "Homepage"],
            ["buttons", "Buttons"],
            ["footer", "Footer"],
            ["mcq", "MCQ Exam"],
            ["blog", "Blog"],
            ["reviews", "Reviews"],
            ["notice", "Notice"],
            ["team", "Team"],
            ["notes", "Notes"],
            ["appearance", "Appearance"],
          ].map(([v, l]) => (
            <TabsTrigger value={v} key={v}>
              {l}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="general">
          <section className="card settings-panel">
            <h2>General Website</h2>
            <div className="grid two">
              {textFields(s, set, [
                ["websiteName", "Website Name"],
                ["shortDescription", "Website Short Description"],
                ["email", "Email Address"],
                ["contactInfo", "Organization / Contact Information"],
                ["bkashPayment", "bKash Number"],
                ["nagadPayment", "Nagad Number"],
                ["rocketPayment", "Rocket Number"],
                ["whatsapp", "WhatsApp Number"],
                ["facebookGroup", "Facebook Group URL"],
                ["facebookPage", "Facebook Page URL"],
                ["telegram", "Telegram Group URL"],
                ["whatsappGroup", "WhatsApp Group URL"],
                ["supportHours", "Support Hours"],
                ["orderSupport", "Order Support Text"],
                ["examAccessSupport", "Exam Access Support Text"],
                ["responseTime", "Response Time Text"],
              ])}
            </div>
            <Field label="Website Logo">
              <ImageSetting
                kind="settingsLogo"
                value={s.websiteLogo}
                onChange={(v: any) => set("websiteLogo", v)}
              />
            </Field>
            <Field label="Favicon">
              <ImageSetting
                kind="settingsFavicon"
                value={s.favicon}
                onChange={(v: any) => set("favicon", v)}
              />
            </Field>
            <Field label="About The Academy">
              <textarea
                rows={5}
                value={s.about}
                onChange={(e) => set("about", e.target.value)}
              />
            </Field>
            <h3>Delivery Charges</h3>
            <div className="grid three">
              {textFields(s, set, [
                ["sundarban", "Sundarban Courier (BDT)"],
                ["dhaka", "Dhaka Home Delivery (BDT)"],
                ["outside", "Outside Dhaka Delivery (BDT)"],
              ])}
            </div>
          </section>
        </TabsContent>
        <TabsContent value="header">
          <section className="card settings-panel">
            <h2>Header</h2>
            <div className="grid two">
              {textFields(s, set, [
                ["brandText", "Brand Text"],
                ["headerContactLabel", "Contact Label"],
                ["homeMenuLabel", "Home Menu Label"],
                ["packagesMenuLabel", "Package Menu Label"],
                ["coursesMenuLabel", "Courses Menu Label"],
                ["booksMenuLabel", "Books Menu Label"],
                ["aboutMenuLabel", "About Menu Label"],
                ["notesMenuLabel", "Notes Menu Label"],
              ])}
            </div>
            <Tog
              label="Show Brand Text Beside Logo"
              value={s.showBrandText}
              onChange={(v: boolean) => set("showBrandText", v)}
            />
            <Tog
              label="Show Cart"
              value={s.showCart}
              onChange={(v: boolean) => set("showCart", v)}
            />
          </section>
        </TabsContent>
        <TabsContent value="home">
          <section className="card settings-panel">
            <h2>Homepage</h2>
            <div className="grid two">
              {textFields(s, set, [
                ["heroEyebrow", "Hero Label"],
                ["heroTitle", "Hero Title"],
                ["heroAccent", "Hero Accent Title"],
                ["heroDescription", "Hero Description"],
                ["packageTitle", "Package Section Title"],
                ["packageSubtitle", "Package Section Subtitle"],
                ["courseTitle", "Course Section Title"],
                ["courseSubtitle", "Course Section Subtitle"],
                ["booksTitle", "Books Section Title"],
                ["booksSubtitle", "Books Section Subtitle"],
              ])}
            </div>
        <Field label="Hero Image">
          <ImageSetting
            kind="settingsHero"
            value={s.heroImage}
            onChange={(v: any) => set("heroImage", v)}
          />
        </Field>
        <h3>Statistics</h3>
        <div className="grid two">
          {textFields(s, set, [
            ["statisticsTitle", "Statistics Section Title"],
            ["statisticsSubtitle", "Statistics Section Subtitle"],
          ])}
        </div>
        <div className="grid two">
              {[1, 2, 3, 4].map((n) => (
                <div className="stat-setting" key={n}>
                  {textFields(s, set, [
                    [`stat${n}Label`, `Statistic ${n} Label`],
                    [`stat${n}Value`, `Statistic ${n} Value`],
                  ])}
                  <Tog
                    label="Show Statistic"
                    value={s[`stat${n}Visible`]}
                    onChange={(v: boolean) => set(`stat${n}Visible`, v)}
                  />
                </div>
              ))}
            </div>
            <h3>Section Visibility</h3>
            <div className="settings-toggle-grid">
              {[
                ["noticeVisible", "Notice"],
                ["statisticsVisible", "Statistics"],
                ["packageVisible", "Exam Packages"],
                ["courseVisible", "Courses"],
                ["booksVisible", "Books"],
                ["blogVisible", "Blog"],
                ["reviewsVisible", "Verified Reviews"],
                ["teamVisible", "Our Team"],
              ].map(([k, l]) => (
                <Tog
                  key={k}
                  label={l}
                  value={s[k]}
                  onChange={(v: boolean) => set(k, v)}
                />
              ))}
            </div>
            <h3>Homepage Section Order</h3>
            <div className="section-order">
              {order.map((key: string, i: number) => (
                <div key={key}>
                  <span>
                    {i + 1}. {key[0].toUpperCase() + key.slice(1)}
                  </span>
                  <div>
                    <button
                      className="icon-btn"
                      disabled={!i}
                      onClick={() => {
                        const n = [...order];
                        [n[i - 1], n[i]] = [n[i], n[i - 1]];
                        set("homeSectionOrder", n);
                      }}
                    >
                      <ArrowUp size={15} />
                    </button>
                    <button
                      className="icon-btn"
                      disabled={i === order.length - 1}
                      onClick={() => {
                        const n = [...order];
                        [n[i + 1], n[i]] = [n[i], n[i + 1]];
                        set("homeSectionOrder", n);
                      }}
                    >
                      <ArrowDown size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </TabsContent>
        <TabsContent value="buttons">
          <section className="card settings-panel">
            <h2>Content Buttons</h2>
            <div className="grid two">
              {textFields(s, set, [
                ["heroPrimaryText", "Hero Primary Button Text"],
                ["heroPrimaryUrl", "Hero Primary Button Destination"],
                ["heroSecondaryText", "Hero Secondary Button Text"],
                ["heroSecondaryUrl", "Hero Secondary Button Destination"],
                ["enrollText", "Course Enrollment Button"],
                ["detailsText", "Details Button"],
                ["viewAllText", "View All Button"],
                ["blogReadMoreText", "Blog Read More Button"],
                ["booksViewText", "View Book Button"],
                ["booksBuyText", "Buy Now Button"],
              ])}
            </div>
            <Tog
              label="Show Hero Primary Button"
              value={s.heroPrimaryVisible}
              onChange={(v: boolean) => set("heroPrimaryVisible", v)}
            />
            <Tog
              label="Show Hero Secondary Button"
              value={s.heroSecondaryVisible}
              onChange={(v: boolean) => set("heroSecondaryVisible", v)}
            />
          </section>
        </TabsContent>
        <TabsContent value="footer">
          <section className="card settings-panel">
            <h2>Footer</h2>
            {textFields(s, set, [
              ["footerDescription", "Footer Description"],
              ["footerExploreTitle", "Footer Navigation Heading"],
              ["footerContactTitle", "Footer Contact Heading"],
              ["copyrightText", "Copyright Text"],
            ])}
            <Field label="Footer Logo (Optional Override)">
              <ImageSetting
                kind="settingsLogo"
                value={s.footerLogo}
                onChange={(v: any) => set("footerLogo", v)}
              />
            </Field>
          </section>
        </TabsContent>
        <TabsContent value="mcq">
          <section className="card settings-panel">
            <h2>MCQ Exam</h2>
            <Field label="Default Exam Instructions">
              <textarea
                rows={5}
                value={s.defaultExamInstructions}
                onChange={(e) => set("defaultExamInstructions", e.target.value)}
              />
            </Field>
            {textFields(s, set, [
              ["submitExamText", "Submit Button Label"],
              ["resultPendingText", "Result Pending Message"],
            ])}
          </section>
        </TabsContent>
        <TabsContent value="blog">
          <section className="card settings-panel">
            <h2>Blog Presentation</h2>
            {textFields(s, set, [
              ["blogTitle", "Blog Section Title"],
              ["blogSubtitle", "Blog Section Subtitle"],
              ["blogReadMoreText", "Read More Label"],
            ])}
            <Field
              label="Blogs On Homepage"
              type="number"
              min="1"
              max="12"
              value={s.blogHomeCount}
              onChange={(e: any) => set("blogHomeCount", e.target.value)}
            />
            <Tog
              label="Show Blog Section"
              value={s.blogVisible}
              onChange={(v: boolean) => set("blogVisible", v)}
            />
          </section>
        </TabsContent>
        <TabsContent value="reviews">
          <section className="card settings-panel">
            <h2>Verified Reviews Presentation</h2>
            {textFields(s, set, [
              ["reviewsTitle", "Section Title"],
              ["reviewsSubtitle", "Section Subtitle"],
            ])}
            <Field
              label="Reviews On Homepage"
              type="number"
              min="1"
              max="12"
              value={s.reviewsHomeCount}
              onChange={(e: any) => set("reviewsHomeCount", e.target.value)}
            />
            <Tog
              label="Show Verified Reviews"
              value={s.reviewsVisible}
              onChange={(v: boolean) => set("reviewsVisible", v)}
            />
          </section>
        </TabsContent>
        <TabsContent value="notice">
          <section className="card settings-panel">
            <h2>Notice Presentation</h2>
            {textFields(s, set, [
              ["noticeTitle", "Notice Section Title"],
              ["noticeSubtitle", "Notice Section Subtitle"],
            ])}
            <Field
              label="Maximum Immediately Visible Notices"
              type="number"
              min="1"
              max="4"
              value={s.noticeMaxVisible}
              onChange={(e: any) => set("noticeMaxVisible", e.target.value)}
            />
            <Tog
              label="Show Notice Section"
              value={s.noticeVisible}
              onChange={(v: boolean) => set("noticeVisible", v)}
            />
          </section>
        </TabsContent>
        <TabsContent value="team">
          <section className="card settings-panel">
            <h2>Our Team Presentation</h2>
            {textFields(s, set, [
              ["teamTitle", "Section Title"],
              ["teamSubtitle", "Section Subtitle"],
            ])}
            <Tog
              label="Show Our Team"
              value={s.teamVisible}
              onChange={(v: boolean) => set("teamVisible", v)}
            />
          </section>
        </TabsContent>
        <TabsContent value="notes">
          <section className="card settings-panel">
            <h2>Notes Presentation</h2>
            <div className="grid two">
              {textFields(s, set, [
                ["notesMenuLabel", "Notes Menu Label"],
                ["bjsNotesLabel", "BJS Notes Display Label"],
                ["barNotesLabel", "BAR Notes Display Label"],
                ["generalNotesLabel", "General Subject Notes Display Label"],
                ["academicNotesLabel", "Academic Notes Display Label"],
              ])}
            </div>
            <Tog
              label="Show Notes In Navigation"
              value={s.notesVisible}
              onChange={(v: boolean) => set("notesVisible", v)}
            />
          </section>
        </TabsContent>
        <TabsContent value="appearance">
          <section className="card settings-panel">
            <h2>Appearance</h2>
            <p>
              Current LexVeritas Academy values remain the defaults until you
              save changes.
            </p>
            <div className="grid two">
              {[
                ["primaryColor", "Primary Brand Color"],
                ["secondaryColor", "Secondary Brand Color"],
                ["backgroundColor", "Background Color"],
                ["textColor", "Text Color"],
              ].map(([k, l]) => (
                <Field
                  key={k}
                  label={l}
                  type="color"
                  value={s[k]}
                  onChange={(e: any) => set(k, e.target.value)}
                />
              ))}
            </div>
            <div className="grid three">
              <Field label="Button Style">
                <Choice
                  label="Button style"
                  value={s.buttonStyle}
                  onChange={(v: string) => set("buttonStyle", v)}
                  options={[
                    { value: "rounded", label: "Rounded" },
                    { value: "square", label: "Square" },
                    { value: "pill", label: "Pill" },
                  ]}
                />
              </Field>
              <Field
                label="Border Radius (px)"
                type="number"
                min="0"
                max="40"
                value={s.borderRadius}
                onChange={(e: any) => set("borderRadius", e.target.value)}
              />
              <Field
                label="Section Spacing (px)"
                type="number"
                min="32"
                max="120"
                value={s.sectionSpacing}
                onChange={(e: any) => set("sectionSpacing", e.target.value)}
              />
            </div>
          </section>
        </TabsContent>
      </Tabs>
      <div className="settings-save-bar">
        <button className="btn" onClick={save}>
          Save Changes
        </button>
      </div>
    </>
  );
}
