(() => {
  "use strict";

  const dashboard = document.querySelector(".bill-dashboard");
  if (!dashboard) return;

  const elements = {
    list: document.querySelector("#bill-list"),
    empty: document.querySelector("#empty-state"),
    count: document.querySelector("#results-count"),
    search: document.querySelector("#bill-search"),
    trackerArea: document.querySelector("#tracker-area"),
    issue: document.querySelector("#issue-filter"),
    stage: document.querySelector("#stage-filter"),
    fiscalFocus: document.querySelector("#fiscal-focus-filter"),
    attention: document.querySelector("#attention-filter"),
    sort: document.querySelector("#sort-bills"),
    clear: document.querySelector("#clear-filters"),
    copy: document.querySelector("#copy-briefing"),
    landscape: document.querySelector("#landscape-list"),
    updates: document.querySelector("#update-list"),
    landscapeTitle: document.querySelector("#policy-landscape-title"),
    landscapeDescription: document.querySelector("#policy-landscape-description"),
    updatesDescription: document.querySelector("#recent-updates-description"),
    monitoringRule: document.querySelector("#monitoring-rule"),
  };

  const state = {
    data: null,
    view: "all",
    query: "",
    trackerArea: "",
    issue: "",
    stage: "",
    fiscalFocus: "",
    attention: "",
    sort: "priority",
  };

  const attentionRank = {
    Escalate: 0,
    "Floor watch": 1,
    "Tax watch": 2,
    "Policy watch": 3,
    Monitor: 4,
  };

  const fiscalFocusRank = {
    "Tax / revenue": 0,
    "Fiscal exposure": 1,
    "Policy only": 2,
  };

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function officialUrl(value) {
    try {
      const url = new URL(value);
      if (url.protocol === "https:" && url.hostname.endsWith("legislature.mi.gov")) {
        return url.href;
      }
    } catch (_error) {
      return "#";
    }
    return "#";
  }

  function slug(value) {
    return String(value).toLowerCase().replaceAll(/[^a-z0-9]+/g, "-").replaceAll(/(^-|-$)/g, "");
  }

  function formatDate(isoDate) {
    const date = new Date(`${isoDate}T12:00:00Z`);
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    }).format(date);
  }

  function setText(selector, value) {
    const element = document.querySelector(selector);
    if (element) element.textContent = value;
  }

  function replaceSelectOptions(select, placeholder, values) {
    const placeholderOption = document.createElement("option");
    placeholderOption.value = "";
    placeholderOption.textContent = placeholder;
    select.replaceChildren(placeholderOption);
    [...new Set(values)].sort().forEach((value) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      select.append(option);
    });
  }

  function trackerAreas() {
    if (Array.isArray(state.data.tracker_areas) && state.data.tracker_areas.length) {
      return state.data.tracker_areas;
    }
    return [{
      id: "all-tracked-bills",
      label: "All tracked bills",
      headline: state.data.metadata.headline,
      landscape_title: "Policy landscape",
      landscape_description: "Tracked bills organized by what they govern and what they can teach us about potential tax design.",
      monitoring_rule: "Every tracked bill is reviewed for potential tax-design lessons. A bill enters the fiscal-note queue only when an official committee hearing is scheduled.",
      summary: state.data.summary,
      policy_landscape: state.data.policy_landscape ?? [],
    }];
  }

  function activeTrackerArea() {
    return trackerAreas().find((area) => area.id === state.trackerArea) ?? trackerAreas()[0];
  }

  function activeAreaBills() {
    const activeArea = activeTrackerArea();
    if (activeArea.id === "all-tracked-bills") return state.data.bills;
    return state.data.bills.filter((bill) => bill.tracker_area === activeArea.id);
  }

  function activeAreaUpdates() {
    return state.data.key_updates.filter((update) => !update.tracker_area || update.tracker_area === state.trackerArea);
  }

  function renderBulletList(items) {
    return `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
  }

  function renderBill(bill) {
    const detail = document.createElement("details");
    detail.className = "bill-item";
    detail.dataset.bill = bill.bill;

    const hearingPill = bill.upcoming_hearing
      ? '<span class="priority-pill hearing-pill">Hearing scheduled</span>'
      : "";
    const curatedAnalysis = bill.important_notes.length || bill.ambiguities.length
      ? `<section class="curated-analysis" aria-label="Tax and revenue review">
          <div>
            <h3>Policy summary</h3>
            <p>${escapeHtml(bill.policy)}</p>
          </div>
          <div>
            <h3>Important notes</h3>
            ${renderBulletList(bill.important_notes)}
          </div>
          <div>
            <h3>Open questions and ambiguities</h3>
            ${renderBulletList(bill.ambiguities)}
          </div>
        </section>`
      : "";
    const fiscalPill = bill.fiscal_focus === "Tax / revenue"
      ? '<span class="priority-pill revenue-pill">Tax / revenue</span>'
      : "";
    const hearingDetail = bill.upcoming_hearing
      ? `<section class="hearing-detail">
          <h3>Upcoming committee hearing</h3>
          <p><strong>${escapeHtml(bill.upcoming_hearing.committee)}</strong> on
            <time datetime="${escapeHtml(bill.upcoming_hearing.date)}">${escapeHtml(formatDate(bill.upcoming_hearing.date))}</time>${bill.upcoming_hearing.time ? ` at ${escapeHtml(bill.upcoming_hearing.time)}` : ""}${bill.upcoming_hearing.location ? `, ${escapeHtml(bill.upcoming_hearing.location)}` : ""}.
          </p>
        </section>`
      : "";
    const fiscalNoteStatus = bill.upcoming_hearing
      ? "Queued - official committee hearing scheduled"
      : "Monitoring - no official committee hearing scheduled";

    detail.innerHTML = `
      <summary>
        <span class="priority-stack">
          ${hearingPill}
          ${fiscalPill}
          <span class="attention-pill attention-${slug(bill.attention)}">${escapeHtml(bill.attention)}</span>
        </span>
        <span class="bill-identity">
          <strong>${escapeHtml(bill.bill)}</strong>
          <span>${escapeHtml(bill.issue_group)}</span>
        </span>
        <p class="bill-policy">${escapeHtml(bill.policy)}</p>
        <span class="bill-status">
          <strong>${escapeHtml(bill.status)}</strong>
          <time class="status-date" datetime="${escapeHtml(bill.latest_action_date)}">${escapeHtml(formatDate(bill.latest_action_date))}</time>
        </span>
        <a class="record-link" href="${escapeHtml(officialUrl(bill.official_url))}">Bill history</a>
      </summary>
      <div class="bill-details">
        ${hearingDetail}
        ${curatedAnalysis}
        <section class="tax-policy-signal">
          <div>
            <h3>Potential tax design relevance</h3>
            <p>${escapeHtml(bill.tax_policy_signal)}</p>
          </div>
          <p class="fiscal-note-state${bill.upcoming_hearing ? " is-queued" : ""}"><strong>Fiscal-note status</strong>${escapeHtml(fiscalNoteStatus)}</p>
        </section>
        <section class="detail-block">
          <h3>Tax and fiscal relevance</h3>
          <p>${escapeHtml(bill.tax_fiscal)}</p>
          <p class="fiscal-channel"><strong>${escapeHtml(bill.fiscal_focus)}:</strong> ${escapeHtml(bill.fiscal_channel)}</p>
        </section>
        <section class="detail-block">
          <h3>Latest official action</h3>
          <p>${escapeHtml(bill.latest_action)}</p>
        </section>
        <section class="detail-block">
          <h3>Next trigger</h3>
          <p>${escapeHtml(bill.next_trigger)}</p>
        </section>
        <div class="detail-meta">
          <span><strong>Sponsor:</strong> ${escapeHtml(bill.sponsor)}</span>
          <span><strong>Related:</strong> ${escapeHtml(bill.related_bills)}</span>
          <nav class="bill-source-links" aria-label="${escapeHtml(bill.bill)} official sources">
            <a href="${escapeHtml(officialUrl(bill.bill_text_url))}"><strong>Bill text</strong><small>${escapeHtml(bill.bill_text_label)}</small></a>
            <a href="${escapeHtml(officialUrl(bill.summary_url))}"><strong>Bill summary</strong><small>${escapeHtml(bill.summary_label)}</small></a>
            <a href="${escapeHtml(officialUrl(bill.official_url))}"><strong>Bill history</strong><small>Michigan Legislature</small></a>
          </nav>
        </div>
      </div>`;

    detail.querySelectorAll("a").forEach((link) => {
      link.target = "_blank";
      link.rel = "noopener";
      link.addEventListener("click", (event) => event.stopPropagation());
    });
    return detail;
  }

  function visibleBills() {
    const query = state.query.trim().toLowerCase();
    const filtered = activeAreaBills().filter((bill) => {
      if (state.view === "tax-revenue" && bill.fiscal_focus !== "Tax / revenue") return false;
      if (state.view === "hearing" && !bill.upcoming_hearing) return false;
      if (state.issue && bill.issue_group !== state.issue) return false;
      if (state.stage && bill.stage !== state.stage) return false;
      if (state.fiscalFocus && bill.fiscal_focus !== state.fiscalFocus) return false;
      if (state.attention && bill.attention !== state.attention) return false;
      if (!query) return true;

      const searchable = [
        bill.bill,
        bill.area,
        bill.issue_group,
        bill.policy,
        bill.tax_fiscal,
        bill.fiscal_focus,
        bill.fiscal_channel,
        bill.status,
        bill.latest_action,
        bill.sponsor,
        bill.related_bills,
      ].join(" ").toLowerCase();
      return searchable.includes(query);
    });

    return filtered.sort((a, b) => {
      if (state.sort === "latest") {
        return b.latest_action_date.localeCompare(a.latest_action_date) || a.bill.localeCompare(b.bill);
      }
      if (state.sort === "bill") return a.bill.localeCompare(b.bill, undefined, { numeric: true });
      return (
        Number(Boolean(b.upcoming_hearing)) - Number(Boolean(a.upcoming_hearing)) ||
        (fiscalFocusRank[a.fiscal_focus] ?? 99) - (fiscalFocusRank[b.fiscal_focus] ?? 99) ||
        (attentionRank[a.attention] ?? 99) - (attentionRank[b.attention] ?? 99) ||
        b.latest_action_date.localeCompare(a.latest_action_date) ||
        a.bill.localeCompare(b.bill, undefined, { numeric: true })
      );
    });
  }

  function renderBills() {
    const bills = visibleBills();
    elements.list.replaceChildren(...bills.map(renderBill));
    elements.list.setAttribute("aria-busy", "false");
    elements.empty.hidden = bills.length !== 0;
    elements.count.textContent = `${bills.length} of ${activeAreaBills().length} bills shown`;
  }

  function renderUpdates(updates) {
    const items = updates.map((update) => {
      const item = document.createElement("li");
      item.innerHTML = `
        <time class="update-date" datetime="${escapeHtml(update.date)}">${escapeHtml(formatDate(update.date))}</time>
        <span class="update-bills">${escapeHtml(update.bills)}</span>
        <span class="update-text">${escapeHtml(update.update)}</span>`;
      return item;
    });
    elements.updates.replaceChildren(...items);
  }

  function renderLandscape(areas) {
    const rows = areas.map((item) => {
      const row = document.createElement("article");
      row.className = "landscape-row";
      row.innerHTML = `
        <div class="landscape-identity">
          <h3>${escapeHtml(item.area)}</h3>
          <p>${escapeHtml(item.bill_count)} bills</p>
          <span>${escapeHtml(item.bills)}</span>
        </div>
        <div>
          <h4>Current proposals</h4>
          <p>${escapeHtml(item.current_picture)}</p>
        </div>
        <div>
          <h4>Tax design lens</h4>
          <p>${escapeHtml(item.tax_design_lens)}</p>
        </div>
        <div>
          <h4>Status</h4>
          <p>${escapeHtml(item.status)}</p>
        </div>`;
      return row;
    });
    elements.landscape.replaceChildren(...rows);
  }

  function briefingText() {
    const { metadata } = state.data;
    const activeArea = activeTrackerArea();
    const summary = activeArea.summary;
    const bills = activeAreaBills();
    const updates = activeAreaUpdates();
    const taxRevenueWatch = bills
      .filter((bill) => bill.fiscal_focus === "Tax / revenue")
      .sort((a, b) => Number(Boolean(b.upcoming_hearing)) - Number(Boolean(a.upcoming_hearing)) || (attentionRank[a.attention] ?? 99) - (attentionRank[b.attention] ?? 99))
      .map((bill) => `${bill.bill}: ${bill.status}`)
      .join("; ");
    const hearingPriority = summary.hearings_scheduled
      ? bills.filter((bill) => bill.upcoming_hearing).map((bill) => `${bill.bill} (${formatDate(bill.upcoming_hearing.date)})`).join("; ")
      : `None scheduled as of ${formatDate(metadata.hearing_schedule_checked)}`;
    return [
      `Michigan Tax Policy Tracker - ${activeArea.label}, checked ${formatDate(metadata.as_of)}.`,
      `${summary.tracked} bills tracked; ${summary.tax_revenue} directly affect tax or revenue; ${summary.enacted} enacted; ${summary.passed_chamber} passed a chamber.`,
      `Fiscal-note queue: ${hearingPriority}.`,
      `Tax/revenue watch: ${taxRevenueWatch}.`,
      updates.length ? `Latest update: ${updates[0].bills} - ${updates[0].update}` : "No material updates are recorded for this tax area.",
      "Personal public-source tracker; not an official Treasury or State of Michigan publication.",
    ].join("\n");
  }

  async function copyBriefing() {
    try {
      await navigator.clipboard.writeText(briefingText());
      elements.copy.textContent = "Copied";
    } catch (_error) {
      elements.copy.textContent = "Copy failed";
    }
    window.setTimeout(() => {
      elements.copy.textContent = "Copy briefing";
    }, 1800);
  }

  function resetFilters() {
    state.query = "";
    state.issue = "";
    state.stage = "";
    state.fiscalFocus = "";
    state.attention = "";
    state.sort = "priority";
    elements.search.value = "";
    elements.issue.value = "";
    elements.stage.value = "";
    elements.fiscalFocus.value = "";
    elements.attention.value = "";
    elements.sort.value = "priority";
    renderBills();
  }

  function renderAreaSummary() {
    const activeArea = activeTrackerArea();
    const summary = activeArea.summary;
    setText("#dashboard-headline", activeArea.headline);
    setText("#metric-tax-revenue", summary.tax_revenue);
    setText("#metric-hearings", summary.hearings_scheduled);
    setText("#metric-passed", summary.passed_chamber);
    setText("#metric-enacted", summary.enacted);
    elements.landscapeTitle.textContent = activeArea.landscape_title;
    elements.landscapeDescription.textContent = activeArea.landscape_description;
    elements.updatesDescription.textContent = `Official history changes affecting ${activeArea.label}.`;
    elements.monitoringRule.textContent = activeArea.monitoring_rule;

    if (summary.hearings_scheduled) {
      setText("#hearing-watch-title", `${summary.hearings_scheduled} tracked ${summary.hearings_scheduled === 1 ? "bill is" : "bills are"} in the fiscal-note queue.`);
      setText("#hearing-watch-detail", "Each has an upcoming hearing on the official committee schedule.");
    } else {
      setText("#hearing-watch-title", "Fiscal-note queue is empty.");
      setText("#hearing-watch-detail", `No tracked bill had an upcoming official hearing when checked ${formatDate(state.data.metadata.hearing_schedule_checked)}.`);
    }

    renderUpdates(activeAreaUpdates());
    renderLandscape(activeArea.policy_landscape);
  }

  function refreshFiltersForArea() {
    const bills = activeAreaBills();
    replaceSelectOptions(elements.issue, "All issues", bills.map((bill) => bill.issue_group));
    replaceSelectOptions(elements.stage, "All stages", bills.map((bill) => bill.stage));
    replaceSelectOptions(elements.fiscalFocus, "All fiscal levels", bills.map((bill) => bill.fiscal_focus));
    replaceSelectOptions(elements.attention, "All levels", bills.map((bill) => bill.attention));
  }

  function bindControls() {
    elements.search.addEventListener("input", () => {
      state.query = elements.search.value;
      renderBills();
    });
    elements.trackerArea.addEventListener("change", () => {
      state.trackerArea = elements.trackerArea.value;
      resetFilters();
      refreshFiltersForArea();
      renderAreaSummary();
    });
    elements.issue.addEventListener("change", () => {
      state.issue = elements.issue.value;
      renderBills();
    });
    elements.stage.addEventListener("change", () => {
      state.stage = elements.stage.value;
      renderBills();
    });
    elements.fiscalFocus.addEventListener("change", () => {
      state.fiscalFocus = elements.fiscalFocus.value;
      renderBills();
    });
    elements.attention.addEventListener("change", () => {
      state.attention = elements.attention.value;
      renderBills();
    });
    elements.sort.addEventListener("change", () => {
      state.sort = elements.sort.value;
      renderBills();
    });
    elements.clear.addEventListener("click", resetFilters);
    elements.copy.addEventListener("click", copyBriefing);

    document.querySelectorAll(".view-button").forEach((button) => {
      button.addEventListener("click", () => {
        state.view = button.dataset.view;
        document.querySelectorAll(".view-button").forEach((candidate) => {
          const active = candidate === button;
          candidate.classList.toggle("is-active", active);
          candidate.setAttribute("aria-pressed", String(active));
        });
        renderBills();
      });
    });
  }

  function initialize(data) {
    state.data = data;
    setText("#as-of-date", formatDate(data.metadata.as_of));
    setText("#notes-as-of", formatDate(data.metadata.as_of));
    document.querySelector("#as-of-date").dateTime = data.metadata.as_of;
    document.querySelector("#notes-as-of").dateTime = data.metadata.as_of;
    const areas = trackerAreas();
    areas.forEach((area) => {
      const option = document.createElement("option");
      option.value = area.id;
      option.textContent = area.label;
      elements.trackerArea.append(option);
    });
    state.trackerArea = areas[0].id;
    elements.trackerArea.value = state.trackerArea;

    const sourceLink = document.querySelector("#legislature-source");
    sourceLink.textContent = data.metadata.source_label;
    sourceLink.href = officialUrl(data.metadata.source_url);
    sourceLink.target = "_blank";
    sourceLink.rel = "noopener";

    ["#schedule-source", "#hearing-schedule-source"].forEach((selector) => {
      const link = document.querySelector(selector);
      link.href = officialUrl(data.metadata.hearing_schedule_url);
      link.target = "_blank";
      link.rel = "noopener";
    });

    refreshFiltersForArea();
    renderBills();
    renderAreaSummary();
    bindControls();
  }

  fetch(dashboard.dataset.billsSource)
    .then((response) => {
      if (!response.ok) throw new Error(`Bill data request failed with ${response.status}`);
      return response.json();
    })
    .then(initialize)
    .catch((error) => {
      console.error(error);
      elements.list.setAttribute("aria-busy", "false");
      elements.count.textContent = "Bill records could not be loaded.";
      elements.empty.hidden = false;
      elements.empty.textContent = "The public tracker data is temporarily unavailable.";
    });
})();
