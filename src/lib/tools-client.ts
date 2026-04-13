// Agentic tool system - dynamically searches regulatory data

export interface ToolResult {
  toolName: string;
  status: "completed" | "failed";
  input: string;
  output: string;
  durationMs: number;
  source: string;
}

function normalizeText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function shortText(value: string, max = 180) {
  const normalized = normalizeText(value);
  return normalized.length > max ? `${normalized.slice(0, max)}...` : normalized;
}

const DATA_INDEX: Record<string, { instruction: string; output: string }[]> = {
  "DigitalLendingGuidelines": [
    { instruction: "FLDG cap", output: "Under DLG 2.0, First Loss Default Guarantee (FLDG) is capped at 5% of the portfolio. Must be maintained as 'Hard Security' (Cash, FD with lien, or Bank Guarantee)." },
    { instruction: "No-Pool Rule", output: "Funds must flow directly RE -> Borrower Account. Intermediary 'Pool Accounts' or 'LSP Nodal Accounts' strictly prohibited." },
    { instruction: "Data Residency", output: "All borrower PII and KYC data must reside on servers physically located in India." },
    { instruction: "Zero-Storage rule", output: "LSPs/DLAs cannot store biometric data, contact lists, call logs, or gallery metadata." },
    { instruction: "Unsolicited Limit Enhancements", output: "Any limit hike requires explicit, standalone borrower consent authenticated via OTP tagged 'LIMIT_ENHANCE'." },
    { instruction: "Recovery Calling Hours", output: "Borrowers can only be contacted for recovery between 08:00 AM and 07:00 PM IST." },
    { instruction: "Cooling-off Period", output: "Loans with tenure >= 7 days must offer a 72-hour cooling-off window. Exit by paying only principal + pro-rata APR." },
    { instruction: "Key Fact Statement", output: "KFS is 'Single Source of Truth'. Must include 'All-Inclusive APR'. Must be machine-readable (JSON/PDF)." },
    { instruction: "LSP-Fee-Loop", output: "Flag any NACH/UPI-Auto-Debits from borrower to LSP within 24 hours of disbursal." },
    { instruction: "Secure Consent", output: "Click-wrap insufficient. Consent must include timestamped audit trail with IP, Device ID, KFS version." },
  ],
  "CoolingOffPeriod": [
    { instruction: "minimum Cooling-Off Period", output: "For loans with tenure 7+ days, 72 hours (3 days) required. For <7 days, 24 hours." },
    { instruction: "No-Penalty exit", output: "RE prohibited from charging foreclosure fees, prepayment penalties. Only principal + pro-rata APR." },
    { instruction: "Auto-Notification", output: "RE must send automated timestamped notification (SMS/Email/Push) immediately upon disbursal." },
    { instruction: "pro-rata interest", output: "Interest = (Principal × APR × Days Utilized) / 365" },
    { instruction: "Cooling-Off compliance", output: "Compare Disbursal_Timestamp with Exit_Request_Timestamp. If <= 72 hours AND Foreclosure_Charge > 0, trigger COMPLIANCE_BREACH_TIER_1." },
  ],
  "KeyFactStatement": [
    { instruction: "KFS contents", output: "Must include: Principal, interest rate, APR, repayment schedule, penalties, foreclosure charges, insurance premium." },
    { instruction: "KFS timing", output: "Must be provided *before* loan agreement. Machine-readable format (JSON/PDF)." },
  ],
  "FirstLossDefaultGuarantee": [
    { instruction: "FLDG cap", output: "Capped at 5% of portfolio. Must be 'Hard Security' (Cash, FD with lien, or Bank Guarantee)." },
    { instruction: "Hard Security", output: "Cash, Fixed Deposit with lien, or Bank Guarantee are the only accepted forms." },
  ],
  "GrievanceRedressal": [
    { instruction: "grievance timeline", output: "Complaints resolved within 15 days. If not, provide RBI Ombudsman link." },
    { instruction: "Nodal Officer", output: "Every DLA must prominently display Nodal Grievance Redressal Officer." },
  ],
  "FairDebtCollectionRules": [
    { instruction: "recovery hours", output: "Contact only between 08:00 AM and 07:00 PM IST. Tier-1 violation outside." },
    { instruction: "harassment", output: "Multiple calls, threats, abusive language, or odd hours contact is harassment." },
  ],
  "ScaleBasedRegulation": [
    { instruction: "Scale-Based Regulation", output: "RBI categorizes NBFCs by asset size/risk - varying capital and governance requirements." },
  ],
};

function searchIndex(query: string): ToolResult[] {
  const keywords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  const results: ToolResult[] = [];

  for (const [category, entries] of Object.entries(DATA_INDEX)) {
    for (const entry of entries) {
      const text = (entry.instruction + " " + entry.output).toLowerCase();
      const matches = keywords.filter(k => text.includes(k)).length;
      
      if (matches >= 1) {
        results.push({
          toolName: category,
          status: "completed",
          input: entry.instruction,
          output: entry.output,
          durationMs: 0,
          source: category,
        });
      }
    }
  }

  return results;
}

function lookupIndex(keyword: string): ToolResult[] {
  const keywords = keyword.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  const results: ToolResult[] = [];

  for (const [category, entries] of Object.entries(DATA_INDEX)) {
    for (const entry of entries) {
      const text = (entry.instruction + " " + entry.output).toLowerCase();
      const match = keywords.some(k => text.includes(k));
      
      if (match) {
        results.push({
          toolName: category,
          status: "completed",
          input: entry.instruction,
          output: entry.output,
          durationMs: 0,
          source: category,
        });
        break;
      }
    }
  }

  return results;
}

export async function search(query: string): Promise<ToolResult> {
  const start = performance.now();
  const results = searchIndex(query);
  const durationMs = Math.max(1, Math.round(performance.now() - start));

  return {
    toolName: "search",
    status: results.length > 0 ? "completed" : "failed",
    input: query,
    output: results.length > 0 
      ? results.map(r => `[${r.source}] ${r.input}\n→ ${r.output}`).join("\n\n")
      : "No results found",
    durationMs,
    source: "data/",
  };
}

export async function lookup(keyword: string): Promise<ToolResult> {
  const start = performance.now();
  const results = lookupIndex(keyword);
  const durationMs = Math.max(1, Math.round(performance.now() - start));

  return {
    toolName: "lookup",
    status: results.length > 0 ? "completed" : "failed",
    input: keyword,
    output: results.length > 0
      ? results.map(r => `[${r.source}] ${r.input}\n→ ${r.output}`).join("\n\n")
      : `No matching rules found for "${keyword}"`,
    durationMs,
    source: "data/",
  };
}

export async function executeAllTools(query: string): Promise<ToolResult[]> {
  const keywords = query.toLowerCase();
  const results: ToolResult[] = [];

  const triggers = [
    { trigger: ["cap", "limit", "percentage", "fldg"], key: "cap limit" },
    { trigger: ["period", "days", "hour", "cooling", "72"], key: "cooling period" },
    { trigger: ["consent", "opt", "agree", "otp"], key: "consent" },
    { trigger: ["recovery", "call", "contact", "harass", "08:00"], key: "recovery" },
    { trigger: ["grievance", "complaint", "redressal", "15 days"], key: "grievance" },
    { trigger: ["kfs", "key fact", "apr"], key: "key fact" },
  ];

  for (const { trigger, key } of triggers) {
    if (trigger.some(t => keywords.includes(t))) {
      const result = await lookup(key);
      if (result.status === "completed" && result.output !== `No matching rules found for "${key}"`) {
        results.push(result);
      }
    }
  }

  if (results.length === 0) {
    const searchResult = await search(query);
    if (searchResult.status === "completed") {
      results.push(searchResult);
    }
  }

  return results;
}

export async function reflect(query: string, result: ToolResult): Promise<ToolResult> {
  const start = performance.now();
  const queryKeywords = query.toLowerCase().split(/\s+/).filter((word) => word.length > 2);
  const resultText = `${result.input} ${result.output}`.toLowerCase();
  const overlap = queryKeywords.filter((word) => resultText.includes(word)).length;
  const confidence = queryKeywords.length === 0
    ? "medium"
    : overlap >= Math.max(1, Math.floor(queryKeywords.length / 3))
      ? "high"
      : "medium";

  const output = [
    `Tool checked: ${result.toolName}`,
    `Confidence: ${confidence}`,
    `Reason: ${shortText(result.output, 140)}`,
  ].join("\n");

  return {
    toolName: "reflect",
    status: "completed",
    input: result.toolName,
    output,
    durationMs: Math.max(1, Math.round(performance.now() - start)),
    source: "reasoning",
  };
}

export async function summarize(query: string, results: ToolResult[]): Promise<ToolResult> {
  const start = performance.now();
  const uniqueEvidence = Array.from(new Map(results.map((item) => [`${item.toolName}|${item.output}`, item])).values());

  if (uniqueEvidence.length === 0) {
    return {
      toolName: "summarize",
      status: "failed",
      input: query,
      output: "No evidence available to summarize.",
      durationMs: Math.max(1, Math.round(performance.now() - start)),
      source: "reasoning",
    };
  }

  const summaryLines = uniqueEvidence.slice(0, 4).map((item, index) => {
    return `${index + 1}. ${shortText(item.output, 130)}`;
  });

  const output = [
    "Final synthesis notes:",
    ...summaryLines,
  ].join("\n");

  return {
    toolName: "summarize",
    status: "completed",
    input: query,
    output,
    durationMs: Math.max(1, Math.round(performance.now() - start)),
    source: "reasoning",
  };
}
