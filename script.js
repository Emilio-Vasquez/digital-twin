// Digital Twin Simulator (client-side only)
// No storage. No tracking. No network calls.

const els = {
  form: document.getElementById("twinForm"),
  ageRange: document.getElementById("ageRange"),
  majorInterest: document.getElementById("majorInterest"),
  socialUse: document.getElementById("socialUse"),
  socialValue: document.getElementById("socialValue"),
  locationSharing: document.getElementById("locationSharing"),
  lateNight: document.getElementById("lateNight"),

  scenarioPrivate: document.getElementById("scenarioPrivate"),
  scenarioSocial: document.getElementById("scenarioSocial"),
  scenarioLate: document.getElementById("scenarioLate"),

  goalList: document.getElementById("goalList"),
  changeExplain: document.getElementById("changeExplain"),

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

  // Digital Twin Snapshot elements
  generateTwin: document.getElementById("generateTwin"),
  twinId: document.getElementById("twinId"),
  twinType: document.getElementById("twinType"),
  twinStrengthBadge: document.getElementById("twinStrengthBadge"),
  twinLikelihoodBadge: document.getElementById("twinLikelihoodBadge"),
  twinSummary: document.getElementById("twinSummary"),
  twinSignals: document.getElementById("twinSignals"),
  twinUseCases: document.getElementById("twinUseCases"),
  twinGeneratedMeta: document.getElementById("twinGeneratedMeta"),
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
  return Array.from(els.form.querySelectorAll('input[name="devices"]:checked')).map(
    (x) => x.value
  );
}

function setDevices(values) {
  const set = new Set(values);
  els.form.querySelectorAll('input[name="devices"]').forEach((cb) => {
    cb.checked = set.has(cb.value);
  });
}

function interestLabel(key) {
  return ({
    cyber: "Cybersecurity",
    data: "Data Science",
    gaming: "Gaming",
    music: "Music",
    fitness: "Fitness",
    design: "Art & Design",
    business: "Business",
    travel: "Travel",
  }[key] || "General");
}

function ageLabel(key) {
  return ({
    u18: "Under 18",
    "18_24": "18–24",
    "25_34": "25–34",
    "35_44": "35–44",
    "45p": "45+",
  }[key] || "Unknown");
}

function computeRisk({ age, interest, social, location, password, devices, lateNight }) {
  const passwordPoints = { strong: 10, okay: 35, risky: 70 }[password] ?? 10;
  const agePoints = { u18: 6, "18_24": 10, "25_34": 12, "35_44": 10, "45p": 8 }[age] ?? 10;

  const socialPoints = social * 2; // 0..20
  const locationPoints = location ? 15 : 0;
  const lateNightPoints = lateNight ? 10 : 0;

  const devicePointsMap = { phone: 5, laptop: 3, tablet: 2, watch: 2, console: 3 };
  const devicePoints = devices.reduce((sum, d) => sum + (devicePointsMap[d] || 0), 0);

  const interestFlavor = ["cyber", "data"].includes(interest) ? -2 : 2;

  const raw =
    passwordPoints +
    agePoints +
    socialPoints +
    locationPoints +
    lateNightPoints +
    devicePoints +
    interestFlavor;

  return clamp(Math.round(raw), 0, 100);
}

function computeConfidence({ social, location, devices, lateNight }) {
  const deviceCount = devices.length;
  let raw =
    35 +
    social * 4 +      // 0..40
    deviceCount * 6 + // 0..30
    (location ? 10 : 0) +
    (lateNight ? 5 : 0);

  return clamp(Math.round(raw), 25, 95);
}

function pickAdProfile({ interest, social, devices, lateNight, location }) {
  const manySignals = (devices.length >= 3) || (social >= 7) || location;

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
  if (bits.length === 0) return "Based on a lighter set of signals, the profile stays broad and general.";
  return `Based on ${bits.slice(0, 2).join(" + ")}, the profile becomes more specific.`;
}

function buildLikelyInterests({ interest, social, devices, lateNight, location }) {
  const base = {
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

function renderActions(items) {
  els.recommendedActions.innerHTML = "";
  items.forEach((t) => {
    const li = document.createElement("li");
    li.textContent = t;
    els.recommendedActions.appendChild(li);
  });
}

function riskWhyText({ password, location, social }) {
  const pieces = [];
  if (password === "risky") pieces.push("password reuse is a big risk signal");
  if (location) pieces.push("always-on location increases exposure");
  if (social >= 7) pieces.push("high activity creates more “surface area”");

  if (pieces.length === 0) return "This looks fairly low-risk based on the selected habits.";
  return `Main drivers: ${pieces.slice(0, 2).join(" + ")}.`;
}

function confidenceWhyText({ social, location, devices }) {
  const pieces = [];
  if (devices.length >= 3) pieces.push("more devices = more signals");
  if (social >= 6) pieces.push("more activity = clearer pattern");
  if (location) pieces.push("location adds extra context");

  if (pieces.length === 0) return "Fewer signals = the system feels less confident about guessing.";
  return `Why confidence is higher: ${pieces.slice(0, 2).join(" + ")}.`;
}

function smartRecommendedActions(state, riskLabel, confLabel) {
  const actions = [];

  if (state.location) actions.push("Try turning Location Sharing OFF and watch what changes.");
  else actions.push("Try turning Location Sharing ON and see how targeting confidence shifts.");

  if (state.password !== "strong") actions.push("Switch Password Habits to “Strong” and see how much the risk score drops.");
  else actions.push("You’re already in “Strong” passwords — try changing a different signal and compare.");

  if (state.social >= 7) actions.push("Lower Social Media Use a little and see if the profile becomes less specific.");
  else actions.push("Increase Social Media Use and watch confidence climb (more signals).");

  actions.push(`Right now: Risk is ${riskLabel} and confidence is ${confLabel}. Try to keep confidence high while lowering risk.`);
  return actions.slice(0, 4);
}

function renderGoals(state, riskLabel, confLabel) {
  const goals = [];

  if (riskLabel !== "Low") {
    goals.push({
      title: "Goal: Drop risk one level",
      body: "Try to move Security Risk down (High→Medium or Medium→Low) without changing Device Usage.",
    });
  } else {
    goals.push({
      title: "Goal: Keep risk Low",
      body: "Try increasing Social Media Use while keeping Security Risk at Low.",
    });
  }

  if (confLabel !== "High") {
    goals.push({
      title: "Goal: Raise confidence",
      body: "Try to get Targeting Confidence to High while keeping Location Sharing OFF.",
    });
  } else {
    goals.push({
      title: "Goal: Reduce signals",
      body: "Try turning off 1–2 signals (like Late-night or Location) and see how confidence reacts.",
    });
  }

  goals.push({
    title: "Goal: Flip the Ad Profile",
    body: "Change only ONE setting and try to make the Ad Profile switch to a different label.",
  });

  els.goalList.innerHTML = "";
  goals.slice(0, 3).forEach((g) => {
    const div = document.createElement("div");
    div.className = "goal";
    div.innerHTML = `<strong>${g.title}</strong><p>${g.body}</p>`;
    els.goalList.appendChild(div);
  });
}

// ===== Digital Twin Snapshot logic =====

function randomTwinId() {
  // Stable for the current page session (not stored anywhere).
  // Prefer crypto for better randomness; fallback is fine for a demo.
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

function computeTwinStrengthScore(state, confidence) {
  // “How detailed is the twin?” (signals + predictability)
  const deviceCount = state.devices.length;
  const signalScore =
    (confidence * 0.55) +
    (state.social * 5) +                 // 0..50
    (deviceCount * 8) +                  // 0..40
    (state.location ? 10 : 0) +
    (state.lateNight ? 6 : 0);

  return clamp(Math.round(signalScore), 0, 100);
}

function strengthLabel(score) {
  if (score <= 39) return { label: "Loose", cls: "low" };
  if (score <= 69) return { label: "Moderate", cls: "medium" };
  return { label: "Strong", cls: "high" };
}

function likelihoodLabel(score) {
  // “How easy is it for a system to recreate a consistent persona?”
  // (Framed as predictability, not identity.)
  if (score <= 39) return { label: "Low", cls: "low" };
  if (score <= 69) return { label: "Medium", cls: "medium" };
  return { label: "High", cls: "high" };
}

function buildTwinType(state, adProfile) {
  const interest = interestLabel(state.interest);
  return `${adProfile} • ${interest}`;
}

function personaSummary(state, adProfile, interests, riskLabel, confLabel, strengthObj, likelihoodObj) {
  const age = ageLabel(state.age);
  const interest = interestLabel(state.interest);

  const s1 = `This twin looks like a ${age} profile with a strong pull toward ${interest}. The system labels it as “${adProfile}.”`;

  const s2 =
    likelihoodObj.label === "High"
      ? `Because the selected signals are consistent, the twin is easier for a system to recreate (recreation likelihood: ${likelihoodObj.label}).`
      : `Because fewer signals are present, the twin stays more general (recreation likelihood: ${likelihoodObj.label}).`;

  const s3 = `Right now, the twin’s “mirroring strength” is ${strengthObj.label}, with Security Risk at ${riskLabel} and Targeting Confidence at ${confLabel}.`;

  return `${s1} ${s2} ${s3}`;
}

function signalMapLines(state) {
  const deviceCount = state.devices.length;

  const socialLine =
    state.social >= 7 ? `Social media: High activity (${state.social}/10)` :
    state.social >= 4 ? `Social media: Medium activity (${state.social}/10)` :
                        `Social media: Low activity (${state.social}/10)`;

  const locLine = `Location sharing: ${state.location ? "ON (adds context)" : "OFF (less context)"}`;
  const nightLine = `Late-night activity: ${state.lateNight ? "ON (pattern signal)" : "OFF"}`;

  const passLine =
    state.password === "strong" ? "Password habits: Strong (unique + MFA)" :
    state.password === "okay" ? "Password habits: Okay (some reuse)" :
                               "Password habits: Risky (reuse/shared)";

  const devLine = `Device streams: ${deviceCount} device${deviceCount === 1 ? "" : "s"} (${state.devices.join(", ") || "none"})`;

  return [socialLine, locLine, passLine, devLine, nightLine];
}

function twinUseCases(state, confidence, risk) {
  // Friendly: what systems typically do with a twin-like profile
  const use = [];

  // Always include personalization
  use.push("Personalized recommendations");
  use.push("Ad targeting segments");

  if (confidence >= 70) use.push("Trend prediction / “what you’ll click”");
  if (state.location) use.push("Local suggestions (events/places)");

  if (risk >= 66) use.push("Security prompts & extra verification");
  else use.push("Account safety nudges");

  // Keep it short and clean
  return Array.from(new Set(use)).slice(0, 5);
}

function renderSignalList(lines) {
  els.twinSignals.innerHTML = "";
  lines.forEach((t) => {
    const li = document.createElement("li");
    li.textContent = t;
    els.twinSignals.appendChild(li);
  });
}

function generateTwinSnapshot(latestState, derived) {
  const { risk, confidence, adProfile, interests, riskLvl, confLvl } = derived;

  const strengthScore = computeTwinStrengthScore(latestState, confidence);
  const strengthObj = strengthLabel(strengthScore);
  const likelihoodObj = likelihoodLabel(strengthScore); // same score, different framing

  // Populate snapshot UI
  els.twinId.textContent = SESSION_TWIN_ID;
  els.twinType.textContent = buildTwinType(latestState, adProfile);

  setBadge(els.twinStrengthBadge, strengthObj);
  setBadge(els.twinLikelihoodBadge, likelihoodObj);

  els.twinSummary.textContent = personaSummary(
    latestState,
    adProfile,
    interests,
    riskLvl.label,
    confLvl.label,
    strengthObj,
    likelihoodObj
  );

  const now = new Date();
  els.twinGeneratedMeta.textContent = `Generated: ${now.toLocaleTimeString()} (this is fictional and stays on your device)`;

  renderSignalList(signalMapLines(latestState));
  renderChips(els.twinUseCases, twinUseCases(latestState, confidence, risk));
}

// ===== Live update plumbing =====

function stateSnapshot() {
  return {
    age: els.ageRange.value,
    interest: els.majorInterest.value,
    social: Number(els.socialUse.value),
    location: els.locationSharing.checked,
    lateNight: els.lateNight.checked,
    password: getPasswordHabit(),
    devices: getDevices().slice().sort().join(","), // comparable
  };
}

let prev = null;

// Derived values cache so the “Generate” button uses the current state
let latestState = null;
let latestDerived = null;

function diffExplain(a, b) {
  if (!a || !b) return "Make a change to see why outputs shift.";

  const changes = [];
  if (a.social !== b.social) changes.push(`social media use → ${b.social}/10`);
  if (a.location !== b.location) changes.push(`location sharing → ${b.location ? "ON" : "OFF"}`);
  if (a.lateNight !== b.lateNight) changes.push(`late-night activity → ${b.lateNight ? "ON" : "OFF"}`);
  if (a.password !== b.password) changes.push(`password habits → ${b.password}`);
  if (a.devices !== b.devices) changes.push(`device usage → updated`);
  if (a.age !== b.age) changes.push(`age range → updated`);
  if (a.interest !== b.interest) changes.push(`major interest → updated`);

  if (changes.length === 0) return "Make a change to see why outputs shift.";
  const top = changes.slice(0, 2).join(" • ");
  return `You changed: ${top}. The algorithm recalculated based on those “signals.”`;
}

function update(withExplain = true) {
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
  renderActions(smartRecommendedActions(state, riskLvl.label, confLvl.label));
  renderGoals(state, riskLvl.label, confLvl.label);

  latestState = state;
  latestDerived = { risk, confidence, adProfile, interests, riskLvl, confLvl };

  if (withExplain) {
    const snap = stateSnapshot();
    els.changeExplain.textContent = diffExplain(prev, snap);
    prev = snap;
  }
}

// Scenario presets
function applyScenario(name) {
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

  update(true);
}

els.scenarioPrivate.addEventListener("click", () => applyScenario("private"));
els.scenarioSocial.addEventListener("click", () => applyScenario("social"));
els.scenarioLate.addEventListener("click", () => applyScenario("late"));

// Generate Twin Snapshot button
els.generateTwin.addEventListener("click", () => {
  if (!latestState || !latestDerived) return;
  generateTwinSnapshot(latestState, latestDerived);
});

// Live feedback
els.form.addEventListener("input", () => update(true));
els.form.addEventListener("change", () => update(true));

// Initialize
prev = stateSnapshot();
update(false);
els.changeExplain.textContent = "Try a scenario, then change ONE thing and compare outputs.";

// Pre-fill Twin ID so it feels real immediately (still requires button to generate content)
els.twinId.textContent = SESSION_TWIN_ID;
