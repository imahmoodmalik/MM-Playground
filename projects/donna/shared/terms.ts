import type { Clause } from "./types.js";

export const termCategories = [
  {
    id: "scope",
    en: "Services & scope",
    ar: "الخدمات ونطاق العمل",
    terms: [
      "services",
      "scope of work",
      "deliverables",
      "الخدمات",
      "خدمات",
      "نطاق العمل",
      "الأعمال",
      "المخرجات",
    ],
  },
  {
    id: "payment",
    en: "Payment & fees",
    ar: "الدفع والرسوم",
    terms: [
      "payment",
      "payments",
      "fees",
      "invoice",
      "invoices",
      "الدفع",
      "دفع",
      "السداد",
      "سداد",
      "الرسوم",
      "رسوم",
      "الفواتير",
      "فاتورة",
      "المقابل المالي",
      "الأجرة",
    ],
  },
  {
    id: "term",
    en: "Duration & renewal",
    ar: "المدة والتجديد",
    terms: [
      "renewal",
      "renew",
      "expiry",
      "expiration",
      "contract term",
      "مدة العقد",
      "مدة الاتفاقية",
      "التجديد",
      "تجديد",
      "انتهاء المدة",
      "سريان العقد",
    ],
  },
  {
    id: "termination",
    en: "Termination",
    ar: "الإنهاء والفسخ",
    terms: [
      "termination",
      "terminate",
      "terminated",
      "cancellation",
      "إنهاء",
      "الإنهاء",
      "فسخ",
      "الفسخ",
      "إلغاء العقد",
      "انتهاء العقد",
    ],
  },
  {
    id: "liability",
    en: "Liability & indemnity",
    ar: "المسؤولية والتعويض",
    terms: [
      "liability",
      "liable",
      "indemnity",
      "indemnify",
      "indemnification",
      "damages",
      "المسؤولية",
      "مسؤولية",
      "مسئولية",
      "المسئولية",
      "التعويض",
      "تعويض",
      "التعويضات",
      "الأضرار",
    ],
  },
  {
    id: "confidentiality",
    en: "Confidentiality",
    ar: "السرية",
    terms: [
      "confidential",
      "confidentiality",
      "non-disclosure",
      "السرية",
      "سرية",
      "المعلومات السرية",
      "عدم الإفصاح",
      "عدم افشاء",
      "إفشاء",
    ],
  },
  {
    id: "data",
    en: "Data & privacy",
    ar: "البيانات والخصوصية",
    terms: [
      "personal data",
      "customer data",
      "data protection",
      "data processing",
      "privacy",
      "البيانات",
      "بيانات",
      "حماية البيانات",
      "معالجة البيانات",
      "الخصوصية",
      "خصوصية",
    ],
  },
  {
    id: "retention",
    en: "Retention & deletion",
    ar: "الاحتفاظ والحذف",
    terms: [
      "retention",
      "retained",
      "retain",
      "deletion",
      "delete",
      "deleted",
      "backup",
      "backups",
      "الاحتفاظ",
      "احتفاظ",
      "الحذف",
      "حذف",
      "إتلاف",
      "الإتلاف",
      "النسخ الاحتياطية",
      "نسخ احتياطية",
    ],
  },
  {
    id: "ip",
    en: "Intellectual property",
    ar: "الملكية الفكرية",
    terms: [
      "intellectual property",
      "copyright",
      "patent",
      "trademark",
      "الملكية الفكرية",
      "حقوق المؤلف",
      "حقوق النشر",
      "براءة اختراع",
      "العلامة التجارية",
    ],
  },
  {
    id: "notices",
    en: "Notices",
    ar: "الإشعارات",
    terms: [
      "notice",
      "notices",
      "notification",
      "notify",
      "الإشعار",
      "إشعار",
      "الإشعارات",
      "إشعارات",
      "إخطار",
      "الإخطارات",
      "التبليغ",
    ],
  },
  {
    id: "disputes",
    en: "Disputes & governing law",
    ar: "النزاعات والقانون الواجب التطبيق",
    terms: [
      "governing law",
      "jurisdiction",
      "arbitration",
      "dispute",
      "disputes",
      "القانون الواجب التطبيق",
      "القانون الحاكم",
      "القانون المطبق",
      "الاختصاص القضائي",
      "التحكيم",
      "تحكيم",
      "النزاعات",
      "نزاع",
      "المنازعات",
    ],
  },
  {
    id: "assignment",
    en: "Assignment & subcontracting",
    ar: "التنازل والتعاقد من الباطن",
    terms: [
      "assignment",
      "assign",
      "subcontract",
      "subcontractors",
      "subcontracting",
      "sub-processor",
      "sub-processors",
      "التنازل",
      "تنازل",
      "التعاقد من الباطن",
      "مقاول الباطن",
      "المقاولين من الباطن",
    ],
  },
  {
    id: "force-majeure",
    en: "Force majeure",
    ar: "القوة القاهرة",
    terms: ["force majeure", "القوة القاهرة", "قوة قاهرة"],
  },
] as const;
export type TermCategoryId = (typeof termCategories)[number]["id"];
export interface CategorizedPassage {
  categoryId: TermCategoryId;
  clauseId: string;
  matchedTerms: string[];
  quote: string;
}

export function normalizeDigits(text: string): string {
  return text.replace(/[٠-٩۰-۹]/g, (digit) =>
    String(digit.charCodeAt(0) - (digit >= "۰" ? 0x6f0 : 0x660)),
  );
}

function searchable(text: string) {
  let value = "";
  const offsets: number[] = [];
  let offset = 0;
  for (const original of text) {
    const normalized = normalizeDigits(original.normalize("NFKC"))
      .replace(/[\u064b-\u065f\u0670\u0640\u200e\u200f\u061c]/g, "")
      .replace(/[أإآٱ]/g, "ا")
      .toLowerCase();
    for (let i = 0; i < normalized.length; i++) offsets.push(offset);
    value += normalized;
    offset += original.length;
  }
  offsets.push(text.length);
  return { value, offsets };
}
export function normalizeTermText(text: string) {
  return searchable(text).value;
}
export function textDirection(text: string): "rtl" | "ltr" {
  const first = text.match(/\p{L}/u)?.[0] || "";
  return /\p{Script=Arabic}/u.test(first) ? "rtl" : "ltr";
}

// Topic organization only. Matching a term never creates a risk or impact finding.
export function categorizeClauses(clauses: Clause[]): CategorizedPassage[] {
  return clauses.flatMap((clause) => {
    const { value, offsets } = searchable(clause.text);
    return termCategories.flatMap((category) => {
      const hits = category.terms.flatMap((term) => {
        const normalized = normalizeTermText(term);
        const escaped = normalized
          .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
          .replace(/\s+/g, "\\s+");
        const prefix = /\p{Script=Arabic}/u.test(normalized) ? "[وبفل]?" : "";
        const match = new RegExp(
          `(?<![\\p{L}\\p{N}])${prefix}${escaped}(?![\\p{L}\\p{N}])`,
          "u",
        ).exec(value);
        return match
          ? [
              {
                term,
                start: offsets[match.index],
                end: offsets[match.index + match[0].length],
              },
            ]
          : [];
      });
      if (!hits.length) return [];
      const hit = hits.sort((a, b) => a.start - b.start)[0];
      const sentenceStart =
        Math.max(
          clause.text.lastIndexOf("\n", hit.start - 1),
          clause.text.lastIndexOf(".", hit.start - 1),
        ) + 1;
      const nextEnd = clause.text.slice(hit.end).search(/[\n.。!?؟]/u);
      const sentenceEnd =
        hit.start < clause.text.indexOf("\n")
          ? Math.min(clause.text.length, hit.start + 220)
          : nextEnd < 0 ? clause.text.length : hit.end + nextEnd + 1;
      return [
        {
          categoryId: category.id,
          clauseId: clause.id,
          matchedTerms: [...new Set(hits.map((item) => item.term))],
          quote: clause.text
            .slice(
              Math.max(sentenceStart, hit.start - 100),
              Math.min(sentenceEnd, Math.max(hit.end, hit.start + 220)),
            )
            .trim(),
        },
      ];
    });
  });
}
