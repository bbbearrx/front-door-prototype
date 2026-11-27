# Front Door (clickable prototype)

Front Door is a phone-first guide for USF students who need more mental-health care than campus counseling (CAPS) can provide: ongoing therapy, a medication evaluation, low-cost care, or care while they're outside California. It asks a few simple questions and shows only options our team has confirmed by phone in the last 90 days, each with its cost, the date it was last checked, and a short script for the first call. Anything not confirmed is hidden automatically.

Front Door is non-clinical. It gives no advice and no diagnosis, has no accounts, and collects no health information.

A student project for the Horizon Collective at USF. Not an official USF or CAPS service.

## Every listing is a made-up sample

This prototype is for class testing.

- Every provider listing in `data/listings.json` is invented. Each name starts with "Sample", every phone number is in the fictional 555-0100 to 555-0199 range, and every website is on example.org.
- The only real contact details are the crisis numbers: 911, 988 (call or text), and USF CAPS's 24/7 line, CAPS All Hours, (855) 531-0761.
- Sample listings store `verified_days_ago` instead of a fixed date, so the demo never goes stale. The app turns that number into a date relative to today. **Real data would store the real date of each confirmation.**

## How a listing's status works

The rule lives in one pure function, `getStatus` in `js/logic.js`. The two cut-offs are named constants in `js/config.js` (`VERIFIED_UNDER_DAYS = 60`, `HIDE_AFTER_DAYS = 90`).

| Listing data | Status | Shown? |
|---|---|---|
| `override: "error"` | Error | Hidden |
| `override: "unreachable"` | Unreachable | Hidden |
| `verified_days_ago: null` | Not yet verified | Hidden |
| under 60 days | Verified ("Confirmed by phone 12 days ago") | Shown, green |
| 60 to 90 days | Due ("Re-check due soon") | Shown, amber |
| over 90 days | Stale | Hidden |

The "How we verify" page shows live counts and lists the hidden listings, so testers can see the rule working.

## Run it on your computer

It's plain HTML, CSS and JavaScript. There's nothing to install, but it needs a simple local server (opening `index.html` directly won't load the listings).

From this folder, run one of these:

```bash
python -m http.server 8000
```

```bash
npx serve .
```

Then open http://localhost:8000 (or the address `serve` prints).

## Run the tests

You need Node.js 20 or newer. No packages are needed.

```bash
node --test
```

The tests cover every status rule (including 59, 60, 90 and 91 days), matching and filtering (and that they never return a hidden listing), the sample data rules, and that the banner, crisis bar and footer render on every screen.

## Add your feedback form link

1. Make a feedback form (for example a Google Form) and copy its share link.
2. Open `js/config.js` and paste the link between the quotes:
   ```js
   export const FEEDBACK_FORM_URL = "https://forms.gle/your-form";
   ```
3. Save, then commit and push. A "Give feedback on this prototype" link appears in the footer and opens the form in a new tab. While the value is empty, the link stays hidden.

## Deploy with GitHub Pages

1. Push this folder to a public GitHub repository (ours is `front-door-prototype`).
2. On GitHub, open the repository, then **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to "Deploy from a branch", pick the `main` branch and the `/ (root)` folder, and click **Save**.
4. After a minute or two the site is live at `https://<your-username>.github.io/front-door-prototype/`.

Every push to `main` updates the live site.

## Files

- `index.html`: the single page
- `styles.css`: all styles (phone-first)
- `js/app.js`: routing (`#/start`, `#/danger`, `#/kinds`, `#/coverage`, `#/results`, `#/listing/<id>`, `#/report/<id>`, `#/how-we-verify`, `#/spread-the-word`, `#/feedback`) and rendering
- `js/poster-qr.js`: offline sample QR code for the campus-poster card (no external service)
- `js/logic.js`: status, matching and filtering as pure functions, no DOM
- `js/config.js`: settings, including the 60/90-day cut-offs and `FEEDBACK_FORM_URL`
- `data/listings.json`: the 16 made-up sample listings
- `tests/logic.test.js`: the tests
- `package.json`: only tells Node the files are JavaScript modules, so `node --test` works

## Privacy

No accounts, cookies, analytics or outside scripts. Two things can be saved in your browser's localStorage on your own device, and neither is sent anywhere:

- Demo "Report a problem" submissions (key `frontDoorDemoReports`), with the listing id, the reason, the optional note, and the time.
- Anonymous "Share your feedback" responses (key `frontDoorDemoFeedback`). The survey does not ask for a name, email, student ID, or health information.

## Spread the word and feedback

Version 2 adds two screens. Everything else, including `#/start` and the `?v=2` link, works as before.

- `#/spread-the-word` (also linked from the start page and the footer) explains that the team first relied on word of mouth, then lists four outreach ideas: CAPS social media, student emails, campus posters, and classroom visits. The poster card includes a sample QR code drawn in the page. It points at `https://bbbearrx.github.io/front-door-prototype/?v=2#/start`.
- `#/feedback` is a short anonymous survey. Submitting it shows a thank-you message and can save the answers on this device only.
