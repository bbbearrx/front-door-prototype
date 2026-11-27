// Front Door prototype settings. Change these, not the code.

// A listing confirmed fewer than this many days ago shows as "Confirmed" (Verified).
export const VERIFIED_UNDER_DAYS = 60;

// A listing confirmed more than this many days ago is hidden (Stale).
// From VERIFIED_UNDER_DAYS up to and including this number, it shows as "Re-check due".
export const HIDE_AFTER_DAYS = 90;

// How many result cards to show before the "Show more" button.
export const INITIAL_RESULTS = 5;

// Paste the link to your feedback form here (for example a Google Form).
// While this is empty, the "Give feedback on this prototype" link is hidden.
export const FEEDBACK_FORM_URL = "";

// Real crisis contacts. These are the only real phone numbers in the prototype.
// Do not change them.
export const CRISIS = Object.freeze({
  emergency: { label: "911", tel: "tel:911" },
  lifeline: { label: "988", tel: "tel:988", sms: "sms:988" },
  capsAllHours: {
    label: "CAPS All Hours",
    display: "(855) 531-0761",
    tel: "tel:+18555310761",
  },
});

// Where demo "Report a problem" submissions are saved on this device.
export const REPORTS_STORAGE_KEY = "frontDoorDemoReports";

// Where anonymous "Share your feedback" responses are saved on this device.
// Nothing in the survey is sent over the network.
export const FEEDBACK_STORAGE_KEY = "frontDoorDemoFeedback";
