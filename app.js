const SUPABASE_URL = window.SUPABASE_URL;
const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY;

const supabase = supabaseJs.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

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

let sessionData = null;
let interval = null;

/* ---------- AUTH ---------- */

async function refreshUI() {
  const { data:{ user } } = await supabase.auth.getUser();

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
  const { error } = await supabase.auth.signInWithPassword({
    email: email.value,
    password: password.value
  });
  authMsg.textContent = error ? error.message : "";
  refreshUI();
};

document.getElementById("btnSignUp").onclick = async () => {
  const { error } = await supabase.auth.signUp({
    email: email.value,
    password: password.value
  });
  authMsg.textContent = error ? error.message : "Account created. Sign in.";
};

document.getElementById("btnSignOut").onclick = async () => {
  await supabase.auth.signOut();
  location.reload();
};

/* ---------- FASTING ---------- */

async function loadActiveSession() {
  const { data:{ user } } = await supabase.auth.getUser();
  if (!user) return;

  const { data } = await supabase
    .from("fasting_sessions")
    .select("*")
    .eq("user_id", user.id)
    .eq("status", "active")
    .single();

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

    timerEl.textContent = format(remaining);
    progressBar.style.width = `${100 - (remaining / total) * 100}%`;

    if (remaining <= 0) finishFast();
  }, 250);
}

async function finishFast() {
  clearInterval(interval);
  dot.classList.remove("active");
  statusText.textContent = "Completed";

  await supabase
    .from("fasting_sessions")
    .update({ status:"completed" })
    .eq("id", sessionData.id);

  sessionData = null;
}

document.getElementById("btnStart").onclick = async () => {
  if (sessionData) return;

  const hours = Number(preset.value);
  const now = new Date();
  const end = new Date(now.getTime() + hours * 3600 * 1000);

  const { data } = await supabase
    .from("fasting_sessions")
    .insert([{
      fasting_seconds: hours * 3600,
      eating_seconds: 0,
      started_at: now,
      ends_at: end,
      status: "active"
    }])
    .select()
    .single();

  sessionData = data;
  startTimer();
};

document.getElementById("btnEnd").onclick = async () => {
  if (!sessionData) return;
  await supabase
    .from("fasting_sessions")
    .update({ status:"cancelled" })
    .eq("id", sessionData.id);

  location.reload();
};

function format(ms) {
  const s = Math.floor(ms / 1000);
  return [
    Math.floor(s / 3600),
    Math.floor((s % 3600) / 60),
    s % 60
  ].map(v => String(v).padStart(2,"0")).join(":");
}

refreshUI();
