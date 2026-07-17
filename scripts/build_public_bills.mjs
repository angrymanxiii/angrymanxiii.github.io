import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const siteDirectory = resolve(scriptDirectory, "..");
const defaultSource = resolve(
  siteDirectory,
  "../bill-analysis/MI_crypto_legislation_tracker/tracker_data.json",
);
const sourcePath = resolve(process.argv[2] ?? defaultSource);
const outputPath = resolve(siteDirectory, "assets/data/bills.json");

const source = JSON.parse(await readFile(sourcePath, "utf8"));

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

const hearingByObjectName = new Map(
  (source.hearingSchedule?.upcomingHearings ?? []).map((hearing) => [hearing.objectName, hearing]),
);

const bills = source.coreBills.map((bill) => ({
  id: bill.objectName,
  area: bill.area ?? "Crypto and digital assets",
  attention: bill.attention,
  bill: bill.bill,
  issue_group: bill.issueGroup,
  policy: bill.policy,
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
  official_url: officialBillUrl(bill.objectName),
  analysis_url: bill.analysisUrl,
  upcoming_hearing: hearingByObjectName.get(bill.objectName) ?? null,
}));

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
