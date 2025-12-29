// 1) Put your Supabase creds here (Project Settings -> API)
const SUPABASE_URL = window.SUPABASE_URL;
const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY;

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// UI refs
const authStateEl = document.getElementById("authState");
const btnSignOut = document.getElementById("btnSignOut");
const authMsg = document.getElementById("authMsg");
const timerMsg = document.getElementById("timerMsg");

const emailEl = document.getElementById("email");
const passwordEl = document.getElementById("password");
const btnSignUp = document.getElementById("btnSignUp");
const btnSignIn = document.getElementById("btnSignIn");

const presetEl = document.getElementById("preset");
const customFastHoursEl = document.getElementById("customFastHours");
const btnStartNow = document.getElementById("btnStartNow");
const btnEnd = document.getElementById("btnEnd");

const timeLeftEl = document.getElementById("timeLeft");
const sessionMetaEl = document.getElementById("sessionMeta");
const statusDotEl = document.getElementById("statusDot");
const statusTextEl = document.getElementById("statusText");

const sessionsTable = document.getElementById("sessionsTable");
const sessionsBody = document.getElementById("sessionsBody");
const listHint = document.getElementById("listHint");

let tickInterval = null;
let activeSession = null; // latest active session row

function setStatus(isActive) {
  statusDotEl.className = isActive ? "ok" : "bad";
  statusTextEl.textContent = isActive ? "Active" : "Inactive";
}

function formatMs(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const hh = String(Math.floor(s / 3600)).padStart(2, "0");
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

function getFastingSeconds() {
  const val = presetEl.value;
  if (val === "custom") {
    const h = Number(customFastHoursEl.value || 16);
    return Math.max(1, h) * 3600;
  }
  const [fastH] = val.split(":").map(Number);
  return fastH * 3600;
}

function getFastName() {
  const val = presetEl.value;
  if (val === "custom") return `Custom ${customFastHoursEl.value}h`;
  return val;
}

async function refreshAuthUI() {
  const { data: { user } } = await supabaseClient.auth.getUser();

  if (user) {
    authStateEl.textContent = `Signed in: ${user.email}`;
    btnSignOut.classList.remove("hidden");
    listHint.textContent = "Loading your sessions...";
    await loadActiveSession();
    await loadSessions();
  } else {
    authStateEl.textContent = "Not signed in";
    btnSignOut.classList.add("hidden");
    sessionsTable.classList.add("hidden");
    listHint.textContent = "Sign in to load your history.";
    clearTimerUI();
  }
}

function clearTimerUI() {
  activeSession = null;
  setStatus(false);
  timeLeftEl.textContent = "--:--:--";
  sessionMetaEl.textContent = "No active session";
  if (tickInterval) clearInterval(tickInterval);
  tickInterval = null;
}

function startTicking() {
  if (tickInterval) clearInterval(tickInterval);
  tickInterval = setInterval(() => {
    if (!activeSession) return;
    const endsAt = new Date(activeSession.ends_at).getTime();
    const now = Date.now();
    const remaining = endsAt - now;
    timeLeftEl.textContent = formatMs(remaining);

    // auto-complete if time passed
    if (remaining <= 0) {
      timeLeftEl.textContent = "00:00:00";
      setStatus(false);
      statusTextEl.textContent = "Completed";
    }
  }, 250);
}

async function loadActiveSession() {
  timerMsg.textContent = "";
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) return;

  // Get latest active session for this user
  const { data, error } = await supabaseClient
    .from("fasting_sessions")
    .select("*")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("started_at", { ascending: false })
    .limit(1);

  if (error) {
    timerMsg.textContent = `Error loading active session: ${error.message}`;
    return;
  }

  activeSession = data?.[0] ?? null;

  if (!activeSession) {
    clearTimerUI();
    return;
  }

  setStatus(true);
  sessionMetaEl.textContent =
    `${activeSession.fast_name} • Started: ${new Date(activeSession.started_at).toLocaleString()} • Ends: ${new Date(activeSession.ends_at).toLocaleString()}`;

  startTicking();
}

async function loadSessions() {
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) return;

  const { data, error } = await supabaseClient
    .from("fasting_sessions")
    .select("id, fast_name, started_at, ends_at, status")
    .eq("user_id", user.id)
    .order("started_at", { ascending: false })
    .limit(30);

  if (error) {
    listHint.textContent = `Error: ${error.message}`;
    sessionsTable.classList.add("hidden");
    return;
  }

  sessionsBody.innerHTML = "";
  for (const row of data) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${new Date(row.started_at).toLocaleString()}</td>
      <td>${new Date(row.ends_at).toLocaleString()}</td>
      <td>${row.fast_name}</td>
      <td>${row.status}</td>
    `;
    sessionsBody.appendChild(tr);
  }

  sessionsTable.classList.remove("hidden");
  listHint.textContent = data.length ? "" : "No sessions yet.";
}

async function startFastNow() {
  timerMsg.textContent = "";
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) {
    timerMsg.textContent = "Please sign in first.";
    return;
  }

  // If you already have an active session, don't create a second one
  await loadActiveSession();
  if (activeSession && activeSession.status === "active") {
    timerMsg.textContent = "You already have an active session. End it first.";
    return;
  }

  const fastingSeconds = getFastingSeconds();
  const eatingSeconds = 0; // optional: add later if you want eating window tracking
  const fastName = getFastName();

  const startedAt = new Date();
  const endsAt = new Date(startedAt.getTime() + fastingSeconds * 1000);

  const { data, error } = await supabaseClient
    .from("fasting_sessions")
    .insert([{
      user_id: user.id,
      fast_name: fastName,
      fasting_seconds: fastingSeconds,
      eating_seconds: eatingSeconds,
      started_at: startedAt.toISOString(),
      ends_at: endsAt.toISOString(),
      status: "active"
    }])
    .select("*")
    .single();

  if (error) {
    timerMsg.textContent = `Could not start: ${error.message}`;
    return;
  }

  activeSession = data;
  setStatus(true);
  sessionMetaEl.textContent =
    `${data.fast_name} • Started: ${new Date(data.started_at).toLocaleString()} • Ends: ${new Date(data.ends_at).toLocaleString()}`;
  startTicking();
  await loadSessions();
}

async function endFast() {
  timerMsg.textContent = "";
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) {
    timerMsg.textContent = "Please sign in first.";
    return;
  }

  await loadActiveSession();
  if (!activeSession) {
    timerMsg.textContent = "No active session to end.";
    return;
  }

  // mark as cancelled (or completed; your choice)
  const { error } = await supabaseClient
    .from("fasting_sessions")
    .update({ status: "cancelled" })
    .eq("id", activeSession.id)
    .eq("user_id", user.id);

  if (error) {
    timerMsg.textContent = `Could not end: ${error.message}`;
    return;
  }

  clearTimerUI();
  await loadSessions();
}

// Auth actions
btnSignUp.addEventListener("click", async () => {
  authMsg.textContent = "";
  const email = emailEl.value.trim();
  const password = passwordEl.value;

  const { error } = await supabaseClient.auth.signUp({ email, password });
  if (error) authMsg.textContent = error.message;
  else authMsg.textContent = "Signup successful. If email confirmation is enabled, check your inbox.";
  await refreshAuthUI();
});

btnSignIn.addEventListener("click", async () => {
  authMsg.textContent = "";
  const email = emailEl.value.trim();
  const password = passwordEl.value;

  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) authMsg.textContent = error.message;
  await refreshAuthUI();
});

btnSignOut.addEventListener("click", async () => {
  await supabaseClient.auth.signOut();
  await refreshAuthUI();
});

btnStartNow.addEventListener("click", startFastNow);
btnEnd.addEventListener("click", endFast);

// react to auth changes
supabaseClient.auth.onAuthStateChange(() => refreshAuthUI());

// init
refreshAuthUI();

