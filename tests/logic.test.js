// Run with: node --test
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { VERIFIED_UNDER_DAYS, HIDE_AFTER_DAYS } from "../js/config.js";
import {
  STATUS,
  getStatus,
  isVisible,
  matchListings,
  applyFilters,
  emptyFilters,
  verificationSummary,
  daysAgoToDate,
  formatShortDate,
  statusBadgeText,
  confirmedOnText,
} from "../js/logic.js";
import {
  renderScreen,
  parseHash,
  freshState,
  resultsModel,
  verifySentence,
  COVERAGE,
} from "../js/app.js";

const listings = JSON.parse(
  readFileSync(new URL("../data/listings.json", import.meta.url), "utf8")
);
const hiddenIds = listings.filter((l) => !isVisible(l)).map((l) => l.id);
const L = (days, override = null) => ({ verified_days_ago: days, override });

// ---------- Status rules ----------

describe("status rules", () => {
  test("thresholds are the named constants 60 and 90", () => {
    assert.equal(VERIFIED_UNDER_DAYS, 60);
    assert.equal(HIDE_AFTER_DAYS, 90);
  });

  test("override error is Error (hidden), even if recently confirmed", () => {
    assert.equal(getStatus(L(1, "error")), STATUS.ERROR);
    assert.equal(isVisible(L(1, "error")), false);
  });

  test("override unreachable is Unreachable (hidden)", () => {
    assert.equal(getStatus(L(1, "unreachable")), STATUS.UNREACHABLE);
    assert.equal(isVisible(L(1, "unreachable")), false);
  });

  test("override wins over null days", () => {
    assert.equal(getStatus(L(null, "error")), STATUS.ERROR);
    assert.equal(getStatus(L(null, "unreachable")), STATUS.UNREACHABLE);
  });

  test("null days is Not yet verified (hidden)", () => {
    assert.equal(getStatus(L(null)), STATUS.UNVERIFIED);
    assert.equal(isVisible(L(null)), false);
  });

  test("bad day values are treated as not verified (hidden)", () => {
    for (const d of [undefined, -1, 12.5, "12", NaN]) {
      assert.equal(getStatus(L(d)), STATUS.UNVERIFIED, String(d));
    }
  });

  test("0 days is Verified", () => assert.equal(getStatus(L(0)), STATUS.VERIFIED));
  test("59 days is Verified (shown)", () => {
    assert.equal(getStatus(L(59)), STATUS.VERIFIED);
    assert.equal(isVisible(L(59)), true);
  });
  test("60 days is Due (shown)", () => {
    assert.equal(getStatus(L(60)), STATUS.DUE);
    assert.equal(isVisible(L(60)), true);
  });
  test("90 days is Due (shown)", () => {
    assert.equal(getStatus(L(90)), STATUS.DUE);
    assert.equal(isVisible(L(90)), true);
  });
  test("91 days is Stale (hidden)", () => {
    assert.equal(getStatus(L(91)), STATUS.STALE);
    assert.equal(isVisible(L(91)), false);
  });

  test("badge text for Verified and Due", () => {
    assert.equal(
      statusBadgeText({ ...L(12), verify_method: "phone" }),
      "Confirmed by phone 12 days ago"
    );
    assert.equal(
      statusBadgeText({ ...L(74), verify_method: "phone" }),
      "Re-check due soon · confirmed 74 days ago"
    );
  });

  test("days ago turns into a date relative to today", () => {
    const today = new Date(2026, 10, 14); // Nov 14, 2026
    const d = daysAgoToDate(12, today);
    assert.equal(formatShortDate(d, today), "Nov 2");
    assert.equal(
      confirmedOnText({ ...L(12), verify_method: "phone" }, today),
      "Confirmed by phone on Nov 2"
    );
    assert.equal(formatShortDate(daysAgoToDate(320, today), today), "Dec 29, 2025");
  });
});

// ---------- Sample data ----------

const FIELDS = [
  "id", "name", "kind", "urgency", "coverage", "cost_type", "cost_note",
  "ages_min", "ages_max", "languages", "mode", "area", "new_clients",
  "lgbtq_affirming", "phone", "web", "how_to_start", "summary", "script",
  "verify_method", "verified_days_ago", "override",
];

describe("sample data", () => {
  test("there are 16 listings with unique ids", () => {
    assert.equal(listings.length, 16);
    assert.equal(new Set(listings.map((l) => l.id)).size, 16);
  });

  for (const l of listings) {
    test(`${l.id}: all fields, Sample name, fictional phone, example.org`, () => {
      for (const f of FIELDS) assert.ok(f in l, `missing ${f}`);
      assert.match(l.name, /^Sample /);
      assert.match(l.phone, /^\(\d{3}\) 555-01\d{2}$/);
      assert.match(l.web, /^https:\/\/example\.org(\/|$)/);
      assert.ok(["support-now", "short-term", "ongoing", "medication"].includes(l.kind));
      assert.ok(["free", "sliding", "insurance"].includes(l.cost_type));
      assert.ok(["online", "in-person", "both"].includes(l.mode));
      assert.ok(["yes", "waitlist"].includes(l.new_clients));
      assert.ok(["phone", "email"].includes(l.verify_method));
      assert.ok([null, "error", "unreachable"].includes(l.override));
      assert.equal(typeof l.lgbtq_affirming, "boolean");
      assert.ok(l.urgency.every((u) => ["soon", "ongoing", "unsure"].includes(u)));
      assert.ok(l.coverage.every((c) => ["usf-plan", "kaiser", "medi-cal", "out-of-state", "uninsured"].includes(c)));
      assert.ok(l.cost_note.length > 0, "every option says what it costs");
    });
  }

  test("status mix: 3 Stale, 1 Error, 2 Due, 10 Verified", () => {
    const s = verificationSummary(listings);
    assert.equal(s.counts.stale, 3);
    assert.equal(s.counts.error, 1);
    assert.equal(s.counts.due, 2);
    assert.equal(s.counts.verified, 10);
    assert.equal(s.visible, 12);
    assert.equal(hiddenIds.length, 4);
  });

  test("covers every kind, cost type and format among visible listings", () => {
    const v = listings.filter(isVisible);
    for (const k of ["support-now", "short-term", "ongoing", "medication"]) assert.ok(v.some((l) => l.kind === k), k);
    for (const c of ["free", "sliding", "insurance"]) assert.ok(v.some((l) => l.cost_type === c), c);
    assert.ok(v.some((l) => l.mode !== "in-person"));
    assert.ok(v.some((l) => l.mode !== "online"));
    assert.ok(v.some((l) => l.lgbtq_affirming));
  });
});

// ---------- Matching ----------

const COVERAGE_IDS = COVERAGE.map((c) => c.id);

describe("matching", () => {
  for (const path of ["soon", "ongoing", "unsure"]) {
    for (const coverage of COVERAGE_IDS) {
      test(`${path} + ${coverage} returns at least 3 visible listings`, () => {
        const out = matchListings(listings, { path, coverage });
        assert.ok(out.length >= 3, `got ${out.length}`);
      });
    }
  }

  test("matches by urgency", () => {
    for (const path of ["soon", "ongoing", "unsure"]) {
      const out = matchListings(listings, { path });
      assert.ok(out.length > 0);
      assert.ok(out.every((l) => l.urgency.includes(path)));
    }
  });

  test("matches by coverage", () => {
    for (const c of COVERAGE_IDS.filter((c) => c !== "not-sure")) {
      const out = matchListings(listings, { coverage: c });
      assert.ok(out.every((l) => l.coverage.includes(c)), c);
    }
  });

  test("'not sure' shows only options that don't depend on insurance", () => {
    const out = matchListings(listings, { coverage: "not-sure" });
    assert.ok(out.length > 0);
    assert.ok(out.every((l) => l.cost_type !== "insurance"));
  });

  test("a chosen kind is sorted first", () => {
    const out = matchListings(listings, { path: "unsure", kind: "medication", coverage: "uninsured" });
    const firstOther = out.findIndex((l) => l.kind !== "medication");
    assert.ok(out[0].kind === "medication");
    assert.ok(out.slice(firstOther).every((l) => l.kind !== "medication"));
  });

  test("never returns a hidden listing, for any answers", () => {
    for (const path of [null, "soon", "ongoing", "unsure"]) {
      for (const coverage of [null, ...COVERAGE_IDS]) {
        for (const kind of [null, "support-now", "short-term", "ongoing", "medication"]) {
          const out = matchListings(listings, { path, coverage, kind });
          assert.ok(out.every((l) => !hiddenIds.includes(l.id)), `${path}/${coverage}/${kind}`);
        }
      }
    }
  });
});

// ---------- Filtering ----------

describe("filters", () => {
  const f = (over) => ({ ...emptyFilters(), ...over });

  test("no filters returns every visible listing", () => {
    assert.equal(applyFilters(listings, emptyFilters()).length, 12);
  });

  for (const cost of ["free", "sliding", "insurance"]) {
    test(`cost: ${cost}`, () => {
      const out = applyFilters(listings, f({ cost: [cost] }));
      assert.ok(out.length > 0);
      assert.ok(out.every((l) => l.cost_type === cost));
    });
  }

  test("format: online includes online and both", () => {
    const out = applyFilters(listings, f({ format: ["online"] }));
    assert.ok(out.length > 0);
    assert.ok(out.every((l) => l.mode === "online" || l.mode === "both"));
    assert.ok(out.some((l) => l.mode === "both"));
  });

  test("format: in person includes in-person and both", () => {
    const out = applyFilters(listings, f({ format: ["in-person"] }));
    assert.ok(out.length > 0);
    assert.ok(out.every((l) => l.mode === "in-person" || l.mode === "both"));
  });

  for (const lang of ["English", "Spanish", "Cantonese", "Mandarin", "Tagalog", "Vietnamese"]) {
    test(`language: ${lang}`, () => {
      const out = applyFilters(listings, f({ language: [lang] }));
      assert.ok(out.length > 0, `no visible ${lang} listing`);
      assert.ok(out.every((l) => l.languages.includes(lang)));
    });
  }

  test("LGBTQ+ affirming", () => {
    const out = applyFilters(listings, f({ lgbtq: true }));
    assert.ok(out.length > 0);
    assert.ok(out.every((l) => l.lgbtq_affirming));
  });

  test("chips in one group are OR; groups are AND", () => {
    const either = applyFilters(listings, f({ cost: ["free", "sliding"] }));
    assert.ok(either.every((l) => ["free", "sliding"].includes(l.cost_type)));
    const both = applyFilters(listings, f({ cost: ["free"], format: ["in-person"] }));
    assert.ok(both.every((l) => l.cost_type === "free" && l.mode !== "online"));
  });

  test("filters never return a hidden listing, even when given hidden ones", () => {
    const combos = [
      emptyFilters(),
      f({ cost: ["sliding"] }),
      f({ cost: ["insurance"] }),
      f({ cost: ["free"] }),
      f({ format: ["online"] }),
      f({ language: ["Vietnamese", "Mandarin", "Cantonese"] }),
      f({ lgbtq: true }),
    ];
    for (const c of combos) {
      assert.ok(applyFilters(listings, c).every((l) => !hiddenIds.includes(l.id)));
    }
  });

  test("Results screen never shows a hidden listing", () => {
    for (const path of [null, "soon", "ongoing", "unsure"]) {
      for (const coverage of [null, ...COVERAGE_IDS]) {
        const state = { ...freshState(), path, coverage, showAll: true };
        const html = renderScreen({ name: "results" }, { listings, state, today: new Date() });
        for (const id of hiddenIds) assert.ok(!html.includes(id), `${id} in ${path}/${coverage}`);
        const { shown } = resultsModel({ listings, state });
        assert.ok(shown.every((l) => isVisible(l)));
      }
    }
  });
});

// ---------- How we verify ----------

describe("how we verify", () => {
  test("live counts sentence", () => {
    assert.equal(
      verifySentence(verificationSummary(listings)),
      "Showing 12 of 16 sample listings. 3 hidden: not confirmed in 90 days. 1 hidden: problem confirmed."
    );
  });

  test("page lists every hidden listing", () => {
    const html = renderScreen({ name: "how-we-verify" }, { listings, state: freshState(), today: new Date() });
    for (const l of listings.filter((x) => !isVisible(x))) assert.ok(html.includes(l.name), l.name);
  });
});

// ---------- Every screen ----------

describe("every route renders the safety pieces", () => {
  const visibleId = listings.find(isVisible).id;
  const routes = [
    "#/start", "#/danger", "#/kinds", "#/coverage", "#/results",
    `#/listing/${visibleId}`, `#/report/${visibleId}`, "#/how-we-verify",
    "#/spread-the-word", "#/feedback",
    `#/listing/${hiddenIds[0]}`, "#/listing/does-not-exist", "#/nonsense",
  ];
  const states = [
    freshState(),
    { ...freshState(), path: "soon" },
    { ...freshState(), path: "ongoing", coverage: "kaiser" },
    { ...freshState(), path: "unsure", kind: "medication", coverage: "not-sure" },
    { ...freshState(), reportSentFor: visibleId },
  ];

  for (const hash of routes) {
    test(`${hash}`, () => {
      for (const state of states) {
        const html = renderScreen(parseHash(hash), { listings, state, today: new Date() });
        assert.ok(html.includes('class="crisis-bar"'), "crisis bar");
        assert.ok(html.includes("In danger now?"));
        assert.ok(html.includes('href="tel:911"'));
        assert.ok(html.includes('href="tel:988"'));
        assert.ok(html.includes('href="sms:988"'));
        assert.ok(html.includes('href="tel:+18555310761"'));
        assert.ok(html.includes("(855) 531-0761"));
        assert.ok(html.includes("Prototype for class testing. Listings are made-up samples. In an emergency, call 911."), "banner");
        assert.ok(html.includes("A student project for the Horizon Collective at USF. Not an official USF or CAPS service."), "footer");
        assert.ok(html.includes('data-action="start-over"'), "start over");
        assert.ok(html.includes('href="#/how-we-verify"'), "verify link");
      }
    });
  }

  test("parseHash knows every route", () => {
    assert.deepEqual(parseHash("#/listing/abc"), { name: "listing", id: "abc" });
    assert.deepEqual(parseHash("#/report/abc"), { name: "report", id: "abc" });
    assert.deepEqual(parseHash(""), { name: "start", id: null });
    assert.equal(parseHash("#/how-we-verify").name, "how-we-verify");
  });

  test("feedback link hidden when empty, shown when set", () => {
    const ctx = { listings, state: freshState(), today: new Date() };
    assert.ok(!renderScreen({ name: "start" }, { ...ctx, feedbackUrl: "" }).includes("Give feedback"));
    const html = renderScreen({ name: "start" }, { ...ctx, feedbackUrl: "https://forms.example.org/x" });
    assert.ok(html.includes("Give feedback on this prototype"));
    assert.ok(html.includes('target="_blank"'));
  });

  test("Danger screen has 911, 988 call and text, CAPS All Hours, and the one line", () => {
    const html = renderScreen({ name: "danger" }, { listings, state: freshState() });
    const main = html.slice(html.indexOf("<main"), html.indexOf("</main>"));
    for (const href of ["tel:911", "tel:988", "sms:988", "tel:+18555310761"]) assert.ok(main.includes(`href="${href}"`), href);
    assert.ok(main.includes("If you can, stay with someone you trust."));
  });

  test("'soon' results put 988 and CAPS All Hours before sample listings", () => {
    const html = renderScreen({ name: "results" }, { listings, state: { ...freshState(), path: "soon" }, today: new Date() });
    assert.ok(html.indexOf("Call 988") < html.indexOf("Sample "));
    assert.ok(html.indexOf("CAPS All Hours") < html.indexOf('class="card listing-card"'));
  });

  test("spread the word and feedback are reachable and stay anonymous", () => {
    const ctx = { listings, state: freshState(), today: new Date() };
    const start = renderScreen({ name: "start" }, ctx);
    assert.ok(start.includes('href="#/spread-the-word"'));
    assert.ok(start.includes('href="#/feedback"'));
    assert.ok(start.includes("I'm not safe right now"));
    assert.ok(start.includes("I need to talk to someone soon"));
    assert.ok(start.includes("I want ongoing therapy or medication"));
    assert.ok(start.includes("I'm not sure what I need"));

    const spread = renderScreen({ name: "spread-the-word" }, ctx);
    assert.ok(spread.includes("About Front Door"));
    assert.ok(spread.includes("Spread the Word"));
    assert.ok(spread.includes("word of mouth"));
    for (const title of ["CAPS Social Media", "Student Emails", "Campus Posters", "Classroom Visits"]) {
      assert.ok(spread.includes(title), title);
    }
    assert.ok(spread.includes("https://bbbearrx.github.io/front-door-prototype/?v=2#/start"));
    assert.ok(spread.includes("<svg"));
    assert.ok(!spread.includes("api.qrserver.com"));

    const feedback = renderScreen({ name: "feedback" }, ctx);
    assert.ok(feedback.includes("Have you used Front Door before?"));
    assert.ok(feedback.includes("How easy was the website to use?"));
    assert.ok(feedback.includes("Were you able to find the resources you needed?"));
    assert.ok(feedback.includes("How helpful was your experience?"));
    assert.ok(feedback.includes("What did you like about Front Door?"));
    assert.ok(feedback.includes("What could we improve?"));
    assert.ok(feedback.includes("Somewhat"));
    assert.ok(feedback.includes("anonymous"));
    assert.ok(feedback.includes('data-action="feedback"'));
    assert.ok(!/type="email"|type="text"|name="email"|name="name"|name="student|diagnosis/i.test(feedback));

    const thanks = renderScreen(
      { name: "feedback" },
      { ...ctx, state: { ...freshState(), feedbackSent: true } }
    );
    assert.ok(thanks.includes("Thank you"));
    assert.ok(thanks.includes("Share another response"));
    assert.ok(thanks.includes('data-action="feedback-again"'));
  });

  test("parseHash keeps every existing route and adds the two new ones", () => {
    for (const name of ["start", "danger", "kinds", "coverage", "results", "how-we-verify", "spread-the-word", "feedback"]) {
      assert.deepEqual(parseHash(`#/${name}`), { name, id: null });
    }
    assert.deepEqual(parseHash("#/listing/abc"), { name: "listing", id: "abc" });
    assert.deepEqual(parseHash("#/report/abc"), { name: "report", id: "abc" });
    assert.deepEqual(parseHash("#/nonsense"), { name: "start", id: null });
  });

  test("empty results say so and show 988 and CAPS All Hours", () => {
    const state = { ...freshState(), path: "ongoing", coverage: "kaiser", filters: { ...emptyFilters(), cost: ["free"], language: ["Tagalog"] } };
    const html = renderScreen({ name: "results" }, { listings, state, today: new Date() });
    assert.ok(html.includes("No sample options match"));
    assert.ok(html.includes("removing a filter"));
    assert.ok(html.includes('href="tel:988"') && html.includes("CAPS All Hours"));
  });
});
