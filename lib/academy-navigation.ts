export const academyNavigation = [
  { id: "home", label: "Home", url: "/", emphasis: true },
  { id: "notices", label: "Notices", url: "/notices" },
  { id: "notes", label: "Free Notes And Resources", url: "/notes" },
  { id: "courses", label: "Courses", url: "/courses", emphasis: true, divider: true },
  { id: "complete-packages", parentId: "courses", label: "Complete Packages", url: "/courses" },
  { id: "bar-premium", parentId: "complete-packages", label: "BAR Premium Course", url: "/courses?category=bar" },
  { id: "bjs-premium", parentId: "complete-packages", label: "BJS Premium Course", url: "/courses?category=bjs" },
  { id: "law-premium", parentId: "complete-packages", label: "Law Officer Premium Course", url: "/courses?category=law-officer" },
  { id: "exam-batches", parentId: "courses", label: "Exam Batches", url: "/packages" },
  { id: "bar-batch", parentId: "exam-batches", label: "BAR Exam Batch", url: "/packages?category=bar" },
  { id: "bjs-batch", parentId: "exam-batches", label: "BJS Exam Batch", url: "/packages?category=bjs" },
  { id: "law-batch", parentId: "exam-batches", label: "Law Officer Exam Batch", url: "/packages?category=law-officer" },
  { id: "mcq-exams", label: "MCQ Exams", url: "/exams" },
  { id: "books", label: "Buy Books", url: "/books", emphasis: true, divider: true },
  { id: "hardcopy", parentId: "books", label: "Hardcopy", url: "/books?type=hardcopy" },
  { id: "softcopy", parentId: "books", label: "Softcopy", url: "/books?type=softcopy" },
  { id: "track-order", parentId: "books", label: "Track Your Order", url: "/track-order" },
  { id: "blog", label: "Blog", url: "/blog", emphasis: true, divider: true },
  { id: "write-blog", label: "Write A Blog", url: "/write-a-blog" },
  { id: "about", label: "About", url: "/about", emphasis: true, divider: true },
  { id: "contact", label: "Contact Us", url: "/contact", emphasis: true },
].map(item => ({ ...item, visible: true, style: "link" }));

// Upgrade the previously stored menu without losing admin edits made after this structure exists.
export function currentAcademyNavigation(items: any[] = []) {
  const removed = new Set(["bank-law-premium", "other-law-premium", "bank-law-batch", "other-law-batch"]);
  if (items.some(item => item.id === "bar-premium")) return items.filter(item => !removed.has(item.id));
  return academyNavigation.map(item => ({ ...item, visible: items.find(old => old.id === item.id)?.visible !== false }));
}

export const matchesPreparationCategory = (item: any, category: string) => {
  if (!category) return true;
  const text = [item.name, item.title, item.category, item.subject, item.description].filter(Boolean).join(" ").toLowerCase();
  if (category === "bar") return /\bbar\b|bar council|বার কাউন্সিল/i.test(text);
  if (category === "bjs") return /\bbjs\b|judicial|বিজেএস|বিচার বিভাগ/i.test(text);
  if (category === "bank-law-officer") return /bank|ব্যাংক/i.test(text) && /law|legal|আইন/i.test(text);
  if (category === "other-law-officer") return /law officer|legal officer|ল অফিসার/i.test(text) && !/bank|ব্যাংক/i.test(text);
  if (category === "law-officer") return /law officer|legal officer|ল অফিসার/i.test(text);
  return true;
};
