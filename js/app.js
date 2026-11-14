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
    icon: "chat",
    label: "Talking to someone today",
    about: "For when you've had a hard day and want to talk with someone now. These are phone lines and chats. No appointment needed.",
    cost: "Usually free.",
  },
  {
    id: "short-term",
    icon: "sprout",
    label: "Short-term counseling",
    about: "A few visits to work through stress, a breakup, or pressure from school or family.",
    cost: "Free to low cost at many places. Call to confirm.",
  },
  {
    id: "ongoing",
    icon: "calendar",
    label: "Ongoing therapy",
    about: "Regular visits, often once a week, for when you've felt down or worried for weeks and want steady support.",
    cost: "Uses insurance, or a sliding scale based on what you earn. Call to confirm.",
  },
  {
    id: "medication",
    icon: "clipboard",
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

// Simple line icons, drawn for this project. Always decorative (aria-hidden):
// every icon sits next to words that say the same thing.
const ICONS = {
  door: '<path d="M5 21V4a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v17"/><path d="M3 21h18"/><path d="M9 21V7l6-1.5V21"/><circle cx="13" cy="13.5" r=".6" fill="currentColor"/>',
  lifebuoy: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3.6"/><path d="m5.6 5.6 3.9 3.9M14.5 14.5l3.9 3.9M18.4 5.6l-3.9 3.9M9.5 14.5l-3.9 3.9"/>',
  chat: '<path d="M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-9l-5 4v-4H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z"/><path d="M8 10h8M8 13h5"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/><path d="m9 15 2 2 4-4"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>',
  sprout: '<path d="M12 21v-9"/><path d="M12 12c0-4 3-6 7-6 0 4-3 6-7 6z"/><path d="M12 14c0-3-2.5-5-6-5 0 3 2.5 5 6 5z"/>',
  clipboard: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1"/><path d="M9 10h6M9 14h6M9 18h3"/>',
  phone: '<path d="M6.6 3.5h2.6l1.4 4-2 1.3a11 11 0 0 0 6.6 6.6l1.3-2 4 1.4v2.6a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4.6 5.7a2 2 0 0 1 2-2.2z"/>',
  message: '<path d="M4 4h16a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H9l-5 4V5a1 1 0 0 1 1-1z"/><circle cx="8.5" cy="10.5" r=".7" fill="currentColor"/><circle cx="12" cy="10.5" r=".7" fill="currentColor"/><circle cx="15.5" cy="10.5" r=".7" fill="currentColor"/>',
  check: '<circle cx="12" cy="12" r="9"/><path d="m8 12.5 2.8 2.8L16.5 9.5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  tag: '<path d="M3.5 12.3V4.5a1 1 0 0 1 1-1h7.8l8.2 8.2a1 1 0 0 1 0 1.4l-7.8 7.8a1 1 0 0 1-1.4 0z"/><circle cx="8" cy="8" r="1.4"/>',
  person: '<circle cx="12" cy="8" r="3.6"/><path d="M4.5 20.5c.8-4 3.8-6 7.5-6s6.7 2 7.5 6"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3c2.6 2.6 3.8 5.6 3.8 9s-1.2 6.4-3.8 9c-2.6-2.6-3.8-5.6-3.8-9S9.4 5.6 12 3z"/>',
  monitor: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
  pin: '<path d="M12 21s-6.5-5.8-6.5-11a6.5 6.5 0 0 1 13 0c0 5.2-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/>',
  door2: '<path d="M6 20V5a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v15"/><path d="M4 20h16"/><circle cx="14.5" cy="12.5" r=".8" fill="currentColor"/>',
  heart: '<path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z"/>',
  copy: '<rect x="8.5" y="8.5" width="11.5" height="11.5" rx="2"/><path d="M15.5 8.5V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v9.5a1 1 0 0 0 1 1h3.5"/>',
  flag: '<path d="M5 21V4"/><path d="M5 4h11l-2 4 2 4H5"/>',
  chevron: '<path d="m9.5 6 6 6-6 6"/>',
  back: '<path d="m14.5 6-6 6 6 6"/>',
  shield: '<path d="M12 3 4.5 6v5.5c0 4.6 3.2 8.2 7.5 9.5 4.3-1.3 7.5-4.9 7.5-9.5V6z"/><path d="m8.8 12 2.2 2.2 4.2-4.4"/>',
  external: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
};

export function icon(name, cls = "icon") {
  return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICONS[name] ?? ""}</svg>`;
}

// The start-screen illustration: an open front door with warm light coming through.
function doorIllustration() {
  return `<svg class="hero-art" viewBox="0 0 160 140" aria-hidden="true" focusable="false">
  <circle cx="108" cy="46" r="34" fill="#FDBB30" opacity=".28"/>
  <circle cx="108" cy="46" r="20" fill="#FDBB30" opacity=".35"/>
  <path d="M10 128h140" stroke="#00543C" stroke-width="3" stroke-linecap="round"/>
  <rect x="44" y="26" width="58" height="102" rx="4" fill="#FFF8E6" stroke="#00543C" stroke-width="3"/>
  <path d="M50 128 L96 128 L118 140 L32 140 Z" fill="#FDBB30" opacity=".35"/>
  <path d="M47 29 L76 38 L76 122 L47 126 Z" fill="#00543C"/>
  <circle cx="70" cy="80" r="2.6" fill="#FDBB30"/>
  <path d="M20 128c0-10 6-16 12-16s12 6 12 16" fill="#E4EFE9" stroke="#00543C" stroke-width="2"/>
  <path d="M128 128c0-14 7-22 12-22s8 8 8 22" fill="#E4EFE9" stroke="#00543C" stroke-width="2"/>
</svg>`;
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
  <p><strong class="crisis-label">In danger now?</strong>
    <a href="${CRISIS.emergency.tel}">Call 911</a> <span aria-hidden="true">·</span>
    <a href="${CRISIS.lifeline.tel}" aria-label="Call 988">Call</a> or <a href="${CRISIS.lifeline.sms}" aria-label="Text 988">text</a> 988 <span aria-hidden="true">·</span>
    <span class="nowrap">CAPS 24/7: <a href="${CRISIS.capsAllHours.tel}" aria-label="Call CAPS All Hours at ${CRISIS.capsAllHours.display}">${CRISIS.capsAllHours.display}</a></span></p>
</aside>`;
}

function footer(feedbackUrl) {
  const feedback = isSafeHttpUrl(feedbackUrl)
    ? `<li><a href="${esc(feedbackUrl)}" target="_blank" rel="noopener noreferrer">Give feedback on this prototype${icon("external", "icon icon-sm")}<span class="visually-hidden"> (opens in a new tab)</span></a></li>`
    : "";
  return `<footer class="site-footer">
  <div class="wrap">
    <ul class="footer-links">
      <li><a href="#/how-we-verify">${icon("shield", "icon icon-sm")}How we verify</a></li>
      ${feedback}
    </ul>
    <p>A student project for the Horizon Collective at USF. Not an official USF or CAPS service.</p>
  </div>
</footer>`;
}

function layout(main, ctx) {
  return `<a class="skip-link" href="#main">Skip to main content</a>
<div class="proto-banner" role="note"><span class="proto-pill" aria-hidden="true">Prototype</span> Prototype for class testing. Listings are made-up samples. In an emergency, call 911.</div>
${crisisBar()}
<header class="site-header">
  <div class="wrap header-row">
    <a class="brand" href="#/start"><span class="brand-mark">${icon("door2")}</span>Front Door</a>
    <button type="button" class="btn btn-quiet btn-small" data-action="start-over" data-key="start-over">Start over</button>
  </div>
</header>
<main id="main" class="wrap" tabindex="-1">
${main}
</main>
${footer(ctx.feedbackUrl ?? FEEDBACK_FORM_URL)}`;
}

/** "Step 2 of 3" so students always know how much is left. */
function progress(state, screen) {
  const flows = {
    ongoing: ["start", "coverage", "results"],
    unsure: ["start", "kinds", "coverage", "results"],
  };
  const flow = flows[state.path];
  if (!flow) return "";
  const i = flow.indexOf(screen);
  if (i < 1) return "";
  const pct = Math.round(((i + 1) / flow.length) * 100);
  return `<div class="progress">
  <span class="progress-text">Step ${i + 1} of ${flow.length}</span>
  <span class="progress-track" aria-hidden="true"><span class="progress-fill" style="width:${pct}%"></span></span>
</div>`;
}

function badge(listing) {
  const status = getStatus(listing);
  const due = status === STATUS.DUE;
  return `<p class="badge ${due ? "badge-due" : "badge-ok"}">${icon(due ? "clock" : "check", "icon icon-sm")}${esc(statusBadgeText(listing))}</p>`;
}

function sampleTag() {
  return `<span class="tag">Sample</span>`;
}

function facts(listing, { full = false } = {}) {
  const rows = [
    ["tag", "Cost", listing.cost_note, "fact-cost"],
    ["person", "Ages", agesText(listing)],
    ["globe", "Languages", listing.languages.join(", ")],
    [listing.mode === "in-person" ? "pin" : "monitor", "How", modeText(listing)],
  ];
  if (full) rows.push(["pin", "Area", listing.area || "Online only"]);
  rows.push(["calendar", "Openings", newClientsText(listing)]);
  return `<dl class="facts">${rows
    .map(
      ([ic, k, v, cls = ""]) =>
        `<div class="fact ${cls}"><dt>${icon(ic, "icon icon-sm")}${k}</dt><dd>${esc(v)}</dd></div>`
    )
    .join("")}</dl>`;
}

function realOptions(heading = "Talk to someone now, any time") {
  return `<section class="real-options" aria-labelledby="real-options-h">
  <h2 id="real-options-h">${heading}</h2>
  <p class="muted">These are real, free, and open 24/7. Reaching out is a strong step.</p>
  <ul class="real-list">
    <li class="real-card">
      <h3>988 Suicide &amp; Crisis Lifeline</h3>
      <p>Free. Call or text any time, day or night. You don't have to be in danger to reach out.</p>
      <div class="btn-row">
        <a class="btn btn-primary" href="${CRISIS.lifeline.tel}">${icon("phone")}Call 988</a>
        <a class="btn btn-secondary" href="${CRISIS.lifeline.sms}">${icon("message")}Text 988</a>
      </div>
    </li>
    <li class="real-card">
      <h3>CAPS All Hours</h3>
      <p>Free for USF students. Talk with a counselor by phone any time.</p>
      <div class="btn-row">
        <a class="btn btn-primary" href="${CRISIS.capsAllHours.tel}">${icon("phone")}Call ${CRISIS.capsAllHours.display}</a>
      </div>
    </li>
  </ul>
</section>`;
}

function choice({ href, title, note, ic, key, attrs = "", cls = "" }) {
  return `<li><a class="choice ${cls}" href="${href}" data-key="${key}"${attrs}>
    <span class="choice-icon">${icon(ic)}</span>
    <span class="choice-text"><span class="choice-title">${title}</span>
    <span class="choice-note">${note}</span></span>
    ${icon("chevron", "icon choice-chevron")}</a></li>`;
}

// ---------- Screens ----------

function startScreen() {
  return `<section class="hero">
  <div class="hero-text">
    <h1 tabindex="-1">What's going on?</h1>
    <p class="lead">Pick the one that fits best. There are no wrong answers, and you can start over any time.</p>
  </div>
  ${doorIllustration()}
</section>
<ul class="choice-list">
  ${choice({ href: "#/danger", title: "I'm not safe right now", note: "Get help right away.", ic: "lifebuoy", key: "path-danger", cls: "choice-urgent" })}
  ${choice({ href: "#/results", title: PATHS.soon, note: "See free 24/7 options and counseling you can start soon.", ic: "chat", key: "path-soon", attrs: ' data-action="set-path" data-path="soon"' })}
  ${choice({ href: "#/coverage", title: PATHS.ongoing, note: "Find care that keeps going, and a way to pay for it.", ic: "calendar", key: "path-ongoing", attrs: ' data-action="set-path" data-path="ongoing"' })}
  ${choice({ href: "#/kinds", title: PATHS.unsure, note: "See the four kinds of help in plain words.", ic: "compass", key: "path-unsure", attrs: ' data-action="set-path" data-path="unsure"' })}
</ul>
<p class="privacy-note">${icon("shield", "icon icon-sm")}We don't ask for your name, and we don't save your answers.</p>`;
}

function dangerScreen() {
  return `<h1 tabindex="-1">Get help right now</h1>
<div class="danger-actions">
  <a class="btn btn-danger btn-big" href="${CRISIS.emergency.tel}">${icon("phone")}Call 911</a>
  <a class="btn btn-primary btn-big" href="${CRISIS.lifeline.tel}">${icon("phone")}Call 988</a>
  <a class="btn btn-primary btn-big" href="${CRISIS.lifeline.sms}">${icon("message")}Text 988</a>
  <a class="btn btn-primary btn-big" href="${CRISIS.capsAllHours.tel}">${icon("phone")}<span>Call CAPS All Hours<span class="btn-sub">${CRISIS.capsAllHours.display}</span></span></a>
</div>
<p class="danger-line">${icon("heart")}If you can, stay with someone you trust.</p>`;
}

function kindsScreen(ctx) {
  const cards = KINDS.map(
    (k) => `<li class="card kind-card">
    <div class="kind-head"><span class="choice-icon">${icon(k.icon)}</span><h2>${k.label}</h2></div>
    <p>${k.about}</p>
    <p class="cost-pill">${icon("tag", "icon icon-sm")}<span><strong>Cost:</strong> ${k.cost}</span></p>
    <a class="btn btn-primary" href="#/coverage" data-action="set-kind" data-kind="${k.id}" data-key="kind-${k.id}">Continue with this<span class="visually-hidden">: ${k.label}</span>${icon("chevron")}</a>
  </li>`
  ).join("");
  return `${progress({ path: "unsure" }, "kinds")}
<h1 tabindex="-1">Four kinds of help</h1>
<p class="lead">It's okay not to know. Here's what each kind is like. Pick the one that sounds closest. You can change it later.</p>
<ul class="card-list">${cards}</ul>`;
}

function coverageScreen(ctx) {
  const { state } = ctx;
  const chosenKind = state.kind ? `<p class="answer-note">You picked: <strong>${kindLabel(state.kind)}</strong>. <a href="#/kinds">Change</a></p>` : "";
  const items = COVERAGE.map(
    (c) => `<li><a class="choice choice-plain" href="#/results" data-action="set-coverage" data-coverage="${c.id}" data-key="cov-${c.id}"${
      state.coverage === c.id ? ' aria-current="true"' : ""
    }>
    <span class="choice-text"><span class="choice-title">${esc(c.label)}</span>
    <span class="choice-note">${esc(c.note)}</span></span>
    ${icon("chevron", "icon choice-chevron")}</a></li>`
  ).join("");
  return `${progress({ path: state.path || "ongoing" }, "coverage")}
<h1 tabindex="-1">How will you pay for care?</h1>
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
  const active = hasActiveFilters(filters);
  const clear = active
    ? `<button type="button" class="btn btn-quiet btn-small" data-action="clear-filters" data-key="clear-filters">Clear filters</button>`
    : "";
  return `<details class="filters"${open || active ? " open" : ""}>
  <summary data-key="filters-summary"><span>Filter results${active ? ' <span class="on-dot">on</span>' : ""}</span>${icon("chevron", "icon summary-chevron")}</summary>
  <div class="filters-body">${groups}${lgbtq}${clear}</div>
</details>`;
}

function listingCard(l) {
  const href = `#/listing/${encodeURIComponent(l.id)}`;
  return `<li class="card listing-card">
  <div class="card-top">${badge(l)}${sampleTag()}</div>
  <h3 class="card-title"><a href="${href}" data-key="card-${esc(l.id)}">${esc(l.name)}</a></h3>
  <p class="card-summary">${esc(l.summary)}</p>
  ${facts(l)}
  <a class="btn btn-secondary btn-block" href="${href}">See details and what to say<span class="visually-hidden">: ${esc(l.name)}</span>${icon("chevron")}</a>
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
        ? `<button type="button" class="btn btn-secondary btn-block" data-action="show-more" data-key="show-more">Show ${filtered.length - shown.length} more</button>`
        : "";
    list = `<ul class="card-list">${shown.map(listingCard).join("")}</ul>${more}`;
  }

  return `${progress(state, "results")}
<h1 tabindex="-1">${isSoon ? "Help you can reach soon" : "Options for you"}</h1>
${answersSummary(state)}
${isSoon ? realOptions() : ""}
<section aria-labelledby="sample-h">
  <h2 id="sample-h">${isSoon ? "Support now and short-term counseling" : "Matching options"}</h2>
  <p class="trust-note">${icon("shield", "icon icon-sm")}<span>Every option was confirmed by our team in the last ${HIDE_AFTER_DAYS} days. Costs and openings can change, so call to confirm.</span></p>
  ${isSoon ? coverageSelect(state) : ""}
  ${filtersBlock(state.filters, state.filtersOpen)}
  <p class="result-count" role="status" aria-live="polite">Showing ${shown.length} of ${filtered.length} ${filtered.length === 1 ? "option" : "options"}.</p>
  ${kindNote}
  ${list}
</section>`;
}

function backToResults(state) {
  const label = state.path || state.coverage ? "Back to your results" : "See all options";
  return `<p class="back-link"><a href="#/results">${icon("back", "icon icon-sm")}${label}</a></p>`;
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
<section class="listing-head">
  <div class="card-top">${badge(l)}${sampleTag()}</div>
  <h1 tabindex="-1">${esc(l.name)}</h1>
  <p class="lead">${esc(l.summary)}</p>
</section>
<div class="card">${facts(l, { full: true })}</div>
<section class="panel" aria-labelledby="contact-h">
  <h2 id="contact-h">How to start</h2>
  <p>${esc(l.how_to_start)}</p>
  <div class="btn-row">
    <a class="btn btn-primary" href="${telHref(l.phone)}">${icon("phone")}Call ${esc(l.phone)}</a>
    <a class="btn btn-secondary" href="${esc(l.web)}" target="_blank" rel="noopener noreferrer">Website${icon("external")}<span class="visually-hidden"> (opens in a new tab)</span></a>
  </div>
  <p class="muted small">This is a made-up sample, so the number and website aren't real.</p>
</section>
<section class="script-box" aria-labelledby="script-h">
  <h2 id="script-h">${icon("chat")}What to say when you call</h2>
  <p class="muted small">It's normal to feel nervous. You can read this word for word.</p>
  <blockquote id="script-text">${esc(l.script)}</blockquote>
  <button type="button" class="btn btn-secondary btn-small" data-action="copy" data-target="script-text" data-key="copy">${icon("copy")}Copy</button>
  <p class="copy-status small" role="status" aria-live="polite"></p>
</section>
<p class="confirmed">${icon("check", "icon icon-sm")}<span>${esc(confirmedOnText(l, today))}. Call to confirm cost and openings.</span></p>
<a class="btn btn-quiet btn-small" href="#/report/${encodeURIComponent(l.id)}" data-key="report-link">${icon("flag")}Report a problem</a>`;
}

function reportScreen(ctx, id) {
  const { listings, state } = ctx;
  const l = listings.find((x) => x.id === id);
  if (!l || !isVisible(l)) return notAvailable(l, state);
  if (state.reportSentFor === id) {
    return `<div class="thanks">
<span class="thanks-icon">${icon("check")}</span>
<h1 tabindex="-1">Thanks for telling us</h1>
<p class="lead" role="status">Thanks. In the real guide, this goes to our audit team, who re-check the listing and hide it until it's fixed.</p>
<p class="muted small">In this prototype, your report is saved only on this device.</p>
<div class="btn-row">
  <a class="btn btn-primary" href="#/listing/${encodeURIComponent(l.id)}">Back to the listing</a>
  <a class="btn btn-secondary" href="#/results">Back to results</a>
</div>
</div>`;
  }
  const radios = REPORT_REASONS.map(
    (r, i) => `<div class="radio">
    <input type="radio" id="reason-${r.value}" name="reason" value="${r.value}"${i === 0 ? " required" : ""}>
    <label for="reason-${r.value}">${r.label}</label>
  </div>`
  ).join("");
  return `<p class="back-link"><a href="#/listing/${encodeURIComponent(l.id)}">${icon("back", "icon icon-sm")}Back to the listing</a></p>
<h1 tabindex="-1">Report a problem</h1>
<p class="lead">With: <strong>${esc(l.name)}</strong></p>
<form class="card report-form" data-action="report" data-id="${esc(l.id)}" novalidate>
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
  <li><span class="step-num" aria-hidden="true">1</span><span>We call every listing every 60 to 90 days to check the phone number, cost, and whether they take new clients.</span></li>
  <li><span class="step-num" aria-hidden="true">2</span><span>Listings confirmed in the last ${VERIFIED_UNDER_DAYS} days show as <span class="badge badge-ok badge-inline">${icon("check", "icon icon-sm")}Confirmed</span></span></li>
  <li><span class="step-num" aria-hidden="true">3</span><span>From ${VERIFIED_UNDER_DAYS} to ${HIDE_AFTER_DAYS} days, they show <span class="badge badge-due badge-inline">${icon("clock", "icon icon-sm")}Re-check due</span> They should still work, but call to confirm.</span></li>
  <li><span class="step-num" aria-hidden="true">4</span><span>After ${HIDE_AFTER_DAYS} days, or once someone reports a problem and we confirm it, the listing is hidden until we confirm it again.</span></li>
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
    case "kinds": return kindsScreen(ctx);
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
      // New screen: go to the top, fade in gently, and move focus to the heading.
      window.scrollTo(0, 0);
      root.querySelector("main")?.classList.add("enter");
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
