"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  FileUp,
  Eye,
  Heading2,
  Heading3,
  IndentDecrease,
  IndentIncrease,
  Italic,
  Link2,
  List as ListIcon,
  ListOrdered,
  Minus,
  Pencil,
  Pilcrow,
  Plus,
  Quote,
  Redo2,
  RemoveFormatting,
  Strikethrough,
  Trash2,
  Underline,
  Undo2,
  Unlink2,
  User,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import { MediaUpload } from "./media-upload";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Confirm,
  EmptyState,
  ErrorBox,
  Field,
  Loading,
  api,
  date,
  useData,
} from "@/lib/client";

const EXCERPT_WORD_LIMIT = 50;
const wordCount = (value = "") =>
  value.trim() ? value.trim().split(/\s+/u).length : 0;
const asset = (value?: string | null) =>
  !value ? "" : value.startsWith("/") ? value : `/api/files/${value}`;
const profileKey = (author: any) =>
  author?.id ? `id:${author.id}` : author?.slug ? `legacy:${author.slug}` : "";

const blank = {
  title: "",
  slug: "",
  thumbnail: null,
  excerpt: "",
  category: "",
  subcategory: "",
  tags: "",
  seo_title: "",
  meta_description: "",
  author_id: null,
  author_name: "",
  author_photo: null,
  author_description: "",
  content: "<p><br></p>",
  publish_date: new Date(Date.now() + 21600000).toISOString().slice(0, 16),
  published: false,
};

function ImageUpload({ kind, value, onChange }: any) {
  return (
    <MediaUpload
      kind={kind}
      value={value}
      onChange={onChange}
      successMessage="Image uploaded"
    />
  );
}

export function BlogManager() {
  const { data, error, reload } = useData("admin/blogs"),
    { data: authors, reload: reloadAuthors } = useData("admin/authors"),
    { data: taxonomy, reload: reloadTaxonomy } = useData("admin/blog-taxonomy"),
    [editing, setEditing] = useState<any>(null),
    [deleting, setDeleting] = useState<any>(null);
  return (
    <>
      <div className="section-head admin-page-heading">
        <div>
          <div className="eyebrow">CONTENT MANAGEMENT</div>
          <h1>Blog</h1>
          <p>
            Create a polished Blog manually or import formatted text from DOCX.
          </p>
        </div>
        <button className="btn" onClick={() => setEditing({ ...blank })}>
          <Plus size={16} /> Add Blog
        </button>
      </div>
      <ErrorBox error={error} />
      {!data && !error ? (
        <Loading />
      ) : data?.length ? (
        <div className="table-card">
          <table>
            <thead>
              <tr>
                <th>Blog</th>
                <th>Author</th>
                <th>Publish Date</th>
                <th>Status</th>
                <th>Manage</th>
              </tr>
            </thead>
            <tbody>
              {data.map((blog: any) => (
                <tr key={blog.id}>
                  <td>
                    <strong>{blog.title}</strong>
                    <small className="block muted">/{blog.slug}</small>
                  </td>
                  <td>{blog.author_name}</td>
                  <td>{date(blog.publish_date)}</td>
                  <td>
                    <span className="badge">
                      {blog.published ? "Published" : "Draft"}
                    </span>
                  </td>
                  <td>
                    <div className="table-actions">
                      <button
                        className="icon-btn"
                        aria-label={`Edit ${blog.title}`}
                        onClick={() =>
                          setEditing({
                            ...blog,
                            publish_date: new Date(blog.publish_date + 21600000)
                              .toISOString()
                              .slice(0, 16),
                            published: !!blog.published,
                          })
                        }
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        className="icon-btn danger"
                        aria-label={`Delete ${blog.title}`}
                        onClick={() => setDeleting(blog)}
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
        <EmptyState title="No Blogs Yet">
          Add a Blog manually or import a DOCX document.
        </EmptyState>
      )}
      <BlogEditor
        value={editing}
        authors={authors || []}
        taxonomy={taxonomy || { categories: [], subcategories: [] }}
        close={() => setEditing(null)}
        saved={() => {
          setEditing(null);
          reload();
          reloadAuthors();
          reloadTaxonomy();
        }}
      />
      <Confirm
        open={!!deleting}
        onOpenChange={(open: boolean) => !open && setDeleting(null)}
        title="Are You Sure You Want To Delete This Blog?"
        description="Only this Blog will be deleted. Other website content and uploaded assets remain unchanged."
        action="Delete Blog"
        onConfirm={async () => {
          await api(`admin/blogs/${deleting.id}`, undefined, "DELETE");
          setDeleting(null);
          reload();
          toast.success("Blog deleted");
        }}
      />
    </>
  );
}

function ToolbarButton({ label, children, action }: any) {
  return (
    <button
      type="button"
      className="rich-tool-button"
      title={label}
      aria-label={label}
      onMouseDown={(event) => event.preventDefault()}
      onClick={action}
    >
      {children}
    </button>
  );
}

function BlogEditor({ value, authors, taxonomy, close, saved }: any) {
  const [form, setForm] = useState<any>(value),
    [error, setError] = useState(""),
    [importing, setImporting] = useState(false),
    [previewing, setPreviewing] = useState(false),
    [selectedProfileKey, setSelectedProfileKey] = useState(""),
    editor = useRef<HTMLDivElement>(null),
    savedSelection = useRef<Range | null>(null);

  useEffect(() => {
    setForm(value);
    const matchingAuthor = authors.find(
      (author: any) =>
        (value?.author_id && author.id === value.author_id) ||
        (!value?.author_id && author.name === value?.author_name),
    );
    setSelectedProfileKey(matchingAuthor ? profileKey(matchingAuthor) : "");
  }, [value, authors]);

  const selectedAuthor = useMemo(
    () =>
      authors.find(
        (author: any) => profileKey(author) === selectedProfileKey,
      ) || null,
    [authors, selectedProfileKey],
  );

  if (!form) return null;
  const set = (key: string, next: any) =>
    setForm((current: any) => ({ ...current, [key]: next }));
  const rememberSelection = () => {
    const selection = window.getSelection();
    if (
      !selection?.rangeCount ||
      !editor.current?.contains(selection.anchorNode)
    )
      return;
    savedSelection.current = selection.getRangeAt(0).cloneRange();
  };
  const restoreSelection = () => {
    if (!editor.current) return;
    editor.current.focus({ preventScroll: true });
    const selection = window.getSelection();
    if (!selection) return;
    selection.removeAllRanges();
    const stored = savedSelection.current;
    if (stored && editor.current.contains(stored.commonAncestorContainer)) {
      selection.addRange(stored);
      return;
    }
    const range = document.createRange();
    range.selectNodeContents(editor.current);
    range.collapse(false);
    selection.addRange(range);
  };
  const syncEditor = () => {
    if (editor.current) set("content", editor.current.innerHTML);
  };
  const command = (name: string, commandValue?: string) => {
    if (!editor.current) return;
    restoreSelection();
    document.execCommand(name, false, commandValue);
    rememberSelection();
  };
  const createLink = () => {
    const entered = window.prompt(
      "Enter an HTTPS link, email address or website path:",
    );
    if (!entered) return;
    const href = /^(https?:\/\/|mailto:|\/)/i.test(entered)
      ? entered
      : `https://${entered}`;
    command("createLink", href);
  };
  const excerptWords = wordCount(form.excerpt);

  return (
    <Dialog open={!!value} onOpenChange={(open) => !open && close()}>
      <DialogContent className="wide-dialog blog-dialog">
        <DialogHeader>
          <DialogTitle>{form.id ? "Edit Blog" : "Add Blog"}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            setError("");
            try {
              if (excerptWords > EXCERPT_WORD_LIMIT)
                throw Error(
                  `Short Excerpt must be ${EXCERPT_WORD_LIMIT} words or fewer.`,
                );
              const content = editor.current?.innerHTML || form.content;
              await api(
                `admin/blogs${form.id ? `/${form.id}` : ""}`,
                {
                  ...form,
                  content,
                  publish_date: new Date(
                    `${form.publish_date}:00+06:00`,
                  ).getTime(),
                },
                form.id ? "PATCH" : "POST",
              );
              toast.success("Blog saved");
              saved();
            } catch (submitError: any) {
              setError(submitError.message);
            }
          }}
        >
          <div className="grid two">
            <Field
              label="Blog Title"
              required
              value={form.title}
              onChange={(event: any) => set("title", event.target.value)}
            />
            <Field
              label="Slug / URL (Optional)"
              value={form.slug}
              onChange={(event: any) => set("slug", event.target.value)}
            />
          </div>
          <div className="grid two">
            <Field label="Blog Thumbnail">
              <ImageUpload
                kind="blog"
                value={form.thumbnail}
                onChange={(next: any) => set("thumbnail", next)}
              />
            </Field>
            <Field
              label="Publish Date & Time"
              type="datetime-local"
              required
              value={form.publish_date}
              onChange={(event: any) => set("publish_date", event.target.value)}
            />
          </div>
          <Field label={`Short Excerpt (Maximum ${EXCERPT_WORD_LIMIT} Words)`}>
            <textarea
              rows={3}
              maxLength={1000}
              value={form.excerpt}
              aria-invalid={excerptWords > EXCERPT_WORD_LIMIT}
              aria-describedby="excerpt-word-count"
              onChange={(event) => set("excerpt", event.target.value)}
            />
            <small
              id="excerpt-word-count"
              className={`word-counter ${excerptWords > EXCERPT_WORD_LIMIT ? "over-limit" : ""}`}
            >
              {excerptWords} / {EXCERPT_WORD_LIMIT} words
            </small>
          </Field>

          <div className="taxonomy-admin-grid">
            <Field label="Select Existing Category">
              <select
                className="choice"
                value={
                  taxonomy.categories.includes(form.category)
                    ? form.category
                    : ""
                }
                onChange={(event) => set("category", event.target.value)}
              >
                <option value="">Select a category</option>
                {taxonomy.categories.map((category: string) => (
                  <option value={category} key={category}>
                    {category}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Or Create New Category">
              <input
                value={
                  taxonomy.categories.includes(form.category)
                    ? ""
                    : form.category || ""
                }
                placeholder="Enter a new category"
                onChange={(event) => set("category", event.target.value)}
              />
            </Field>
            <Field label="Select Existing Subcategory">
              <select
                className="choice"
                value={
                  taxonomy.subcategories.includes(form.subcategory)
                    ? form.subcategory
                    : ""
                }
                onChange={(event) => set("subcategory", event.target.value)}
              >
                <option value="">Select a subcategory</option>
                {taxonomy.subcategories.map((subcategory: string) => (
                  <option value={subcategory} key={subcategory}>
                    {subcategory}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Or Create New Subcategory">
              <input
                value={
                  taxonomy.subcategories.includes(form.subcategory)
                    ? ""
                    : form.subcategory || ""
                }
                placeholder="Enter a new subcategory"
                onChange={(event) => set("subcategory", event.target.value)}
              />
            </Field>
          </div>
          <Field label="Tags (Comma Separated)">
            <input
              value={form.tags || ""}
              placeholder="Constitution, BJS, Fundamental Rights"
              onChange={(event) => set("tags", event.target.value)}
            />
          </Field>
          <div className="notice seo-central-notice">
            <div>
              <strong>SEO is managed centrally</strong>
              <p>After saving this blog, use Page SEO for its title, description, canonical URL, social preview and schema.</p>
            </div>
            <a className="btn outline" href="/admin/seo/pages">Open Page SEO</a>
          </div>

          <div className="author-box">
            <div className="author-box-heading">
              <div>
                <span className="eyebrow">AUTHOR LIBRARY</span>
                <h3>Author Information</h3>
              </div>
              <button
                type="button"
                className="btn outline compact-btn"
                onClick={() => {
                  setSelectedProfileKey("");
                  setForm((current: any) => ({
                    ...current,
                    author_id: null,
                    author_name: "",
                    author_photo: null,
                    author_description: "",
                  }));
                }}
              >
                <UserPlus size={16} /> New Author
              </button>
            </div>
            <Field label="Choose An Existing Author">
              <select
                className="author-native-select"
                value={selectedProfileKey}
                onChange={(event) => {
                  const nextKey = event.target.value;
                  const author = authors.find(
                    (item: any) => profileKey(item) === nextKey,
                  );
                  if (!author) {
                    setSelectedProfileKey("");
                    set("author_id", null);
                    return;
                  }
                  setSelectedProfileKey(profileKey(author));
                  setForm((current: any) => ({
                    ...current,
                    author_id: author.id || null,
                    author_name: author.name,
                    author_photo: author.photo || null,
                    author_description: author.description || "",
                  }));
                }}
              >
                <option value="">Create a new author</option>
                {authors.map((author: any) => (
                  <option key={profileKey(author)} value={profileKey(author)}>
                    {author.name}
                  </option>
                ))}
              </select>
            </Field>
            {selectedAuthor ? (
              <div className="selected-author-card">
                {selectedAuthor.photo ? (
                  <img
                    src={asset(selectedAuthor.photo)}
                    alt={`${selectedAuthor.name} profile`}
                  />
                ) : (
                  <span className="selected-author-fallback">
                    <User size={24} />
                  </span>
                )}
                <div>
                  <strong>{selectedAuthor.name}</strong>
                  <p>
                    {selectedAuthor.description ||
                      "No author description added."}
                  </p>
                  <small>This saved profile will be linked to the Blog.</small>
                </div>
              </div>
            ) : (
              <div className="new-author-fields">
                <p className="field-help">
                  Add the author once. This profile becomes searchable for
                  future Blogs.
                </p>
                <div className="grid two">
                  <Field
                    label="Author Name"
                    required
                    value={form.author_name}
                    onChange={(event: any) =>
                      set("author_name", event.target.value)
                    }
                  />
                  <Field label="Author Photo">
                    <ImageUpload
                      kind="author"
                      value={form.author_photo}
                      onChange={(next: any) => set("author_photo", next)}
                    />
                  </Field>
                </div>
                <Field label="Author Description">
                  <textarea
                    rows={3}
                    value={form.author_description}
                    onChange={(event) =>
                      set("author_description", event.target.value)
                    }
                  />
                </Field>
              </div>
            )}
          </div>

          <Field label="Import Microsoft Word DOCX">
            <div className="docx-upload">
              <FileUp size={20} />
              <input
                type="file"
                accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                disabled={importing}
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  setImporting(true);
                  try {
                    if (file.size > 25_000_000)
                      throw Error("DOCX file must be 25 MB or smaller.");
                    const mammoth = await import("mammoth");
                    const result = await mammoth.convertToHtml({
                      arrayBuffer: await file.arrayBuffer(),
                    });
                    const html = result.value || "<p><br></p>";
                    set("content", html);
                    window.setTimeout(() => {
                      if (editor.current) editor.current.innerHTML = html;
                    }, 0);
                    toast.success(
                      "DOCX converted. Review the editable Blog content before publishing.",
                    );
                    if (result.messages.length)
                      toast.info(
                        "Some unsupported Word styling was simplified.",
                      );
                  } catch (importError: any) {
                    toast.error("DOCX import failed: " + importError.message);
                  } finally {
                    setImporting(false);
                  }
                }}
              />
              <span>
                {importing
                  ? "Converting DOCX…"
                  : "Choose a .docx file to convert headings, paragraphs, emphasis, links, lists and tables."}
              </span>
            </div>
          </Field>

          <div className="field rich-editor-field">
            <span id="blog-editor-label">Editable Blog Content</span>
            <div
              className="rich-toolbar"
              role="toolbar"
              aria-label="Blog formatting tools"
            >
              <div className="rich-tool-group" aria-label="Text styles">
                <ToolbarButton
                  label="Paragraph"
                  action={() => command("formatBlock", "p")}
                >
                  <Pilcrow size={17} />
                </ToolbarButton>
                <ToolbarButton
                  label="Heading"
                  action={() => command("formatBlock", "h2")}
                >
                  <Heading2 size={17} />
                </ToolbarButton>
                <ToolbarButton
                  label="Subheading"
                  action={() => command("formatBlock", "h3")}
                >
                  <Heading3 size={17} />
                </ToolbarButton>
                <ToolbarButton label="Bold" action={() => command("bold")}>
                  <Bold size={17} />
                </ToolbarButton>
                <ToolbarButton label="Italic" action={() => command("italic")}>
                  <Italic size={17} />
                </ToolbarButton>
                <ToolbarButton
                  label="Underline"
                  action={() => command("underline")}
                >
                  <Underline size={17} />
                </ToolbarButton>
                <ToolbarButton
                  label="Strikethrough"
                  action={() => command("strikeThrough")}
                >
                  <Strikethrough size={17} />
                </ToolbarButton>
              </div>
              <div className="rich-tool-group" aria-label="Lists and quotation">
                <ToolbarButton
                  label="Bulleted List"
                  action={() => command("insertUnorderedList")}
                >
                  <ListIcon size={17} />
                </ToolbarButton>
                <ToolbarButton
                  label="Numbered List"
                  action={() => command("insertOrderedList")}
                >
                  <ListOrdered size={17} />
                </ToolbarButton>
                <ToolbarButton
                  label="Block Quote"
                  action={() => command("formatBlock", "blockquote")}
                >
                  <Quote size={17} />
                </ToolbarButton>
                <ToolbarButton
                  label="Decrease Indent"
                  action={() => command("outdent")}
                >
                  <IndentDecrease size={17} />
                </ToolbarButton>
                <ToolbarButton
                  label="Increase Indent"
                  action={() => command("indent")}
                >
                  <IndentIncrease size={17} />
                </ToolbarButton>
              </div>
              <div className="rich-tool-group" aria-label="Alignment">
                <ToolbarButton
                  label="Align Left"
                  action={() => command("justifyLeft")}
                >
                  <AlignLeft size={17} />
                </ToolbarButton>
                <ToolbarButton
                  label="Align Center"
                  action={() => command("justifyCenter")}
                >
                  <AlignCenter size={17} />
                </ToolbarButton>
                <ToolbarButton
                  label="Align Right"
                  action={() => command("justifyRight")}
                >
                  <AlignRight size={17} />
                </ToolbarButton>
                <ToolbarButton
                  label="Justify"
                  action={() => command("justifyFull")}
                >
                  <AlignJustify size={17} />
                </ToolbarButton>
              </div>
              <div className="rich-tool-group" aria-label="Insert and history">
                <ToolbarButton label="Add Link" action={createLink}>
                  <Link2 size={17} />
                </ToolbarButton>
                <ToolbarButton
                  label="Remove Link"
                  action={() => command("unlink")}
                >
                  <Unlink2 size={17} />
                </ToolbarButton>
                <ToolbarButton
                  label="Horizontal Rule"
                  action={() => command("insertHorizontalRule")}
                >
                  <Minus size={17} />
                </ToolbarButton>
                <ToolbarButton label="Undo" action={() => command("undo")}>
                  <Undo2 size={17} />
                </ToolbarButton>
                <ToolbarButton label="Redo" action={() => command("redo")}>
                  <Redo2 size={17} />
                </ToolbarButton>
                <ToolbarButton
                  label="Clear Formatting"
                  action={() => command("removeFormat")}
                >
                  <RemoveFormatting size={17} />
                </ToolbarButton>
              </div>
            </div>
            <div
              key={form.id || "new"}
              ref={editor}
              className="rich-editor"
              contentEditable
              role="textbox"
              aria-labelledby="blog-editor-label"
              aria-multiline="true"
              spellCheck
              suppressContentEditableWarning
              dangerouslySetInnerHTML={{ __html: form.content }}
              onInput={rememberSelection}
              onKeyUp={rememberSelection}
              onMouseUp={rememberSelection}
              onFocus={rememberSelection}
              onBlur={syncEditor}
            />
          </div>
          <label className="toggle-line">
            <span>Published</span>
            <input
              type="checkbox"
              checked={!!form.published}
              onChange={(event) => set("published", event.target.checked)}
            />
          </label>
          <ErrorBox error={error} />
          <div className="actions blog-editor-actions">
            <button className="btn" type="submit">
              Save Blog
            </button>
            <button
              className="btn outline"
              type="button"
              onClick={() => {
                syncEditor();
                setPreviewing(true);
              }}
            >
              <Eye size={17} /> Preview Before Publishing
            </button>
          </div>
        </form>
        <Dialog open={previewing} onOpenChange={setPreviewing}>
          <DialogContent className="wide-dialog blog-preview-dialog">
            <DialogHeader>
              <DialogTitle>Article Preview</DialogTitle>
            </DialogHeader>
            <article className="admin-article-preview">
              <div className="blog-breadcrumb">
                <span>Blog</span>
                <span>·</span>
                <span>{form.category || "Category"}</span>
                <span>·</span>
                <span>{form.subcategory || "Subcategory"}</span>
              </div>
              <h1>{form.title || "Untitled Blog"}</h1>
              <p className="blog-detail-deck">{form.excerpt}</p>
              {form.thumbnail && (
                <img
                  className="blog-hero"
                  src={asset(form.thumbnail)}
                  alt="Featured preview"
                />
              )}
              <div
                className="blog-content"
                dangerouslySetInnerHTML={{ __html: form.content }}
              />
            </article>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}
