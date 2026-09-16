import { DATA, type Pokemon } from "../lib/data";

function $<T extends HTMLElement = HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing element #${id}`);
  return node as unknown as T;
}

const els = {
  statScore: $("statScore"),
  statStreak: $("statStreak"),
  statBest: $("statBest"),
  statTimer: $("statTimer"),
  statTimerLabel: $("statTimerLabel"),
  settingsToggle: $("settingsToggle"),
  settingsPanel: $("settingsPanel"),
  modeTabs: $("modeTabs"),
  spellingHelp: $<HTMLInputElement>("spellingHelp"),
  soundOn: $<HTMLInputElement>("soundOn"),

  viewClassic: $("viewClassic"),
  classicGens: $("classicGens"),
  classicGenAll: $<HTMLButtonElement>("classicGenAll"),
  classicGenNone: $<HTMLButtonElement>("classicGenNone"),
  classicProgress: $("classicProgress"),
  classicSprite: $<HTMLImageElement>("classicSprite"),
  classicRevealName: $("classicRevealName"),
  classicInput: $<HTMLInputElement>("classicInput"),
  classicSubmit: $<HTMLButtonElement>("classicSubmit"),
  classicHint: $("classicHint"),
  classicFeedback: $("classicFeedback"),
  classicNext: $<HTMLButtonElement>("classicNext"),
  classicRestart: $<HTMLButtonElement>("classicRestart"),

  viewRecall: $("viewRecall"),
  recallGens: $("recallGens"),
  recallFound: $("recallFound"),
  recallTotal: $("recallTotal"),
  recallTimer: $("recallTimer"),
  recallProgress: $("recallProgress"),
  recallInput: $<HTMLInputElement>("recallInput"),
  recallGiveUp: $<HTMLButtonElement>("recallGiveUp"),
  recallHint: $("recallHint"),
  recallScroll: $("recallScroll"),

  modal: $("modal"),
  modalTitle: $("modalTitle"),
  modalScore: $("modalScore"),
  modalSub: $("modalSub"),
  modalMissed: $("modalMissed"),
  modalAgain: $<HTMLButtonElement>("modalAgain"),
  modalClose: $<HTMLButtonElement>("modalClose"),
};

const ALL = DATA.pokemon;
const GENS = DATA.generations;
const TYPE_COLORS = DATA.typeColors;
const silhouetteWrap = document.querySelector<HTMLElement>(".silhouette-wrap");

function applyTypes(el: HTMLElement | null, types: string[]) {
  if (!el) return;
  const first = TYPE_COLORS[types[0]] ?? "";
  const second = types[1] ? TYPE_COLORS[types[1]] ?? first : first;
  el.style.setProperty("--type-a", first);
  el.style.setProperty("--type-b", second);
}

function typesLabel(types: string[]): string {
  return types.map((t) => t.charAt(0).toUpperCase() + t.slice(1)).join(" / ");
}

type Mode = "classic" | "recall";

interface Settings {
  mode: Mode;
  classicGens: string[];
  recallGen: string;
  spellingHelp: boolean;
  sound: boolean;
}

const SETTINGS_KEY = "pkmn.quiz.settings.v1";
const BEST_KEY = "pkmn.quiz.best";

const settings: Settings = {
  mode: "classic",
  classicGens: GENS.map((g) => g.key),
  recallGen: "all",
  spellingHelp: true,
  sound: true,
};

try {
  const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "null") as Record<string, unknown> | null;
  if (saved) {
    if (saved.mode === "classic" || saved.mode === "recall") settings.mode = saved.mode;
    if (Array.isArray(saved.classicGens)) settings.classicGens = saved.classicGens as string[];
    else if (Array.isArray(saved.gens)) settings.classicGens = saved.gens as string[];
    if (typeof saved.recallGen === "string") settings.recallGen = saved.recallGen;
    if (typeof saved.spellingHelp === "boolean") settings.spellingHelp = saved.spellingHelp;
    if (typeof saved.sound === "boolean") settings.sound = saved.sound;
  }
} catch {
  /* ignore corrupt storage */
}

// URL overrides, e.g. ?mode=recall&gen=kanto
try {
  const params = new URLSearchParams(window.location.search);
  const qMode = params.get("mode");
  if (qMode === "classic" || qMode === "recall") settings.mode = qMode;
  const qGen = params.get("gen");
  if (qGen && (qGen === "all" || GENS.some((g) => g.key === qGen))) settings.recallGen = qGen;
} catch {
  /* ignore */
}

function saveSettings() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    /* ignore */
  }
}

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function normalize(value: string): string {
  return String(value)
    .toLowerCase()
    .replace(/♀/g, "f")
    .replace(/♂/g, "m")
    .replace(/[éèêë]/g, "e")
    .replace(/[áàâä]/g, "a")
    .replace(/[íìîï]/g, "i")
    .replace(/[óòôö]/g, "o")
    .replace(/[úùûü]/g, "u")
    .replace(/[^a-z0-9]/g, "");
}

function matchesName(p: Pokemon, key: string): boolean {
  if (!key) return false;
  if (key === normalize(p.name) || key === normalize(p.slug)) return true;
  if (p.id === 29 && (key === "nidoranfemale" || key === "nidoranf")) return true;
  if (p.id === 32 && (key === "nidoranmale" || key === "nidoranm")) return true;
  return false;
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = new Array<number>(n + 1);
  let cur = new Array<number>(n + 1);
  for (let j = 0; j <= n; j += 1) prev[j] = j;
  for (let i = 1; i <= m; i += 1) {
    cur[0] = i;
    for (let j = 1; j <= n; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    const swap = prev;
    prev = cur;
    cur = swap;
  }
  return prev[n];
}

function closestNameIn(value: string, candidates: Pokemon[]): string | null {
  const target = normalize(value);
  if (!target) return null;
  let best: string | null = null;
  let bestDist = Infinity;
  candidates.forEach((p) => {
    const d = levenshtein(target, normalize(p.name));
    if (d < bestDist) {
      bestDist = d;
      best = p.name;
    }
  });
  if (!best) return null;
  const limit = Math.max(2, Math.floor(target.length / 3));
  return bestDist <= limit ? best : null;
}

function formatTime(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (x: number) => String(x).padStart(2, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

/* ------------------------------ sound ----------------------------- */

let audioCtx: AudioContext | null = null;

function tone(freq: number, duration: number, type: OscillatorType, delay = 0, volume = 0.06) {
  if (!settings.sound) return;
  try {
    if (!audioCtx) {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      audioCtx = new Ctx();
    }
    if (audioCtx.state === "suspended") void audioCtx.resume();
    const t0 = audioCtx.currentTime + delay;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(volume, t0 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  } catch {
    /* audio unavailable */
  }
}

const sfx = {
  correct: () => {
    tone(660, 0.09, "triangle", 0);
    tone(990, 0.13, "triangle", 0.08);
  },
  wrong: () => tone(150, 0.2, "sawtooth", 0, 0.05),
  win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.15, "triangle", i * 0.11)),
};

/* ---------------------------- top bar ----------------------------- */

let bestStreak = Number(localStorage.getItem(BEST_KEY) || 0);

function renderTopbar(
  mode: Mode,
  vals: { score: number; streak: number; seconds: number; seen?: number },
) {
  els.statScore.textContent = String(vals.score);
  els.statStreak.textContent = mode === "classic" ? String(vals.streak) : "–";
  els.statBest.textContent = mode === "classic" ? String(bestStreak) : "–";
  if (mode === "classic") {
    els.statTimerLabel.textContent = "Seen";
    els.statTimer.textContent = String(vals.seen ?? 0);
  } else {
    els.statTimerLabel.textContent = "Timer";
    els.statTimer.textContent = formatTime(vals.seconds);
  }
}

function saveBest() {
  try {
    localStorage.setItem(BEST_KEY, String(bestStreak));
  } catch {
    /* ignore */
  }
}

/* --------------------------- settings UI -------------------------- */

function syncControls() {
  els.spellingHelp.checked = settings.spellingHelp;
  els.soundOn.checked = settings.sound;
}

/* ------------------- CLASSIC (written, one at a time) ------------- */

interface ClassicState {
  queue: Pokemon[];
  idx: number;
  score: number;
  streak: number;
  seen: number;
  current: Pokemon | null;
  answered: boolean;
  best: number;
}

const classic: ClassicState = {
  queue: [],
  idx: 0,
  score: 0,
  streak: 0,
  seen: 0,
  current: null,
  answered: false,
  best: 0,
};

function activeClassicPool(): Pokemon[] {
  return ALL.filter((p) => settings.classicGens.indexOf(p.gen) !== -1).sort((a, b) => a.id - b.id);
}

function renderClassicGens() {
  els.classicGens.innerHTML = "";
  GENS.forEach((g) => {
    const btn = document.createElement("button");
    btn.className = "chip" + (settings.classicGens.indexOf(g.key) !== -1 ? " is-on" : "");
    btn.textContent = `${g.name} (${g.count})`;
    btn.addEventListener("click", () => {
      const i = settings.classicGens.indexOf(g.key);
      if (i === -1) settings.classicGens.push(g.key);
      else settings.classicGens.splice(i, 1);
      saveSettings();
      renderClassicGens();
      startClassic();
    });
    els.classicGens.appendChild(btn);
  });
}

function startClassic() {
  const pool = activeClassicPool();
  if (!pool.length) return;
  classic.queue = shuffle(pool);
  classic.idx = 0;
  classic.score = 0;
  classic.streak = 0;
  classic.seen = 0;
  classic.best = 0;
  classic.answered = false;
  renderClassic();
}

function updateClassicProgress() {
  const total = classic.queue.length || 1;
  const span = els.classicProgress.querySelector<HTMLElement>("span");
  if (span) span.style.width = `${(classic.idx / total) * 100}%`;
}

function renderClassic() {
  if (classic.idx >= classic.queue.length) {
    classic.queue = shuffle(classic.queue);
    classic.idx = 0;
  }

  const p = classic.queue[classic.idx];
  classic.current = p;
  classic.answered = false;

  updateClassicProgress();

  els.classicSprite.src = p.sprite;
  els.classicSprite.alt = "Mystery Pokémon silhouette";
  els.classicRevealName.textContent = "";
  silhouetteWrap?.classList.remove("revealed");

  els.classicFeedback.textContent = "";
  els.classicFeedback.className = "feedback";
  els.classicHint.innerHTML = "Most similar spelling: <em>—</em>";

  els.classicInput.value = "";
  els.classicInput.disabled = false;
  els.classicInput.classList.remove("shake");
  els.classicSubmit.disabled = false;
  els.classicNext.disabled = true;

  renderTopbar("classic", { score: classic.score, streak: classic.streak, seen: classic.seen, seconds: 0 });
  els.classicInput.focus();
}

function updateClassicHint() {
  if (!settings.spellingHelp || classic.answered) {
    els.classicHint.innerHTML = "Most similar spelling: <em>—</em>";
    return;
  }
  const candidates = classic.queue.slice(classic.idx);
  const suggestion = closestNameIn(els.classicInput.value, candidates);
  els.classicHint.innerHTML = `Most similar spelling: <em>${suggestion ?? "—"}</em>`;
}

function submitClassic() {
  if (classic.answered || !classic.current) return;
  const raw = els.classicInput.value;
  if (!raw.trim()) return;
  const p = classic.current;
  classic.answered = true;
  classic.seen += 1;

  if (matchesName(p, normalize(raw))) {
    classic.score += 1;
    classic.streak += 1;
    classic.best = Math.max(classic.best, classic.streak);
    if (classic.streak > bestStreak) {
      bestStreak = classic.streak;
      saveBest();
    }
    els.classicFeedback.textContent = "Correct!";
    els.classicFeedback.className = "feedback good";
    sfx.correct();
  } else {
    classic.streak = 0;
    els.classicFeedback.textContent = `It was ${p.name}.`;
    els.classicFeedback.className = "feedback bad";
    sfx.wrong();
  }

  silhouetteWrap?.classList.add("revealed");
  applyTypes(silhouetteWrap, p.types);
  els.classicRevealName.innerHTML = `${p.name}<span class="reveal-types">${typesLabel(p.types)}</span>`;
  els.classicInput.disabled = true;
  els.classicSubmit.disabled = true;
  els.classicNext.disabled = false;
  els.classicHint.innerHTML = "Most similar spelling: <em>—</em>";
  els.classicNext.focus();

  classic.idx += 1;
  updateClassicProgress();
  renderTopbar("classic", { score: classic.score, streak: classic.streak, seen: classic.seen, seconds: 0 });
}

function nextClassic() {
  if (!classic.answered) return;
  renderClassic();
}

/* ---------------------------- RECALL ------------------------------ */

interface RecallState {
  pool: Pokemon[];
  found: Set<number>;
  lookup: Map<string, number>;
  tiles: Map<number, HTMLElement>;
  labels: Map<number, string>;
  startedAt: number;
  timerId: ReturnType<typeof setInterval> | null;
  over: boolean;
}

const recall: RecallState = {
  pool: [],
  found: new Set(),
  lookup: new Map(),
  tiles: new Map(),
  labels: new Map(),
  startedAt: 0,
  timerId: null,
  over: false,
};

function buildLookup(pool: Pokemon[]) {
  recall.lookup = new Map();
  pool.forEach((p) => {
    recall.lookup.set(normalize(p.name), p.id);
    recall.lookup.set(normalize(p.slug), p.id);
  });
  recall.lookup.set("nidoranfemale", 29);
  recall.lookup.set("nidoranmale", 32);
  recall.lookup.set("nidoranf", 29);
  recall.lookup.set("nidoranm", 32);
}

function renderRecallGens() {
  els.recallGens.innerHTML = "";
  const options = [{ key: "all", label: `All (${DATA.count})` }].concat(
    GENS.map((g) => ({ key: g.key, label: `${g.name} (${g.count})` })),
  );
  options.forEach((opt) => {
    const btn = document.createElement("button");
    btn.className = "gen-btn" + (settings.recallGen === opt.key ? " is-on" : "");
    btn.textContent = opt.label;
    btn.addEventListener("click", () => {
      settings.recallGen = opt.key;
      saveSettings();
      renderRecallGens();
      startRecall();
    });
    els.recallGens.appendChild(btn);
  });
}

function recallPool(): Pokemon[] {
  const pool =
    settings.recallGen === "all" ? ALL.slice() : ALL.filter((p) => p.gen === settings.recallGen);
  return pool.sort((a, b) => a.id - b.id);
}

function makeTile(p: Pokemon): HTMLElement {
  const tile = document.createElement("div");
  tile.className = "tile";
  tile.dataset.id = String(p.id);
  const img = document.createElement("img");
  img.src = p.sprite;
  img.alt = "";
  img.loading = "lazy";
  img.draggable = false;
  const label = document.createElement("span");
  label.className = "tile-name";
  label.textContent = p.name;
  const dex = document.createElement("span");
  dex.className = "tile-dex";
  dex.textContent = `#${String(p.id).padStart(3, "0")}`;
  applyTypes(tile, p.types);
  tile.appendChild(img);
  tile.appendChild(label);
  tile.appendChild(dex);
  recall.tiles.set(p.id, tile);
  recall.labels.set(p.id, p.name);
  return tile;
}

function renderRecallGrid(pool: Pokemon[]) {
  els.recallScroll.innerHTML = "";
  const byGen = new Map<string, Pokemon[]>();
  pool.forEach((p) => {
    if (!byGen.has(p.gen)) byGen.set(p.gen, []);
    byGen.get(p.gen)!.push(p);
  });

  GENS.forEach((g) => {
    const list = byGen.get(g.key);
    if (!list || !list.length) return;
    const section = document.createElement("section");
    section.className = "gen-section";
    const heading = document.createElement("h3");
    heading.className = "gen-heading";
    heading.innerHTML = `${g.name} <span>${list.length}</span>`;
    const grid = document.createElement("div");
    grid.className = "tile-grid";
    list.forEach((p) => grid.appendChild(makeTile(p)));
    section.appendChild(heading);
    section.appendChild(grid);
    els.recallScroll.appendChild(section);
  });
}

function startRecall() {
  const pool = recallPool();
  if (!pool.length) return;
  recall.pool = pool;
  recall.found = new Set();
  recall.tiles = new Map();
  recall.labels = new Map();
  recall.over = false;
  buildLookup(pool);

  els.recallTotal.textContent = String(pool.length);
  els.recallFound.textContent = "0";
  els.recallProgress.style.width = "0%";
  els.recallHint.innerHTML = "Most similar spelling: <em>—</em>";
  els.recallInput.value = "";
  els.recallInput.disabled = false;
  els.recallGiveUp.disabled = false;

  renderRecallGrid(pool);

  recall.startedAt = Date.now();
  if (recall.timerId) clearInterval(recall.timerId);
  recall.timerId = setInterval(() => {
    const secs = (Date.now() - recall.startedAt) / 1000;
    els.recallTimer.textContent = formatTime(secs);
    els.statTimer.textContent = formatTime(secs);
  }, 250);
  els.recallTimer.textContent = "00:00";
  renderTopbar("recall", { score: 0, streak: 0, seconds: 0 });

  els.recallInput.focus();
}

function updateRecallHint() {
  if (!settings.spellingHelp) {
    els.recallHint.innerHTML = "Most similar spelling: <em>—</em>";
    return;
  }
  const candidates = recall.pool.filter((p) => !recall.found.has(p.id));
  const suggestion = closestNameIn(els.recallInput.value, candidates);
  els.recallHint.innerHTML = `Most similar spelling: <em>${suggestion ?? "—"}</em>`;
}

function submitRecall() {
  if (recall.over) return;
  const value = els.recallInput.value;
  if (!value.trim()) return;
  const key = normalize(value);
  const id = recall.lookup.get(key);

  if (id && recall.found.has(id)) {
    els.recallHint.innerHTML = `${recall.labels.get(id)} is already found.`;
    els.recallInput.value = "";
    return;
  }

  if (id) {
    recall.found.add(id);
    recall.tiles.get(id)?.classList.add("found", "pop");
    sfx.correct();
    els.recallInput.value = "";
    els.recallHint.innerHTML = "Most similar spelling: <em>—</em>";
    const count = recall.found.size;
    els.recallFound.textContent = String(count);
    els.recallProgress.style.width = `${(count / recall.pool.length) * 100}%`;
    renderTopbar("recall", { score: count, streak: 0, seconds: (Date.now() - recall.startedAt) / 1000 });
    if (count === recall.pool.length) finishRecall(false);
    return;
  }

  sfx.wrong();
  els.recallInput.classList.remove("shake");
  void els.recallInput.offsetWidth;
  els.recallInput.classList.add("shake");
  updateRecallHint();
}

function finishRecall(gaveUp: boolean) {
  if (recall.over) return;
  recall.over = true;
  if (recall.timerId) clearInterval(recall.timerId);
  recall.timerId = null;
  els.recallInput.disabled = true;
  els.recallGiveUp.disabled = true;

  const seconds = (Date.now() - recall.startedAt) / 1000;
  const missed = recall.pool.filter((p) => !recall.found.has(p.id));
  missed.forEach((p) => recall.tiles.get(p.id)?.classList.add("reveal-miss"));

  const foundCount = recall.found.size;
  const total = recall.pool.length;
  if (foundCount === total && total > 0) sfx.win();

  openModal({
    title: foundCount === total ? "You caught them all!" : gaveUp ? "Gave up" : "Finished",
    score: `${foundCount} / ${total}`,
    sub: `Time: ${formatTime(seconds)}`,
    missed: missed.map((p) => p.name),
  });
}

/* ----------------------------- modal ------------------------------ */

interface ModalOptions {
  title: string;
  score: string;
  sub: string;
  missed: string[];
}

function openModal({ title, score, sub, missed }: ModalOptions) {
  els.modalTitle.textContent = title;
  els.modalScore.textContent = score;
  els.modalSub.textContent = sub;
  els.modalMissed.innerHTML = missed.length
    ? `<b>Missed (${missed.length}):</b><br>` + missed.join(", ")
    : "";
  els.modal.hidden = false;
}

function closeModal() {
  els.modal.hidden = true;
}

/* --------------------------- mode switch -------------------------- */

function restartCurrent() {
  closeModal();
  if (settings.mode === "classic") startClassic();
  else startRecall();
}

function setMode(mode: Mode) {
  settings.mode = mode;
  saveSettings();
  Array.from(els.modeTabs.querySelectorAll<HTMLElement>(".tab")).forEach((t) => {
    t.classList.toggle("is-active", t.dataset.mode === mode);
  });
  els.viewClassic.hidden = mode !== "classic";
  els.viewRecall.hidden = mode !== "recall";
  if (recall.timerId) {
    clearInterval(recall.timerId);
    recall.timerId = null;
  }
  closeModal();
  if (mode === "classic") startClassic();
  else startRecall();
}

/* ----------------------------- events ----------------------------- */

function bind() {
  els.settingsToggle.addEventListener("click", () => {
    els.settingsPanel.hidden = !els.settingsPanel.hidden;
  });

  els.modeTabs.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    const tab = target.closest<HTMLElement>(".tab");
    if (tab?.dataset.mode) setMode(tab.dataset.mode as Mode);
  });

  els.classicGenAll.addEventListener("click", () => {
    settings.classicGens = GENS.map((g) => g.key);
    saveSettings();
    renderClassicGens();
    startClassic();
  });

  els.classicGenNone.addEventListener("click", () => {
    settings.classicGens = [];
    saveSettings();
    renderClassicGens();
    startClassic();
  });

  els.spellingHelp.addEventListener("change", () => {
    settings.spellingHelp = els.spellingHelp.checked;
    saveSettings();
    updateClassicHint();
    updateRecallHint();
  });

  els.soundOn.addEventListener("change", () => {
    settings.sound = els.soundOn.checked;
    saveSettings();
  });

  els.classicInput.addEventListener("input", updateClassicHint);
  els.classicInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      submitClassic();
    }
  });
  els.classicSubmit.addEventListener("click", submitClassic);
  els.classicNext.addEventListener("click", nextClassic);
  els.classicRestart.addEventListener("click", startClassic);

  els.recallGiveUp.addEventListener("click", () => finishRecall(true));
  els.recallInput.addEventListener("input", () => {
    if (els.recallHint.textContent.indexOf("already found") !== -1) {
      els.recallHint.innerHTML = "Most similar spelling: <em>—</em>";
    }
    updateRecallHint();
  });
  els.recallInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      submitRecall();
    }
  });

  els.modalAgain.addEventListener("click", restartCurrent);
  els.modalClose.addEventListener("click", closeModal);
  els.modal.addEventListener("click", (e) => {
    if (e.target === els.modal) closeModal();
  });

  document.addEventListener("keydown", (e) => {
    if (settings.mode !== "classic" || !els.modal.hidden) return;
    const target = e.target as HTMLElement;
    if (target.tagName === "INPUT") return;
    if (e.key === "Enter" || e.key === " ") {
      if (!els.classicNext.disabled) {
        e.preventDefault();
        nextClassic();
      }
    }
  });
}

export function initQuiz() {
  if (!ALL.length) {
    document.body.innerHTML = "<p style='padding:40px'>Failed to load Pokémon data.</p>";
    return;
  }
  bind();
  renderClassicGens();
  renderRecallGens();
  syncControls();
  setMode(settings.mode);
}
