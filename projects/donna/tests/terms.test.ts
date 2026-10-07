import { test } from "node:test";
import assert from "node:assert/strict";
import { categorizeClauses, textDirection } from "../shared/terms.js";
import { parseDocument, mapReferences } from "../shared/review.js";

test("Arabic and English agreements map equivalent terms to the same categories", () => {
  const english = categorizeClauses(
    parseDocument(
      "1. Payment\nPayment of fees is due within 30 days.\n2. Termination\nTermination requires written notice.\n3. Liability\nLiability includes indemnity for damages.",
    ),
  );
  const arabic = categorizeClauses(
    parseDocument(
      "المادة ١: الدفع\nيجب سداد الرسوم خلال ثلاثين يوماً.\nالمادة ٢: الإنهاء\nيتطلب إنهاء العقد إرسال إشعار كتابي.\nالمادة ٣: المسؤولية\nتشمل المسؤولية التعويض عن الأضرار.",
    ),
  );
  assert.deepEqual(
    [...new Set(arabic.map((p) => p.categoryId))].sort(),
    [...new Set(english.map((p) => p.categoryId))].sort(),
  );
});

test("Arabic diacritics, tatweel and attached conjunctions retain original evidence", () => {
  const clauses = parseDocument(
    "١. أحكام عامة\nتُحْفَظُ سِرِّيَّة المعلومات والسَّداد والإنهاء وفقاً للعقد.",
  );
  const passages = categorizeClauses(clauses);
  assert.ok(passages.some((p) => p.categoryId === "confidentiality"));
  assert.ok(passages.some((p) => p.categoryId === "payment"));
  assert.ok(passages.some((p) => p.categoryId === "termination"));
  for (const passage of passages)
    assert.ok(clauses[0].text.includes(passage.quote));
});

test("multiple terms can categorize one section without generating risk findings", () => {
  const clauses = parseDocument(
    "1. Ending services\nOn termination, delete customer data and retain backups for 30 days.\n2. General\nThe parties agree to cooperate.",
  );
  const passages = categorizeClauses(clauses);
  assert.ok(passages.some((p) => p.categoryId === "termination"));
  assert.ok(passages.some((p) => p.categoryId === "data"));
  assert.ok(passages.some((p) => p.categoryId === "retention"));
  assert.ok(!passages.some((p) => p.clauseId === clauses[1].id));
  assert.equal(mapReferences(clauses).length, 0);
});

test("term matching respects word boundaries and mixed-language sections", () => {
  assert.equal(
    categorizeClauses(
      parseDocument(
        "1. General\nAn invoiceable item and a serviceable device.",
      ),
    ).length,
    0,
  );
  const clauses = parseDocument(
    "1. Payment / الدفع\nيتم السداد وفق payment schedule.",
  );
  const matches = categorizeClauses(clauses);
  assert.equal(matches.filter((p) => p.categoryId === "payment").length, 1);
  assert.equal(textDirection("١. الإنهاء"), "rtl");
  assert.equal(textDirection("1. Payment / الدفع"), "ltr");
});

test("Arabic section numbers and internal references navigate to the real clause", () => {
  const clauses = parseDocument(
    "المادة ١: الخدمات\nتخضع الخدمات للبند ٢.\nالبند ٢: المسؤولية\nتطبق حدود المسؤولية.",
  );
  assert.deepEqual(
    clauses.map((clause) => clause.label),
    ["1", "2"],
  );
  const refs = mapReferences(clauses);
  assert.equal(refs[0].related[0].targetId, clauses[1].id);
  assert.equal(refs[0].quote, "للبند ٢");
  assert.equal(
    mapReferences(parseDocument("١. البيانات\nوفقاً للمادة ٢٤ من القانون."))
      .length,
    0,
  );
});
