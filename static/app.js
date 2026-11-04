/* Docket UI — no framework, no build step. */

const $ = (selector) => document.querySelector(selector);

const ui = {
  scenarios: $("#scenarios"),
  clear: $("#clear"),
  emptyExamples: $("#empty-examples"),
  tabCase: $("#tab-case"),
  tabExamples: $("#tab-examples"),
  panelCase: $("#panel-case"),
  panelExamples: $("#panel-examples"),
  caseNote: $("#case-note"),
  importCase: $("#import-case"),
  exportCase: $("#export-case"),
  importFile: $("#import-file"),
  draftCount: $("#draft-count"),
  question: $("#question"),
  country: $("#country"),
  role: $("#role"),
  plan: $("#plan"),
  docTabs: $("#doc-tabs"),
  docEditor: $("#doc-editor"),
  removeDoc: $("#remove-doc"),
  docCount: $("#doc-count"),
  addDoc: $("#add-doc"),
  draft: $("#draft"),
  run: $("#run"),
  runRow: $(".run-row"),
  error: $("#error"),
  inputStatus: $("#input-status"),
  stepper: $("#stepper"),
  runStatus: $("#run-status"),
  empty: $("#empty"),
  result: $("#result"),
  verdictCard: $("#verdict-card"),
  verdictWord: $("#verdict-word"),
  stamp: $("#stamp"),
  stampRef: $("#stamp-ref"),
  verdictSentence: $("#verdict-sentence"),
  verdictMeter: $("#verdict-meter"),
  verdictMeta: $("#verdict-meta"),
  reasons: $("#reasons"),
  draftView: $("#draft-view"),
  allowedView: $("#allowed-view"),
  allowedLabel: $("#allowed-label"),
  copyAllowed: $("#copy-allowed"),
  authority: $("#authority"),
  claims: $("#claims"),
  claimCount: $("#claim-count"),
  conflictsBlock: $("#conflicts-block"),
  conflicts: $("#conflicts"),
  rerank: $("#rerank"),
  raw: $("#raw"),
  copyJson: $("#copy-json"),
  requestJson: $("#request-json"),
  copyRequest: $("#copy-request"),
  copyCurl: $("#copy-curl"),
  themeToggle: $("#theme-toggle"),
  live: $("#live"),
  liveText: $("#live-text"),
  modeSwitch: $(".mode-switch"),
  controlRef: $("#control-ref"),
  controlDocs: $("#control-docs"),
  controlCalls: $("#control-calls"),
  controlCredits: $("#control-credits"),
  controlTime: $("#control-time"),
  decisionStrip: $(".decision-strip"),
  auditBody: $("#audit-body"),
  creditTotal: $("#credit-total"),
};

const state = { documents: [], samples: [], busy: false, last: null, streaming: true, allowedText: "", mode: "case", lastPayload: null, activeDoc: 0 };

const blankDoc = () => ({
  title: "",
  jurisdiction: "Global",
  effective_date: "",
  precedence: 0,
  text: "",
});

const DECISIONS = {
  publish: { word: "PUBLISH", sub: "Cleared to publish", status: "done" },
  rewrite: { word: "REWRITE", sub: "Blocked — rewrite required", status: "done" },
  hold: { word: "HOLD", sub: "Held — not published", status: "error" },
};

/* ------------------------------------------------------------------ init */
async function init() {
  initTheme();
  state.documents = [blankDoc()];
  renderDocs();
  updateDraftCount();
  setMode("case", "Your own policies, question and draft.");
  bind();
  await Promise.all([loadSamples(), loadAudit(), loadStats(), checkHealth()]);
}

function bind() {
  ui.docTabs.addEventListener("click", (event) => {
    const tab = event.target.closest(".doc-tab");
    if (!tab) return;
    state.activeDoc = Number(tab.dataset.index);
    renderDocs();
  });

  ui.docEditor.addEventListener("input", onEditorEdit);
  ui.docEditor.addEventListener("change", onEditorEdit);

  ui.addDoc.addEventListener("click", () => {
    if (state.documents.length >= 6) return;
    state.documents.push(blankDoc());
    state.activeDoc = state.documents.length - 1;
    renderDocs();
    document.querySelector("#doc-title")?.focus();
  });

  ui.removeDoc.addEventListener("click", () => {
    if (state.documents.length <= 1) return;
    state.documents.splice(state.activeDoc, 1);
    state.activeDoc = Math.max(0, state.activeDoc - 1);
    renderDocs();
  });

  ui.run.addEventListener("click", run);
  ui.clear.addEventListener("click", clearAll);

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      ([entry]) => {
        const stuck = entry.isIntersecting || entry.boundingClientRect.top < 0;
        ui.runRow.classList.toggle("is-stuck", stuck);
      },
      { rootMargin: "0px 0px -30% 0px", threshold: 0 }
    );
    observer.observe(ui.draft);
  }

  ui.tabCase.addEventListener("click", () => setMode("case"));
  ui.tabExamples.addEventListener("click", () => setMode("examples"));
  ui.emptyExamples.addEventListener("click", () => setMode("examples"));
  for (const tab of [ui.tabCase, ui.tabExamples]) {
    tab.addEventListener("keydown", (event) => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const target = state.mode === "case" ? "examples" : "case";
      setMode(target);
      (target === "case" ? ui.tabCase : ui.tabExamples).focus();
    });
  }

  ui.draft.addEventListener("input", () => {
    updateDraftCount();
    ui.draft.removeAttribute("aria-invalid");
    ui.draft.classList.remove("is-invalid");
  });
  ui.question.addEventListener("input", () => {
    ui.question.removeAttribute("aria-invalid");
    ui.question.classList.remove("is-invalid");
  });

  ui.importCase.addEventListener("click", () => ui.importFile.click());
  ui.importFile.addEventListener("change", async () => {
    const file = ui.importFile.files && ui.importFile.files[0];
    if (file) await importCase(file);
    ui.importFile.value = "";
  });
  ui.exportCase.addEventListener("click", exportCase);
  ui.themeToggle.addEventListener("click", toggleTheme);

  ui.copyRequest.addEventListener("click", async () => {
    if (!state.lastPayload) return;
    await navigator.clipboard.writeText(JSON.stringify(state.lastPayload, null, 2));
    ui.copyRequest.textContent = "Copied";
    setTimeout(() => (ui.copyRequest.textContent = "Copy JSON"), 1400);
  });
  ui.copyCurl.addEventListener("click", async () => {
    if (!state.lastPayload) return;
    const body = JSON.stringify(state.lastPayload).replaceAll("'", "'\\''");
    const command = `curl -s ${location.origin}/api/check \\\n  -H 'Content-Type: application/json' \\\n  -d '${body}'`;
    await navigator.clipboard.writeText(command);
    ui.copyCurl.textContent = "Copied";
    setTimeout(() => (ui.copyCurl.textContent = "Copy as cURL"), 1400);
  });

  document.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      run();
    }
  });

  ui.copyJson.addEventListener("click", async () => {
    if (!state.last) return;
    await navigator.clipboard.writeText(JSON.stringify(state.last, null, 2));
    ui.copyJson.textContent = "Copied";
    setTimeout(() => (ui.copyJson.textContent = "Copy JSON"), 1400);
  });

  ui.copyAllowed.addEventListener("click", async () => {
    if (!state.allowedText) return;
    await navigator.clipboard.writeText(state.allowedText);
    ui.copyAllowed.textContent = "Copied";
    setTimeout(() => (ui.copyAllowed.textContent = "Copy allowed text"), 1400);
  });
}

/* ------------------------------------------------------------------ modes */
function setMode(mode, note) {
  state.mode = mode;
  const isCase = mode === "case";
  ui.tabCase.setAttribute("aria-selected", String(isCase));
  ui.tabExamples.setAttribute("aria-selected", String(!isCase));
  ui.panelCase.hidden = !isCase;
  ui.panelExamples.hidden = isCase;
  ui.emptyExamples.hidden = !isCase;
  ui.modeSwitch.style.setProperty("--tab", isCase ? "0" : "1");
  if (note !== undefined) {
    ui.caseNote.textContent = note;
    ui.caseNote.dataset.state = note.startsWith("Example") || note.startsWith("Imported") ? "example" : "";
  }
}

/* ------------------------------------------------------------------ theme */
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem("docket-theme", theme);
  } catch {
    /* storage can be unavailable; the theme still applies */
  }
  ui.themeToggle.textContent = theme === "dark" ? "Light" : "Dark";
  ui.themeToggle.setAttribute("aria-label", theme === "dark" ? "Switch to light mode" : "Switch to dark mode");
}

function initTheme() {
  if ("IntersectionObserver" in window) {
    const track = document.querySelector(".pipeline-track");
    if (track) {
      track.classList.add("js-reveal");
      const observer = new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-in");
          observer.disconnect();
        }
      }, { threshold: 0.25 });
      observer.observe(track);
    }
  }
  let saved = null;
  try {
    saved = localStorage.getItem("docket-theme");
  } catch {
    saved = null;
  }
  const preferred = saved || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  applyTheme(preferred);
}

function toggleTheme() {
  applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
}

/* --------------------------------------------------------------- counters */
function updateDraftCount() {
  ui.draftCount.textContent = `${ui.draft.value.length.toLocaleString()} / 10,000`;
}

/* --------------------------------------------------------------- validity */
function markInvalid(element) {
  clearInvalid();
  if (!element) return;
  element.classList.add("is-invalid");
  element.setAttribute("aria-invalid", "true");
  element.focus();
}

function clearInvalid() {
  document.querySelectorAll(".is-invalid").forEach((element) => {
    element.classList.remove("is-invalid");
    element.removeAttribute("aria-invalid");
  });
}

/* ------------------------------------------------------------ import/export */
function exportCase() {
  const payload = collect();
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `docket-case-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function importCase(file) {
  let payload;
  try {
    payload = JSON.parse(await file.text());
  } catch {
    showError("That file is not valid JSON.");
    return;
  }
  if (!payload || typeof payload !== "object" || !Array.isArray(payload.documents) || !payload.documents.length) {
    showError("Expected a JSON case with a non-empty documents array.");
    return;
  }

  ui.question.value = String(payload.question || "").slice(0, 2000);
  ui.country.value = String(payload.country || "").slice(0, 40);
  ui.role.value = String(payload.role || "").slice(0, 60);
  ui.plan.value = String(payload.plan || "").slice(0, 60);
  ui.draft.value = String(payload.draft || "").slice(0, 10000);
  state.documents = payload.documents.slice(0, 6).map((doc) => ({
    title: String(doc.title || "").slice(0, 120),
    jurisdiction: String(doc.jurisdiction || "Global").slice(0, 20),
    effective_date: String(doc.effective_date || "").slice(0, 10),
    precedence: Number(doc.precedence) || 0,
    text: String(doc.text || "").slice(0, 60000),
  }));
  if (!state.documents.length) state.documents = [blankDoc()];
  state.activeDoc = 0;
  renderDocs();
  updateDraftCount();
  clearError();
  clearInvalid();
  setMode("case", "Imported case — edit anything.");
  ui.result.hidden = true;
  ui.empty.hidden = false;
  resetStages();
  setRunStatus("idle", "Idle");
  ui.inputStatus.textContent = "Ready";
  ui.inputStatus.dataset.state = "";
}

/* --------------------------------------------------------------- documents */
function renderTabs() {
  ui.docTabs.innerHTML = "";
  state.documents.forEach((doc, index) => {
    const tab = document.createElement("button");
    tab.type = "button";
    tab.setAttribute("role", "tab");
    tab.className = "doc-tab";
    tab.dataset.index = String(index);
    tab.setAttribute("aria-selected", String(index === state.activeDoc));
    tab.setAttribute("aria-label", `Policy ${index + 1}`);

    const dot = document.createElement("span");
    dot.className = "tab-dot";
    dot.setAttribute("aria-hidden", "true");

    const label = document.createElement("span");
    label.className = "tab-label";
    label.textContent = doc.title || `Policy ${index + 1}`;

    tab.append(dot, label);
    ui.docTabs.appendChild(tab);
  });
}

function renderEditor() {
  const doc = state.documents[state.activeDoc];
  if (!doc) return;
  ui.docEditor.innerHTML = "";

  const row = document.createElement("div");
  row.className = "editor-row";

  const titleWrap = document.createElement("div");
  titleWrap.className = "field editor-title";
  const titleLabel = document.createElement("label");
  titleLabel.htmlFor = "doc-title";
  titleLabel.textContent = "Title";
  const title = document.createElement("input");
  title.id = "doc-title";
  title.type = "text";
  title.maxLength = 120;
  title.placeholder = "Policy title";
  title.value = doc.title;
  title.dataset.field = "title";
  title.setAttribute("aria-label", "Policy title");
  titleWrap.append(titleLabel, title);
  row.appendChild(titleWrap);

  const jurisdictionWrap = document.createElement("div");
  jurisdictionWrap.className = "field";
  const jurisdictionLabel = document.createElement("label");
  jurisdictionLabel.htmlFor = "doc-jurisdiction";
  jurisdictionLabel.textContent = "Jurisdiction";
  const jurisdiction = document.createElement("input");
  jurisdiction.id = "doc-jurisdiction";
  jurisdiction.type = "text";
  jurisdiction.maxLength = 20;
  jurisdiction.placeholder = "Global or FR";
  jurisdiction.value = doc.jurisdiction;
  jurisdiction.dataset.field = "jurisdiction";
  jurisdictionWrap.append(jurisdictionLabel, jurisdiction);
  row.appendChild(jurisdictionWrap);

  const dateWrap = document.createElement("div");
  dateWrap.className = "field";
  const dateLabel = document.createElement("label");
  dateLabel.htmlFor = "doc-date";
  dateLabel.textContent = "Effective date";
  const date = document.createElement("input");
  date.id = "doc-date";
  date.type = "date";
  date.value = doc.effective_date || "";
  date.dataset.field = "effective_date";
  dateWrap.append(dateLabel, date);
  row.appendChild(dateWrap);

  const precedenceWrap = document.createElement("div");
  precedenceWrap.className = "field";
  const precedenceLabel = document.createElement("label");
  precedenceLabel.htmlFor = "doc-precedence";
  precedenceLabel.textContent = "Precedence";
  const precedence = document.createElement("select");
  precedence.id = "doc-precedence";
  precedence.dataset.field = "precedence";
  for (const [value, text] of [["0", "Normal"], ["1", "Overrides"]]) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = text;
    if (String(doc.precedence) === value) option.selected = true;
    precedence.appendChild(option);
  }
  precedenceWrap.append(precedenceLabel, precedence);
  row.appendChild(precedenceWrap);

  const textWrap = document.createElement("div");
  textWrap.className = "field";
  const textLabel = document.createElement("label");
  textLabel.htmlFor = "doc-text";
  textLabel.textContent = "Policy text";
  const text = document.createElement("textarea");
  text.id = "doc-text";
  text.rows = 7;
  text.maxLength = 60000;
  text.placeholder = "Paste the policy text…";
  text.value = doc.text;
  text.dataset.field = "text";
  const counter = document.createElement("div");
  counter.className = "counter";
  counter.id = "doc-counter";
  counter.textContent = `${doc.text.length.toLocaleString()} / 60,000`;
  textWrap.append(textLabel, text, counter);

  ui.docEditor.append(row, textWrap);
}

function renderDocs() {
  renderTabs();
  renderEditor();
  ui.docCount.textContent = `${state.documents.length} of 6`;
  ui.addDoc.disabled = state.documents.length >= 6;
  ui.removeDoc.disabled = state.documents.length <= 1;
  ui.inputStatus.textContent = state.documents.length ? "Ready" : "Empty";
  ui.inputStatus.dataset.state = state.documents.length ? "done" : "";
}

function onEditorEdit(event) {
  const target = event.target;
  if (!target.dataset.field) return;
  const doc = state.documents[state.activeDoc];
  if (!doc) return;
  const fieldName = target.dataset.field;
  doc[fieldName] = fieldName === "precedence" ? Number(target.value) : target.value;

  if (fieldName === "title") {
    const tab = ui.docTabs.querySelector(`.doc-tab[data-index="${state.activeDoc}"] .tab-label`);
    if (tab) tab.textContent = doc.title || `Policy ${state.activeDoc + 1}`;
  }
  if (fieldName === "text") {
    const counter = document.querySelector("#doc-counter");
    if (counter) counter.textContent = `${target.value.length.toLocaleString()} / 60,000`;
  }
  target.classList.remove("is-invalid");
  target.removeAttribute("aria-invalid");
}

/* ----------------------------------------------------------------- samples */
async function loadSamples() {
  try {
    const response = await fetch("/api/samples");
    state.samples = await response.json();
    ui.scenarios.innerHTML = "";
    for (const sample of state.samples) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "scenario";
      button.dataset.id = sample.id;
      button.setAttribute("aria-pressed", "false");

      const tag = document.createElement("span");
      tag.className = "scenario-tag";
      tag.textContent = sample.tag || "scenario";

      const title = document.createElement("span");
      title.className = "scenario-title";
      title.textContent = sample.label;

      const blurb = document.createElement("span");
      blurb.className = "scenario-blurb";
      blurb.textContent = sample.blurb || "";

      const action = document.createElement("span");
      action.className = "scenario-load";
      action.textContent = "Load case";

      button.append(tag, title, blurb, action);
      button.addEventListener("click", () => loadSample(sample.id));
      ui.scenarios.appendChild(button);
    }
  } catch {
    ui.scenarios.innerHTML = '<span class="cases-empty">Scenarios unavailable.</span>';
  }
}

async function loadSample(id) {
  if (state.busy) return;
  try {
    const response = await fetch(`/api/samples/${id}`);
    const sample = await response.json();
    ui.question.value = sample.question;
    ui.country.value = sample.context?.country || "";
    ui.role.value = sample.context?.role || "";
    ui.plan.value = sample.context?.plan || "";
    ui.draft.value = sample.draft;
    state.documents = sample.documents.map((doc) => ({
      title: doc.title,
      jurisdiction: doc.jurisdiction || "Global",
      effective_date: doc.effective_date || "",
      precedence: doc.precedence || 0,
      text: doc.text,
    }));
    state.activeDoc = 0;
    renderDocs();
    updateDraftCount();
    document.querySelectorAll(".scenario").forEach((b) => {
      b.setAttribute("aria-pressed", String(b.dataset.id === id));
    });
    clearError();
    clearInvalid();
    resetStages();
    setRunStatus("idle", "Idle");
    setMode("case", "Example loaded — edit any field.");
    ui.result.hidden = true;
    ui.empty.hidden = false;
    ui.verdictCard.dataset.state = "hold";
  } catch {
    showError("Could not load that example. Try again.");
  }
}

function clearAll() {
  if (state.busy) return;
  ui.question.value = "";
  ui.country.value = "";
  ui.role.value = "";
  ui.plan.value = "";
  ui.draft.value = "";
  state.activeDoc = 0;
  state.documents = [blankDoc()];
  renderDocs();
  updateDraftCount();
  document.querySelectorAll(".scenario").forEach((b) => b.setAttribute("aria-pressed", "false"));
  clearError();
  clearInvalid();
  setMode("case", "Your own policies, question and draft.");
  ui.result.hidden = true;
  ui.empty.hidden = false;
  resetStages();
  setRunStatus("idle", "Idle");
}

/* -------------------------------------------------------------------- run */
function collect() {
  return {
    question: ui.question.value.trim(),
    draft: ui.draft.value.trim(),
    country: ui.country.value.trim(),
    role: ui.role.value.trim(),
    plan: ui.plan.value.trim(),
    documents: state.documents.map((doc) => ({
      title: doc.title.trim(),
      text: doc.text.trim(),
      jurisdiction: doc.jurisdiction.trim() || "Global",
      effective_date: doc.effective_date || null,
      precedence: Number(doc.precedence) || 0,
    })),
  };
}

function validate(payload) {
  if (payload.question.length < 3) {
    return { message: "Enter the employee question.", focus: ui.question };
  }
  if (payload.draft.length < 3) {
    return { message: "Paste the draft answer the assistant wants to send.", focus: ui.draft };
  }
  if (!payload.documents.length) {
    return { message: "Add at least one policy document.", focus: ui.addDoc };
  }
  for (const [index, doc] of payload.documents.entries()) {
    if (!doc.title) {
      return { message: `Policy ${index + 1} needs a title.`, docIndex: index, field: "title" };
    }
    if (doc.text.length < 20) {
      return { message: `Policy ${index + 1} needs at least 20 characters of policy text.`, docIndex: index, field: "text" };
    }
  }
  return null;
}

async function run() {
  if (state.busy) return;
  const payload = collect();
  const problem = validate(payload);
  if (problem) {
    showError(problem.message);
    if (problem.docIndex != null) {
      state.activeDoc = problem.docIndex;
      renderDocs();
    }
    markInvalid(problem.docIndex != null ? document.querySelector(`#doc-${problem.field}`) : problem.focus);
    return;
  }

  clearError();
  clearInvalid();
  state.lastPayload = payload;
  state.busy = true;
  ui.run.disabled = true;
  ui.error.hidden = true;
  ui.empty.hidden = true;
  ui.result.hidden = true;
  ui.result.setAttribute("aria-busy", "true");
  ui.inputStatus.textContent = "checking";
  ui.inputStatus.dataset.state = "running";
  resetStages();
  setRunStatus("running", "running");

  const started = performance.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 35000);
  try {
    if (!state.streaming) throw new Error("streaming disabled");
    const response = await fetch("/api/check/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!response.ok || !response.body) throw new Error("stream unavailable");
    await consume(response);
  } catch (error) {
    if (error && error.name === "AbortError") {
      showError("Taking longer than expected. Clocked may be busy — try again.");
      setRunStatus("error", "timed out");
      return;
    }
    try {
      const response = await fetch("/api/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      const result = await response.json();
      for (const stage of result.stages || []) renderStage(stage);
      renderResult(result, performance.now() - started);
    } catch (fallbackError) {
      if (fallbackError && fallbackError.name === "AbortError") {
        showError("Taking longer than expected. Clocked may be busy — try again.");
        setRunStatus("error", "timed out");
      } else {
        showError("The check could not run. Nothing was published.");
        setRunStatus("error", "failed");
      }
    }
  } finally {
    clearTimeout(timer);
    state.busy = false;
    ui.run.disabled = false;
    ui.result.removeAttribute("aria-busy");
    ui.inputStatus.textContent = "ready";
    ui.inputStatus.dataset.state = "done";
  }
}

async function consume(response) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const started = performance.now();

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let boundary;
    while ((boundary = buffer.indexOf("\n\n")) >= 0) {
      const block = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      const event = parseEvent(block);
      if (event) handleEvent(event, performance.now() - started);
    }
  }
}

function parseEvent(block) {
  let name = "message";
  const data = [];
  for (const line of block.split("\n")) {
    if (line.startsWith("event:")) name = line.slice(6).trim();
    else if (line.startsWith("data:")) data.push(line.slice(5).trim());
  }
  if (!data.length) return null;
  try {
    return { name, data: JSON.parse(data.join("\n")) };
  } catch {
    return null;
  }
}

function handleEvent({ name, data }, elapsed) {
  if (name === "stage") {
    renderStage(data);
  } else if (name === "result") {
    renderResult(data, elapsed);
  } else if (name === "error") {
    showError(data.message || "The check failed.");
    setRunStatus("error", "failed");
  }
}

/* ----------------------------------------------------------------- stages */
function resetStages() {
  ui.stepper.style.setProperty("--progress", "0");
  ui.stepper.querySelectorAll("li").forEach((item) => {
    item.dataset.status = "";
    item.querySelector(".step-meta").textContent = item.dataset.step === "authority" ? "rule" : "";
  });
}

function renderStage(stage) {
  const item = ui.stepper.querySelector(`li[data-step="${stage.stage}"]`);
  if (!item) return;
  item.dataset.status = stage.status;
  const meta = item.querySelector(".step-meta");

  if (stage.status === "running") meta.textContent = "running…";
  else if (stage.status === "done") {
    const bits = [];
    if (stage.ms != null) bits.push(`${stage.ms} ms`);
    if (stage.credits != null) bits.push(`${formatCredits(stage.credits)} cr`);
    meta.textContent = bits.join(" · ") || "done";
  } else if (stage.status === "skipped") meta.textContent = "skipped";
  else if (stage.status === "error") meta.textContent = "failed";

  const steps = [...ui.stepper.querySelectorAll("li")];
  const settled = steps.filter((item) => ["done", "skipped"].includes(item.dataset.status)).length;
  ui.stepper.style.setProperty("--progress", String(settled / steps.length));
}

function setRunStatus(stateName, text) {
  ui.runStatus.dataset.state = stateName;
  ui.runStatus.textContent = text;
}

/* ---------------------------------------------------------------- results */
function renderResult(result, elapsed) {
  state.last = result;
  const meta = DECISIONS[result.decision] || DECISIONS.hold;

  ui.result.hidden = false;
  ui.verdictCard.dataset.state = result.decision;
  ui.verdictWord.textContent = meta.word;
  const now = result.checked_at ? new Date(result.checked_at) : new Date();
  const ymd = `${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const ref = `CC-${ymd}-${String(result.id || 0).padStart(4, "0")}`;
  if (ui.stampRef) ui.stampRef.textContent = ref;

  if (ui.controlRef) {
    ui.controlRef.textContent = ref;
    const docs = (result.document_titles || []).length;
    ui.controlDocs.textContent = `${docs} ${docs === 1 ? "POLICY" : "POLICIES"}`;
    ui.controlCalls.textContent = `${result.api_calls || 0} CALLS`;
    ui.controlCredits.textContent = `${formatCredits(result.credits)} CREDITS`;
    ui.controlTime.textContent = `${((result.latency_ms || 0) / 1000).toFixed(1)}s`;
  }
  if (ui.decisionStrip) {
    ui.decisionStrip.querySelectorAll("span").forEach((span) => {
      span.dataset.active = String(span.dataset.decision === result.decision);
    });
  }

  if (ui.stamp) {
    ui.stamp.classList.remove("is-stamped");
    void ui.stamp.offsetWidth;
    ui.stamp.classList.add("is-stamped");
  }

  const grounded =
    result.verify && typeof result.verify.grounded === "number" ? result.verify.grounded : null;
  ui.verdictMeter.style.left = `${Math.round((grounded === null ? 0 : grounded) * 100)}%`;

  const claims = result.verify?.claims || [];
  const counted = claims.filter((c) => c.counted !== false && c.kind !== "not_a_claim");
  const supported = counted.filter((c) => (c.verdict || "").toLowerCase() === "supported").length;
  const supportText = counted.length
    ? `${supported}/${counted.length} supported`
    : "not evaluated";
  ui.verdictSentence.textContent = result.headline || meta.sub;
  const calls = result.api_calls || 0;
  const seconds = ((result.latency_ms || 0) / 1000).toFixed(1);
  const checked = result.checked_at
    ? new Date(result.checked_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    : "";
  const firstLine = `${checked ? `Checked ${checked} · ` : ""}${formatCredits(result.credits)} credits`;
  const secondLine = `${seconds}s · ${calls} calls · ${supportText}`;
  ui.verdictMeta.innerHTML = `${firstLine}<br>${secondLine}`;

  ui.reasons.innerHTML = "";
  for (const reason of result.reasons || []) {
    const item = document.createElement("li");
    item.textContent = reason;
    ui.reasons.appendChild(item);
  }

  renderDeliveryPanel(result);
  renderAuthority(result);
  if (result.authority && result.authority.trace) {
    const outcomeById = new Map(result.authority.trace.map((row) => [row.id, row.outcome]));
    ui.docTabs.querySelectorAll(".doc-tab").forEach((tab, index) => {
      const outcome = outcomeById.get(`doc${index + 1}`);
      if (outcome) tab.dataset.outcome = outcome;
      else delete tab.dataset.outcome;
    });
  }
  renderClaims(result);
  renderConflicts(result);
  renderRerank(result);

  ui.raw.textContent = JSON.stringify(result.raw || {}, null, 2);
  ui.requestJson.textContent = JSON.stringify(state.lastPayload || {}, null, 2);
  ui.stepper.style.setProperty("--progress", "1");
  setRunStatus(meta.status, meta.status === "error" ? "held" : "complete");

  ui.result.tabIndex = -1;
  ui.result.focus({ preventScroll: true });
  loadStats();
  loadAudit();

  if (window.matchMedia("(max-width: 1080px)").matches) {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    ui.result.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  }
}

function markDraft(container, draft, claims) {
  const ranges = [];
  for (const claim of claims) {
    if (claim.counted === false || claim.kind === "not_a_claim") continue;
    const verdict = (claim.verdict || "").toLowerCase();
    if (verdict !== "contradicted" && verdict !== "not_stated") continue;
    const text = claim.claim || "";
    if (!text) continue;
    let index = draft.indexOf(text);
    if (index < 0) index = draft.toLowerCase().indexOf(text.toLowerCase());
    if (index >= 0) ranges.push({ start: index, end: index + text.length, verdict });
  }

  ranges.sort((a, b) => a.start - b.start);
  let cursor = 0;
  const clean = [];
  for (const range of ranges) {
    if (range.start >= cursor) {
      clean.push(range);
      cursor = range.end;
    }
  }

  let position = 0;
  for (const range of clean) {
    if (range.start > position) {
      container.appendChild(document.createTextNode(draft.slice(position, range.start)));
    }
    const mark = document.createElement("mark");
    if (range.verdict === "not_stated") mark.className = "unsupported";
    mark.textContent = draft.slice(range.start, range.end);
    container.appendChild(mark);
    requestAnimationFrame(() => mark.classList.add("is-in"));
    position = range.end;
  }
  if (position < draft.length) {
    container.appendChild(document.createTextNode(draft.slice(position)));
  }
}

function renderDeliveryPanel(result) {
  ui.draftView.innerHTML = "";
  markDraft(ui.draftView, result.draft || "", result.verify?.claims || []);

  ui.allowedView.innerHTML = "";
  ui.copyAllowed.hidden = true;
  state.allowedText = "";

  if (result.decision === "publish") {
    ui.allowedLabel.textContent = "Cleared to publish";
    const text = document.createElement("div");
    text.textContent = result.draft || "";
    ui.allowedView.appendChild(text);
    state.allowedText = result.draft || "";
    ui.copyAllowed.hidden = !state.allowedText;
    return;
  }

  if (result.decision === "rewrite") {
    ui.allowedLabel.textContent = "Required corrections";
    const claims = (result.verify?.claims || []).filter(
      (claim) =>
        claim.counted !== false &&
        ["contradicted", "not_stated"].includes((claim.verdict || "").toLowerCase())
    );
    if (!claims.length) {
      const note = document.createElement("div");
      note.className = "delivery-empty";
      note.textContent = "No claim-level correction was returned.";
      ui.allowedView.appendChild(note);
      return;
    }
    for (const claim of claims) {
      const evidence = evidenceList(claim.evidence);
      const passages = claim.governing_quotes
        || [claim.governing_quote || (evidence[0] && evidence[0].quote) || ""];
      for (const passage of passages) {
        const quote = document.createElement("blockquote");
        quote.className = "allowed-quote";
        quote.textContent = passage || "No governing passage returned.";
        ui.allowedView.appendChild(quote);
      }
    }
    const note = document.createElement("div");
    note.className = "delivery-empty";
    note.textContent = "Replace the struck claims with the governing clauses above before publishing.";
    ui.allowedView.appendChild(note);
    return;
  }

  ui.allowedLabel.textContent = "Nothing leaves Docket";
  const note = document.createElement("div");
  note.className = "delivery-empty";
  note.textContent = result.headline || (result.reasons || [])[0] || "Held for a human.";
  ui.allowedView.appendChild(note);
}

function renderAuthority(result) {
  ui.authority.innerHTML = "";
  const trace = result.authority?.trace || [];
  if (!trace.length) {
    ui.authority.textContent = "No authority trace was returned.";
    return;
  }

  for (const row of trace) {
    const wrap = document.createElement("div");
    wrap.className = "auth-row";
    wrap.dataset.outcome = row.outcome || "out of scope";

    const icon = document.createElement("span");
    icon.className = "auth-icon";
    icon.setAttribute("aria-hidden", "true");

    const body = document.createElement("div");
    const title = document.createElement("div");
    title.className = "auth-title";
    title.textContent = row.title;
    const detail = document.createElement("div");
    detail.className = "auth-meta";
    const bits = [row.jurisdiction || "Global"];
    if (row.effective_date) bits.push(`effective ${row.effective_date}`);
    bits.push(row.precedence ? "overrides" : "normal precedence");
    detail.textContent = `${bits.join(" · ")} — ${row.rule_reason || row.why || ""}`;
    body.append(title, detail);

    const tag = document.createElement("span");
    tag.className = "auth-tag";
    const labels = { governing: "IN FORCE", superseded: "SUPERSEDED", "out of scope": "OUT OF SCOPE" };
    tag.textContent = labels[row.outcome] || row.outcome || "OUT OF SCOPE";

    wrap.append(icon, body, tag);
    ui.authority.appendChild(wrap);
  }
}

function evidenceList(evidence) {
  if (!evidence) return [];
  return Array.isArray(evidence) ? evidence : [evidence];
}

function renderClaims(result) {
  ui.claims.innerHTML = "";
  const claims = result.verify?.claims || [];
  ui.claimCount.textContent = claims.length ? `${claims.length} in draft` : "";

  if (!claims.length) {
    const note = document.createElement("p");
    note.className = "empty-copy";
    note.textContent =
      "Verify did not return claim-level results. The draft was held rather than published.";
    ui.claims.appendChild(note);
    return;
  }

  for (const claim of claims) {
    const counted = claim.counted !== false && claim.kind !== "not_a_claim";
    const verdict = (claim.verdict || "not_stated").toLowerCase();
    const row = document.createElement("div");
    row.className = "claim";

    const head = document.createElement("div");
    head.className = "claim-head";

    const text = document.createElement("div");
    text.className = "claim-text";
    text.textContent = claim.claim || "(empty claim)";

    const pill = document.createElement("span");
    pill.className = `pill ${counted ? verdict : "not_a_claim"}`;
    pill.textContent = counted ? verdict.replaceAll("_", " ") : "not a claim";

    head.append(text, pill);

    const evidence = evidenceList(claim.evidence);
    const quotes = evidence.filter((item) => item && item.quote).slice(0, 2);

    row.appendChild(head);

    for (const item of quotes) {
      const quote = document.createElement("blockquote");
      quote.className = "claim-evidence";
      quote.textContent = item.quote;
      row.appendChild(quote);
      if (item.document) {
        const source = document.createElement("div");
        source.className = "claim-source";
        source.textContent = `source: ${item.document}`;
        row.appendChild(source);
      }
    }

    if (!quotes.length && counted && (claim.governing_quotes || claim.governing_quote)) {
      const passages = claim.governing_quotes || [claim.governing_quote];
      for (const passage of passages) {
        const quote = document.createElement("blockquote");
        quote.className = "claim-evidence";
        quote.textContent = passage;
        row.appendChild(quote);
      }
      const source = document.createElement("div");
      source.className = "claim-source";
      source.textContent = `governing clause: ${claim.governing_doc || "source"}`;
      row.appendChild(source);
    } else if (!quotes.length && counted) {
      const note = document.createElement("div");
      note.className = "claim-source";
      note.textContent = "No source passage was returned for this claim.";
      row.appendChild(note);
    }

    ui.claims.appendChild(row);
  }
}

function renderConflicts(result) {
  ui.conflicts.innerHTML = "";
  const pairs = result.compare?.pairs || [];
  const withConflicts = pairs.filter((pair) => (pair.conflicts || []).length);

  if (!withConflicts.length) {
    ui.conflictsBlock.hidden = true;
    return;
  }

  const titleById = new Map();
  for (const row of result.rerank?.rows || []) titleById.set(row.clause_id, row.doc_title);

  ui.conflictsBlock.hidden = false;

  for (const pair of withConflicts) {
    // One conflict per governing clause, highest confidence first. A single
    // clause can otherwise produce several paraphrased "conflicts" that say
    // the same thing and make the evidence look noisy.
    const best = new Map();
    for (const conflict of pair.conflicts) {
      const key = (conflict.a && conflict.a.quote) || "";
      const current = best.get(key);
      if (!current || (conflict.confidence || 0) > (current.confidence || 0)) best.set(key, conflict);
    }
    for (const conflict of best.values()) {
      const card = document.createElement("div");
      card.className = "conflict";

      const head = document.createElement("div");
      head.className = "conflict-head";
      head.textContent = `${pair.relation || "conflict"} · ${titleById.get(pair.a) || pair.a} vs ${titleById.get(pair.b) || pair.b}`;

      const grid = document.createElement("div");
      grid.className = "conflict-pair";

      for (const [side, label] of [
        [conflict.a, "Governing"],
        [conflict.b, "Superseded"],
      ]) {
        const cell = document.createElement("div");
        cell.className = "conflict-side";
        const tag = document.createElement("div");
        tag.className = "conflict-label";
        tag.textContent = label;
        const quote = document.createElement("div");
        quote.className = "conflict-quote";
        quote.textContent = side?.quote || "No passage returned.";
        cell.append(tag, quote);
        grid.appendChild(cell);
      }

      card.append(head, grid);
      ui.conflicts.appendChild(card);
    }
  }
}

function renderRerank(result) {
  ui.rerank.innerHTML = "";
  const rows = result.rerank?.rows || [];
  if (!rows.length) {
    ui.rerank.textContent = "No rerank results were returned.";
    return;
  }

  const selected = new Set((result.rerank?.selected || []).map((row) => row.clause_id));
  const ordered = [...rows].sort((a, b) => Number(selected.has(b.clause_id)) - Number(selected.has(a.clause_id)));

  for (const row of ordered.slice(0, 10)) {
    const line = document.createElement("div");
    line.className = "rerank-row";
    line.dataset.action = row.action || "skip";

    const action = document.createElement("span");
    action.className = "rerank-action";
    action.textContent = row.action || "skip";

    const text = document.createElement("span");
    text.className = "rerank-text";
    text.textContent = `${row.doc_title}: ${row.text}`;
    text.title = row.text;

    const score = document.createElement("span");
    score.className = "rerank-score";
    const value = typeof row.relevance === "number" ? `${Math.round(row.relevance * 100)}%` : "";
    score.textContent = row.reason ? `${row.reason} ${value}` : value;

    line.append(action, text, score);
    ui.rerank.appendChild(line);
  }
}

/* ------------------------------------------------------------------ audit */
async function loadAudit() {
  try {
    const response = await fetch("/api/checks?limit=8");
    const rows = await response.json();
    if (!rows.length) {
      ui.auditBody.innerHTML = '<tr class="empty-row"><td colspan="7">No checks yet.</td></tr>';
      return;
    }
    ui.auditBody.innerHTML = "";
    for (const row of rows) {
      const tr = document.createElement("tr");
      const time = new Date(row.created_at).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
      tr.innerHTML = `
        <td class="time">${escapeHtml(time)}</td>
        <td class="question" title="${escapeHtml(row.question)}">${escapeHtml(row.question)}</td>
        <td><span class="pill ${escapeHtml(row.decision)}">${escapeHtml(row.decision)}</span></td>
        <td>${escapeHtml(row.governing_title || "—")}</td>
        <td class="num">${row.claim_count || 0}</td>
        <td class="num">${formatCredits(row.credits)}</td>
        <td class="num">${row.latency_ms || 0} ms</td>
      `;
      ui.auditBody.appendChild(tr);
    }
  } catch {
    /* the audit table is not worth breaking the page over */
  }
}

async function loadStats() {
  try {
    const response = await fetch("/api/stats");
    const stats = await response.json();
    ui.creditTotal.textContent = formatCredits(stats.credits || 0);
  } catch {
    /* ignore */
  }
}

async function checkHealth() {
  try {
    const response = await fetch("/api/health");
    const health = await response.json();
    state.streaming = health.streaming !== false;
    const configured = health.clocked_configured !== false;
    ui.live.dataset.state = configured ? "live" : "offline";
    ui.liveText.textContent = configured ? "Live" : "Offline";
    if (!configured) {
      showError("This server has no CLOCKED_API_KEY. Add it to .env and restart.");
    }
  } catch {
    ui.live.dataset.state = "offline";
    ui.liveText.textContent = "Offline";
  }
}

/* ---------------------------------------------------------------- helpers */
function showError(message) {
  ui.error.textContent = message;
  ui.error.hidden = false;
}

function clearError() {
  ui.error.textContent = "";
  ui.error.hidden = true;
}

function formatCredits(value) {
  const number = Number(value || 0);
  if (!number) return "0";
  return number < 1 ? number.toFixed(2) : String(Math.round(number * 10) / 10);
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

init();
