// Routing and rendering. Render functions return HTML strings so they can be
// tested in Node; the browser-only code is at the bottom and only runs in a browser.
import {
  CRISIS,
  FEEDBACK_FORM_URL,
  INITIAL_RESULTS,
  REPORTS_STORAGE_KEY,
  VERIFIED_UNDER_DAYS,
  HIDE_AFTER_DAYS,
} from "./config.js";
import {
  STATUS,
  getStatus,
  isVisible,
  matchListings,
  applyFilters,
  emptyFilters,
  hasActiveFilters,
  statusBadgeText,
  confirmedOnText,
  verificationSummary,
  agesText,
  modeText,
  newClientsText,
} from "./logic.js";

// ---------- Words ----------

export const KINDS = [
  {
    id: "support-now",
    label: "Talking to someone today",
    about: "For when you've had a hard day and want to talk with someone now. These are phone lines and chats. No appointment needed.",
    cost: "Usually free.",
  },
  {
    id: "short-term",
    label: "Short-term counseling",
    about: "A few visits to work through stress, a breakup, or pressure from school or family.",
    cost: "Free to low cost at many places. Call to confirm.",
  },
  {
    id: "ongoing",
    label: "Ongoing therapy",
    about: "Regular visits, often once a week, for when you've felt down or worried for weeks and want steady support.",
    cost: "Uses insurance, or a sliding scale based on what you earn. Call to confirm.",
  },
  {
    id: "medication",
    label: "A medication evaluation",
    about: "A visit with a prescriber to talk about whether medicine might help. You decide together.",
    cost: "Often uses insurance. Some clinics are free or use a sliding scale. Call to confirm.",
  },
];

export const COVERAGE = [
  {
    id: "usf-plan",
    label: "USF student health insurance plan",
    note: "The plan you can buy through USF. Your cost depends on the visit.",
  },
  {
    id: "kaiser",
    label: "Kaiser Permanente",
    note: "Often through a parent's job. Kaiser has its own clinics.",
  },
  {
    id: "medi-cal",
    label: "Medi-Cal",
    note: "California's free or low-cost coverage. Many visits cost nothing.",
  },
  {
    id: "out-of-state",
    label: "A plan from another state",
    note: "CAPS therapy stops while you're outside California, so plan ahead for breaks.",
  },
  {
    id: "uninsured",
    label: "No insurance, or I'd rather not use it",
    note: "We'll show free and sliding-scale options. Sliding scale means you pay based on what you earn.",
  },
  {
    id: "not-sure",
    label: "I'm not sure",
    note: "Check your insurance card or ask a parent. For now, we'll show options that don't depend on insurance.",
  },
];

export const PATHS = {
  soon: "I need to talk to someone soon",
  ongoing: "I want ongoing therapy or medication",
  unsure: "I'm not sure what I need",
};

export const FILTER_GROUPS = [
  {
    id: "cost",
    label: "Cost",
    options: [
      { value: "free", label: "Free" },
      { value: "sliding", label: "Sliding scale" },
      { value: "insurance", label: "Uses insurance" },
    ],
  },
  {
    id: "format",
    label: "Format",
    options: [
      { value: "online", label: "Online" },
      { value: "in-person", label: "In person" },
    ],
  },
  {
    id: "language",
    label: "Language",
    options: ["English", "Spanish", "Cantonese", "Mandarin", "Tagalog", "Vietnamese"].map(
      (l) => ({ value: l, label: l })
    ),
  },
];

const REPORT_REASONS = [
  { value: "number", label: "The number didn't work" },
  { value: "not-taking", label: "They're not taking new clients" },
  { value: "cost", label: "Insurance or cost was wrong" },
  { value: "other", label: "Something else" },
];

const kindLabel = (id) => KINDS.find((k) => k.id === id)?.label ?? "";
const coverageLabel = (id) => COVERAGE.find((c) => c.id === id)?.label ?? "";

// ---------- Helpers ----------

export function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function telHref(display) {
  return "tel:+1" + String(display).replace(/\D/g, "");
}

export function freshState() {
  return {
    path: null,
    kind: null,
    coverage: null,
    filters: emptyFilters(),
    showAll: false,
    filtersOpen: false,
    reportSentFor: null,
  };
}

export function parseHash(hash) {
  const clean = String(hash || "").replace(/^#\/?/, "");
  const [name, id] = clean.split("/");
  const known = ["start", "danger", "kinds", "coverage", "results", "listing", "report", "how-we-verify"];
  if (!known.includes(name)) return { name: "start", id: null };
  return { name, id: id ? decodeURIComponent(id) : null };
}

function isSafeHttpUrl(url) {
  return /^https?:\/\/[^\s"'<>]+$/i.test(String(url || ""));
}

// ---------- Shared pieces ----------

export function crisisBar() {
  return `<aside class="crisis-bar" aria-label="Crisis help">
  <p><strong>In danger now?</strong>
    <a href="${CRISIS.emergency.tel}">Call 911</a> ·
    <a href="${CRISIS.lifeline.tel}" aria-label="Call 988">Call</a> or <a href="${CRISIS.lifeline.sms}" aria-label="Text 988">text</a> 988 ·
    CAPS 24/7: <a href="${CRISIS.capsAllHours.tel}" aria-label="Call CAPS All Hours at ${CRISIS.capsAllHours.display}">${CRISIS.capsAllHours.display}</a></p>
</aside>`;
}

function footer(feedbackUrl) {
  const feedback = isSafeHttpUrl(feedbackUrl)
    ? `<li><a href="${esc(feedbackUrl)}" target="_blank" rel="noopener noreferrer">Give feedback on this prototype<span class="visually-hidden"> (opens in a new tab)</span></a></li>`
    : "";
  return `<footer class="site-footer">
  <div class="wrap">
    <ul class="footer-links">
      <li><a href="#/how-we-verify">How we verify</a></li>
      ${feedback}
    </ul>
    <p>A student project for the Horizon Collective at USF. Not an official USF or CAPS service.</p>
  </div>
</footer>`;
}

function layout(main, ctx) {
  return `<a class="skip-link" href="#main">Skip to main content</a>
<div class="proto-banner" role="note">Prototype for class testing. Listings are made-up samples. In an emergency, call 911.</div>
${crisisBar()}
<header class="site-header">
  <div class="wrap header-row">
    <a class="brand" href="#/start">Front Door</a>
    <button type="button" class="btn btn-quiet" data-action="start-over" data-key="start-over">Start over</button>
  </div>
</header>
<main id="main" class="wrap" tabindex="-1">
${main}
</main>
${footer(ctx.feedbackUrl ?? FEEDBACK_FORM_URL)}`;
}

function badge(listing) {
  const status = getStatus(listing);
  const cls = status === STATUS.DUE ? "badge badge-due" : "badge badge-ok";
  return `<p class="${cls}"><span class="badge-dot" aria-hidden="true"></span>${esc(statusBadgeText(listing))}</p>`;
}

function sampleTag() {
  return `<span class="tag">Sample</span>`;
}

function facts(listing, { full = false } = {}) {
  const rows = [
    ["Cost", listing.cost_note],
    ["Ages", agesText(listing)],
    ["Languages", listing.languages.join(", ")],
    ["How", modeText(listing)],
  ];
  if (full) rows.push(["Area", listing.area || "Online only"]);
  rows.push(["Openings", newClientsText(listing)]);
  return `<dl class="facts">${rows
    .map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`)
    .join("")}</dl>`;
}

function realOptions(heading = "Talk to someone now, any time") {
  return `<section class="real-options" aria-labelledby="real-options-h">
  <h2 id="real-options-h">${heading}</h2>
  <p class="muted">These are real, free, and open 24/7.</p>
  <ul class="real-list">
    <li class="real-card">
      <h3>988 Suicide &amp; Crisis Lifeline</h3>
      <p>Free. Call or text any time, day or night. You don't have to be in danger to reach out.</p>
      <div class="btn-row">
        <a class="btn btn-primary" href="${CRISIS.lifeline.tel}">Call 988</a>
        <a class="btn btn-secondary" href="${CRISIS.lifeline.sms}">Text 988</a>
      </div>
    </li>
    <li class="real-card">
      <h3>CAPS All Hours</h3>
      <p>Free for USF students. Talk with a counselor by phone any time.</p>
      <div class="btn-row">
        <a class="btn btn-primary" href="${CRISIS.capsAllHours.tel}">Call ${CRISIS.capsAllHours.display}</a>
      </div>
    </li>
  </ul>
</section>`;
}

// ---------- Screens ----------

function startScreen() {
  return `<h1 tabindex="-1">What's going on?</h1>
<p class="lead">Pick the one that fits best. There are no wrong answers, and you can start over any time.</p>
<ul class="choice-list">
  <li><a class="choice choice-urgent" href="#/danger" data-key="path-danger">
    <span class="choice-title">I'm not safe right now</span>
    <span class="choice-note">Get help right away.</span></a></li>
  <li><a class="choice" href="#/results" data-action="set-path" data-path="soon" data-key="path-soon">
    <span class="choice-title">${PATHS.soon}</span>
    <span class="choice-note">See free 24/7 options and counseling you can start soon.</span></a></li>
  <li><a class="choice" href="#/coverage" data-action="set-path" data-path="ongoing" data-key="path-ongoing">
    <span class="choice-title">${PATHS.ongoing}</span>
    <span class="choice-note">Find care that keeps going, and a way to pay for it.</span></a></li>
  <li><a class="choice" href="#/kinds" data-action="set-path" data-path="unsure" data-key="path-unsure">
    <span class="choice-title">${PATHS.unsure}</span>
    <span class="choice-note">See the four kinds of help in plain words.</span></a></li>
</ul>
<p class="muted small">We don't ask for your name, and we don't save your answers.</p>`;
}

function dangerScreen() {
  return `<h1 tabindex="-1">Get help right now</h1>
<div class="danger-actions">
  <a class="btn btn-danger btn-big" href="${CRISIS.emergency.tel}">Call 911</a>
  <a class="btn btn-primary btn-big" href="${CRISIS.lifeline.tel}">Call 988</a>
  <a class="btn btn-primary btn-big" href="${CRISIS.lifeline.sms}">Text 988</a>
  <a class="btn btn-primary btn-big" href="${CRISIS.capsAllHours.tel}">Call CAPS All Hours<span class="btn-sub">${CRISIS.capsAllHours.display}</span></a>
</div>
<p class="danger-line">If you can, stay with someone you trust.</p>`;
}

function kindsScreen() {
  const cards = KINDS.map(
    (k) => `<li class="card kind-card">
    <h2>${k.label}</h2>
    <p>${k.about}</p>
    <p><strong>Cost:</strong> ${k.cost}</p>
    <a class="btn btn-primary" href="#/coverage" data-action="set-kind" data-kind="${k.id}" data-key="kind-${k.id}">Continue with this<span class="visually-hidden">: ${k.label}</span></a>
  </li>`
  ).join("");
  return `<h1 tabindex="-1">Four kinds of help</h1>
<p class="lead">It's okay not to know. Here's what each kind is like. Pick the one that sounds closest. You can change it later.</p>
<ul class="card-list">${cards}</ul>`;
}

function coverageScreen(ctx) {
  const { state } = ctx;
  const chosenKind = state.kind ? `<p class="answer-note">You picked: <strong>${kindLabel(state.kind)}</strong>. <a href="#/kinds">Change</a></p>` : "";
  const items = COVERAGE.map(
    (c) => `<li><a class="choice" href="#/results" data-action="set-coverage" data-coverage="${c.id}" data-key="cov-${c.id}"${
      state.coverage === c.id ? ' aria-current="true"' : ""
    }>
    <span class="choice-title">${esc(c.label)}</span>
    <span class="choice-note">${esc(c.note)}</span></a></li>`
  ).join("");
  return `<h1 tabindex="-1">How will you pay for care?</h1>
${chosenKind}
<p class="lead">This helps us show options you can afford. We don't save your answer.</p>
<ul class="choice-list">${items}</ul>`;
}

function chip(group, value, label, pressed) {
  return `<button type="button" class="chip" aria-pressed="${pressed}" data-action="toggle-filter" data-group="${group}" data-value="${esc(value)}" data-key="chip-${group}-${esc(value)}">${esc(label)}</button>`;
}

function filtersBlock(filters, open) {
  const groups = FILTER_GROUPS.map(
    (g) => `<div class="chip-group" role="group" aria-labelledby="fg-${g.id}">
    <span class="chip-group-label" id="fg-${g.id}">${g.label}</span>
    <div class="chips">${g.options
      .map((o) => chip(g.id, o.value, o.label, filters[g.id].includes(o.value)))
      .join("")}</div>
  </div>`
  ).join("");
  const lgbtq = `<div class="chip-group" role="group" aria-labelledby="fg-lgbtq">
    <span class="chip-group-label" id="fg-lgbtq">Identity</span>
    <div class="chips">${chip("lgbtq", "true", "LGBTQ+ affirming", filters.lgbtq)}</div>
  </div>`;
  const clear = hasActiveFilters(filters)
    ? `<button type="button" class="btn btn-quiet" data-action="clear-filters" data-key="clear-filters">Clear filters</button>`
    : "";
  return `<details class="filters"${open || hasActiveFilters(filters) ? " open" : ""}>
  <summary data-key="filters-summary">Filter results${hasActiveFilters(filters) ? " (on)" : ""}</summary>
  <div class="filters-body">${groups}${lgbtq}${clear}</div>
</details>`;
}

function listingCard(l) {
  return `<li class="card listing-card">
  <h3 class="card-title"><a href="#/listing/${encodeURIComponent(l.id)}" data-key="card-${esc(l.id)}">${esc(l.name)}</a> ${sampleTag()}</h3>
  ${badge(l)}
  <p>${esc(l.summary)}</p>
  ${facts(l)}
  <a class="btn btn-secondary" href="#/listing/${encodeURIComponent(l.id)}">See details and what to say<span class="visually-hidden">: ${esc(l.name)}</span></a>
</li>`;
}

function answersSummary(state) {
  const parts = [];
  if (state.path) parts.push(esc(PATHS[state.path]));
  if (state.kind) parts.push(kindLabel(state.kind));
  if (state.coverage && state.path !== "soon") parts.push(esc(coverageLabel(state.coverage)));
  if (!parts.length) return `<p class="answer-note">Showing all sample options. <a href="#/start">Answer a few questions</a> to narrow them down.</p>`;
  const change = state.path === "soon" ? "#/start" : "#/coverage";
  return `<p class="answer-note">Your answers: <strong>${parts.join(" · ")}</strong>. <a href="${change}">Change</a></p>`;
}

function coverageSelect(state) {
  const opts = [`<option value="">Any way to pay</option>`]
    .concat(
      COVERAGE.map(
        (c) => `<option value="${c.id}"${state.coverage === c.id ? " selected" : ""}>${esc(c.label)}</option>`
      )
    )
    .join("");
  const note = state.coverage ? `<p class="muted small">${esc(COVERAGE.find((c) => c.id === state.coverage).note)}</p>` : "";
  return `<div class="field">
  <label for="coverage-filter">How will you pay? (optional)</label>
  <select id="coverage-filter" data-action="set-coverage-filter" data-key="coverage-filter">${opts}</select>
  ${note}
</div>`;
}

export function resultsModel(ctx) {
  const { listings, state } = ctx;
  const matched = matchListings(listings, {
    path: state.path,
    kind: state.kind,
    coverage: state.coverage,
  });
  const filtered = applyFilters(matched, state.filters);
  const shown = state.showAll ? filtered : filtered.slice(0, INITIAL_RESULTS);
  return { matched, filtered, shown };
}

function resultsScreen(ctx) {
  const { state } = ctx;
  const { filtered, shown } = resultsModel(ctx);
  const isSoon = state.path === "soon";
  const kindNote = state.kind
    ? `<p class="muted small">${kindLabel(state.kind)} options are listed first.</p>`
    : "";

  let list;
  if (!filtered.length) {
    list = `<div class="empty" role="status">
  <h2>No sample options match all of that</h2>
  <p>Try removing a filter${isSoon && state.coverage ? " or choosing “Any way to pay”" : ""}. You can also reach someone now:</p>
</div>
${isSoon ? "" : realOptions("You can still talk to someone now")}`;
  } else {
    const more =
      filtered.length > shown.length
        ? `<button type="button" class="btn btn-secondary btn-wide" data-action="show-more" data-key="show-more">Show ${filtered.length - shown.length} more</button>`
        : "";
    list = `<ul class="card-list">${shown.map(listingCard).join("")}</ul>${more}`;
  }

  return `<h1 tabindex="-1">${isSoon ? "Help you can reach soon" : "Options for you"}</h1>
${answersSummary(state)}
${isSoon ? realOptions() : ""}
<section aria-labelledby="sample-h">
  <h2 id="sample-h">${isSoon ? "Support now and short-term counseling" : "Matching options"}</h2>
  <p class="muted small">Every option was confirmed by our team in the last ${HIDE_AFTER_DAYS} days. Costs and openings can change, so call to confirm.</p>
  ${isSoon ? coverageSelect(state) : ""}
  ${filtersBlock(state.filters, state.filtersOpen)}
  <p class="result-count" role="status" aria-live="polite">Showing ${shown.length} of ${filtered.length} ${filtered.length === 1 ? "option" : "options"}.</p>
  ${kindNote}
  ${list}
</section>`;
}

function backToResults(state) {
  return state.path || state.coverage
    ? `<p><a href="#/results">← Back to your results</a></p>`
    : `<p><a href="#/results">← See all options</a></p>`;
}

function notAvailable(listing, state) {
  if (!listing) {
    return `<h1 tabindex="-1">We couldn't find that listing</h1>
<p>It may have been removed. <a href="#/results">See the options we can show you</a>.</p>`;
  }
  return `<h1 tabindex="-1">This listing is hidden right now</h1>
<p>We hide any option we haven't confirmed in the last ${HIDE_AFTER_DAYS} days, or that has a problem we've confirmed. That way you only see options that should work.</p>
<p><a href="#/how-we-verify">How we verify</a></p>
${backToResults(state)}`;
}

function listingScreen(ctx, id) {
  const { listings, state, today } = ctx;
  const l = listings.find((x) => x.id === id);
  if (!l || !isVisible(l)) return notAvailable(l, state);
  return `${backToResults(state)}
<h1 tabindex="-1">${esc(l.name)} ${sampleTag()}</h1>
${badge(l)}
<p class="lead">${esc(l.summary)}</p>
${facts(l, { full: true })}
<section class="panel" aria-labelledby="contact-h">
  <h2 id="contact-h">How to start</h2>
  <p>${esc(l.how_to_start)}</p>
  <div class="btn-row">
    <a class="btn btn-primary" href="${telHref(l.phone)}">Call ${esc(l.phone)}</a>
    <a class="btn btn-secondary" href="${esc(l.web)}" target="_blank" rel="noopener noreferrer">Website<span class="visually-hidden"> (opens in a new tab)</span></a>
  </div>
  <p class="muted small">This is a made-up sample, so the number and website aren't real.</p>
</section>
<section class="script-box" aria-labelledby="script-h">
  <h2 id="script-h">What to say when you call</h2>
  <p id="script-text">${esc(l.script)}</p>
  <button type="button" class="btn btn-secondary" data-action="copy" data-target="script-text" data-key="copy">Copy</button>
  <p class="copy-status small" role="status" aria-live="polite"></p>
</section>
<p class="confirmed">${esc(confirmedOnText(l, today))}. Call to confirm cost and openings.</p>
<a class="btn btn-quiet" href="#/report/${encodeURIComponent(l.id)}" data-key="report-link">Report a problem</a>`;
}

function reportScreen(ctx, id) {
  const { listings, state } = ctx;
  const l = listings.find((x) => x.id === id);
  if (!l || !isVisible(l)) return notAvailable(l, state);
  if (state.reportSentFor === id) {
    return `<h1 tabindex="-1">Thanks for telling us</h1>
<p class="lead" role="status">Thanks. In the real guide, this goes to our audit team, who re-check the listing and hide it until it's fixed.</p>
<p class="muted small">In this prototype, your report is saved only on this device.</p>
<div class="btn-row">
  <a class="btn btn-primary" href="#/listing/${encodeURIComponent(l.id)}">Back to the listing</a>
  <a class="btn btn-secondary" href="#/results">Back to results</a>
</div>`;
  }
  const radios = REPORT_REASONS.map(
    (r, i) => `<div class="radio">
    <input type="radio" id="reason-${r.value}" name="reason" value="${r.value}"${i === 0 ? " required" : ""}>
    <label for="reason-${r.value}">${r.label}</label>
  </div>`
  ).join("");
  return `<p><a href="#/listing/${encodeURIComponent(l.id)}">← Back to the listing</a></p>
<h1 tabindex="-1">Report a problem</h1>
<p class="lead">With: <strong>${esc(l.name)}</strong></p>
<form class="report-form" data-action="report" data-id="${esc(l.id)}" novalidate>
  <fieldset>
    <legend>What went wrong?</legend>
    ${radios}
    <p class="form-error small" id="reason-error" role="alert" hidden>Please pick one.</p>
  </fieldset>
  <div class="field">
    <label for="report-note">Anything else? (optional)</label>
    <p class="muted small" id="note-hint">Please don't include your name or anything about your health.</p>
    <textarea id="report-note" name="note" rows="4" maxlength="500" aria-describedby="note-hint"></textarea>
  </div>
  <button type="submit" class="btn btn-primary" data-key="report-submit">Send report</button>
</form>`;
}

export function verifySentence(summary) {
  const parts = [`Showing ${summary.visible} of ${summary.total} sample listings.`];
  const phrases = {
    [STATUS.STALE]: `not confirmed in ${HIDE_AFTER_DAYS} days`,
    [STATUS.ERROR]: "problem confirmed",
    [STATUS.UNREACHABLE]: "we couldn't reach them",
    [STATUS.UNVERIFIED]: "not confirmed yet",
  };
  for (const [status, phrase] of Object.entries(phrases)) {
    const n = summary.counts[status];
    if (n) parts.push(`${n} hidden: ${phrase}.`);
  }
  return parts.join(" ");
}

function verifyScreen(ctx) {
  const summary = verificationSummary(ctx.listings);
  const hiddenList = summary.hidden.length
    ? `<ul class="hidden-list">${summary.hidden
        .map(
          (h) => `<li><strong>${esc(h.listing.name)}</strong> ${sampleTag()}<br><span class="muted">Hidden: ${esc(h.reason)}${
            Number.isInteger(h.listing.verified_days_ago) ? ` (last confirmed ${h.listing.verified_days_ago} days ago)` : ""
          }</span></li>`
        )
        .join("")}</ul>`
    : `<p>No listings are hidden right now.</p>`;
  return `<h1 tabindex="-1">How we verify</h1>
<p class="lead">We only show options our team has checked recently, so you don't waste a call.</p>
<ol class="steps">
  <li>We call every listing every 60 to 90 days to check the phone number, cost, and whether they take new clients.</li>
  <li>Listings confirmed in the last ${VERIFIED_UNDER_DAYS} days show as <span class="badge badge-ok badge-inline"><span class="badge-dot" aria-hidden="true"></span>Confirmed</span>.</li>
  <li>From ${VERIFIED_UNDER_DAYS} to ${HIDE_AFTER_DAYS} days, they show <span class="badge badge-due badge-inline"><span class="badge-dot" aria-hidden="true"></span>Re-check due</span>. They should still work, but call to confirm.</li>
  <li>After ${HIDE_AFTER_DAYS} days, or once someone reports a problem and we confirm it, the listing is hidden until we confirm it again.</li>
</ol>
<section class="panel" aria-labelledby="live-h">
  <h2 id="live-h">Right now in this prototype</h2>
  <p class="verify-counts">${esc(verifySentence(summary))}</p>
  <h3>Hidden listings</h3>
  ${hiddenList}
</section>
<p class="muted small">Front Door doesn't give advice or diagnose anything. It helps you find a place to call.</p>`;
}

// ---------- Router ----------

export const ROUTE_TITLES = {
  start: "What's going on?",
  danger: "Get help right now",
  kinds: "Four kinds of help",
  coverage: "How will you pay for care?",
  results: "Your options",
  listing: "Listing",
  report: "Report a problem",
  "how-we-verify": "How we verify",
};

export function renderMain(route, ctx) {
  switch (route.name) {
    case "danger": return dangerScreen();
    case "kinds": return kindsScreen();
    case "coverage": return coverageScreen(ctx);
    case "results": return resultsScreen(ctx);
    case "listing": return listingScreen(ctx, route.id);
    case "report": return reportScreen(ctx, route.id);
    case "how-we-verify": return verifyScreen(ctx);
    default: return startScreen();
  }
}

export function renderScreen(route, ctx) {
  return layout(renderMain(route, ctx), ctx);
}

// ---------- Browser only ----------

function saveReport(report) {
  try {
    const all = JSON.parse(localStorage.getItem(REPORTS_STORAGE_KEY) || "[]");
    all.push(report);
    localStorage.setItem(REPORTS_STORAGE_KEY, JSON.stringify(all));
    return true;
  } catch {
    return false;
  }
}

function startBrowser() {
  const root = document.getElementById("app");
  let listings = [];
  let state = freshState();
  let lastRouteKey = null;

  function render() {
    const route = parseHash(location.hash);
    const routeKey = `${route.name}/${route.id ?? ""}`;
    const focusKey = document.activeElement?.dataset?.key;
    root.innerHTML = renderScreen(route, { listings, state, today: new Date() });
    document.title = `${ROUTE_TITLES[route.name]} · Front Door (prototype)`;
    if (routeKey !== lastRouteKey) {
      // New screen: go to the top and move focus to the heading.
      window.scrollTo(0, 0);
      if (lastRouteKey !== null) root.querySelector("h1")?.focus();
      lastRouteKey = routeKey;
    } else if (focusKey) {
      // Same screen re-rendered (for example a filter chip): keep focus in place.
      root.querySelector(`[data-key="${CSS.escape(focusKey)}"]`)?.focus();
    }
  }

  function goTo(hash) {
    if (location.hash === hash) render();
    else location.hash = hash;
  }

  root.addEventListener("click", (e) => {
    const el = e.target.closest("[data-action]");
    if (!el || el.tagName === "FORM" || el.tagName === "SELECT") return;
    const action = el.dataset.action;
    if (action === "start-over") {
      state = freshState();
      lastRouteKey = "__reset"; // forces focus to move to the heading
      goTo("#/start");
    } else if (action === "set-path") {
      state = { ...freshState(), path: el.dataset.path };
    } else if (action === "set-kind") {
      state.path = "unsure";
      state.kind = el.dataset.kind;
    } else if (action === "set-coverage") {
      if (!state.path) state.path = "ongoing";
      state.coverage = el.dataset.coverage;
      state.showAll = false;
    } else if (action === "toggle-filter") {
      const { group, value } = el.dataset;
      if (group === "lgbtq") state.filters.lgbtq = !state.filters.lgbtq;
      else {
        const list = state.filters[group];
        state.filters[group] = list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
      }
      state.showAll = false;
      render();
    } else if (action === "clear-filters") {
      state.filters = emptyFilters();
      state.showAll = false;
      render();
      root.querySelector('[data-key="filters-summary"]')?.focus();
    } else if (action === "show-more") {
      const before = resultsModel({ listings, state }).shown.length;
      state.showAll = true;
      render();
      // Move focus to the first newly shown card.
      root.querySelectorAll(".listing-card .card-title a")[before]?.focus();
    } else if (action === "copy") {
      const text = document.getElementById(el.dataset.target)?.textContent ?? "";
      const status = root.querySelector(".copy-status");
      const done = (msg) => { if (status) status.textContent = msg; };
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(text).then(
          () => done("Copied."),
          () => done("Couldn't copy. Press and hold the words to copy them.")
        );
      } else {
        done("Couldn't copy. Press and hold the words to copy them.");
      }
    }
  });

  root.addEventListener("change", (e) => {
    const el = e.target;
    if (el.dataset?.action === "set-coverage-filter") {
      state.coverage = el.value || null;
      state.showAll = false;
      render();
    }
  });

  root.addEventListener("submit", (e) => {
    const form = e.target.closest('form[data-action="report"]');
    if (!form) return;
    e.preventDefault();
    const reason = form.querySelector('input[name="reason"]:checked')?.value;
    const error = form.querySelector("#reason-error");
    if (!reason) {
      error.hidden = false;
      form.querySelector('input[name="reason"]')?.focus();
      return;
    }
    const note = form.querySelector("#report-note").value.trim().slice(0, 500);
    saveReport({ listing_id: form.dataset.id, reason, note, time: new Date().toISOString() });
    state.reportSentFor = form.dataset.id;
    lastRouteKey = "__reset"; // treat the thank-you as a new screen so focus moves to it
    render();
  });

  // Remember whether the filter panel is open so re-rendering doesn't close it.
  root.addEventListener("toggle", (e) => {
    if (e.target.matches?.("details.filters")) state.filtersOpen = e.target.open;
  }, true);

  window.addEventListener("hashchange", () => {
    const route = parseHash(location.hash);
    if (route.name !== "report") state.reportSentFor = null;
    render();
  });

  fetch("data/listings.json")
    .then((r) => {
      if (!r.ok) throw new Error(String(r.status));
      return r.json();
    })
    .then((data) => {
      listings = data;
      if (!location.hash) history.replaceState(null, "", "#/start");
      render();
    })
    .catch(() => {
      root.innerHTML = renderScreen({ name: "start" }, { listings: [], state });
      const main = root.querySelector("main");
      if (main) main.insertAdjacentHTML("afterbegin", `<p class="form-error" role="alert">We couldn't load the listings. Please try again. If you need help now, use the numbers above.</p>`);
    });
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  startBrowser();
}
