/* ===============================
   SUPABASE SETUP
================================ */

const SUPABASE_URL = "https://gybhivuztvvjhxazzgtf.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5YmhpdnV6dHZ2amh4YXp6Z3RmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcwMzQ1OTgsImV4cCI6MjA4MjYxMDU5OH0.tKkWQHc3b3mf92qljBbcv0IE86puzLVUA_fbWfSlehU";


const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ======================
// 2) ELEMENTS
// ======================
const authView = document.getElementById("authView");
const appView = document.getElementById("appView");
const bottomNav = document.getElementById("bottomNav");

const statusDot = document.getElementById("statusDot");
const statusLabel = document.getElementById("statusLabel");

const emailEl = document.getElementById("email");
const passEl = document.getElementById("password");
const btnSignIn = document.getElementById("btnSignIn");
const btnSignUp = document.getElementById("btnSignUp");
const btnSignOut = document.getElementById("btnSignOut");
const btnSignOut2 = document.getElementById("btnSignOut2");
const authMsg = document.getElementById("authMsg");

const tabs = Array.from(document.querySelectorAll(".tab"));
const btabs = Array.from(document.querySelectorAll(".btab"));

const panelTimer = document.getElementById("panel-timer");
const panelInsights = document.getElementById("panel-insights");
const panelHistory = document.getElementById("panel-history");
const panelSettings = document.getElementById("panel-settings");

const timeLeftEl = document.getElementById("timeLeft");
const centerLabel = document.getElementById("centerLabel");
const centerSub = document.getElementById("centerSub");

const badgePlan = document.getElementById("badgePlan");
const badgeStart = document.getElementById("badgeStart");
const badgeEnd = document.getElementById("badgeEnd");

const ringProgress = document.getElementById("ringProgress");

const presetHours = document.getElementById("presetHours");
const startMode = document.getElementById("startMode");
const manualStartWrap = document.getElementById("manualStartWrap");
const manualStart = document.getElementById("manualStart");

const btnStart = document.getElementById("btnStart");
const btnEnd = document.getElementById("btnEnd");
const timerMsg = document.getElementById("timerMsg");

const insightsList = document.getElementById("insightsList");

const historyHint = document.getElementById("historyHint");
const historyList = document.getElementById("historyList");

const motivationStyle = document.getElementById("motivationStyle");
const endBehavior = document.getElementById("endBehavior");

// ======================
// 3) STATE
// ======================
let activeSession = null;
let tick = null;

const RING_CIRC = 578; // approx for r=92
ringProgress.setAttribute("stroke-dasharray", String(RING_CIRC));
ringProgress.setAttribute("stroke-dashoffset", String(RING_CIRC));

// ======================
// 4) UTIL
// ======================
function fmtTime(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const hh = String(Math.floor(s / 3600)).padStart(2, "0");
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

function fmtDT(d) {
  try {
    return new Date(d).toLocaleString(undefined, {
      month: "short", day: "numeric", hour: "numeric", minute: "2-digit"
    });
  } catch {
    return "—";
  }
}

function setMsg(el, text = "", kind = "") {
  el.textContent = text;
  el.classList.remove("error", "ok");
  if (kind) el.classList.add(kind);
}

function setSignedInUI(email) {
  statusDot.classList.add("on");
  statusLabel.textContent = email ? `Signed in` : `Signed in`;
  btnSignOut.classList.remove("hidden");
  bottomNav.classList.remove("hidden");
}

function setSignedOutUI() {
  statusDot.classList.remove("on");
  statusLabel.textContent = "Signed out";
  btnSignOut.classList.add("hidden");
  bottomNav.classList.add("hidden");
}

function setButtonsState(isActive) {
  btnStart.disabled = isActive;
  btnEnd.disabled = !isActive;
}

function getHours() {
  return Number(presetHours.value || 16);
}

function getStartDate() {
  if (startMode.value === "manual") {
    const v = manualStart.value;
    if (!v) return null;
    // datetime-local is local time; Date(v) parses as local
    const d = new Date(v);
    if (isNaN(d.getTime())) return null;
    return d;
  }
  return new Date();
}

// ======================
// 5) TABS
// ======================
function showTab(key) {
  const map = {
    timer: panelTimer,
    insights: panelInsights,
    history: panelHistory,
    settings: panelSettings,
  };

  for (const [k, el] of Object.entries(map)) {
    el.classList.toggle("hidden", k !== key);
  }

  tabs.forEach(t => t.classList.toggle("active", t.dataset.tab === key));
  btabs.forEach(t => t.classList.toggle("active", t.dataset.tab === key));

  // Small quality: refresh history when opening History tab
  if (key === "history") loadHistory().catch(()=>{});
  if (key === "insights") renderInsights();
}

tabs.forEach(t => t.addEventListener("click", () => showTab(t.dataset.tab)));
btabs.forEach(t => t.addEventListener("click", () => showTab(t.dataset.tab)));

// ======================
// 6) INSIGHTS (general + motivating)
// ======================
const INSIGHTS = [
  { from: 0, to: 2, title: "Settle in", desc: "You’re starting strong. Hydrate, keep it easy, and let the routine carry you." },
  { from: 2, to: 6, title: "Energy shift", desc: "Many people notice cravings fade a bit. A walk + water can help you stay calm." },
  { from: 6, to: 10, title: "Steady focus", desc: "You may feel more ‘even’. Keep it simple: water, electrolytes (if you use them), and chill." },
  { from: 10, to: 14, title: "Discipline zone", desc: "This is the mental win. You’re proving consistency to yourself — that matters." },
  { from: 14, to: 18, title: "Deep routine", desc: "Commonly reported: lighter feeling + clarity. Keep it safe; listen to your body." },
  { from: 18, to: 24, title: "Long fast territory", desc: "If you’re going long, be mindful. Consider a gentle refeed and don’t overdo it." },
];

function renderInsights() {
  const hoursElapsed = activeSession ? (Date.now() - new Date(activeSession.started_at).getTime()) / 36e5 : 0;

  insightsList.innerHTML = "";
  INSIGHTS.forEach(step => {
    const div = document.createElement("div");
    div.className = "step" + (hoursElapsed >= step.from && hoursElapsed < step.to ? " active" : "");
    div.innerHTML = `
      <div class="top">
        <div class="t">${step.title}</div>
        <div class="range">${step.from}–${step.to}h</div>
      </div>
      <div class="d">${step.desc}</div>
    `;
    insightsList.appendChild(div);
  });
}

// ======================
// 7) DATA LOADERS
// ======================
async function getUser() {
  const { data: { user } } = await supabaseClient.auth.getUser();
  return user || null;
}

async function loadActiveSession() {
  const user = await getUser();
  if (!user) return null;

  const { data, error } = await supabaseClient
    .from("fasting_sessions")
    .select("*")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("started_at", { ascending: false })
    .limit(1);

  if (error) throw error;
  return data?.[0] ?? null;
}

async function loadHistory() {
  const user = await getUser();
  if (!user) return;

  historyHint.textContent = "Loading your sessions…";
  historyList.innerHTML = "";

  const { data, error } = await supabaseClient
    .from("fasting_sessions")
    .select("id, fast_name, started_at, ends_at, status, fasting_seconds")
    .eq("user_id", user.id)
    .order("started_at", { ascending: false })
    .limit(25);

  if (error) {
    historyHint.textContent = `Error: ${error.message}`;
    return;
  }

  if (!data || data.length === 0) {
    historyHint.textContent = "No sessions yet. Start your first fast.";
    return;
  }

  historyHint.textContent = "";
  for (const row of data) {
    const div = document.createElement("div");
    div.className = "item";
    const hours = Math.round((row.fasting_seconds || 0) / 3600);
    div.innerHTML = `
      <div class="left">
        <div class="name">${row.fast_name || `${hours}h fast`}</div>
        <div class="sub">${fmtDT(row.started_at)} → ${fmtDT(row.ends_at)}</div>
      </div>
      <div class="right">
        <div>${row.status}</div>
        <div>${hours}h</div>
      </div>
    `;
    historyList.appendChild(div);
  }
}

// ======================
// 8) TIMER RENDER
// ======================
function stopTick() {
  if (tick) clearInterval(tick);
  tick = null;
}

function applyRing(progress01) {
  const clamped = Math.max(0, Math.min(1, progress01));
  const offset = RING_CIRC * (1 - clamped);
  ringProgress.setAttribute("stroke-dashoffset", String(offset));
}

function setInactiveUI() {
  stopTick();
  activeSession = null;

  centerLabel.textContent = "Ready when you are";
  timeLeftEl.textContent = "--:--:--";
  centerSub.textContent = "Start a fast to begin";

  badgeStart.textContent = "Start: —";
  badgeEnd.textContent = "End: —";

  applyRing(0);
  setButtonsState(false);

  renderInsights();
}

function startTicking() {
  stopTick();
  setButtonsState(true);

  const style = motivationStyle.value || "calm";

  tick = setInterval(async () => {
    if (!activeSession) return;

    const startMs = new Date(activeSession.started_at).getTime();
    const endMs = new Date(activeSession.ends_at).getTime();
    const now = Date.now();

    const total = Math.max(1, endMs - startMs);
    const remaining = Math.max(0, endMs - now);
    const done = total - remaining;

    timeLeftEl.textContent = fmtTime(remaining);
    applyRing(done / total);

    const hoursElapsed = done / 36e5;

    // Motivating center label
    if (remaining > 0) {
      if (style === "pushy") {
        centerLabel.textContent = hoursElapsed < 2 ? "You started. Keep going." :
                                  hoursElapsed < 8 ? "Stay locked in." :
                                  hoursElapsed < 14 ? "You’re doing it." :
                                  "Finish strong.";
      } else {
        centerLabel.textContent = hoursElapsed < 2 ? "Easy start" :
                                  hoursElapsed < 8 ? "Steady pace" :
                                  hoursElapsed < 14 ? "Calm focus" :
                                  "Almost there";
      }
      centerSub.textContent = "Breathe. Hydrate. Keep it simple.";
    }

    // When done: mark completed in DB (so refresh shows correct status)
    if (remaining <= 0) {
      timeLeftEl.textContent = "00:00:00";
      centerLabel.textContent = "Fast complete";
      centerSub.textContent = "Nice work. Break it gently.";

      stopTick();
      setButtonsState(false);

      // Mark DB completed (best-effort)
      try {
        await supabaseClient
          .from("fasting_sessions")
          .update({ status: "completed" })
          .eq("id", activeSession.id);

        // reload session/history
        activeSession = null;
        await bootAfterLogin();
      } catch {
        // If update fails, user still sees complete locally
      }
    }

    // Update insights highlighting
    renderInsights();
  }, 300);
}

function setActiveUI(session) {
  activeSession = session;

  const hours = Math.round((session.fasting_seconds || 0) / 3600);
  badgePlan.textContent = `Plan: ${hours}h`;

  badgeStart.textContent = `Start: ${fmtDT(session.started_at)}`;
  badgeEnd.textContent = `End: ${fmtDT(session.ends_at)}`;

  setMsg(timerMsg, "");

  startTicking();
}

// ======================
// 9) ACTIONS
// ======================
startMode.addEventListener("change", () => {
  manualStartWrap.classList.toggle("hidden", startMode.value !== "manual");
});

presetHours.addEventListener("change", () => {
  badgePlan.textContent = `Plan: ${getHours()}h`;
});

btnStart.addEventListener("click", async () => {
  setMsg(timerMsg, "");

  const user = await getUser();
  if (!user) {
    setMsg(timerMsg, "Please sign in first.", "error");
    return;
  }

  // Prevent double active sessions
  const existing = await loadActiveSession();
  if (existing) {
    setMsg(timerMsg, "You already have an active fast. End it first.", "error");
    setActiveUI(existing);
    return;
  }

  const hours = getHours();
  const startDate = getStartDate();

  if (!startDate) {
    setMsg(timerMsg, "Pick a valid manual start time.", "error");
    return;
  }

  const endDate = new Date(startDate.getTime() + hours * 3600 * 1000);

  // Friendly name
  const fastName = `${hours}h fast`;

  btnStart.disabled = true;

  const { data, error } = await supabaseClient
    .from("fasting_sessions")
    .insert([{
      user_id: user.id, // ✅ required for RLS
      fast_name: fastName,
      fasting_seconds: hours * 3600,
      eating_seconds: 0,
      started_at: startDate.toISOString(),
      ends_at: endDate.toISOString(),
      status: "active"
    }])
    .select()
    .single();

  btnStart.disabled = false;

  if (error) {
    setMsg(timerMsg, error.message, "error");
    return;
  }

  setMsg(timerMsg, "Fast started.", "ok");
  setActiveUI(data);
  await loadHistory();
});

btnEnd.addEventListener("click", async () => {
  setMsg(timerMsg, "");

  const user = await getUser();
  if (!user) return;

  const current = await loadActiveSession();
  if (!current) {
    setMsg(timerMsg, "No active fast to end.", "error");
    setInactiveUI();
    return;
  }

  const status = endBehavior.value || "cancelled";
  btnEnd.disabled = true;

  const { error } = await supabaseClient
    .from("fasting_sessions")
    .update({ status })
    .eq("id", current.id)
    .eq("user_id", user.id);

  btnEnd.disabled = false;

  if (error) {
    setMsg(timerMsg, error.message, "error");
    return;
  }

  // Reset local UI cleanly
  setMsg(timerMsg, status === "completed" ? "Marked completed." : "Ended.", "ok");
  await bootAfterLogin();
});

// ======================
// 10) AUTH
// ======================
btnSignUp.addEventListener("click", async () => {
  setMsg(authMsg, "");
  const email = (emailEl.value || "").trim();
  const password = passEl.value || "";

  const { error } = await supabaseClient.auth.signUp({ email, password });
  if (error) setMsg(authMsg, error.message, "error");
  else setMsg(authMsg, "Account created. You can sign in now.", "ok");
});

btnSignIn.addEventListener("click", async () => {
  setMsg(authMsg, "");
  const email = (emailEl.value || "").trim();
  const password = passEl.value || "";

  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) {
    setMsg(authMsg, error.message, "error");
    return;
  }
  await refreshAuthUI();
});

async function signOut() {
  await supabaseClient.auth.signOut();
  // Clean reset (feels like a real app)
  window.location.reload();
}
btnSignOut.addEventListener("click", signOut);
btnSignOut2.addEventListener("click", signOut);

// ======================
// 11) BOOT
// ======================
async function bootAfterLogin() {
  setButtonsState(false);
  badgePlan.textContent = `Plan: ${getHours()}h`;

  // load active
  const session = await loadActiveSession();
  if (!session) {
    setInactiveUI();
  } else {
    setActiveUI(session);
  }

  // render insights + history
  renderInsights();
  await loadHistory();
}

async function refreshAuthUI() {
  const user = await getUser();

  if (!user) {
    setSignedOutUI();
    authView.classList.remove("hidden");
    appView.classList.add("hidden");
    bottomNav.classList.add("hidden");
    setInactiveUI();
    showTab("timer");
    return;
  }

  setSignedInUI(user.email);
  authView.classList.add("hidden");
  appView.classList.remove("hidden");
  bottomNav.classList.remove("hidden");

  // Default tab
  showTab("timer");

  await bootAfterLogin();
}

// React to auth changes (if token refresh happens)
supabaseClient.auth.onAuthStateChange(() => {
  refreshAuthUI().catch(()=>{});
});

// Init
refreshAuthUI().catch((e) => {
  console.error(e);
});





