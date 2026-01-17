/*
  Digital Twin v3
  - Static frontend (GitHub Pages)
  - Secure backend proxy (Cloudflare Worker) to call OpenAI
  - AI Persona is the Twin Card (always included)
*/

// === CONFIG ===
// Set this to your deployed Worker URL, e.g. "https://digital-twin-api.<your>.workers.dev"
// If left blank, the app will call same-origin "/api/twin" (useful for local testing with a dev server).
const API_BASE_URL = "https://digital-twin-api.emilio-vasquez.workers.dev";

const els = {
  form: document.getElementById("twinForm"),
  ageRange: document.getElementById("ageRange"),
  majorInterest: document.getElementById("majorInterest"),
  socialUse: document.getElementById("socialUse"),
  socialValue: document.getElementById("socialValue"),
  locationSharing: document.getElementById("locationSharing"),
  lateNight: document.getElementById("lateNight"),

  // Scenario buttons (match IDs in index.html)
  scenarioPrivate: document.getElementById("scenarioPrivate"),
  scenarioSocial: document.getElementById("scenarioSocial"),
  scenarioLate: document.getElementById("scenarioLate"),
  resetBtn: document.getElementById("resetBtn"),

  adProfile: document.getElementById("adProfile"),
  adProfileWhy: document.getElementById("adProfileWhy"),
  riskScore: document.getElementById("riskScore"),
  riskBadge: document.getElementById("riskBadge"),
  riskWhy: document.getElementById("riskWhy"),
  targetConfidence: document.getElementById("targetConfidence"),
  confidenceBadge: document.getElementById("confidenceBadge"),
  confidenceWhy: document.getElementById("confidenceWhy"),
  likelyInterests: document.getElementById("likelyInterests"),
  recommendedActions: document.getElementById("recommendedActions"),
  changeExplain: document.getElementById("changeExplain"),
  goalList: document.getElementById("goalList"),

  // Twin card
  twinId: document.getElementById("twinId"),
  twinStrengthBadge: document.getElementById("twinStrengthBadge"),
  twinLikelihoodBadge: document.getElementById("twinLikelihoodBadge"),
  twinSignals: document.getElementById("twinSignals"),
  twinUseCases: document.getElementById("twinUseCases"),
  aiPersona: document.getElementById("aiPersona"),
  aiStatus: document.getElementById("aiStatus"),
  aiMeta: document.getElementById("aiMeta"),
  regenPersona: document.getElementById("regenPersona"),
  payloadPreview: document.getElementById("payloadPreview"),
};

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function badgeLevel(value, lowMax, medMax) {
  if (value <= lowMax) return { label: "Low", cls: "low" };
  if (value <= medMax) return { label: "Medium", cls: "medium" };
  return { label: "High", cls: "high" };
}

function setBadge(el, level) {
  el.classList.remove("low", "medium", "high");
  el.classList.add(level.cls);
  el.textContent = level.label;
}

function getPasswordHabit() {
  const checked = els.form.querySelector('input[name="passwordHabits"]:checked');
  return checked ? checked.value : "strong";
}

function setPasswordHabit(value) {
  const radio = els.form.querySelector(`input[name="passwordHabits"][value="${value}"]`);
  if (radio) radio.checked = true;
}

function getDevices() {
  return Array.from(els.form.querySelectorAll('input[name="devices"]:checked')).map((x) => x.value);
}

function setDevices(values) {
  const set = new Set(values);
  els.form.querySelectorAll('input[name="devices"]').forEach((cb) => {
    cb.checked = set.has(cb.value);
  });
}

function randomTwinId() {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const pick = (n) => {
    let out = "";
    if (window.crypto && window.crypto.getRandomValues) {
      const buf = new Uint8Array(n);
      window.crypto.getRandomValues(buf);
      for (let i = 0; i < n; i++) out += alphabet[buf[i] % alphabet.length];
      return out;
    }
    for (let i = 0; i < n; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
    return out;
  };
  return `DT-${pick(6)}`;
}

const SESSION_TWIN_ID = randomTwinId();
els.twinId.textContent = SESSION_TWIN_ID;

function interestLabel(key) {
  return (
    {
      cyber: "Cybersecurity",
      data: "Data Science",
      gaming: "Gaming",
      music: "Music",
      fitness: "Fitness",
      design: "Art & Design",
      business: "Business",
      travel: "Travel",
    }[key] || "General"
  );
}

function ageLabel(key) {
  return (
    {
      u18: "Under 18",
      "18_24": "18–24",
      "25_34": "25–34",
      "35_44": "35–44",
      "45p": "45+",
    }[key] || "Unknown"
  );
}

// === Core scoring (simple + explainable) ===
function computeRisk({ age, interest, social, location, password, devices, lateNight }) {
  const passwordPoints = { strong: 10, okay: 35, risky: 70 }[password] ?? 10;
  const agePoints = { u18: 6, "18_24": 10, "25_34": 12, "35_44": 10, "45p": 8 }[age] ?? 10;
  const socialPoints = social * 2; // 0..20
  const locationPoints = location ? 15 : 0;
  const lateNightPoints = lateNight ? 10 : 0;

  const devicePointsMap = { phone: 5, laptop: 3, tablet: 2, watch: 2, console: 3 };
  const devicePoints = devices.reduce((sum, d) => sum + (devicePointsMap[d] || 0), 0);

  const interestFlavor = ["cyber", "data"].includes(interest) ? -2 : 2;

  const raw = passwordPoints + agePoints + socialPoints + locationPoints + lateNightPoints + devicePoints + interestFlavor;
  return clamp(Math.round(raw), 0, 100);
}

function computeConfidence({ social, location, devices, lateNight }) {
  const deviceCount = devices.length;
  let raw = 35 + social * 4 + deviceCount * 6 + (location ? 10 : 0) + (lateNight ? 5 : 0);
  return clamp(Math.round(raw), 25, 95);
}

function pickAdProfile({ interest, social, devices, lateNight, location }) {
  const manySignals = devices.length >= 3 || social >= 7 || location;
  const map = {
    cyber: ["Security Scout", "Privacy-Pro Planner", "System Sleuth"],
    data: ["Insight Seeker", "Dashboard Devotee", "Pattern Hunter"],
    gaming: ["Cozy Gamer", "Hype Gamer", "Competitive Grinder"],
    music: ["Playlist Curator", "Concert Chaser", "New-Release Radar"],
    fitness: ["Goal Getter", "Routine Builder", "Tracker Fan"],
    design: ["Visual Explorer", "Creative Collector", "Aesthetic Architect"],
    business: ["Career Climber", "Deal Strategist", "Startup Watcher"],
    travel: ["Local Explorer", "Weekend Wanderer", "Deal Finder"],
  };
  const options = map[interest] || ["Curious Explorer", "Tech Taster", "Trend Tester"];
  if (lateNight && social >= 6) return options[1];
  if (manySignals) return options[2] || options[0];
  return options[0];
}

function adProfileWhyText({ social, location, devices, lateNight }) {
  const bits = [];
  if (social >= 7) bits.push("high social activity");
  if (location) bits.push("location signals");
  if (devices.length >= 3) bits.push("multiple devices");
  if (lateNight) bits.push("late-night pattern");
  if (bits.length === 0) return "Light signals → broader profile.";
  return `Signals like ${bits.slice(0, 2).join(" + ")} make the profile more specific.`;
}

function buildLikelyInterests({ interest, social, devices, lateNight, location }) {
  const base =
    {
      cyber: ["Password tools", "Privacy settings", "Security tips"],
      data: ["AI & analytics", "Cool dashboards", "Data storytelling"],
      gaming: ["Game drops", "Streaming", "Headsets & gear"],
      music: ["New releases", "Playlists", "Live shows"],
      fitness: ["Training plans", "Wearables", "Meal ideas"],
      design: ["Creative tools", "Inspiration boards", "Design trends"],
      business: ["Career growth", "Productivity", "Side hustles"],
      travel: ["Weekend plans", "Budget deals", "Local spots"],
    }[interest] || ["Trends", "Communities", "Recommendations"];

  const list = [...base];
  if (social >= 7) list.push("Creators & trends");
  if (location) list.push("Nearby events");
  if (devices.includes("console")) list.push("Gaming content");
  if (devices.includes("watch")) list.push("Health tracking");
  if (lateNight) list.push("Late-night browsing");

  return Array.from(new Set(list)).slice(0, 5);
}

function renderChips(containerEl, chips) {
  containerEl.innerHTML = "";
  chips.forEach((t) => {
    const span = document.createElement("span");
    span.className = "chip";
    span.textContent = t;
    containerEl.appendChild(span);
  });
}

function renderList(containerEl, items) {
  containerEl.innerHTML = "";
  items.forEach((t) => {
    const li = document.createElement("li");
    li.textContent = t;
    containerEl.appendChild(li);
  });
}

function riskWhyText({ password, location, social }) {
  const pieces = [];
  if (password === "risky") pieces.push("password reuse is a strong risk signal");
  if (location) pieces.push("always-on location adds exposure");
  if (social >= 7) pieces.push("high activity creates more surface area");
  if (pieces.length === 0) return "Looks fairly low-risk based on selected habits.";
  return `Main drivers: ${pieces.slice(0, 2).join(" + ")}.`;
}

function confidenceWhyText({ social, location, devices }) {
  const pieces = [];
  if (devices.length >= 3) pieces.push("more devices = more signals");
  if (social >= 6) pieces.push("more activity = clearer pattern");
  if (location) pieces.push("location adds context");
  if (pieces.length === 0) return "Fewer signals → the system is less confident guessing.";
  return `Why confidence is higher: ${pieces.slice(0, 2).join(" + ")}.`;
}

function smartRecommendedActions(state, riskLabel, confLabel) {
  const actions = [];
  actions.push(state.location ? "Try turning Location Sharing OFF and watch what changes." : "Try turning Location Sharing ON and see how confidence shifts.");
  actions.push(state.password !== "strong" ? "Switch Password Habits to “Strong” and see the risk score drop." : "You already have strong passwords — try changing a different signal.");
  actions.push(state.social >= 7 ? "Lower Social Media Use a bit and see if the profile becomes less specific." : "Increase Social Media Use to see confidence climb (more signals).");
  actions.push(`Right now: Risk is ${riskLabel} and confidence is ${confLabel}. Try to keep confidence high while lowering risk.`);
  return actions.slice(0, 4);
}

function renderGoals(state, riskLabel, confLabel) {
  const goals = [];
  goals.push(
    riskLabel !== "Low"
      ? { title: "Goal: Drop risk one level", body: "Move Security Risk down without changing Device Usage." }
      : { title: "Goal: Keep risk Low", body: "Increase Social Media Use while keeping Security Risk Low." }
  );

  goals.push(
    confLabel !== "High"
      ? { title: "Goal: Raise confidence", body: "Get Targeting Confidence to High while keeping Location Sharing OFF." }
      : { title: "Goal: Reduce signals", body: "Turn off 1–2 signals and see how confidence reacts." }
  );

  goals.push({ title: "Goal: Flip the Ad Profile", body: "Change only ONE setting and make the Ad Profile switch." });

  els.goalList.innerHTML = "";
  goals.slice(0, 3).forEach((g) => {
    const div = document.createElement("div");
    div.className = "goal";
    div.innerHTML = `<strong>${g.title}</strong><p>${g.body}</p>`;
    els.goalList.appendChild(div);
  });
}

function computeTwinStrengthScore(state, confidence) {
  const deviceCount = state.devices.length;
  const signalScore = confidence * 0.55 + state.social * 5 + deviceCount * 8 + (state.location ? 10 : 0) + (state.lateNight ? 6 : 0);
  return clamp(Math.round(signalScore), 0, 100);
}

function strengthLabel(score) {
  if (score <= 39) return { label: "Loose", cls: "low" };
  if (score <= 69) return { label: "Moderate", cls: "medium" };
  return { label: "Strong", cls: "high" };
}

function likelihoodLabel(score) {
  if (score <= 39) return { label: "Low", cls: "low" };
  if (score <= 69) return { label: "Medium", cls: "medium" };
  return { label: "High", cls: "high" };
}

function signalMapLines(state) {
  const deviceCount = state.devices.length;
  const socialLine = state.social >= 7 ? `Social media: High (${state.social}/10)` : state.social >= 4 ? `Social media: Medium (${state.social}/10)` : `Social media: Low (${state.social}/10)`;
  const locLine = `Location sharing: ${state.location ? "ON (adds context)" : "OFF"}`;
  const nightLine = `Late-night activity: ${state.lateNight ? "ON (pattern signal)" : "OFF"}`;
  const passLine = state.password === "strong" ? "Password habits: Strong (unique + MFA)" : state.password === "okay" ? "Password habits: Okay (some reuse)" : "Password habits: Risky (reuse/shared)";
  const devLine = `Device streams: ${deviceCount} (${state.devices.join(", ") || "none"})`;
  return [socialLine, locLine, passLine, devLine, nightLine];
}

function twinUseCases(state, confidence, risk) {
  const use = ["Personalized recommendations", "Ad targeting segments"];
  if (confidence >= 70) use.push("Trend prediction (what you’ll click)");
  if (state.location) use.push("Local suggestions (events/places)");
  use.push(risk >= 66 ? "Security prompts & extra verification" : "Account safety nudges");
  return Array.from(new Set(use)).slice(0, 5);
}

// === Explain changes ===
let prevSnap = null;
function stateSnap(state) {
  return {
    age: state.age,
    interest: state.interest,
    social: state.social,
    location: state.location,
    lateNight: state.lateNight,
    password: state.password,
    devices: state.devices.slice().sort().join(","),
  };
}

function diffExplain(a, b) {
  if (!a || !b) return "Try a preset, then change one thing and compare.";
  const changes = [];
  if (a.social !== b.social) changes.push(`social → ${b.social}/10`);
  if (a.location !== b.location) changes.push(`location → ${b.location ? "ON" : "OFF"}`);
  if (a.lateNight !== b.lateNight) changes.push(`late-night → ${b.lateNight ? "ON" : "OFF"}`);
  if (a.password !== b.password) changes.push(`password → ${b.password}`);
  if (a.devices !== b.devices) changes.push(`devices → updated`);
  if (a.age !== b.age) changes.push(`age → updated`);
  if (a.interest !== b.interest) changes.push(`interest → updated`);
  if (!changes.length) return "Try a preset, then change one thing and compare.";
  return `You changed: ${changes.slice(0, 2).join(" • ")}.`;
}

// === AI Persona generation ===
let latestPayload = null;
let latestDerived = null;
let debounceTimer = null;
let inflight = 0;

function setStatus(text) {
  els.aiStatus.textContent = text;
}

function apiUrl(path) {
  return (API_BASE_URL ? API_BASE_URL.replace(/\/$/, "") : "") + path;
}

async function fetchPersona(payload) {
  const reqId = ++inflight;
  setStatus("Generating…");

  try {
    const res = await fetch(apiUrl("/api/twin"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Backend error (${res.status}): ${txt}`);
    }

    const data = await res.json();

    // Only apply if this is the latest request
    if (reqId !== inflight) return;

    // Render persona
    const html = (data.persona_html || "").trim();
    const text = (data.persona_text || "").trim();

    els.aiPersona.innerHTML = html ? html : `<p>${escapeHtml(text || "(No persona returned.)")}</p>`;
    setStatus("Updated");

    const now = new Date();
    els.aiMeta.textContent = `Updated: ${now.toLocaleTimeString()} • Model: ${data.model || "(unknown)"}`;
  } catch (err) {
    if (reqId !== inflight) return;
    setStatus("Offline");
    els.aiPersona.innerHTML = `<p class="muted"><strong>AI persona unavailable.</strong> Connect the secure backend, then try again.</p>
      <p class="muted small">${escapeHtml(String(err.message || err))}</p>`;
    els.aiMeta.textContent = "";
  }
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function schedulePersona(force = false) {
  if (!latestPayload) return;

  // Debounce to avoid spamming the backend
  const delay = force ? 0 : 900;
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => fetchPersona(latestPayload), delay);
}

// === Update loop ===
function updateAll(withExplain = true) {
  const state = {
    age: els.ageRange.value,
    interest: els.majorInterest.value,
    social: Number(els.socialUse.value),
    location: els.locationSharing.checked,
    lateNight: els.lateNight.checked,
    password: getPasswordHabit(),
    devices: getDevices(),
  };

  els.socialValue.textContent = `${state.social}/10`;

  const risk = computeRisk(state);
  const confidence = computeConfidence(state);
  const adProfile = pickAdProfile(state);
  const interests = buildLikelyInterests(state);

  const riskLvl = badgeLevel(risk, 34, 65);
  const confLvl = badgeLevel(confidence, 44, 75);

  setBadge(els.riskBadge, riskLvl);
  setBadge(els.confidenceBadge, confLvl);

  els.riskScore.textContent = risk;
  els.targetConfidence.textContent = confidence;

  els.adProfile.textContent = adProfile;
  els.adProfileWhy.textContent = adProfileWhyText(state);
  els.riskWhy.textContent = riskWhyText(state);
  els.confidenceWhy.textContent = confidenceWhyText(state);

  renderChips(els.likelyInterests, interests);
  renderList(els.recommendedActions, smartRecommendedActions(state, riskLvl.label, confLvl.label));
  renderGoals(state, riskLvl.label, confLvl.label);

  // Twin strength/likelihood + maps
  const strengthScore = computeTwinStrengthScore(state, confidence);
  const strength = strengthLabel(strengthScore);
  const likelihood = likelihoodLabel(strengthScore);
  setBadge(els.twinStrengthBadge, strength);
  setBadge(els.twinLikelihoodBadge, likelihood);

  renderList(els.twinSignals, signalMapLines(state));
  renderChips(els.twinUseCases, twinUseCases(state, confidence, risk));

  // Explain changes
  if (withExplain) {
    const snap = stateSnap(state);
    els.changeExplain.textContent = diffExplain(prevSnap, snap);
    prevSnap = snap;
  }

  // Build AI payload (what the backend uses)
  latestPayload = {
    twin_id: SESSION_TWIN_ID,
    inputs: {
      age_range: ageLabel(state.age),
      major_interest: interestLabel(state.interest),
      social_media_use: state.social,
      location_sharing: state.location,
      password_habits: state.password,
      device_usage: state.devices,
      late_night_activity: state.lateNight,
    },
    outputs: {
      ad_profile: adProfile,
      security_risk_score: risk,
      risk_level: riskLvl.label,
      targeting_confidence: confidence,
      confidence_level: confLvl.label,
      likely_interests: interests,
      recommended_actions: smartRecommendedActions(state, riskLvl.label, confLvl.label),
      mirroring_strength: strength.label,
      recreation_likelihood: likelihood.label,
    },
    style: {
      tone: "friendly",
      audience: "college_students",
      avoid: ["fear", "threats", "guilt"],
      length: "medium",
    },
  };

  latestDerived = { state, risk, confidence, adProfile, interests, riskLvl, confLvl, strength, likelihood };

  // Instructor preview
  els.payloadPreview.textContent = JSON.stringify(latestPayload, null, 2);

  // Auto-update persona
  schedulePersona(false);
}

// === Presets ===
function applyPreset(name) {
  if (name === "private") {
    els.ageRange.value = "18_24";
    els.majorInterest.value = "cyber";
    els.socialUse.value = "2";
    els.locationSharing.checked = false;
    els.lateNight.checked = false;
    setPasswordHabit("strong");
    setDevices(["phone", "laptop"]);
  }

  if (name === "social") {
    els.ageRange.value = "18_24";
    els.majorInterest.value = "music";
    els.socialUse.value = "8";
    els.locationSharing.checked = true;
    els.lateNight.checked = false;
    setPasswordHabit("okay");
    setDevices(["phone", "laptop", "watch"]);
  }

  if (name === "late") {
    els.ageRange.value = "18_24";
    els.majorInterest.value = "gaming";
    els.socialUse.value = "7";
    els.locationSharing.checked = true;
    els.lateNight.checked = true;
    setPasswordHabit("risky");
    setDevices(["phone", "laptop", "console"]);
  }

  updateAll(true);
  schedulePersona(true);
}

function resetAll() {
  els.ageRange.value = "18_24";
  els.majorInterest.value = "cyber";
  els.socialUse.value = "5";
  els.locationSharing.checked = false;
  els.lateNight.checked = false;
  setPasswordHabit("strong");
  setDevices(["phone", "laptop"]);
  updateAll(true);
  schedulePersona(true);
}

// Defensive bindings: if an element ID is changed in HTML, we don't want the whole app to crash.
if (els.scenarioPrivate) els.scenarioPrivate.addEventListener("click", () => applyPreset("private"));
if (els.scenarioSocial) els.scenarioSocial.addEventListener("click", () => applyPreset("social"));
if (els.scenarioLate) els.scenarioLate.addEventListener("click", () => applyPreset("late"));
if (els.resetBtn) els.resetBtn.addEventListener("click", resetAll);
if (els.regenPersona) els.regenPersona.addEventListener("click", () => schedulePersona(true));

if (els.form) {
  els.form.addEventListener("input", () => updateAll(true));
  els.form.addEventListener("change", () => updateAll(true));
}

// Init
prevSnap = null;
updateAll(false);
setStatus("Generating…");
schedulePersona(true);
