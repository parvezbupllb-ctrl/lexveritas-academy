export function deadline(start: number, duration: number, end: number) {
  return Math.min(start + duration * 60000, end);
}
export function score(
  selected: (number | null)[],
  correct: number[],
  mark: number,
  penalty: number,
) {
  let c = 0,
    w = 0,
    u = 0;
  correct.forEach((v, i) => {
    if (selected[i] == null) u++;
    else if (selected[i] === v) c++;
    else w++;
  });
  const positive = c * mark,
    negative = w * penalty;
  return {
    correct: c,
    wrong: w,
    unanswered: u,
    positive,
    negative,
    score: positive - negative,
    percentage: correct.length
      ? Math.round(((positive - negative) / (correct.length * mark)) * 10000)
      : 0,
  };
}
export function totals(
  subtotal: number,
  delivery: string,
  payment: string,
  charges: Record<string, number>,
) {
  if (!(delivery in charges) || !["full", "cod"].includes(payment))
    throw Error("Choose a valid delivery and payment option.");
  if (delivery === "sundarban" && payment === "cod")
    throw Error("COD is only available for Home Delivery.");
  let delivery_charge = charges[delivery];
  if (
    !Number.isSafeInteger(subtotal) ||
    subtotal < 0 ||
    !Number.isSafeInteger(delivery_charge) ||
    delivery_charge < 0
  )
    throw Error("Invalid amount.");
  return {
    subtotal,
    delivery_charge,
    total: subtotal + delivery_charge,
    paid: payment === "cod" ? delivery_charge : subtotal + delivery_charge,
    due: payment === "cod" ? subtotal : 0,
  };
}
export const released = (
  e: {
    end: number;
    status: string;
    result_mode: string;
    results_published: number;
  },
  now: number,
) => e.result_mode === "immediate" || (now >= e.end && (e.result_mode === "auto" || !!e.results_published));
export const defaults = {
  payment: "01742181698",
  bkashPayment: "01742181698",
  nagadPayment: "01742181698",
  rocketPayment: "01742181698",
  sundarban: 7000,
  dhaka: 8000,
  outside: 11000,
  websiteName: "LexVeritas Academy",
  websiteLogo: "/assets/lexveritas-logo.png",
  favicon: "",
  shortDescription: "BJS • Bar Council • Law Officer • Academic Legal Education",
  email: "parvezbupllb@gmail.com",
  contactInfo: "Bangladesh",
  whatsapp: "01577291341",
  facebookGroup: "https://www.facebook.com/groups/lexveritasacademy/",
  facebookPage: "https://www.facebook.com/share/1KDxs3PCgD/",
  telegram: "https://t.me/+xK-oyAWyQGQ3YWI9",
  whatsappGroup: "https://chat.whatsapp.com/EdK8nO5sa9j0AMrVi4RVBN?mode=gi_t",
  about:
    "LexVeritas Academy supports aspiring judges, advocates, Law Officer candidates, and law students through focused BJS preparation, Bangladesh Bar Council preparation, Law Officer preparation, academic legal education, MCQ examinations, and law books.",
  brandText: "LexVeritas Academy",
  showBrandText: true,
  showCart: true,
  headerContactLabel: "Contact",
  notesMenuLabel: "Free Notes & Study Resources",
  homeMenuLabel: "Home",
  packagesMenuLabel: "Exam Packages",
  coursesMenuLabel: "Courses",
  booksMenuLabel: "Books",
  aboutMenuLabel: "About",
  heroEyebrow: "YOUR NEXT CHAPTER IN LAW",
  heroTitle: "A Stronger Foundation.",
  heroAccent: "A Higher Ambition.",
  heroDescription:
    "Prepare for BJS, the Bar Council, Law Officer recruitment, and academic law with focused MCQ examinations and carefully selected law materials.",
  heroPrimaryText: "Explore Exam Packages",
  heroPrimaryUrl: "/packages",
  heroPrimaryVisible: true,
  heroSecondaryText: "Browse Books",
  heroSecondaryUrl: "/books",
  heroSecondaryVisible: true,
  heroImage: "",
  noticeTitle: "Notice",
  noticeSubtitle: "ACADEMY UPDATES",
  noticeVisible: true,
  noticeMaxVisible: 4,
  statisticsTitle: "LexVeritas In Numbers",
  statisticsSubtitle: "TRUSTED LEGAL LEARNING COMMUNITY",
  statisticsVisible: true,
  stat1Label: "Learners Reached",
  stat1Value: "6,000+",
  stat1Visible: true,
  stat2Label: "Books Delivered",
  stat2Value: "500+",
  stat2Visible: true,
  stat3Label: "Student Rating",
  stat3Value: "4.8/5",
  stat3Visible: true,
  stat4Label: "Free Notes",
  stat4Value: "100+",
  stat4Visible: true,
  packageTitle: "MCQ Exam Packages",
  packageSubtitle:
    "One purchase gives you secure access to every scheduled exam in the package.",
  packageVisible: true,
  courseTitle: "Our Courses",
  courseSubtitle:
    "Choose a structured course for your next stage of legal preparation.",
  courseVisible: true,
  enrollText: "ভর্তি হোন",
  detailsText: "বিস্তারিত",
  viewAllText: "View All",
  blogTitle: "Blog",
  blogSubtitle: "Legal insight, examination guidance and Academy updates.",
  blogVisible: true,
  blogHomeCount: 3,
  blogReadMoreText: "Read More",
  reviewsTitle: "Verified Reviews",
  reviewsSubtitle:
    "Approved experiences shared by LexVeritas Academy learners.",
  reviewsVisible: true,
  reviewsHomeCount: 6,
  teamTitle: "Our Team",
  teamSubtitle: "THE PEOPLE BEHIND THE ACADEMY",
  teamVisible: true,
  notesVisible: true,
  bjsNotesLabel: "BJS Notes",
  barNotesLabel: "BAR Notes",
  generalNotesLabel: "General Subject Notes",
  academicNotesLabel: "Academic Notes",
  booksVisible: true,
  booksTitle: "Books & Study Materials",
  booksSubtitle: "Explore our hardcopy books and digital editions.",
  booksViewText: "View Book",
  booksBuyText: "Buy Now",
  footerDescription: "Preparation for a career grounded in law.",
  footerExploreTitle: "Explore",
  footerContactTitle: "Stay Connected",
  copyrightText: "LexVeritas Academy",
  footerLogo: "",
  supportHours: "Saturday–Thursday, 9:00 AM–9:00 PM",
  orderSupport: "For order help, please include your Order ID.",
  examAccessSupport: "For exam access help, please include your Exam or Package name and access code.",
  responseTime: "We usually respond within 24 hours.",
  defaultExamInstructions:
    "Each access code permits one attempt. Your attempt ends when the duration expires or the scheduled window closes, whichever is earlier.",
  submitExamText: "Submit Exam",
  resultPendingText:
    "Your examination has been submitted. Results will be available when released.",
  primaryColor: "#10243c",
  secondaryColor: "#c89b3c",
  backgroundColor: "#f7f8fa",
  textColor: "#172033",
  buttonStyle: "rounded",
  borderRadius: 14,
  sectionSpacing: 72,
  homeSectionOrder: [
    "notice",
    "courses",
    "packages",
    "notes",
    "books",
    "blog",
    "statistics",
    "reviews",
    "team",
  ],
};
