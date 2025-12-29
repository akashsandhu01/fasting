/* ===============================
   SUPABASE SETUP
================================ */

const SUPABASE_URL = window.APP_CONFIG?.SUPABASE_URL;
const SUPABASE_ANON_KEY = window.APP_CONFIG?.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error("Missing Supabase config");
}

const supabaseClient = supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);


/* ===============================
   ELEMENT REFERENCES
================================ */

const authView = document.getElementById("authView");
const appView = document.getElementById("appView");

const email = document.getElementById("email");
const password = document.getElementById("password");
const authMsg = document.getElementById("authMsg");

const timerEl = document.getElementById("timer");
const statusText = document.getElementById("statusText");
const dot = document.getElementById("dot");
const progressBar = document.getElementById("progressBar");
const preset = document.getElementById("preset");
const appMsg = document.getElementById("appMsg");

/* ===============================
   STATE
================================ */

let sessionData = null;
let interval = null;

/* ===============================
   AUTH FLOW
================================ */

async function refreshUI() {
  const { data: { user } } = await supabaseClient.auth.getUser();

  if (!user) {
    authView.classList.remove("hidden");
    appView.classList.add("hidden");
    return;
  }

  authView.classList.add("hidden");
  appView.classList.remove("hidden");

  loadActiveSession();
}

document.getElementById("btnSignIn").onclick = async () => {
  authMsg.textContent = "";

  const { error } = await supabaseClient.auth.signInWithPassword({
    email: email.value.trim(),
    password: password.value
  });

  if (error) {
    authMsg.textContent = error.message;
    return;
  }

  refreshUI();
};

document.getElementById("btnSignUp").onclick = async () => {
  authMsg.textContent = "";

  const { error } = await supabaseClient.auth.signUp({
    email: email.value.trim(),
    password: password.value
  });

  authMsg.textContent = error
    ? error.message
    : "Account created. You can sign in now.";
};

document.getElementById("btnSignOut").onclick = async () => {
  await supabaseClient.auth.signOut();
  window.location.reload();
};

/* ===============================
   FASTING LOGIC
================================ */

async function loadActiveSession() {
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) return;

  const { data } = await supabaseClient
    .from("fasting_sessions")
    .select("*")
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  sessionData = data || null;

  if (sessionData) startTimer();
}

function startTimer() {
  clearInterval(interval);

  dot.classList.add("active");
  statusText.textContent = "Active";

  interval = setInterval(() => {
    const now = Date.now();
    const start = new Date(sessionData.started_at).getTime();
    const end = new Date(sessionData.ends_at).getTime();

    const remaining = Math.max(0, end - now);
    const total = end - start;

    timerEl.textContent = formatTime(remaining);
    progressBar.style.width = `${100 - (remaining / total) * 100}%`;

    if (remaining <= 0) completeFast();
  }, 250);
}

async function completeFast() {
  clearInterval(interval);

  dot.classList.remove("active");
  statusText.textContent = "Completed";

  await supabaseClient
    .from("fasting_sessions")
    .update({ status: "completed" })
    .eq("id", sessionData.id);

  sessionData = null;
}

document.getElementById("btnStart").onclick = async () => {
  if (sessionData) return;

  const hours = Number(preset.value);
  const start = new Date();
  const end = new Date(start.getTime() + hours * 3600 * 1000);

  const { data, error } = await supabaseClient
    .from("fasting_sessions")
    .insert([{
      fasting_seconds: hours * 3600,
      eating_seconds: 0,
      started_at: start,
      ends_at: end,
      status: "active"
    }])
    .select()
    .single();

  if (error) {
    appMsg.textContent = error.message;
    return;
  }

  sessionData = data;
  startTimer();
};

document.getElementById("btnEnd").onclick = async () => {
  if (!sessionData) return;

  await supabaseClient
    .from("fasting_sessions")
    .update({ status: "cancelled" })
    .eq("id", sessionData.id);

  window.location.reload();
};

/* ===============================
   HELPERS
================================ */

function formatTime(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const h = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
  const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
  const s = String(totalSeconds % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

/* ===============================
   INIT
================================ */

refreshUI();

