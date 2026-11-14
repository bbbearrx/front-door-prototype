// Pure functions for status, matching and filtering. No DOM access here.
import { VERIFIED_UNDER_DAYS, HIDE_AFTER_DAYS } from "./config.js";

export const STATUS = Object.freeze({
  VERIFIED: "verified",
  DUE: "due",
  STALE: "stale",
  UNVERIFIED: "unverified",
  ERROR: "error",
  UNREACHABLE: "unreachable",
});

const SHOWN = new Set([STATUS.VERIFIED, STATUS.DUE]);

/**
 * The one status rule. Anything we can't confirm is hidden.
 * - override "error"        -> error (hidden)
 * - override "unreachable"  -> unreachable (hidden)
 * - verified_days_ago null  -> unverified (hidden)
 * - under 60 days           -> verified (shown)
 * - 60 to 90 days           -> due (shown, amber)
 * - over 90 days            -> stale (hidden)
 * A missing, negative or non-whole number is treated as not verified.
 */
export function getStatus(listing) {
  if (listing.override === "error") return STATUS.ERROR;
  if (listing.override === "unreachable") return STATUS.UNREACHABLE;
  const days = listing.verified_days_ago;
  if (!Number.isInteger(days) || days < 0) return STATUS.UNVERIFIED;
  if (days < VERIFIED_UNDER_DAYS) return STATUS.VERIFIED;
  if (days <= HIDE_AFTER_DAYS) return STATUS.DUE;
  return STATUS.STALE;
}

export function isVisible(listing) {
  return SHOWN.has(getStatus(listing));
}

export function visibleListings(listings) {
  return listings.filter(isVisible);
}

/** "not-sure" means: show options that don't depend on insurance. */
export function matchesCoverage(listing, coverage) {
  if (!coverage) return true;
  if (coverage === "not-sure") return listing.cost_type !== "insurance";
  return listing.coverage.includes(coverage);
}

/** Most recently confirmed first; a chosen kind of help goes to the top. */
export function sortListings(listings, kind) {
  return [...listings].sort((a, b) => {
    if (kind) {
      const ak = a.kind === kind ? 0 : 1;
      const bk = b.kind === kind ? 0 : 1;
      if (ak !== bk) return ak - bk;
    }
    return a.verified_days_ago - b.verified_days_ago;
  });
}

/**
 * answers: { path: "soon" | "ongoing" | "unsure" | null, kind, coverage }
 * Never returns a hidden listing.
 */
export function matchListings(listings, answers = {}) {
  const { path, kind, coverage } = answers;
  const out = visibleListings(listings).filter(
    (l) => (!path || l.urgency.includes(path)) && matchesCoverage(l, coverage)
  );
  return sortListings(out, kind);
}

function modeMatches(mode, format) {
  return mode === "both" || mode === format;
}

/**
 * filters: { cost: [], format: [], language: [], lgbtq: boolean }
 * Inside a group, any chip can match. Across groups, all must match.
 * Never returns a hidden listing.
 */
export function applyFilters(listings, filters = {}) {
  const { cost = [], format = [], language = [], lgbtq = false } = filters;
  return visibleListings(listings).filter((l) => {
    if (cost.length && !cost.includes(l.cost_type)) return false;
    if (format.length && !format.some((f) => modeMatches(l.mode, f))) return false;
    if (language.length && !language.some((x) => l.languages.includes(x))) return false;
    if (lgbtq && !l.lgbtq_affirming) return false;
    return true;
  });
}

export function emptyFilters() {
  return { cost: [], format: [], language: [], lgbtq: false };
}

export function hasActiveFilters(f) {
  return Boolean(f.cost.length || f.format.length || f.language.length || f.lgbtq);
}

// ---------- Dates and labels ----------

/** Sample data stores days-ago so the demo never goes stale. Real data would store real dates. */
export function daysAgoToDate(days, today = new Date()) {
  return new Date(today.getFullYear(), today.getMonth(), today.getDate() - days);
}

export function formatShortDate(date, today = new Date()) {
  const opts = { month: "short", day: "numeric", timeZone: "UTC" };
  if (date.getFullYear() !== today.getFullYear()) opts.year = "numeric";
  // Build a UTC date from the local parts so the label never shifts by a day.
  const utc = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  return utc.toLocaleDateString("en-US", opts);
}

export function relativeDays(days) {
  if (days === 0) return "today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

export function methodWord(listing) {
  return listing.verify_method === "email" ? "email" : "phone";
}

export function statusBadgeText(listing) {
  const status = getStatus(listing);
  const when = Number.isInteger(listing.verified_days_ago)
    ? relativeDays(listing.verified_days_ago)
    : "";
  if (status === STATUS.VERIFIED) return `Confirmed by ${methodWord(listing)} ${when}`;
  if (status === STATUS.DUE) return `Re-check due soon · confirmed ${when}`;
  return HIDDEN_REASONS[status];
}

export function confirmedOnText(listing, today = new Date()) {
  if (!Number.isInteger(listing.verified_days_ago)) return "Not confirmed yet";
  const date = daysAgoToDate(listing.verified_days_ago, today);
  return `Confirmed by ${methodWord(listing)} on ${formatShortDate(date, today)}`;
}

export const HIDDEN_REASONS = Object.freeze({
  [STATUS.STALE]: `not confirmed in ${HIDE_AFTER_DAYS} days`,
  [STATUS.ERROR]: "problem confirmed",
  [STATUS.UNREACHABLE]: "we couldn't reach them",
  [STATUS.UNVERIFIED]: "not confirmed yet",
});

/** Counts for the "How we verify" page. */
export function verificationSummary(listings) {
  const counts = {};
  for (const s of Object.values(STATUS)) counts[s] = 0;
  const hidden = [];
  for (const l of listings) {
    const s = getStatus(l);
    counts[s] += 1;
    if (!SHOWN.has(s)) hidden.push({ listing: l, status: s, reason: HIDDEN_REASONS[s] });
  }
  return {
    total: listings.length,
    visible: counts[STATUS.VERIFIED] + counts[STATUS.DUE],
    counts,
    hidden,
  };
}

export function agesText(listing) {
  if (listing.ages_max == null) return `Ages ${listing.ages_min} and up`;
  return `Ages ${listing.ages_min}–${listing.ages_max}`;
}

export function modeText(listing) {
  if (listing.mode === "both") return "Online or in person";
  if (listing.mode === "online") return "Online";
  return "In person";
}

export function newClientsText(listing) {
  return listing.new_clients === "yes"
    ? "Taking new clients (as of last check)"
    : "Waitlist (as of last check)";
}
