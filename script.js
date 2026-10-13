/* =========================================================
   ChatGPT Images clone – all behaviour lives here
   ========================================================= */

// ---------- Helpers ----------
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function store(key, value) {
  try {
    if (value === undefined) return JSON.parse(localStorage.getItem(key));
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) { return null; }
}

// ---------- State ----------
let user = store("user");               // {name, email} or null
let creations = store("creations") || []; // [{id, prompt, style, emoji, hue}]
let activeStyle = "";
let attachedFile = null;
let toastTimer;

// ---------- API settings (chat answers) ----------
const API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-5-5";      // change to any model your key can use
const SYSTEM_PROMPT = "You are a helpful assistant. Answer simple questions clearly and briefly (under 120 words).";
let apiKey = store("apiKey") || "";
let chatHistory = [];                   // [{role, content}]
let imageMode = false;                  // true when "ChatGPT Images" model is picked
let forceImage = false;                 // true after clicking a template card

// ---------- Template cards (like the screenshot) ----------
const templates = [
  { label: "'80s flashback", emoji: "😎", cls: "c1", prompt: "'80s flashback portrait with sunglasses and a retro jacket" },
  { label: "Good morning", emoji: "☕", cls: "c2", prompt: "Good morning coffee on a mountain lake at sunrise" },
  { label: "Join a cricket victory scene", emoji: "🏏", cls: "c3", prompt: "Cricket victory celebration in a packed stadium" },
  { label: "Luxe collage", emoji: "🌺", cls: "c4", prompt: "Luxe collage with lilies and warm tones" },
  { label: "Dog on grass", emoji: "🐕", cls: "c5", prompt: "A small dog on green grass, top view" },
  { label: "Travel tin", emoji: "📷", cls: "c6", prompt: "Travel memory tin with photos and a camera" },
  { label: "Cartoon avatar", emoji: "📖", cls: "c7", prompt: "Cartoon adventurer girl reading a book" },
  { label: "Flower doodle", emoji: "🌼", cls: "c8", prompt: "Minimal flower doodle with a tiny bee", dark: true },
];
const gradients = {
  c1: "linear-gradient(160deg,#6d5a4a,#b04a7a 60%,#2a7d8a)",
  c2: "linear-gradient(180deg,#f5a65b,#6a7f5a 60%,#3b2a1f)",
  c3: "linear-gradient(180deg,#1a2a55,#2d4fa8 60%,#101a3a)",
  c4: "linear-gradient(160deg,#8a3b2a,#c98a5b 60%,#5a2a1f)",
  c5: "linear-gradient(180deg,#4a8a2a,#6aa83a)",
  c6: "#b9d6bd",
  c7: "linear-gradient(180deg,#5ab0f0,#f0c9a0)",
  c8: "#f0f0f0",
};

function renderTemplates() {
  $("#templates").innerHTML = templates.map((t, i) => `
    <div class="card ${t.dark ? "dark-label" : ""}" style="background:${gradients[t.cls]}" data-i="${i}">
      <span class="emoji">${t.emoji}</span>
      <span class="label">${t.label}</span>
    </div>`).join("");
}

// ---------- Toast ----------
function toast(text) {
  const t = $("#toast");
  t.textContent = text;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2600);
}

// ---------- Modal system ----------
function openModal(html, big = false) {
  const m = $("#modal");
  m.className = "modal" + (big ? " big" : "");
  m.innerHTML = `<button class="x" data-close>×</button>` + html;
  $("#overlay").hidden = false;
  const first = m.querySelector("input");
  if (first) first.focus();
}
function closeModal() { $("#overlay").hidden = true; }

$("#overlay").addEventListener("click", (e) => {
  if (e.target.id === "overlay" || e.target.hasAttribute("data-close")) closeModal();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") { closeModal(); $("#modelMenu").hidden = true; }
});

// ---------- Login / Signup ----------
function authModal(mode) {
  const signup = mode === "signup";
  openModal(`
    <h2>${signup ? "Create your account" : "Welcome back"}</h2>
    <p class="sub">${signup ? "Sign up to save your images." : "Log in to see your saved images."}</p>
    ${signup ? '<input type="text" id="fName" placeholder="Full name">' : ""}
    <input type="email" id="fEmail" placeholder="Email address">
    <input type="password" id="fPass" placeholder="Password">
    <div class="error" id="fError"></div>
    <button class="pill solid" id="fSubmit">${signup ? "Sign up" : "Log in"}</button>
    <p class="sub" style="margin:16px 0 0;text-align:center">
      ${signup ? "Already have an account?" : "No account yet?"}
      <a href="#" id="switchAuth" style="color:inherit">${signup ? "Log in" : "Sign up"}</a>
    </p>`);

  $("#switchAuth").onclick = (e) => { e.preventDefault(); authModal(signup ? "login" : "signup"); };
  $("#fSubmit").onclick = () => {
    const email = $("#fEmail").value.trim();
    const pass = $("#fPass").value;
    const name = signup ? $("#fName").value.trim() : email.split("@")[0];
    const err = $("#fError");
    if (signup && !name) return (err.textContent = "Please enter your name.");
    if (!/^\S+@\S+\.\S+$/.test(email)) return (err.textContent = "Enter a valid email address.");
    if (pass.length < 6) return (err.textContent = "Password must be at least 6 characters.");
    user = { name, email };
    store("user", user);
    closeModal();
    renderAuth();
    toast(`Welcome, ${name}!`);
  };
}

function logout() {
  user = null;
  store("user", null);
  renderAuth();
  toast("You have been logged out.");
}

function renderAuth() {
  if (user) {
    $("#auth").innerHTML = `<button class="avatar" id="avatarBtn" title="${user.email}">${user.name[0].toUpperCase()}</button>`;
    $("#avatarBtn").onclick = () => openModal(`
      <h2>${user.name}</h2><p class="sub">${user.email}</p>
      <button class="pill soft" id="logoutBtn">Log out</button>`);
    $("#sbBottom").innerHTML = `<h4>Hi, ${user.name}</h4><p>Your images are saved on this device.</p>`;
    document.addEventListener("click", function once(e) {
      if (e.target.id === "logoutBtn") { closeModal(); logout(); document.removeEventListener("click", once); }
    });
  } else {
    $("#auth").innerHTML = `
      <button class="pill solid" id="loginBtn">Log in</button>
      <button class="pill soft" id="signupBtn">Sign up for free</button>`;
    $("#loginBtn").onclick = () => authModal("login");
    $("#signupBtn").onclick = () => authModal("signup");
    $("#sbBottom").innerHTML = `
      <h4>Get responses tailored to you</h4>
      <p>Log in to get answers based on saved chats, plus create images and upload files.</p>
      <button class="btn-wide" id="sbLogin">Log in</button>`;
    $("#sbLogin").onclick = () => authModal("login");
  }
}

// ---------- Settings ----------
function settingsModal() {
  const light = document.body.classList.contains("light");
  openModal(`
    <h2>Settings</h2><p class="sub">Customize this demo.</p>
    <div class="row"><span>Light theme</span><button class="switch ${light ? "on" : ""}" id="themeSwitch"></button></div>
    <div class="row"><span>API key: ${apiKey ? "saved" : "not set (offline answers)"}</span><button class="link-btn" style="margin:0" id="keyBtn">${apiKey ? "Change" : "Add"}</button></div>
    <div class="row"><span>Saved images: ${creations.length}</span><button class="link-btn" style="margin:0" id="wipe">Delete all</button></div>
    <div class="row"><span>${user ? "Signed in as " + user.email : "Not signed in"}</span>
      ${user ? '<button class="link-btn" style="margin:0" id="setLogout">Log out</button>' : ""}</div>`);
  $("#themeSwitch").onclick = (e) => {
    document.body.classList.toggle("light");
    e.target.classList.toggle("on");
    store("light", document.body.classList.contains("light"));
  };
  $("#wipe").onclick = () => { clearAll(); closeModal(); };
  $("#keyBtn").onclick = keyModal;
  if (user) $("#setLogout").onclick = () => { closeModal(); logout(); };
}

// ---------- Fake image generation ----------
const emojiMap = [
  [/dog|puppy/, "🐕"], [/cat|kitten/, "🐈"], [/flower|lily|rose/, "🌸"], [/coffee|tea/, "☕"],
  [/mountain|hill/, "🏔️"], [/sea|ocean|beach|wave/, "🌊"], [/city|street|building/, "🌆"],
  [/space|planet|star|galaxy/, "🪐"], [/car|racing/, "🏎️"], [/robot|ai /, "🤖"],
  [/cricket|ball|stadium/, "🏏"], [/food|pizza|burger/, "🍕"], [/dragon/, "🐉"],
  [/forest|tree/, "🌲"], [/girl|woman|portrait/, "🧑‍🎨"], [/sun|sunrise|sunset/, "🌅"],
];
function pickEmoji(text) {
  const t = text.toLowerCase();
  for (const [re, e] of emojiMap) if (re.test(t)) return e;
  return ["✨", "🎨", "🌈", "🖼️"][t.length % 4];
}
function hash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}
const styleHues = { watercolor: [190, 320], cyberpunk: [290, 180], anime: [330, 210], vintage: [35, 15] };

// Builds an SVG picture from the prompt, so each prompt looks different
function artSVG(c, forDownload = false) {
  const h = hash(c.prompt + c.style);
  const [a, b] = styleHues[c.style] || [h % 360, (h >> 4) % 360];
  const shapes = Array.from({ length: 5 }, (_, i) => {
    const x = (hash(c.prompt + i) % 400), y = (hash(c.prompt + "y" + i) % 300), r = 30 + (hash(c.prompt + "r" + i) % 80);
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="hsla(${(a + i * 40) % 360},80%,70%,.25)"/>`;
  }).join("");
  const size = forDownload ? 'width="800" height="600"' : 'class="art" preserveAspectRatio="xMidYMid slice"';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" ${size}>
    <defs><linearGradient id="g${c.id}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="hsl(${a},70%,45%)"/><stop offset="1" stop-color="hsl(${b},70%,25%)"/>
    </linearGradient></defs>
    <rect width="400" height="300" fill="url(#g${c.id})"/>${shapes}
    <text x="200" y="165" font-size="90" text-anchor="middle">${c.emoji}</text></svg>`;
}

function renderCreations() {
  $("#creationsWrap").hidden = creations.length === 0;
  $("#creations").innerHTML = creations.map((c) => `
    <div class="card" data-id="${c.id}">
      ${artSVG(c)}
      <div class="art-actions">
        <button data-dl="${c.id}" title="Download">⬇</button>
        <button data-del="${c.id}" title="Delete">🗑</button>
      </div>
      <span class="label">${c.prompt}</span>
    </div>`).join("");
  renderHistory();
}

function renderHistory() {
  const items = creations.slice(0, 6);
  $("#history").innerHTML = items.length
    ? `<h5>Recent</h5>` + items.map((c) => `<button data-hist="${c.id}">${c.prompt}</button>`).join("")
    : "";
}

function generate() {
  const input = $("#prompt");
  const text = input.value.trim();
  if (!text) { toast("Please describe an image first."); input.focus(); return; }

  const id = Date.now();
  // loading placeholder
  $("#creationsWrap").hidden = false;
  $("#creations").insertAdjacentHTML("afterbegin",
    `<div class="card loading" id="load${id}"><div class="spinner"></div><span>Creating image...</span></div>`);
  input.value = "";
  $("#sendBtn").classList.remove("active");

  setTimeout(() => {
    const c = {
      id, prompt: text, style: activeStyle,
      emoji: pickEmoji(text + (attachedFile ? " portrait" : "")),
    };
    creations.unshift(c);
    store("creations", creations);
    renderCreations();
    removeAttachment();
    toast("Image ready!");
  }, 1600);
}

function clearAll() {
  creations = [];
  store("creations", creations);
  renderCreations();
  toast("All images deleted.");
}

function downloadArt(c) {
  const blob = new Blob([artSVG(c, true)], { type: "image/svg+xml" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "image-" + c.id + ".svg";
  a.click();
  URL.revokeObjectURL(a.href);
}

function viewer(c) {
  openModal(`
    <div class="viewer-art">${artSVG(c)}</div>
    <p class="viewer-prompt">${c.prompt}${c.style ? " · " + c.style : ""}</p>
    <button class="pill solid" id="vDl">Download</button>
    <button class="pill soft" id="vReuse" style="margin-top:8px">Use this prompt again</button>`, true);
  $("#vDl").onclick = () => downloadArt(c);
  $("#vReuse").onclick = () => { closeModal(); setPrompt(c.prompt); forceImage = true; };
}

// ---------- API key modal ----------
function keyModal() {
  openModal(`
    <h2>API key</h2>
    <p class="sub">Paste your Anthropic API key to answer questions.</p>
    <input type="password" id="keyInput" placeholder="sk-ant-..." value="${apiKey}">
    <div class="error" id="keyError"></div>
    <button class="pill solid" id="keySave">Save key</button>
    ${apiKey ? '<button class="pill soft" id="keyRemove" style="margin-top:8px">Remove key</button>' : ""}
    <p class="note">The key is stored only in this browser (localStorage) and sent only to Anthropic.
    Use this for personal testing; for a public website, call the API from a backend instead.</p>`);
  $("#keySave").onclick = () => {
    const k = $("#keyInput").value.trim();
    if (!k.startsWith("sk-")) return ($("#keyError").textContent = "That doesn't look like an API key.");
    apiKey = k; store("apiKey", k); closeModal(); toast("API key saved. Ask a question!");
  };
  if (apiKey) $("#keyRemove").onclick = () => { apiKey = ""; store("apiKey", ""); closeModal(); toast("API key removed."); };
}

// ---------- Chat: ask the API a question ----------
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>");

function renderChat(loading = false, error = "") {
  $("#chatWrap").hidden = chatHistory.length === 0 && !loading && !error;
  $("#chat").innerHTML =
    chatHistory.map((m) => `<div class="msg ${m.role}"><div class="bubble">${esc(m.content)}</div></div>`).join("") +
    (loading ? `<div class="msg assistant"><div class="bubble typing"><i></i><i></i><i></i></div></div>` : "") +
    (error ? `<div class="msg assistant"><div class="bubble err">${esc(error)}</div></div>` : "");
  $("#chatWrap").scrollIntoView({ behavior: "smooth", block: "nearest" });
}

// ---------- Offline answers (used when no API key is saved) ----------
const capitals = {
  india: "New Delhi", france: "Paris", japan: "Tokyo", germany: "Berlin", italy: "Rome", spain: "Madrid",
  china: "Beijing", russia: "Moscow", australia: "Canberra", canada: "Ottawa", brazil: "Brasília",
  "united states": "Washington, D.C.", usa: "Washington, D.C.", "united kingdom": "London", uk: "London",
  pakistan: "Islamabad", nepal: "Kathmandu", bangladesh: "Dhaka", "sri lanka": "Colombo", egypt: "Cairo",
  "south africa": "Pretoria", mexico: "Mexico City", argentina: "Buenos Aires", turkey: "Ankara",
  indonesia: "Jakarta", thailand: "Bangkok", "saudi arabia": "Riyadh", uae: "Abu Dhabi",
};
const jokes = [
  "Why do programmers prefer dark mode? Because light attracts bugs.",
  "Why did the computer go to the doctor? It had a virus.",
  "I told my computer I needed a break. Now it won't stop sending me Kit-Kat ads.",
  "Why was the JavaScript developer sad? Because he didn't Node how to Express himself.",
];
const facts = [
  [/largest planet/, "Jupiter is the largest planet in our solar system."],
  [/tallest (mountain|peak)|highest (mountain|peak)/, "Mount Everest is the tallest mountain above sea level, at about 8,849 m."],
  [/largest ocean/, "The Pacific Ocean is the largest ocean."],
  [/speed of light/, "The speed of light is about 299,792 km per second."],
  [/days in a (year|leap year)/, "A normal year has 365 days, and a leap year has 366."],
  [/days in a week/, "There are 7 days in a week."],
  [/national animal of india/, "The Bengal tiger is the national animal of India."],
  [/national bird of india/, "The Indian peafowl (peacock) is the national bird of India."],
  [/boiling point of water/, "Water boils at 100 °C (212 °F) at sea level."],
  [/closest star|nearest star/, "The Sun is the closest star to Earth."],
];

function localAnswer(raw) {
  const t = raw.toLowerCase().replace(/[?!.]+$/, "").trim();

  // simple maths: "12 * 7", "what is 20 + 5", "2^5"
  const expr = t.replace(/^(what is|what's|calculate|solve|compute)\s+/, "");
  if (/^[\d\s+\-*/().%^x]+$/.test(expr) && /\d/.test(expr) && /[+\-*/%^x]/.test(expr)) {
    try {
      const v = Function('"use strict";return (' + expr.replace(/x/g, "*").replace(/\^/g, "**") + ")")();
      if (isFinite(v)) return expr + " = " + +v.toFixed(6);
    } catch (e) { /* not valid maths, fall through */ }
  }

  const cap = t.match(/capital (?:city )?of (?:the )?([a-z ]+)/);
  if (cap) {
    const c = capitals[cap[1].trim()];
    return c ? "The capital of " + cap[1].trim().replace(/\b\w/g, (m) => m.toUpperCase()) + " is " + c + "." :
               "I don't know that capital offline. Add an API key in Settings to ask about any country.";
  }
  for (const [re, ans] of facts) if (re.test(t)) return ans;

  if (/\bjoke\b/.test(t)) return jokes[Math.floor(Math.random() * jokes.length)];
  if (/\b(current time|time now)\b|what('s| is) the time|what time is it/.test(t)) return "It's " + new Date().toLocaleTimeString() + ".";
  if (/today'?s date|\bwhat day\b|\bwhat('s| is) the date\b|\bdate today\b/.test(t))
    return "Today is " + new Date().toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" }) + ".";
  if (/^(hi|hello|hey|hii|namaste)\b/.test(t)) return "Hello! 👋 Ask me a simple question, or tell me to draw something.";
  if (/how are you/.test(t)) return "I'm doing great, thanks for asking! How can I help?";
  if (/who (made|created|built) you/.test(t)) return "I'm a demo assistant built with HTML, CSS and JavaScript as a learning project.";
  if (/your name|who are you/.test(t)) return "I'm a demo ChatGPT-style assistant running right in your browser.";
  if (/what can you do|^help$/.test(t)) return "I can create pictures from a description (try \"draw a dragon\") and answer simple questions: maths, capitals, jokes, date and time. Add an API key in Settings to answer anything.";
  if (/weather/.test(t)) return "I can't check live weather. Try a weather app or website for that.";
  if (/thank/.test(t)) return "You're welcome! 😊";
  if (/^(bye|goodbye|see you)/.test(t)) return "Goodbye! Come back any time.";
  return null;
}
// END localAnswer

function askOffline(text) {
  $("#prompt").value = "";
  $("#sendBtn").classList.remove("active");
  chatHistory.push({ role: "user", content: text });
  renderChat(true);
  setTimeout(() => {
    const ans = localAnswer(text) ||
      "I only know a few things offline: greetings, simple maths, capitals, jokes, date and time. Add an API key in Settings and I can answer anything.";
    chatHistory.push({ role: "assistant", content: ans });
    renderChat();
  }, 700);
}

async function ask(text) {
  if (!apiKey) return askOffline(text);   // no key: use built-in answers
  const input = $("#prompt");
  input.value = "";
  $("#sendBtn").classList.remove("active");
  chatHistory.push({ role: "user", content: text });
  renderChat(true);
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({ model: MODEL, max_tokens: 600, system: SYSTEM_PROMPT, messages: chatHistory.slice(-10) }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error((data.error && data.error.message) || "Request failed (" + res.status + ")");
    const reply = data.content.filter((b) => b.type === "text").map((b) => b.text).join("\n");
    chatHistory.push({ role: "assistant", content: reply || "(no answer)" });
    renderChat();
  } catch (err) {
    chatHistory.pop();                  // drop the unanswered question
    input.value = text;                 // give it back so the user can retry
    $("#sendBtn").classList.add("active");
    renderChat(false, "Couldn't get an answer: " + err.message);
  }
}

$("#clearChat").addEventListener("click", () => { chatHistory = []; renderChat(); toast("Chat cleared."); });

// ---------- Decide: image or question? ----------
function isImagePrompt(text) {
  if (imageMode || forceImage || attachedFile || activeStyle) return true;
  return /^(image:|draw|paint|sketch|illustrate|generate (an? )?(image|picture|photo)|create (an? )?(image|picture|photo)|make (an? )?(image|picture|photo))/i.test(text)
      || /\b(image|picture|photo|illustration|wallpaper|poster|logo|drawing|painting) of\b/i.test(text);
}

function submit() {
  const text = $("#prompt").value.trim();
  if (!text) { toast("Type a question or describe an image."); $("#prompt").focus(); return; }
  if (isImagePrompt(text)) { forceImage = false; generate(); } else { ask(text); }
}

// ---------- Prompt box ----------
function setPrompt(text) {
  const input = $("#prompt");
  input.value = text;
  input.focus();
  $("#sendBtn").classList.toggle("active", text.trim() !== "");
  window.scrollTo(0, 0);
  $(".main").scrollTo({ top: 0, behavior: "smooth" });
}

$("#prompt").addEventListener("input", (e) => {
  forceImage = false;
  $("#sendBtn").classList.toggle("active", e.target.value.trim() !== "");
});
$("#prompt").addEventListener("keydown", (e) => { if (e.key === "Enter") submit(); });
$("#sendBtn").addEventListener("click", submit);

// Attach image
function removeAttachment() { attachedFile = null; $("#attachment").hidden = true; $("#fileInput").value = ""; }
$("#attachBtn").addEventListener("click", () => $("#fileInput").click());
$("#fileInput").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  attachedFile = file;
  $("#attachment").hidden = false;
  $("#attachment").innerHTML = `<img src="${URL.createObjectURL(file)}" alt=""><span>${file.name}</span><button id="rmAttach">×</button>`;
  $("#rmAttach").onclick = removeAttachment;
});

// Voice input (works in browsers with Web Speech API, e.g. Chrome)
$("#micBtn").addEventListener("click", () => {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return toast("Voice input isn't supported in this browser.");
  const rec = new SR();
  const btn = $("#micBtn");
  btn.classList.add("listening");
  toast("Listening...");
  rec.onresult = (e) => setPrompt(e.results[0][0].transcript);
  rec.onend = () => btn.classList.remove("listening");
  rec.onerror = () => { btn.classList.remove("listening"); toast("Couldn't hear anything."); };
  rec.start();
});

// Style chips
$("#chips").addEventListener("click", (e) => {
  const chip = e.target.closest(".chip");
  if (!chip) return;
  $$(".chip").forEach((c) => c.classList.remove("active"));
  chip.classList.add("active");
  activeStyle = chip.dataset.style;
});

// ---------- Grid clicks (templates + creations) ----------
$("#templates").addEventListener("click", (e) => {
  const card = e.target.closest(".card");
  if (card) { setPrompt(templates[card.dataset.i].prompt); forceImage = true; }
});
$("#creations").addEventListener("click", (e) => {
  const dl = e.target.closest("[data-dl]"), del = e.target.closest("[data-del]"), card = e.target.closest(".card[data-id]");
  if (dl) return downloadArt(creations.find((c) => c.id == dl.dataset.dl));
  if (del) {
    creations = creations.filter((c) => c.id != del.dataset.del);
    store("creations", creations);
    renderCreations();
    return toast("Image deleted.");
  }
  if (card) viewer(creations.find((c) => c.id == card.dataset.id));
});
$("#clearAll").addEventListener("click", clearAll);

// ---------- Sidebar ----------
$("#history").addEventListener("click", (e) => {
  const b = e.target.closest("[data-hist]");
  if (b) viewer(creations.find((c) => c.id == b.dataset.hist));
});
$("#closeSidebar").onclick = () => { $("#sidebar").classList.add("hidden"); $("#openSidebar").hidden = false; };
$("#openSidebar").onclick = () => { $("#sidebar").classList.remove("hidden"); $("#openSidebar").hidden = true; };

const menuActions = {
  new: () => { setPrompt(""); removeAttachment(); toast("New chat started."); },
  images: () => toast("You're already on the Images page."),
  plugins: () => openModal(`<h2>Plugins</h2><p class="sub">Plugins are coming soon in this demo. Stay tuned!</p>`),
  research: () => user ? toast("Deep research would start here.") : (toast("Log in to use Deep research."), authModal("login")),
  plans: () => openModal(`<h2>Plans</h2>
    <div class="row"><span><b>Free</b><br><small>Basic image creation</small></span><span>$0</span></div>
    <div class="row"><span><b>Plus</b><br><small>More images, faster</small></span><span>$20</span></div>
    <div class="row"><span><b>Pro</b><br><small>Unlimited everything</small></span><span>$200</span></div>`),
  help: () => openModal(`<h2>Help</h2><p class="sub">Type a prompt, pick a style, press the arrow. Click an image to view or download it.</p>`),
  settings: settingsModal,
};
$(".menu").addEventListener("click", (e) => {
  const b = e.target.closest("[data-action]");
  if (b) menuActions[b.dataset.action]();
});

// ---------- Model dropdown ----------
$("#modelBtn").addEventListener("click", (e) => { e.stopPropagation(); $("#modelMenu").hidden = !$("#modelMenu").hidden; });
$("#modelMenu").addEventListener("click", (e) => {
  const b = e.target.closest("[data-model]");
  if (!b) return;
  $("#modelBtn").textContent = b.dataset.model + " ⌄";
  imageMode = b.dataset.model === "ChatGPT Images";
  $("#modelMenu").hidden = true;
  toast(imageMode ? "Images mode: every prompt creates an image." : "Switched to " + b.dataset.model);
});
document.addEventListener("click", () => ($("#modelMenu").hidden = true));

// ---------- Init ----------
if (store("light")) document.body.classList.add("light");
renderTemplates();
renderAuth();
renderCreations();