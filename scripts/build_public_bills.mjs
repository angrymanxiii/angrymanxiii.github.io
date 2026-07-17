import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const siteDirectory = resolve(scriptDirectory, "..");
const defaultSource = resolve(
  siteDirectory,
  "../bill-analysis/MI_crypto_legislation_tracker/tracker_data.json",
);
const defaultOfficialSnapshot = resolve(
  siteDirectory,
  "../bill-analysis/MI_crypto_legislation_tracker/sources/official_search_snapshot.json",
);
const sourcePath = resolve(process.argv[2] ?? defaultSource);
const outputPath = resolve(siteDirectory, "assets/data/bills.json");

const source = JSON.parse(await readFile(sourcePath, "utf8"));
const officialSnapshot = JSON.parse(await readFile(defaultOfficialSnapshot, "utf8"));

function stageFor(status) {
  const normalized = status.toLowerCase();
  if (normalized.includes("enacted") || normalized.includes("signed")) return "Enacted";
  if (normalized.includes("passed")) return "Passed chamber";
  if (normalized.includes("reading") || normalized.includes("floor")) return "Floor";
  return "Committee";
}

function officialBillUrl(objectName) {
  return `https://www.legislature.mi.gov/Bills/Bill?ObjectName=${encodeURIComponent(objectName)}`;
}

const officialBillByObjectName = new Map(
  officialSnapshot.bills.map((bill) => [bill.objectName, bill]),
);

function latestBillText(bill) {
  if (bill.billTextUrl) {
    return { url: bill.billTextUrl, label: bill.billTextLabel ?? "Current version" };
  }

  const textDocuments = (officialBillByObjectName.get(bill.objectName)?.documentLinks ?? [])
    .filter((document) =>
      document.url.includes("/htm/") &&
      /(Introduced Bill|As Passed by the|Enrolled Bill|Public Act)/i.test(document.label),
    );
  const latest = textDocuments.at(-1);
  if (!latest) return { url: officialBillUrl(bill.objectName), label: "Official bill page" };

  return {
    url: latest.url,
    label: latest.label
      .replace(/\s+(HTML|PDF)$/i, "")
      .replace(/^(House|Senate)\s+/i, ""),
  };
}

function officialSummary(bill) {
  if (!bill.analysisUrl.includes("/billanalysis/")) {
    return { url: officialBillUrl(bill.objectName), label: "Official bill page" };
  }
  return {
    url: bill.analysisUrl,
    label: bill.analysisUrl.includes("/billanalysis/Senate/") ? "SFA analysis" : "HFA analysis",
  };
}

const hearingByObjectName = new Map(
  (source.hearingSchedule?.upcomingHearings ?? []).map((hearing) => [hearing.objectName, hearing]),
);

const bills = source.coreBills.map((bill) => {
  const billText = latestBillText(bill);
  const summary = officialSummary(bill);
  return {
    id: bill.objectName,
    area: bill.area ?? "Crypto and digital assets",
    attention: bill.attention,
    bill: bill.bill,
    issue_group: bill.issueGroup,
    policy: bill.policy,
    tax_policy_signal: bill.taxPolicySignal,
    tax_fiscal: bill.taxFiscal,
    fiscal_focus: bill.fiscalFocus,
    fiscal_channel: bill.fiscalChannel,
    status: bill.status,
    stage: stageFor(bill.status),
    latest_action_date: bill.latestActionDate,
    latest_action: bill.latestAction,
    sponsor: bill.sponsor,
    related_bills: bill.relatedBills,
    next_trigger: bill.nextTrigger,
    important_notes: bill.importantNotes ?? [],
    ambiguities: bill.ambiguities ?? [],
    official_url: officialBillUrl(bill.objectName),
    bill_text_url: billText.url,
    bill_text_label: billText.label,
    summary_url: summary.url,
    summary_label: summary.label,
    upcoming_hearing: hearingByObjectName.get(bill.objectName) ?? null,
  };
});

const countStage = (stage) => bills.filter((bill) => bill.stage === stage).length;
const publicData = {
  metadata: {
    title: "Michigan Bill Tracker",
    jurisdiction: "Michigan",
    session: source.session,
    as_of: source.asOf,
    headline: source.headline.replace("No core bill", "No tracked bill"),
    disclaimer:
      "Personal public-source tracker. Not an official publication or position of the Michigan Department of Treasury or State of Michigan.",
    source_label: "Michigan Legislature",
    source_url: "https://www.legislature.mi.gov/Bills/",
    hearing_schedule_checked: source.hearingSchedule.checkedAt,
    hearing_schedule_url: source.hearingSchedule.officialUrl,
  },
  summary: {
    tracked: bills.length,
    tax_revenue: bills.filter((bill) => bill.fiscal_focus === "Tax / revenue").length,
    hearings_scheduled: bills.filter((bill) => bill.upcoming_hearing).length,
    passed_chamber: countStage("Passed chamber"),
    third_reading: bills.filter((bill) => bill.status.toLowerCase().includes("third reading")).length,
    enacted: countStage("Enacted"),
  },
  bills,
  kiosk_comparison: source.kioskComparison.map((item) => ({
    package: item.package,
    approach: item.approach,
    core_mechanics: item.coreMechanics,
    sanctions: item.sanctions,
    lead: item.lead,
    status: item.status,
    bottom_line: item.bottomLine,
  })),
  key_updates: source.keyUpdates.map(([date, billsLabel, update]) => ({
    date,
    bills: billsLabel,
    update,
  })),
};

await writeFile(outputPath, `${JSON.stringify(publicData, null, 2)}\n`, "utf8");
console.log(`Wrote ${bills.length} public bill records to ${outputPath}`);
