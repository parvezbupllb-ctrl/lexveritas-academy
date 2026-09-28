import {
  sqliteTable,
  text,
  integer,
  uniqueIndex,
  index,
} from "drizzle-orm/sqlite-core";
const id = () => text("id").primaryKey();
export const admins = sqliteTable("admins", {
  id: id(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  mustChange: integer("must_change").notNull().default(1),
  active: integer("active").notNull().default(1),
  lastLoginAt: integer("last_login_at"),
  createdAt: integer("created_at").notNull(),
});
export const sessions = sqliteTable("sessions", {
  id: id(),
  adminId: text("admin_id")
    .notNull()
    .references(() => admins.id),
  expires: integer("expires").notNull(),
});
export const limits = sqliteTable("limits", {
  id: id(),
  count: integer("count").notNull(),
  expires: integer("expires").notNull(),
});
export const codes = sqliteTable("codes", {
  id: id(),
  code: text("code").notNull().unique(),
  active: integer("active").notNull().default(1),
  deviceHash: text("device_hash"),
  claimedAt: integer("claimed_at"),
  createdAt: integer("created_at").notNull(),
});
export const exams = sqliteTable(
  "exams",
  {
    id: id(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    syllabus: text("syllabus").notNull().default(""),
    start: integer("start").notNull(),
    end: integer("end").notNull(),
    duration: integer("duration").notNull(),
    correctMark: integer("correct_mark").notNull().default(100),
    negativeMark: integer("negative_mark").notNull().default(25),
    passMark: integer("pass_mark").notNull().default(0),
    questionTarget: integer("question_target").notNull().default(0),
    accessMode: text("access_mode").notNull().default("code"),
    attemptLimit: integer("attempt_limit").notNull().default(1),
    directToken: text("direct_token"),
    status: text("status").notNull().default("draft"),
    resultMode: text("result_mode").notNull().default("auto"),
    resultsPublished: integer("results_published").notNull().default(0),
    publishedAt: integer("published_at"),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [
    index("exam_status_time").on(t.status, t.end),
    uniqueIndex("exam_direct_token").on(t.directToken),
  ],
);
export const questions = sqliteTable(
  "questions",
  {
    id: id(),
    examId: text("exam_id")
      .notNull()
      .references(() => exams.id),
    question: text("question").notNull(),
    options: text("options").notNull(),
    correctOption: integer("correct_option").notNull(),
    explanation: text("explanation").notNull().default(""),
    image: text("image"),
    displayOrder: integer("display_order").notNull(),
  },
  (t) => [index("question_exam_order").on(t.examId, t.displayOrder)],
);
export const attempts = sqliteTable(
  "attempts",
  {
    id: id(),
    examId: text("exam_id")
      .notNull()
      .references(() => exams.id),
    codeId: text("code_id")
      .notNull()
      .references(() => codes.id),
    packageId: text("package_id"),
    tokenHash: text("token_hash").notNull(),
    studentName: text("student_name").notNull(),
    university: text("university").notNull(),
    startedAt: integer("started_at").notNull(),
    deadline: integer("deadline").notNull(),
    submittedAt: integer("submitted_at"),
    duration: integer("duration"),
    status: text("status").notNull().default("active"),
    correct: integer("correct").notNull().default(0),
    wrong: integer("wrong").notNull().default(0),
    unanswered: integer("unanswered").notNull().default(0),
    positive: integer("positive").notNull().default(0),
    negative: integer("negative").notNull().default(0),
    score: integer("score").notNull().default(0),
    percentage: integer("percentage").notNull().default(0),
  },
  (t) => [
    index("attempt_exam_code").on(t.examId, t.codeId),
    index("attempt_package_exam_code").on(t.packageId, t.examId, t.codeId),
    index("attempt_ranking").on(
      t.examId,
      t.status,
      t.score,
      t.wrong,
      t.duration,
      t.submittedAt,
    ),
    index("attempt_deadline").on(t.status, t.deadline),
  ],
);
export const answers = sqliteTable(
  "answers",
  {
    id: id(),
    attemptId: text("attempt_id")
      .notNull()
      .references(() => attempts.id),
    questionId: text("question_id")
      .notNull()
      .references(() => questions.id),
    selected: integer("selected"),
    flagged: integer("flagged").notNull().default(0),
  },
  (t) => [uniqueIndex("one_answer").on(t.attemptId, t.questionId)],
);
export const books = sqliteTable("books", {
  id: id(),
  title: text("title").notNull(),
  author: text("author").notNull().default(""),
  authors: text("authors").notNull().default("[]"),
  examCategory: text("exam_category").notNull().default("Academic"),
  subject: text("subject").notNull().default("General"),
  subjects: text("subjects").notNull().default("[]"),
  type: text("type").notNull(),
  bookTypes: text("book_types").notNull().default("[]"),
  price: integer("price").notNull(),
  oldPrice: integer("old_price"),
  description: text("description").notNull().default(""),
  cover: text("cover"),
  preview: text("preview"),
  digital: text("digital"),
  stockCount: integer("stock_count"),
  available: integer("available").notNull().default(1),
  published: integer("published").notNull().default(0),
  createdAt: integer("created_at").notNull(),
});
export const hardOrders = sqliteTable(
  "hard_orders",
  {
    id: id(),
    tokenHash: text("token_hash").notNull(),
    createdAt: integer("created_at").notNull(),
    name: text("name").notNull(),
    address: text("address").notNull(),
    phone: text("phone").notNull(),
    email: text("email"),
    paymentMethod: text("payment_method").notNull().default("bkash"),
    couponCode: text("coupon_code"),
    discountAmount: integer("discount_amount").notNull().default(0),
    trx: text("trx").notNull(),
    subtotal: integer("subtotal").notNull(),
    delivery: text("delivery").notNull(),
    deliveryCharge: integer("delivery_charge").notNull(),
    paymentType: text("payment_type").notNull(),
    paid: integer("paid").notNull(),
    due: integer("due").notNull(),
    total: integer("total").notNull(),
    verified: integer("verified").notNull().default(0),
    verifiedAt: integer("verified_at"),
    verifiedBy: text("verified_by"),
    delivered: integer("delivered").notNull().default(0),
    deliveredAt: integer("delivered_at"),
    received: integer("received").notNull().default(0),
    receivedAt: integer("received_at"),
  },
  (t) => [
    index("hard_trx").on(t.trx),
    index("hard_phone").on(t.phone),
    index("hard_created").on(t.createdAt),
  ],
);
export const hardItems = sqliteTable(
  "hard_items",
  {
    id: id(),
    orderId: text("order_id")
      .notNull()
      .references(() => hardOrders.id),
    bookId: text("book_id")
      .notNull()
      .references(() => books.id),
    title: text("title").notNull(),
    quantity: integer("quantity").notNull(),
    price: integer("price").notNull(),
  },
  (t) => [index("items_order").on(t.orderId)],
);
export const softOrders = sqliteTable(
  "soft_orders",
  {
    id: id(),
    tokenHash: text("token_hash").notNull(),
    createdAt: integer("created_at").notNull(),
    bookId: text("book_id")
      .notNull()
      .references(() => books.id),
    bookTitle: text("book_title").notNull(),
    price: integer("price").notNull(),
    name: text("name").notNull(),
    phone: text("phone").notNull(),
    email: text("email"),
    paymentMethod: text("payment_method").notNull().default("bkash"),
    couponCode: text("coupon_code"),
    discountAmount: integer("discount_amount").notNull().default(0),
    trx: text("trx").notNull(),
    verified: integer("verified").notNull().default(0),
    verifiedAt: integer("verified_at"),
    verifiedBy: text("verified_by"),
    downloadedAt: integer("downloaded_at"),
  },
  (t) => [
    index("soft_trx").on(t.trx),
    index("soft_phone").on(t.phone),
    index("soft_created").on(t.createdAt),
  ],
);
export const examPackages = sqliteTable("exam_packages", {
  id: id(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  thumbnail: text("thumbnail"),
  details: text("details").notNull().default(""),
  price: integer("price").notNull(),
  accessMode: text("access_mode").notNull().default("code"),
  oldPrice: integer("old_price"),
  detailedExplanations: integer("detailed_explanations").notNull().default(1),
  leaderboard: integer("leaderboard").notNull().default(1),
  status: text("status").notNull().default("active"),
  maxParticipants: integer("max_participants"),
  accessDays: integer("access_days").notNull().default(30),
  available: integer("available").notNull().default(1),
  published: integer("published").notNull().default(0),
  createdAt: integer("created_at").notNull(),
});
export const packageExams = sqliteTable(
  "package_exams",
  {
    id: id(),
    packageId: text("package_id")
      .notNull()
      .references(() => examPackages.id),
    examId: text("exam_id")
      .notNull()
      .references(() => exams.id),
    displayOrder: integer("display_order").notNull().default(0),
    supportPdf: text("support_pdf"),
  },
  (t) => [
    uniqueIndex("one_exam_per_package").on(t.packageId, t.examId),
    index("package_exam_order").on(t.packageId, t.displayOrder),
  ],
);
export const packageRoutines = sqliteTable(
  "package_routines",
  {
    id: id(),
    packageId: text("package_id")
      .notNull()
      .references(() => examPackages.id),
    examId: text("exam_id")
      .notNull()
      .references(() => exams.id),
    start: integer("start").notNull(),
    end: integer("end").notNull(),
    displayOrder: integer("display_order").notNull().default(0),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [
    index("package_routine_package_order").on(t.packageId, t.displayOrder),
    index("package_routine_exam_window").on(t.examId, t.start, t.end),
  ],
);
export const packageOrders = sqliteTable(
  "package_orders",
  {
    id: id(),
    tokenHash: text("token_hash").notNull(),
    createdAt: integer("created_at").notNull(),
    packageId: text("package_id")
      .notNull()
      .references(() => examPackages.id),
    packageTitle: text("package_title").notNull(),
    price: integer("price").notNull(),
    name: text("name").notNull(),
    phone: text("phone").notNull(),
    email: text("email"),
    paymentMethod: text("payment_method").notNull().default("bkash"),
    couponCode: text("coupon_code"),
    discountAmount: integer("discount_amount").notNull().default(0),
    trx: text("trx").notNull(),
    verified: integer("verified").notNull().default(0),
    verifiedAt: integer("verified_at"),
    verifiedBy: text("verified_by"),
    accessCodeId: text("access_code_id").references(() => codes.id),
    activatedAt: integer("activated_at"),
    expiresAt: integer("expires_at"),
    accessSuspended: integer("access_suspended").notNull().default(0),
  },
  (t) => [
    index("package_order_trx").on(t.trx),
    index("package_order_phone").on(t.phone),
    index("package_order_created").on(t.createdAt),
  ],
);
export const codeExamAccess = sqliteTable(
  "code_exam_access",
  {
    id: id(),
    codeId: text("code_id")
      .notNull()
      .references(() => codes.id),
    examId: text("exam_id")
      .notNull()
      .references(() => exams.id),
    packageOrderId: text("package_order_id")
      .notNull()
      .references(() => packageOrders.id),
  },
  (t) => [
    uniqueIndex("one_code_exam_entitlement").on(t.codeId, t.examId),
    index("code_exam_access_code").on(t.codeId),
  ],
);
export const packageSessions = sqliteTable("package_sessions", {
  id: id(),
  packageId: text("package_id").notNull().references(() => examPackages.id),
  codeId: text("code_id").notNull().references(() => codes.id),
  tokenHash: text("token_hash").notNull(),
  expires: integer("expires").notNull(),
  createdAt: integer("created_at").notNull(),
}, (t) => [index("package_session_token").on(t.packageId,t.tokenHash)]);
export const packageProfiles = sqliteTable("package_profiles", {
  id: id(),
  packageId: text("package_id").notNull().references(() => examPackages.id),
  codeId: text("code_id").notNull().references(() => codes.id),
  name: text("name").notNull(),
  university: text("university").notNull().default(""),
  phone: text("phone").notNull().default(""),
  photo: text("photo"),
  updatedAt: integer("updated_at").notNull(),
}, (t) => [uniqueIndex("package_profile_unique").on(t.packageId,t.codeId)]);
export const teamMembers = sqliteTable(
  "team_members",
  {
    id: id(),
    name: text("name").notNull(),
    role: text("role").notNull(),
    details: text("details").notNull().default(""),
    photo: text("photo"),
    active: integer("active").notNull().default(1),
    displayOrder: integer("display_order").notNull().default(0),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [index("team_active_order").on(t.active, t.displayOrder)],
);
export const notices = sqliteTable(
  "notices",
  {
    id: id(),
    title: text("title").notNull(),
    content: text("content").notNull(),
    attachment: text("attachment"),
    noticeDate: integer("notice_date").notNull(),
    published: integer("published").notNull().default(0),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [index("notice_published_date").on(t.published, t.noticeDate)],
);
export const courses = sqliteTable(
  "courses",
  {
    id: id(),
    name: text("name").notNull(),
    thumbnail: text("thumbnail"),
    description: text("description").notNull().default(""),
    fullDescription: text("full_description").notNull().default(""),
    category: text("category").notNull().default(""),
    subject: text("subject").notNull().default(""),
    instructor: text("instructor").notNull().default(""),
    classCount: integer("class_count").notNull().default(0),
    examCount: integer("exam_count").notNull().default(0),
    sheetCount: integer("sheet_count").notNull().default(0),
    price: integer("price").notNull(),
    regularPrice: integer("regular_price"),
    pricingType: text("pricing_type").notNull().default("paid"),
    accessMode: text("access_mode").notNull().default("code"),
    durationLabel: text("duration_label").notNull().default(""),
    accessValidityDays: integer("access_validity_days").notNull().default(365),
    enrollmentStart: integer("enrollment_start"),
    courseStart: integer("course_start"),
    courseEnd: integer("course_end"),
    maximumStudents: integer("maximum_students"),
    enrollmentOpen: integer("enrollment_open").notNull().default(1),
    featured: integer("featured").notNull().default(0),
    status: text("status").notNull().default("published"),
    sequentialLearning: integer("sequential_learning").notNull().default(0),
    details: text("details").notNull().default(""),
    packageId: text("package_id").references(() => examPackages.id),
    active: integer("active").notNull().default(1),
    published: integer("published").notNull().default(0),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [index("course_published_created").on(t.published, t.createdAt)],
);
export const courseContent = sqliteTable(
  "course_content",
  {
    id: id(),
    courseId: text("course_id")
      .notNull()
      .references(() => courses.id),
    parentId: text("parent_id"),
    nodeType: text("node_type").notNull(),
    lessonType: text("lesson_type"),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    body: text("body").notNull().default(""),
    videoUrl: text("video_url"),
    videoId: text("video_id"),
    videoDuration: text("video_duration").notNull().default(""),
    thumbnail: text("thumbnail"),
    instructor: text("instructor").notNull().default(""),
    fileId: text("file_id"),
    resources: text("resources").notNull().default("[]"),
    examId: text("exam_id").references(() => exams.id),
    packageId: text("package_id").references(() => examPackages.id),
    externalUrl: text("external_url"),
    status: text("status").notNull().default("draft"),
    freePreview: integer("free_preview").notNull().default(0),
    accessMode: text("access_mode").notNull().default("code"),
    downloadAllowed: integer("download_allowed").notNull().default(0),
    unlockRule: text("unlock_rule").notNull().default("immediate"),
    unlockValue: text("unlock_value").notNull().default(""),
    attemptsAllowed: integer("attempts_allowed").notNull().default(1),
    displayOrder: integer("display_order").notNull().default(0),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [
    index("idx_course_content_course_parent_order").on(
      t.courseId,
      t.parentId,
      t.displayOrder,
    ),
    index("idx_course_content_exam").on(t.examId),
  ],
);
export const codeEntitlements = sqliteTable("code_entitlements", {
  id: id(),
  codeId: text("code_id").notNull().references(() => codes.id),
  resourceType: text("resource_type").notNull(),
  resourceId: text("resource_id").notNull(),
  createdAt: integer("created_at").notNull(),
}, t => [
  uniqueIndex("entitlement_code_resource").on(t.codeId,t.resourceType,t.resourceId),
  index("entitlement_resource").on(t.resourceType,t.resourceId),
]);
export const courseSessions = sqliteTable(
  "course_sessions",
  {
    id: id(),
    courseId: text("course_id")
      .notNull()
      .references(() => courses.id),
    codeId: text("code_id")
      .notNull()
      .references(() => codes.id),
    tokenHash: text("token_hash").notNull(),
    expires: integer("expires").notNull(),
    lastAccessedContentId: text("last_accessed_content_id"),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [
    uniqueIndex("idx_course_session_course_code").on(t.courseId, t.codeId),
    index("idx_course_session_expiry").on(t.expires),
  ],
);
export const courseProgress = sqliteTable(
  "course_progress",
  {
    id: id(),
    courseId: text("course_id")
      .notNull()
      .references(() => courses.id),
    codeId: text("code_id")
      .notNull()
      .references(() => codes.id),
    contentId: text("content_id")
      .notNull()
      .references(() => courseContent.id),
    completed: integer("completed").notNull().default(0),
    watchedSeconds: integer("watched_seconds").notNull().default(0),
    openedAt: integer("opened_at").notNull(),
    completedAt: integer("completed_at"),
    examScore: integer("exam_score"),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [
    uniqueIndex("idx_course_progress_unique").on(
      t.courseId,
      t.codeId,
      t.contentId,
    ),
    index("idx_course_progress_student").on(t.courseId, t.codeId, t.completed),
  ],
);
export const courseOrders = sqliteTable(
  "course_orders",
  {
    id: id(),
    tokenHash: text("token_hash").notNull(),
    createdAt: integer("created_at").notNull(),
    courseId: text("course_id")
      .notNull()
      .references(() => courses.id),
    courseName: text("course_name").notNull(),
    price: integer("price").notNull(),
    name: text("name").notNull(),
    phone: text("phone").notNull(),
    email: text("email"),
    paymentMethod: text("payment_method").notNull().default("bkash"),
    couponCode: text("coupon_code"),
    discountAmount: integer("discount_amount").notNull().default(0),
    trx: text("trx").notNull(),
    verified: integer("verified").notNull().default(0),
    verifiedAt: integer("verified_at"),
    verifiedBy: text("verified_by"),
    accessCodeId: text("access_code_id").references(() => codes.id),
    firstAccessIp: text("first_access_ip"),
    activatedAt: integer("activated_at"),
    expiresAt: integer("expires_at"),
    accessSuspended: integer("access_suspended").notNull().default(0),
  },
  (t) => [
    index("course_order_trx").on(t.trx),
    index("course_order_phone").on(t.phone),
    index("course_order_created").on(t.createdAt),
  ],
);
export const notes = sqliteTable(
  "notes",
  {
    id: id(),
    category: text("category").notNull(),
    subcategory: text("subcategory").notNull().default("[]"),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    subject: text("subject").notNull().default(""),
    pageCount: integer("page_count").notNull().default(0),
    readingMinutes: integer("reading_minutes").notNull().default(0),
    thumbnail: text("thumbnail"),
    file: text("file"),
    link: text("link"),
    published: integer("published").notNull().default(0),
    downloadCount: integer("download_count").notNull().default(0),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [
    index("note_category_published").on(t.category, t.published, t.createdAt),
  ],
);
export const authors = sqliteTable(
  "authors",
  {
    id: id(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    photo: text("photo"),
    description: text("description").notNull().default(""),
    active: integer("active").notNull().default(1),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [
    uniqueIndex("idx_authors_slug").on(t.slug),
    index("idx_authors_name").on(t.name),
  ],
);
export const blogs = sqliteTable(
  "blogs",
  {
    id: id(),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    thumbnail: text("thumbnail"),
    excerpt: text("excerpt").notNull().default(""),
    category: text("category").notNull().default(""),
    subcategory: text("subcategory").notNull().default(""),
    tags: text("tags").notNull().default(""),
    seoTitle: text("seo_title").notNull().default(""),
    metaDescription: text("meta_description").notNull().default(""),
    authorId: text("author_id").references(() => authors.id),
    authorName: text("author_name").notNull(),
    authorPhoto: text("author_photo"),
    authorDescription: text("author_description").notNull().default(""),
    content: text("content").notNull(),
    publishDate: integer("publish_date").notNull(),
    published: integer("published").notNull().default(0),
    viewCount: integer("view_count").notNull().default(0),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [
    index("blog_published_date").on(t.published, t.publishDate),
    index("idx_blogs_author_id").on(t.authorId),
  ],
);
export const seoEntries = sqliteTable(
  "seo_entries",
  {
    id: id(),
    contentType: text("content_type").notNull(),
    contentId: text("content_id").notNull(),
    path: text("path").notNull(),
    seoTitle: text("seo_title").notNull().default(""),
    metaDescription: text("meta_description").notNull().default(""),
    canonicalUrl: text("canonical_url").notNull().default(""),
    indexable: integer("indexable").notNull().default(1),
    followLinks: integer("follow_links").notNull().default(1),
    ogTitle: text("og_title").notNull().default(""),
    ogDescription: text("og_description").notNull().default(""),
    socialImage: text("social_image"),
    schemaType: text("schema_type").notNull().default("WebPage"),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [
    uniqueIndex("idx_seo_entries_content").on(t.contentType, t.contentId),
    uniqueIndex("idx_seo_entries_path").on(t.path),
    index("idx_seo_entries_indexable").on(t.indexable, t.updatedAt),
  ],
);
export const seoRedirects = sqliteTable(
  "seo_redirects",
  {
    id: id(),
    oldUrl: text("old_url").notNull(),
    newUrl: text("new_url").notNull(),
    statusCode: integer("status_code").notNull().default(301),
    active: integer("active").notNull().default(1),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [
    uniqueIndex("idx_seo_redirects_old_url").on(t.oldUrl),
    index("idx_seo_redirects_active").on(t.active, t.updatedAt),
  ],
);
export const reviews = sqliteTable(
  "reviews",
  {
    id: id(),
    reviewText: text("review_text").notNull(),
    reviewerName: text("reviewer_name").notNull(),
    reviewerPhoto: text("reviewer_photo"),
    university: text("university").notNull(),
    rating: integer("rating").notNull().default(5),
    verified: integer("verified").notNull().default(0),
    published: integer("published").notNull().default(0),
    active: integer("active").notNull().default(1),
    displayOrder: integer("display_order").notNull().default(0),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [
    index("review_public_order").on(
      t.published,
      t.verified,
      t.active,
      t.displayOrder,
    ),
  ],
);
export const settings = sqliteTable("settings", {
  id: id(),
  value: text("value").notNull(),
});
export const files = sqliteTable("files", {
  id: id(),
  name: text("name").notNull(),
  mime: text("mime").notNull(),
  visibility: text("visibility").notNull(),
  createdAt: integer("created_at").notNull(),
});
export const siteVisitors = sqliteTable("site_visitors", {
  id: id(),
  firstSeenAt: integer("first_seen_at").notNull(),
  lastSeenAt: integer("last_seen_at").notNull(),
  visitCount: integer("visit_count").notNull().default(1),
});
export const audit = sqliteTable("audit", {
  id: id(),
  adminId: text("admin_id").notNull(),
  action: text("action").notNull(),
  target: text("target").notNull(),
  createdAt: integer("created_at").notNull(),
  result: text("result").notNull().default("success"),
});

export const coupons = sqliteTable(
  "coupons",
  {
    id: id(),
    code: text("code").notNull(),
    discountType: text("discount_type").notNull(),
    discountValue: integer("discount_value").notNull(),
    minimumOrder: integer("minimum_order").notNull().default(0),
    maximumDiscount: integer("maximum_discount"),
    startsAt: integer("starts_at"),
    expiresAt: integer("expires_at"),
    usageLimit: integer("usage_limit"),
    perUserLimit: integer("per_user_limit").notNull().default(1),
    appliesTo: text("applies_to").notNull().default('["entire_store"]'),
    productIds: text("product_ids").notNull().default("[]"),
    active: integer("active").notNull().default(1),
    timesUsed: integer("times_used").notNull().default(0),
    totalDiscount: integer("total_discount").notNull().default(0),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [
    uniqueIndex("idx_coupons_code").on(t.code),
    index("idx_coupons_active_dates").on(t.active, t.startsAt, t.expiresAt),
  ],
);

export const payments = sqliteTable(
  "payments",
  {
    id: id(),
    orderId: text("order_id").notNull(),
    orderType: text("order_type").notNull(),
    customer: text("customer").notNull(),
    amount: integer("amount").notNull(),
    method: text("method").notNull(),
    transactionId: text("transaction_id").notNull(),
    status: text("status").notNull().default("pending"),
    refundAmount: integer("refund_amount").notNull().default(0),
    adminNote: text("admin_note").notNull().default(""),
    deletedAt: integer("deleted_at"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [
    uniqueIndex("idx_payments_order").on(t.orderId),
    index("idx_payments_status_date").on(t.status, t.createdAt),
    index("idx_payments_transaction").on(t.transactionId),
  ],
);
export const couponRedemptions = sqliteTable(
  "coupon_redemptions",
  {
    id: id(),
    couponId: text("coupon_id")
      .notNull()
      .references(() => coupons.id),
    userKey: text("user_key").notNull(),
    orderId: text("order_id").notNull(),
    discountAmount: integer("discount_amount").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [
    uniqueIndex("idx_coupon_redemption_order").on(t.orderId),
    index("idx_coupon_redemption_user").on(t.couponId, t.userKey),
  ],
);

export const backupHistory = sqliteTable(
  "backup_history",
  {
    id: id(),
    kind: text("kind").notNull(),
    status: text("status").notNull(),
    createdBy: text("created_by").notNull(),
    createdAt: integer("created_at").notNull(),
    verifiedAt: integer("verified_at"),
    sizeBytes: integer("size_bytes").notNull().default(0),
    verificationStatus: text("verification_status")
      .notNull()
      .default("pending"),
    driveStatus: text("drive_status").notNull().default("not_synced"),
    driveStartedAt: integer("drive_started_at"),
    driveFolderId: text("drive_folder_id"),
    driveSyncedAt: integer("drive_synced_at"),
    driveErrorMessage: text("drive_error_message"),
    keepForever: integer("keep_forever").notNull().default(0),
    includedModules: text("included_modules").notNull().default("[]"),
    manifest: text("manifest").notNull().default("{}"),
    checksum: text("checksum").notNull().default(""),
    archiveKey: text("archive_key"),
    payloadKey: text("payload_key"),
    mediaCount: integer("media_count").notNull().default(0),
    source: text("source").notNull().default("manual"),
    errorMessage: text("error_message"),
  },
  (t) => [
    index("idx_backup_history_created").on(t.createdAt),
    index("idx_backup_history_status").on(t.status, t.verificationStatus),
  ],
);

export const backupSchedules = sqliteTable("backup_schedules", {
  id: id(),
  label: text("label").notNull(),
  backupType: text("backup_type").notNull(),
  frequency: text("frequency").notNull(),
  enabled: integer("enabled").notNull().default(1),
  retentionCount: integer("retention_count").notNull(),
  lastRunAt: integer("last_run_at"),
  nextRunAt: integer("next_run_at"),
  updatedAt: integer("updated_at").notNull(),
});

export const backupStorageConnections = sqliteTable(
  "backup_storage_connections",
  {
    id: id(),
    provider: text("provider").notNull(),
    accountEmail: text("account_email").notNull().default(""),
    folder: text("folder").notNull().default(""),
    status: text("status").notNull().default("authorization_required"),
    connected: integer("connected").notNull().default(0),
    lastTestedAt: integer("last_tested_at"),
    lastSyncedAt: integer("last_synced_at"),
    config: text("config").notNull().default("{}"),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [
    uniqueIndex("idx_backup_storage_provider_email").on(
      t.provider,
      t.accountEmail,
    ),
  ],
);

export const bdLawsSources = sqliteTable(
  "bd_laws_sources",
  {
    id: id(),
    actName: text("act_name").notNull(),
    actNumber: text("act_number").notNull().default(""),
    year: integer("year"),
    officialUrl: text("official_url").notNull(),
    language: text("language").notNull().default("en"),
    status: text("status").notNull().default("pending"),
    legalStatus: text("legal_status").notNull().default("unknown"),
    statusSourceUrl: text("status_source_url").notNull().default(""),
    supersededBy: text("superseded_by").notNull().default(""),
    lastSyncedAt: integer("last_synced_at"),
    contentHash: text("content_hash").notNull().default(""),
    errorMessage: text("error_message"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [
    uniqueIndex("idx_bd_laws_sources_url").on(t.officialUrl),
    index("idx_bd_laws_sources_status").on(t.status, t.updatedAt),
    index("idx_bd_laws_sources_legal_status").on(t.legalStatus, t.year),
    index("idx_bd_laws_sources_name").on(t.actName),
  ],
);

export const bdLawsSections = sqliteTable(
  "bd_laws_sections",
  {
    id: id(),
    sourceId: text("source_id")
      .notNull()
      .references(() => bdLawsSources.id),
    chapter: text("chapter").notNull().default(""),
    part: text("part").notNull().default(""),
    sectionNumber: text("section_number").notNull(),
    sectionTitle: text("section_title").notNull().default(""),
    sectionText: text("section_text").notNull(),
    officialUrl: text("official_url").notNull(),
    language: text("language").notNull().default("en"),
    status: text("status").notNull().default("indexed"),
    contentHash: text("content_hash").notNull(),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [
    uniqueIndex("idx_bd_laws_sections_url").on(t.officialUrl),
    index("idx_bd_laws_sections_source_number").on(t.sourceId, t.sectionNumber),
    index("idx_bd_laws_sections_status").on(t.status, t.updatedAt),
  ],
);

export const bdLawsSyncHistory = sqliteTable(
  "bd_laws_sync_history",
  {
    id: id(),
    mode: text("mode").notNull(),
    status: text("status").notNull(),
    startedAt: integer("started_at").notNull(),
    finishedAt: integer("finished_at"),
    discoveredSources: integer("discovered_sources").notNull().default(0),
    indexedSections: integer("indexed_sections").notNull().default(0),
    changedSources: integer("changed_sources").notNull().default(0),
    failedSources: integer("failed_sources").notNull().default(0),
    errorMessage: text("error_message"),
  },
  (t) => [index("idx_bd_laws_sync_started").on(t.startedAt)],
);

export const bdLawsQueries = sqliteTable(
  "bd_laws_queries",
  {
    id: id(),
    question: text("question").notNull(),
    language: text("language").notNull(),
    resultStatus: text("result_status").notNull(),
    sectionIds: text("section_ids").notNull().default("[]"),
    sourceCount: integer("source_count").notNull().default(0),
    durationMs: integer("duration_ms").notNull().default(0),
    visitorHash: text("visitor_hash").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [
    index("idx_bd_laws_queries_created").on(t.createdAt),
    index("idx_bd_laws_queries_status").on(t.resultStatus, t.createdAt),
  ],
);

export const studyUsers = sqliteTable("study_users", {
  id: id(), name: text("name").notNull(), university: text("university").notNull(),
  phone: text("phone").notNull().unique(), passwordHash: text("password_hash").notNull(),
  active: integer("active").notNull().default(1), createdAt: integer("created_at").notNull(), lastLoginAt: integer("last_login_at"),
});
export const studySessions = sqliteTable("study_sessions", {
  id: id(), userId: text("user_id").notNull().references(() => studyUsers.id),
  tokenHash: text("token_hash").notNull().unique(), expires: integer("expires").notNull(), createdAt: integer("created_at").notNull(),
}, (t) => [index("idx_study_sessions_user").on(t.userId)]);
export const studyCurricula = sqliteTable("study_curricula", {
  id: id(), code: text("code").notNull().unique(), title: text("title").notNull(),
  marks: integer("marks"), active: integer("active").notNull().default(1), sortOrder: integer("sort_order").notNull().default(0),
});
export const studyNodes = sqliteTable("study_nodes", {
  id: id(), curriculumId: text("curriculum_id").notNull().references(() => studyCurricula.id),
  parentId: text("parent_id"), type: text("type").notNull(), titleBn: text("title_bn").notNull(), titleEn: text("title_en").notNull().default(""),
  referenceNumber: text("reference_number").notNull().default(""), sortOrder: integer("sort_order").notNull().default(0),
  marks: integer("marks"), workloadWeight: integer("workload_weight").notNull().default(100), active: integer("active").notNull().default(1),
  description: text("description").notNull().default(""), estimatedWorkload: integer("estimated_workload").notNull().default(100),
  metadata: text("metadata").notNull().default("{}"),
}, (t) => [index("idx_study_nodes_tree").on(t.curriculumId,t.parentId,t.sortOrder)]);
export const studyPlans = sqliteTable("study_plans", {
  id: id(), userId: text("user_id").notNull().references(() => studyUsers.id), curriculumId: text("curriculum_id").notNull().references(() => studyCurricula.id),
  title: text("title").notNull(), startDate: text("start_date").notNull(), endDate: text("end_date").notNull(),
  studyDays: text("study_days").notNull(), offDates: text("off_dates").notNull().default("[]"),
  dailyWorkload: integer("daily_workload").notNull().default(400), dailyLimit: integer("daily_limit").notNull().default(6),
  carryMode: text("carry_mode").notNull().default("auto"), mode: text("mode").notNull().default("smart"),
  status: text("status").notNull().default("active"), selections: text("selections").notNull().default("[]"),
  createdAt: integer("created_at").notNull(), updatedAt: integer("updated_at").notNull(),
}, (t) => [index("idx_study_plans_user").on(t.userId,t.status,t.updatedAt)]);
export const studyTasks = sqliteTable("study_tasks", {
  id: id(), planId: text("plan_id").notNull().references(() => studyPlans.id), nodeId: text("node_id"),
  titleSnapshot: text("title_snapshot").notNull(), subjectSnapshot: text("subject_snapshot").notNull(),
  referenceSnapshot: text("reference_snapshot").notNull().default(""), originalDate: text("original_date").notNull(),
  dueDate: text("due_date").notNull(), status: text("status").notNull().default("pending"),
  carryCount: integer("carry_count").notNull().default(0), completedAt: integer("completed_at"),
  priority: integer("priority").notNull().default(1), notes: text("notes").notNull().default(""),
  workload: integer("workload").notNull().default(100), sortOrder: integer("sort_order").notNull().default(0),
}, (t) => [index("idx_study_tasks_plan_date").on(t.planId,t.dueDate,t.status)]);
export const studyTaskHistory = sqliteTable("study_task_history", {
  id: id(), taskId: text("task_id").notNull().references(() => studyTasks.id),
  planId: text("plan_id").notNull().references(() => studyPlans.id), action: text("action").notNull(),
  previousDate: text("previous_date"), nextDate: text("next_date"), details: text("details").notNull().default(""),
  createdAt: integer("created_at").notNull(),
}, (t) => [index("idx_study_task_history_plan").on(t.planId,t.createdAt)]);
export const studyConfig = sqliteTable("study_config", { id: id(), value: text("value").notNull(), updatedAt: integer("updated_at").notNull() });
