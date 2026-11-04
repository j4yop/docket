/* Docket UI — no framework, no build step. */

const $ = (selector) => document.querySelector(selector);

const ui = {
  sampleChips: $("#sample-chips"),
  clear: $("#clear"),
  question: $("#question"),
  country: $("#country"),
  role: $("#role"),
  plan: $("#plan"),
  docList: $("#doc-list"),
  docCount: $("#doc-count"),
  addDoc: $("#add-doc"),
  draft: $("#draft"),
  run: $("#run"),
  error: $("#error"),
  inputStatus: $("#input-status"),
  stepper: $("#stepper"),
  runStatus: $("#run-status"),
  empty: $("#empty"),
  result: $("#result"),
  verdictCard: $("#verdict-card"),
  verdictWord: $("#verdict-word"),
  verdictSub: $("#verdict-sub"),
  verdictMeter: $("#verdict-meter"),
  verdictMeta: $("#verdict-meta"),
  reasons: $("#reasons"),
  authority: $("#authority"),
  claims: $("#claims"),
  claimCount: $("#claim-count"),
  conflictsBlock: $("#conflicts-block"),
  conflicts: $("#conflicts"),
  rerank: $("#rerank"),
  raw: $("#raw"),
  copyJson: $("#copy-json"),
  auditBody: $("#audit-body"),
  creditTotal: $("#credit-total"),
};

const state = { documents: [], samples: [], busy: false, last: null, streaming: true };

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
  state.documents = [blankDoc()];
  renderDocs();
  bind();
  await Promise.all([loadSamples(), loadAudit(), loadStats(), checkHealth()]);
}

function bind() {
  ui.docList.addEventListener("input", onDocEdit);
  ui.docList.addEventListener("change", onDocEdit);
  ui.docList.addEventListener("click", (event) => {
    const button = event.target.closest(".doc-remove");
    if (!button) return;
    const index = Number(button.dataset.index);
    if (state.documents.length === 1) {
      state.documents[0] = blankDoc();
    } else {
      state.documents.splice(index, 1);
    }
    renderDocs();
  });

  ui.addDoc.addEventListener("click", () => {
    if (state.documents.length >= 4) return;
    state.documents.push(blankDoc());
    renderDocs();
    const inputs = ui.docList.querySelectorAll(".doc-title");
    inputs[inputs.length - 1]?.focus();
  });

  ui.run.addEventListener("click", run);
  ui.clear.addEventListener("click", clearAll);

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
}

/* --------------------------------------------------------------- documents */
function field(labelText, id, input) {
  const wrap = document.createElement("div");
  const label = document.createElement("label");
  label.htmlFor = id;
  label.textContent = labelText;
  wrap.append(label, input);
  return wrap;
}

function renderDocs() {
  ui.docList.innerHTML = "";

  state.documents.forEach((doc, index) => {
    const card = document.createElement("div");
    card.className = "doc";

    const head = document.createElement("div");
    head.className = "doc-head";
    const title = document.createElement("input");
    title.type = "text";
    title.className = "doc-title";
    title.id = `doc-title-${index}`;
    title.placeholder = "Document title";
    title.value = doc.title;
    title.dataset.field = "title";
    title.dataset.index = String(index);
    title.setAttribute("aria-label", `Document ${index + 1} title`);

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "doc-remove";
    remove.dataset.index = String(index);
    remove.setAttribute("aria-label", `Remove document ${index + 1}`);
    remove.textContent = "×";

    head.append(title, remove);

    const meta = document.createElement("div");
    meta.className = "doc-meta";

    const jurisdiction = document.createElement("input");
    jurisdiction.type = "text";
    jurisdiction.id = `doc-jurisdiction-${index}`;
    jurisdiction.placeholder = "Global or FR";
    jurisdiction.value = doc.jurisdiction;
    jurisdiction.dataset.field = "jurisdiction";
    jurisdiction.dataset.index = String(index);

    const date = document.createElement("input");
    date.type = "date";
    date.id = `doc-date-${index}`;
    date.value = doc.effective_date || "";
    date.dataset.field = "effective_date";
    date.dataset.index = String(index);

    const precedence = document.createElement("select");
    precedence.id = `doc-precedence-${index}`;
    precedence.dataset.field = "precedence";
    precedence.dataset.index = String(index);
    for (const [value, text] of [["0", "Normal"], ["1", "Overrides"]]) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = text;
      if (String(doc.precedence) === value) option.selected = true;
      precedence.appendChild(option);
    }

    meta.append(
      field("Jurisdiction", jurisdiction.id, jurisdiction),
      field("Effective date", date.id, date),
      field("Precedence", precedence.id, precedence)
    );

    const body = document.createElement("textarea");
    body.id = `doc-text-${index}`;
    body.rows = 4;
    body.placeholder = "Paste the policy text…";
    body.value = doc.text;
    body.dataset.field = "text";
    body.dataset.index = String(index);
    body.setAttribute("aria-label", `Document ${index + 1} text`);

    card.append(head, meta, body);
    ui.docList.appendChild(card);
  });

  ui.docCount.textContent = `${state.documents.length} of 4`;
  ui.addDoc.disabled = state.documents.length >= 4;
  ui.inputStatus.textContent = state.documents.length ? "ready" : "empty";
  ui.inputStatus.dataset.state = state.documents.length ? "done" : "";
}

function onDocEdit(event) {
  const target = event.target;
  if (!target.dataset.field) return;
  const index = Number(target.dataset.index);
  if (Number.isNaN(index) || !state.documents[index]) return;
  const fieldName = target.dataset.field;
  state.documents[index][fieldName] =
    fieldName === "precedence" ? Number(target.value) : target.value;
}

/* ----------------------------------------------------------------- samples */
async function loadSamples() {
  try {
    const response = await fetch("/api/samples");
    state.samples = await response.json();
    ui.sampleChips.innerHTML = "";
    for (const sample of state.samples) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "chip";
      button.textContent = sample.label;
      button.title = sample.blurb || "";
      button.addEventListener("click", () => loadSample(sample.id));
      ui.sampleChips.appendChild(button);
    }
  } catch {
    ui.sampleChips.innerHTML = '<span class="examples-label">Examples unavailable</span>';
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
    renderDocs();
    clearError();
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
  state.documents = [blankDoc()];
  renderDocs();
  clearError();
  ui.result.hidden = true;
  ui.empty.hidden = false;
  resetStages();
  ui.runStatus.textContent = "idle";
  ui.runStatus.dataset.state = "";
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
  if (payload.question.length < 3) return "Enter the employee question.";
  if (payload.draft.length < 3) return "Paste the draft answer the assistant wants to send.";
  if (!payload.documents.length) return "Add at least one policy document.";
  for (const [index, doc] of payload.documents.entries()) {
    if (!doc.title) return `Document ${index + 1} needs a title.`;
    if (doc.text.length < 20) return `Document ${index + 1} needs at least 20 characters of policy text.`;
  }
  return null;
}

async function run() {
  if (state.busy) return;
  const payload = collect();
  const problem = validate(payload);
  if (problem) {
    showError(problem);
    return;
  }

  clearError();
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
  try {
    if (!state.streaming) throw new Error("streaming disabled");
    const response = await fetch("/api/check/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok || !response.body) throw new Error("stream unavailable");
    await consume(response);
  } catch {
    try {
      const response = await fetch("/api/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      for (const stage of result.stages || []) renderStage(stage);
      renderResult(result, performance.now() - started);
    } catch {
      showError("The check could not run. Nothing was published.");
      setRunStatus("error", "failed");
    }
  } finally {
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
  ui.verdictSub.textContent = meta.sub;

  const grounded =
    result.verify && typeof result.verify.grounded === "number" ? result.verify.grounded : null;
  ui.verdictMeter.style.width = grounded === null ? "0%" : `${Math.round(grounded * 100)}%`;

  const claims = result.verify?.claims || [];
  const counted = claims.filter((c) => c.counted !== false && c.kind !== "not_a_claim");
  const supported = counted.filter((c) => (c.verdict || "").toLowerCase() === "supported").length;
  const supportText = counted.length
    ? `${supported} of ${counted.length} claims supported`
    : "support not evaluated";
  const parts = [`${formatCredits(result.credits)} credits`, `${result.latency_ms} ms`, supportText];
  ui.verdictMeta.textContent = parts.join(" · ");

  ui.reasons.innerHTML = "";
  for (const reason of result.reasons || []) {
    const item = document.createElement("li");
    item.textContent = reason;
    ui.reasons.appendChild(item);
  }

  renderAuthority(result);
  renderClaims(result);
  renderConflicts(result);
  renderRerank(result);

  ui.raw.textContent = JSON.stringify(result.raw || {}, null, 2);
  setRunStatus(meta.status, meta.status === "error" ? "held" : "complete");

  ui.result.tabIndex = -1;
  ui.result.focus({ preventScroll: true });
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
    detail.textContent = `${bits.join(" · ")} — ${row.why || ""}`;
    body.append(title, detail);

    const tag = document.createElement("span");
    tag.className = "auth-tag";
    tag.textContent = row.outcome || "out of scope";

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

    if (!quotes.length && counted && claim.governing_quote) {
      const quote = document.createElement("blockquote");
      quote.className = "claim-evidence";
      quote.textContent = claim.governing_quote;
      row.appendChild(quote);
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
    if (!health.clocked_configured) {
      showError("This server has no CLOCKED_API_KEY. Add it to .env and restart.");
    }
  } catch {
    /* ignore */
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
