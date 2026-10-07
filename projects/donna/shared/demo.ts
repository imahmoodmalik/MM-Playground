import { localReview, parseDocument } from "./review.js";
import type { ReviewSession } from "./types.js";

export const exampleText = `MASTER SERVICES AGREEMENT
Northstar Studio × Acme Cloud
Fictional example · 02 October 2026

1. Services
Acme Cloud (Supplier) will provide the hosted collaboration service to Northstar Studio (Customer). The service scope is set out in Schedule A. Any change to the Services must be agreed in writing.

2. Subcontracting
The Supplier may appoint subcontractors to perform any part of the Services without obtaining prior written consent from the Customer. The Supplier remains responsible for its subcontractors.

3. Data processing
The Supplier will process Customer Data only on documented instructions. The Supplier must obtain the Customer's prior written approval before appointing any sub-processor that will access Customer Data. See clause 2 for general subcontracting rights.

4. Confidentiality
Each party must protect the other's Confidential Information and may disclose it only to personnel who need access to provide the Services. The disclosure obligations in clause 8 apply to any incident involving Confidential Information.

5. Retention and deletion
Within 30 days after termination, the Supplier will delete all Customer Data, including backup copies, unless retention is required by applicable law. The Supplier will confirm deletion in writing.

6. Business continuity
The Supplier retains disaster-recovery backups for 180 days after termination. Backups contain Customer Data and are restored only for business-continuity purposes. Access is restricted to authorised staff.

7. Liability
The Supplier's aggregate liability under this Agreement is capped at the fees paid during the preceding twelve months. The cap does not apply to the confidentiality obligations in clause 4. Each party must assess the effect of this exception before agreeing to the cap.

8. Incident notification
The Supplier must notify the Customer of a confirmed personal data breach within 48 hours of confirmation. Notices under this clause must be delivered to the security contact named in Schedule A.

9. Notices
Formal notices under this Agreement must be sent by registered post and are deemed received five business days after dispatch. Additional notice requirements are set out in clause 14.

10. Order of precedence
If the data-processing obligations in clause 3 conflict with the general subcontracting rights in clause 2, clause 3 takes precedence. Other inconsistencies must be resolved by written agreement. This clause should be considered before treating an apparent conflict as unresolved.`;

export function exampleSession(): ReviewSession {
  const clauses = parseDocument(exampleText);
  const clause = (label: string) =>
    clauses.find((item) => item.label === label)!;
  return {
    version: 1,
    document: {
      name: "Northstar — Master services agreement",
      clauses,
      warnings: [
        "Fictional example. The two editorial comments illustrate the review experience; they are not AI findings.",
      ],
      isExample: true,
    },
    context: { jurisdiction: "", party: "Customer", instructions: "" },
    sources: [],
    findings: [
      {
        id: "example-retention",
        kind: "connection",
        origin: "example",
        title: "Two different deletion timelines",
        clauseId: clause("5").id,
        quote:
          "Within 30 days after termination, the Supplier will delete all Customer Data, including backup copies",
        explanation:
          "§5 requires deletion of backups within 30 days; §6 keeps them for 180 days. The same backups have two incompatible deadlines.",
        related: [
          {
            targetId: clause("6").id,
            quote: clause("6").text,
            reason:
              "Provides a different retention period for the same backup data",
          },
        ],
        sources: [],
        uncertainty:
          "Is backup retention required by law? §5 allows that exception.",
        status: "open",
      },
      {
        id: "example-subcontract",
        kind: "connection",
        origin: "example",
        title: "Approval rights depend on the work",
        clauseId: clause("2").id,
        quote: clause("2").text,
        explanation:
          "§2 allows subcontracting without consent. For Customer Data, §3 requires approval and §10 gives that requirement priority.",
        related: [
          {
            targetId: clause("3").id,
            quote: clause("3").text,
            reason:
              "Requires prior written approval for data-processing subcontractors",
          },
          {
            targetId: clause("10").id,
            quote: clause("10").text,
            reason: "Specifies which provision takes precedence",
          },
        ],
        sources: [],
        uncertainty:
          "Confirm whether the proposed subcontractor will access Customer Data.",
        status: "open",
      },
      ...localReview(clauses),
    ],
  };
}
