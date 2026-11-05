/* Docket gate on the Docket integrations page. */
(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const esc = (value) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const STORAGE_KEY = "docket-recent-checks";
  const MAX_DOCS = 6;
  const FALLBACK_SAMPLES = [
    { id: "precedence-recency", label: "Precedence over recency", tag: "authority", blurb: "A newer global policy is subordinate to an older country annex. Latest-wins publishes the wrong answer." },
    { id: "expense-update", label: "Expense policy update", tag: "version", blurb: "A new version changes two numbers. The draft still uses the old ones." },
    { id: "access-request", label: "Clean access request", tag: "control", blurb: "One governing source, a draft that matches it. The gate publishes." },
  ];

  const state = {
    documents: [],
    activeDoc: 0,
    samples: [],
    busy: false,
    last: null,
    lastPayload: null,
    mode: "case",
  };

  let refs = {};

  const blankDoc = () => ({
    title: "",
    jurisdiction: "Global",
    effective_date: "",
    expires_date: "",
    precedence: 0,
    text: "",
  });

  /* --------------------------------------------------------------- boot */
  function boot() {
    if (!document.getElementById("docket-gate")) return;
    document.body.classList.add("gate-mode");
    document.title = "Docket Console";
    init();
  }

  function init() {
    refs = {
      live: $("gate-live"),
      inputStatus: $("gate-input-status"),
      verdictStatus: $("gate-verdict-status"),
      tabCase: $("gate-tab-case"),
      tabExamples: $("gate-tab-examples"),
      panelCase: $("gate-panel-case"),
      panelExamples: $("gate-panel-examples"),
      caseNote: $("gate-case-note"),
      question: $("gate-question"),
      country: $("gate-country"),
      role: $("gate-role"),
      plan: $("gate-plan"),
      docTabs: $("gate-doc-tabs"),
      docEditor: $("gate-doc-editor"),
      docCount: $("gate-doc-count"),
      addDoc: $("gate-add-doc"),
      removeDoc: $("gate-remove-doc"),
      draft: $("gate-draft"),
      draftCount: $("gate-draft-count"),
      error: $("gate-error"),
      run: $("gate-run"),
      importButton: $("gate-import"),
      exportButton: $("gate-export"),
      clearButton: $("gate-clear"),
      importFile: $("gate-import-file"),
      examples: $("gate-examples"),
      openExamples: $("gate-open-examples"),
      stages: $("gate-stages"),
      empty: $("gate-empty"),
      checking: $("gate-checking"),
      result: $("gate-result"),
      refEl: $("gate-ref"),
      controlPolicies: $("gate-control-policies"),
      controlCalls: $("gate-control-calls"),
      controlCredits: $("gate-control-credits"),
      controlTime: $("gate-control-time"),
      decisions: $("gate-decisions"),
      verdictHead: $("gate-verdict-head"),
      stampWord: $("gate-stamp-word"),
      stampRef: $("gate-stamp-ref"),
      headline: $("gate-headline"),
      meta: $("gate-meta"),
      rulerMarker: $("gate-ruler-marker"),
      reasons: $("gate-reasons"),
      delivery: $("gate-delivery"),
      authority: $("gate-authority"),
      claims: $("gate-claims"),
      claimsMeta: $("gate-claims-meta"),
      guardBlock: $("gate-guard-block"),
      guardMeta: $("gate-guard-meta"),
      guard: $("gate-guard"),
      traceBlock: $("gate-trace-block"),
      trace: $("gate-trace"),
      inspectBlock: $("gate-inspect-block"),
      inspectMeta: $("gate-inspect-meta"),
      inspect: $("gate-inspect"),
      coverageBlock: $("gate-coverage-block"),
      coverageMeta: $("gate-coverage-meta"),
      coverage: $("gate-coverage"),
      conflictsBlock: $("gate-conflicts-block"),
      conflicts: $("gate-conflicts"),
      rerank: $("gate-rerank"),
      requestJson: $("gate-request-json"),
      rawJson: $("gate-raw-json"),
      copyRequest: $("gate-copy-request"),
      copyCurl: $("gate-copy-curl"),
      copyRaw: $("gate-copy-raw"),
      recentBody: $("gate-recent-body"),
      recentEmpty: $("gate-recent-empty"),
    };

    state.documents = [blankDoc()];
    bind();
    bindDocketNav();
    renderDocs();
    updateDraftCount();
    setMode("case");
    renderRecent();
    checkHealth();
    loadSamples();
    initMotion();
  }

  function bindDocketNav() {
    const menuButton = [...document.querySelectorAll("header button")].find(
      (button) => button.textContent.trim().toLowerCase() === "menu"
    );
    const overlay = document.getElementById("docket-mobile-menu");
    let menuOpen = false;

    const isVisible = (element) => Boolean(element && !element.hidden && element.getClientRects().length);

    const openMenu = () => {
      if (!overlay || !menuButton || menuOpen) return;
      menuOpen = true;
      overlay.hidden = false;
      document.body.classList.add("docket-menu-open");
      menuButton.textContent = "Close";
      menuButton.setAttribute("aria-expanded", "true");
      requestAnimationFrame(() => {
        overlay.querySelector("a[href]")?.focus({ preventScroll: true });
      });
    };

    const closeMenu = (restoreFocus = true) => {
      if (!overlay || !menuButton || !menuOpen) return;
      menuOpen = false;
      overlay.hidden = true;
      document.body.classList.remove("docket-menu-open");
      menuButton.textContent = "Menu";
      menuButton.setAttribute("aria-expanded", "false");
      if (restoreFocus) menuButton.focus({ preventScroll: true });
    };

    if (menuButton && overlay) {
      menuButton.setAttribute("aria-controls", "docket-mobile-menu");
      menuButton.setAttribute("aria-expanded", "false");
      menuButton.addEventListener("click", () => {
        if (menuOpen) closeMenu();
        else openMenu();
      });

      overlay.querySelectorAll("a[href]").forEach((link) => {
        link.addEventListener("click", () => closeMenu(false));
      });

      document.addEventListener("keydown", (event) => {
        if (!menuOpen) return;
        if (event.key === "Escape") {
          event.preventDefault();
          closeMenu();
          return;
        }
        if (event.key !== "Tab") return;
        const focusables = [menuButton, ...overlay.querySelectorAll("a[href], button")]
          .filter(isVisible);
        if (!focusables.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const current = focusables.indexOf(document.activeElement);
        event.preventDefault();
        if (event.shiftKey) {
          (current <= 0 ? last : focusables[current - 1]).focus({ preventScroll: true });
        } else {
          (current === -1 || current === focusables.length - 1 ? first : focusables[current + 1])
            .focus({ preventScroll: true });
        }
      });

      window.addEventListener("resize", () => {
        if (window.innerWidth > 1023) closeMenu(false);
      });
    }

  }

  function initMotion() {
    const root = document.documentElement;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!root.classList.contains("dk-motion")) root.classList.add("dk-motion");
    root.dataset.dkMotionReady = "true";

    // Scroll progress line under the frame.
    let scrollLine = document.querySelector(".dk-scroll-line");
    if (!scrollLine) {
      scrollLine = document.createElement("span");
      scrollLine.className = "dk-scroll-line";
      scrollLine.setAttribute("aria-hidden", "true");
      document.body.appendChild(scrollLine);
    }
    let scrollQueued = false;
    const updateScrollLine = () => {
      scrollQueued = false;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const progress = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      scrollLine.style.transform = `scaleX(${progress})`;
    };
    const queueScroll = () => {
      if (scrollQueued) return;
      scrollQueued = true;
      requestAnimationFrame(updateScrollLine);
    };
    window.addEventListener("scroll", queueScroll, { passive: true });
    window.addEventListener("resize", queueScroll);
    updateScrollLine();

    // In-page navigation: smooth scroll, and open Scenarios before scrolling.
    document.querySelectorAll('a[href^="#"]').forEach((link) => {
      const href = link.getAttribute("href");
      if (!href || href === "#") return;
      link.addEventListener("click", (event) => {
        const target = document.querySelector(href);
        if (!target) return;
        event.preventDefault();
        if (href === "#gate-panel-examples" || href === "#scenarios") {
          setMode("examples");
        }
        requestAnimationFrame(() => {
          target.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
          history.replaceState(null, "", href);
        });
      });
    });

    // Reveal sections and footer columns as they enter the viewport.
    if (location.hash === "#gate-panel-examples" || location.hash === "#scenarios") {
      setMode("examples");
    }

    const reveals = [
      ...document.querySelectorAll(".dk-reveal, [data-dk-col], .dk-footer-mark"),
    ];
    if (reduce || !("IntersectionObserver" in window)) {
      reveals.forEach((element) => element.classList.add("is-in"));
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-in");
          observer.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -24px 0px", threshold: 0.01 }
    );
    reveals.forEach((element) => observer.observe(element));

    // If a section jumps into view (anchor jump, restored scroll), reveal it
    // even when the observer's threshold is skipped.
    const revealVisible = () => {
      const limit = window.innerHeight - 24;
      reveals.forEach((element) => {
        if (!element.classList.contains("is-in") && element.getBoundingClientRect().top < limit) {
          element.classList.add("is-in");
        }
      });
    };
    window.addEventListener("scroll", () => requestAnimationFrame(revealVisible), { passive: true });
    revealVisible();
  }

  /* --------------------------------------------------------------- bind */
  function bind() {
    for (const input of [refs.question, refs.country, refs.role, refs.plan]) {
      input.addEventListener("input", () => {
        input.classList.remove("is-invalid");
        input.removeAttribute("aria-invalid");
      });
    }

    refs.draft.addEventListener("input", () => {
      updateDraftCount();
      refs.draft.classList.remove("is-invalid");
      refs.draft.removeAttribute("aria-invalid");
    });

    refs.docTabs.addEventListener("click", (event) => {
      const tab = event.target.closest(".gate-doc-tab");
      if (!tab) return;
      state.activeDoc = Number(tab.dataset.index);
      renderDocs();
    });

    refs.docEditor.addEventListener("input", onDocEdit);
    refs.docEditor.addEventListener("change", onDocEdit);

    refs.addDoc.addEventListener("click", () => {
      if (state.documents.length >= MAX_DOCS) return;
      state.documents.push(blankDoc());
      state.activeDoc = state.documents.length - 1;
      state.last = null;
      applyDocOutcomes();
      renderDocs();
      $("gate-doc-title")?.focus();
    });

    refs.removeDoc.addEventListener("click", () => {
      if (state.documents.length <= 1) {
        state.documents[0] = blankDoc();
      } else {
        state.documents.splice(state.activeDoc, 1);
        state.activeDoc = Math.max(0, state.activeDoc - 1);
      }
      state.last = null;
      applyDocOutcomes();
      renderDocs();
    });

    refs.tabCase.addEventListener("click", () => setMode("case"));
    refs.tabExamples.addEventListener("click", () => setMode("examples"));
    refs.openExamples.addEventListener("click", () => setMode("examples"));
    const modeTabs = [refs.tabCase, refs.tabExamples];
    for (const tab of modeTabs) {
      tab.addEventListener("keydown", (event) => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        let index = modeTabs.indexOf(tab);
        if (event.key === "ArrowRight") index = (index + 1) % modeTabs.length;
        if (event.key === "ArrowLeft") index = (index - 1 + modeTabs.length) % modeTabs.length;
        if (event.key === "Home") index = 0;
        if (event.key === "End") index = modeTabs.length - 1;
        const next = modeTabs[index];
        setMode(next === refs.tabCase ? "case" : "examples");
        next.focus();
      });
    }

    refs.run.addEventListener("click", run);
    document.addEventListener("keydown", (event) => {
      if (!(event.metaKey || event.ctrlKey) || event.key !== "Enter") return;
      event.preventDefault();
      run();
    });

    refs.importButton.addEventListener("click", () => refs.importFile.click());
    refs.importFile.addEventListener("change", async () => {
      const file = refs.importFile.files && refs.importFile.files[0];
      if (file) await importCase(file);
      refs.importFile.value = "";
    });
    refs.exportButton.addEventListener("click", exportCase);
    refs.clearButton.addEventListener("click", clearAll);

    refs.examples.addEventListener("click", (event) => {
      const card = event.target.closest(".gate-example");
      if (card) loadSample(card.dataset.id);
    });

    bindCopy(refs.copyRequest, () => JSON.stringify(state.lastPayload || {}, null, 2), "Copy JSON");
    bindCopy(refs.copyRaw, () => JSON.stringify((state.last && state.last.raw) || {}, null, 2), "Copy JSON");
    refs.copyCurl.addEventListener("click", async () => {
      if (!state.lastPayload) return;
      const body = JSON.stringify(state.lastPayload).replace(/'/g, "'\\''");
      const command = [
        "curl -s " + location.origin + "/api/check \\",
        "  -H 'Content-Type: application/json' \\",
        "  -d '" + body + "'",
      ].join("\n");
      await copyText(command);
      flash(refs.copyCurl, "Copied", "Copy as cURL");
    });
  }

  function bindCopy(button, getText, original) {
    button.addEventListener("click", async () => {
      await copyText(getText());
      flash(button, "Copied", original);
    });
  }

  function flash(button, text, original) {
    button.textContent = text;
    window.setTimeout(() => {
      button.textContent = original;
    }, 1400);
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const helper = document.createElement("textarea");
      helper.value = text;
      helper.style.position = "fixed";
      helper.style.opacity = "0";
      document.body.appendChild(helper);
      helper.select();
      try {
        document.execCommand("copy");
      } catch {
        /* no-op */
      }
      helper.remove();
    }
  }

  /* --------------------------------------------------------------- modes */
  function setMode(mode, note) {
    state.mode = mode;
    const isCase = mode === "case";
    refs.tabCase.setAttribute("aria-selected", String(isCase));
    refs.tabExamples.setAttribute("aria-selected", String(!isCase));
    refs.panelCase.hidden = !isCase;
    refs.panelExamples.hidden = isCase;
    if (note !== undefined) {
      refs.caseNote.textContent = note;
      refs.caseNote.dataset.state =
        note.startsWith("Example") || note.startsWith("Imported") ? "example" : "";
    }
  }

  /* ------------------------------------------------------------- documents */
  function renderDocs() {
    refs.docTabs.innerHTML = "";
    state.documents.forEach((doc, index) => {
      const tab = document.createElement("button");
      tab.type = "button";
      tab.className = "gate-doc-tab";
      tab.dataset.index = String(index);
      tab.setAttribute("role", "tab");
      tab.setAttribute("aria-selected", String(index === state.activeDoc));
      tab.setAttribute("aria-controls", "gate-doc-editor");
      const outcome = outcomeFor(index);
      if (outcome) tab.dataset.outcome = outcome;

      const dot = document.createElement("span");
      dot.className = "gate-doc-dot";
      dot.setAttribute("aria-hidden", "true");
      const label = document.createElement("span");
      label.className = "gate-doc-label";
      label.textContent = doc.title || `Policy ${index + 1}`;
      tab.append(dot, label);
      refs.docTabs.appendChild(tab);
    });

    const doc = state.documents[state.activeDoc] || blankDoc();
    refs.docEditor.innerHTML = `
      <div class="gate-doc-grid">
        <div class="gate-field">
          <label for="gate-doc-title">Title</label>
          <input id="gate-doc-title" type="text" maxlength="120" placeholder="Policy title" data-field="title" />
        </div>
        <div class="gate-field">
          <label for="gate-doc-jurisdiction">Jurisdiction</label>
          <input id="gate-doc-jurisdiction" type="text" maxlength="20" placeholder="Global" data-field="jurisdiction" />
        </div>
        <div class="gate-field">
          <label for="gate-doc-date">Effective</label>
          <input id="gate-doc-date" type="date" data-field="effective_date" />
        </div>
        <div class="gate-field">
          <label for="gate-doc-expires">Expires</label>
          <input id="gate-doc-expires" type="date" data-field="expires_date" />
        </div>
        <div class="gate-field">
          <label for="gate-doc-precedence">Precedence</label>
          <select id="gate-doc-precedence" data-field="precedence">
            <option value="0">Normal</option>
            <option value="1">Overrides</option>
          </select>
        </div>
      </div>
      <div class="gate-field">
        <label for="gate-doc-text">Policy text</label>
        <textarea id="gate-doc-text" rows="7" maxlength="60000" placeholder="Paste the policy text…" data-field="text"></textarea>
        <div class="gate-counter" id="gate-doc-counter">${doc.text.length.toLocaleString()} / 60,000</div>
      </div>
    `;

    $("gate-doc-title").value = doc.title;
    $("gate-doc-jurisdiction").value = doc.jurisdiction;
    $("gate-doc-date").value = doc.effective_date || "";
    $("gate-doc-expires").value = doc.expires_date || "";
    $("gate-doc-precedence").value = String(doc.precedence);
    $("gate-doc-text").value = doc.text;

    refs.docCount.textContent = `${state.documents.length} of ${MAX_DOCS}`;
    refs.addDoc.disabled = state.documents.length >= MAX_DOCS;
    refs.removeDoc.disabled = state.documents.length <= 1;
  }

  function onDocEdit(event) {
    const target = event.target;
    if (!target.dataset || !target.dataset.field) return;
    const doc = state.documents[state.activeDoc];
    if (!doc) return;

    const field = target.dataset.field;
    doc[field] = field === "precedence" ? Number(target.value) : target.value;

    if (field === "title") {
      const label = refs.docTabs.querySelector(
        `.gate-doc-tab[data-index="${state.activeDoc}"] .gate-doc-label`
      );
      if (label) label.textContent = doc.title || `Policy ${state.activeDoc + 1}`;
    }
    if (field === "text") {
      $("gate-doc-counter").textContent = `${target.value.length.toLocaleString()} / 60,000`;
    }

    target.classList.remove("is-invalid");
    target.removeAttribute("aria-invalid");
  }

  function outcomeFor(index) {
    return state.last?.authority?.trace?.find((row) => row.id === `doc${index + 1}`)?.outcome;
  }

  function applyDocOutcomes() {
    refs.docTabs.querySelectorAll(".gate-doc-tab").forEach((tab, index) => {
      const outcome = outcomeFor(index);
      if (outcome) tab.dataset.outcome = outcome;
      else delete tab.dataset.outcome;
    });
  }

  function updateDraftCount() {
    refs.draftCount.textContent = `${refs.draft.value.length.toLocaleString()} / 10,000`;
  }

  /* --------------------------------------------------------------- payload */
  function collect() {
    return {
      question: refs.question.value.trim(),
      draft: refs.draft.value.trim(),
      country: refs.country.value.trim(),
      role: refs.role.value.trim(),
      plan: refs.plan.value.trim(),
      documents: state.documents.map((doc) => ({
        title: doc.title.trim(),
        jurisdiction: doc.jurisdiction.trim() || "Global",
        effective_date: doc.effective_date || "",
        expires_date: doc.expires_date || "",
        precedence: Number(doc.precedence) || 0,
        text: doc.text.trim(),
      })),
    };
  }

  function validate(payload) {
    if (payload.question.length < 3) {
      return { message: "Enter the employee question.", focus: refs.question };
    }
    if (payload.draft.length < 3) {
      return { message: "Paste the draft answer the assistant wants to send.", focus: refs.draft };
    }
    for (let index = 0; index < payload.documents.length; index += 1) {
      const doc = payload.documents[index];
      if (!doc.title) {
        return { message: `Policy ${index + 1} needs a title.`, docIndex: index, field: "title" };
      }
      if (doc.text.length < 20) {
        return { message: `Policy ${index + 1} needs at least 20 characters of policy text.`, docIndex: index, field: "text" };
      }
    }
    return null;
  }

  /* ------------------------------------------------------------------ stream */
  function updateStageEvent(entry) {
    if (!entry || !entry.stage) return;
    const element = refs.stages.querySelector(
      '.gate-stage[data-stage="' + String(entry.stage).replace(/"/g, "") + '"]'
    );
    if (!element) return;
    element.dataset.state = entry.status === "done" ? "done" : entry.status;
    const meta = element.querySelector(".gate-stage-meta");
    if (!meta) return;
    if (entry.status === "skipped") meta.textContent = "skipped";
    else if (entry.status === "done") {
      meta.textContent = `${entry.ms || 0} ms · ${formatCredits(entry.credits)} cr`;
    } else if (entry.status === "error") {
      meta.textContent = entry.reason || "error";
    } else {
      meta.textContent = "";
    }
  }

  let sessionToken = null;
  let sessionExpires = 0;

  async function getSession() {
    if (sessionToken && Date.now() / 1000 < sessionExpires - 30) return sessionToken;
    const response = await fetch("/api/session", { cache: "no-store" });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data || !data.token) {
      throw new Error((data && data.detail) || "Could not start a Docket session.");
    }
    sessionToken = data.token;
    sessionExpires = Number(data.expires_at) || 0;
    return sessionToken;
  }

  async function authFetch(url, options) {
    let token = await getSession();
    const headers = Object.assign({}, options.headers || {}, { "X-Docket-Session": token });
    let response = await fetch(url, Object.assign({}, options, { headers }));
    if (response.status !== 401) return response;
    sessionToken = null;
    sessionExpires = 0;
    token = await getSession();
    headers["X-Docket-Session"] = token;
    return fetch(url, Object.assign({}, options, { headers }));
  }

  async function readJsonCheck(payload) {
    const response = await authFetch("/api/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      const detail = (body && (body.detail || body.error)) || `HTTP ${response.status}`;
      throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
    }
    if (!body || body.error) throw new Error((body && body.error) || "No result returned.");
    return body;
  }

  async function readCheckStream(payload) {
    const response = await authFetch("/api/check/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      if ([404, 405, 501].includes(response.status)) return readJsonCheck(payload);
      const body = await response.json().catch(() => null);
      const detail = (body && (body.detail || body.error)) || `HTTP ${response.status}`;
      throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
    }
    if (!response.body) return readJsonCheck(payload);

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let result = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let boundary = buffer.indexOf("\n\n");
      while (boundary !== -1) {
        const block = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        let event = "message";
        let data = "";
        for (const line of block.split("\n")) {
          if (line.indexOf("event:") === 0) event = line.slice(6).trim();
          else if (line.indexOf("data:") === 0) data += line.slice(5).trim();
        }
        if (data) {
          const parsed = JSON.parse(data);
          if (event === "stage") updateStageEvent(parsed);
          else if (event === "result") result = parsed;
          else if (event === "error") throw new Error(parsed.message || "The check stream failed.");
        }
        boundary = buffer.indexOf("\n\n");
      }
    }

    if (!result) throw new Error("No result returned.");
    return result;
  }

  /* ------------------------------------------------------------------ run */
  async function run() {
    if (state.busy) return;
    const payload = collect();
    const problem = validate(payload);
    if (problem) {
      if (problem.docIndex != null) {
        state.activeDoc = problem.docIndex;
        renderDocs();
      }
      showError(problem.message);
      const focus = problem.docIndex != null ? $(`gate-doc-${problem.field}`) : problem.focus;
      markInvalid(focus);
      return;
    }

    clearError();
    clearInvalid();
    state.busy = true;
    state.lastPayload = payload;

    refs.run.disabled = true;
    refs.run.textContent = "Checking…";
    refs.empty.hidden = true;
    refs.result.hidden = true;
    refs.checking.hidden = false;
    setStatus("input", "Checking", "busy");
    setStatus("verdict", "Checking", "busy");
    setStageState("");

    try {
      const data = await readCheckStream(payload);
      state.last = data;
      renderResult(data, payload);
      addRecent(data, payload);
      setStatus("input", "Ready", "done");
      setStatus("verdict", String(data.decision || "hold").toLowerCase() === "hold" ? "Held" : "Complete", "done");
    } catch (error) {
      showError(`The check did not finish. ${error.message}. Hold the answer until the gate returns.`);
      renderFailClosed(error);
      setStatus("input", "Ready", "done");
      setStatus("verdict", "Held", "error");
    } finally {
      state.busy = false;
      refs.run.disabled = false;
      refs.run.innerHTML = "Run check <kbd>⌘↵</kbd>";
      refs.checking.hidden = true;
    }
  }

  function renderFailClosed(error) {
    const result = {
      checked_at: new Date().toISOString(),
      decision: "hold",
      headline: "The check did not finish. Hold the answer.",
      reasons: [
        `The gate returned an error: ${error.message}`,
        "No answer should ship until the check completes.",
      ],
      credits: 0,
      latency_ms: 0,
      api_calls: 0,
      authority: { governing: null, superseded: [], trace: [] },
      verify: { claims: [], grounded: 0 },
      compare: null,
      rerank: { rows: [] },
      raw: { error: String(error) },
    };
    state.last = result;
    renderResult(result, state.lastPayload);
    addRecent(result, state.lastPayload);
  }

  /* --------------------------------------------------------------- result */
  function renderResult(result, payload) {
    const decision = String(result.decision || "hold").toLowerCase();
    const ref = makeRef(result);

    state.lastPayload = payload || state.lastPayload;
    refs.empty.hidden = true;
    refs.checking.hidden = true;
    refs.result.hidden = false;

    refs.refEl.textContent = ref;
    refs.controlPolicies.textContent = `${((payload && payload.documents) || []).length} POLICIES`;
    refs.controlCalls.textContent = `${result.api_calls || 0} CALLS`;
    refs.controlCredits.textContent = `${formatCredits(result.credits)} CREDITS`;
    refs.controlTime.textContent = formatSeconds(result.latency_ms);

    refs.decisions.querySelectorAll("span").forEach((span) => {
      span.dataset.active = String(span.dataset.decision === decision);
    });

    refs.verdictHead.dataset.state = decision;
    refs.stampWord.textContent = decision;
    refs.stampRef.textContent = ref;

    let headline = esc(result.headline || "");
    if (result.authority && result.authority.governing && result.authority.governing.title) {
      headline = headline
        .split(esc(result.authority.governing.title))
        .join(`<strong>${esc(result.authority.governing.title)}</strong>`);
    }
    refs.headline.innerHTML = headline || "No headline returned.";

    const time = formatTime(result.checked_at);
    const privacy = result.protect && result.protect.entity_count
      ? ` · ${result.protect.entity_count} PII redacted`
      : "";
    refs.meta.innerHTML = `${time ? `Checked ${esc(time)} · ` : ""}${esc(formatCredits(result.credits))} credits<br>${esc(formatSeconds(result.latency_ms))} · ${result.api_calls || 0} calls · ${esc(supportText(result))}${privacy}`;

    const grounded = Number((result.verify && result.verify.grounded) || 0);
    refs.rulerMarker.style.left = `${Math.max(0, Math.min(100, grounded * 100))}%`;

    refs.reasons.innerHTML = (result.reasons || [])
      .map((reason) => `<li>${esc(reason)}</li>`)
      .join("") || "<li>No reasons returned.</li>";

    renderStages(result);
    renderTrace(result);
    renderDelivery(result, payload);
    renderAuthority(result);
    renderClaims(result);
    renderGuard(result);
    renderInspect(result);
    renderCoverage(result);
    renderConflicts(result);
    renderRerank(result);
    renderDrawers(result, payload);
    applyDocOutcomes();

    if (window.matchMedia("(max-width: 1100px)").matches) {
      refs.result.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function renderTrace(result) {
    const stages = result && result.stages;
    if (!Array.isArray(stages) || !stages.length) {
      refs.traceBlock.hidden = true;
      return;
    }
    refs.traceBlock.hidden = false;
    const coverage = result.coverage || {};
    const verify = result.verify || {};
    const claims = (verify.claims || []).filter((claim) => claim.counted !== false);
    const contradicted = claims.filter((claim) => claim.verdict === "contradicted").length;
    const supported = claims.filter((claim) => claim.verdict === "supported").length;
    const guard = result.guard || {};
    const inspect = result.inspect || {};
    const protect = result.protect || {};
    const roles = {
      authority: "Resolves jurisdiction, precedence and valid time.",
      protect: "Redacts personal data before the audit preview is stored.",
      guard: "Screens source and draft for prompt injection.",
      inspect: "Reviews runbook scripts before an employee runs them.",
      rerank: "Selects the governing clauses that answer the question.",
      compare: "Aligns conflicts with superseded clauses.",
      coverage: "Extracts obligations and finds material omissions.",
      verify: "Checks every claim against the governing text.",
    };
    const without = {
      authority: "Without Authority, the newest policy could win.",
      protect: protect.entity_count ? "Without Protect, the audit preview would store raw PII." : "Without Protect, PII screening would be skipped.",
      guard: Number(guard.injection) >= 0.5 ? "Without Guard, the injected source would continue to Rerank." : "Without Guard, injection risk would be unchecked.",
      inspect: inspect.verdict ? "Without Inspect, this script would not get a safety review." : "No runnable script in this draft.",
      rerank: "Without Rerank, authority would not select clause-level evidence.",
      compare: "Without Compare, the superseded-clause diff would be missing.",
      coverage: coverage.value === true ? "Without Fill, the omission would be invisible." : "Without Fill, completeness would be unverified.",
      verify: contradicted ? "Without Verify, the contradiction would not be caught." : "Without Verify, support would be an assertion.",
    };
    const effects = {
      authority: "governing",
      protect: protect.entity_count ? `${protect.entity_count} redacted` : "clean",
      guard: Number(guard.injection) >= 0.5 ? "HOLD" : "benign",
      inspect: inspect.verdict || (inspect.error ? "error" : "skipped"),
      rerank: `${(result.rerank && result.rerank.selected && result.rerank.selected.length) || 0} clauses`,
      compare: result.compare && result.compare.pairs ? "conflicts" : "none",
      coverage: coverage.value === true ? "REWRITE" : "no omission",
      verify: `${supported}/${claims.length} supported`,
    };
    const impactFor = (stage) => {
      if (stage.status === "error") return "error";
      if (stage.status === "skipped") return "skip";
      if (stage.stage === "guard" && Number(guard.injection) >= 0.5) return "hold";
      if (stage.stage === "inspect" && (inspect.malicious === true || String(inspect.verdict || "").toLowerCase() === "malicious")) return "hold";
      if (stage.stage === "coverage" && coverage.value === true) return "rewrite";
      if (stage.stage === "verify" && contradicted) return "rewrite";
      return "support";
    };
    refs.trace.innerHTML = stages
      .map((stage) => {
        const name = stage.stage;
        const role = roles[name] || "Endpoint contribution.";
        const impact = impactFor(stage);
        const effect = stage.status === "skipped" ? "skipped" : effects[name] || stage.status;
        return `<div class="gate-trace-row" data-impact="${impact}">
          <span class="gate-trace-endpoint">${esc(name)}</span>
          <span class="gate-trace-body">
            <span class="gate-trace-role">${esc(role)}</span>
            <span class="gate-trace-without">${esc(without[name] || "")}</span>
          </span>
          <span class="gate-trace-effect">${esc(effect)}</span>
        </div>`;
      })
      .join("");
  }

  function makeRef(result) {
    const date = result.checked_at ? new Date(result.checked_at) : new Date();
    const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
    const ymd = `${String(safeDate.getFullYear()).slice(2)}${String(safeDate.getMonth() + 1).padStart(2, "0")}${String(safeDate.getDate()).padStart(2, "0")}`;
    return result.id != null
      ? `DK-${ymd}-${String(result.id).padStart(4, "0")}`
      : `DK-${ymd}-HOLD`;
  }

  function formatCredits(value) {
    const number = Number(value || 0);
    return Number.isInteger(number) ? String(number) : number.toFixed(1);
  }

  function formatSeconds(ms) {
    return `${(Number(ms || 0) / 1000).toFixed(1)}s`;
  }

  function formatTime(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  }

  function countedClaims(result) {
    return ((result.verify && result.verify.claims) || []).filter(
      (claim) => claim.counted !== false && claim.kind !== "not_a_claim"
    );
  }

  function supportText(result) {
    const claims = countedClaims(result);
    const supported = claims.filter((claim) => claim.verdict === "supported").length;
    return `${supported}/${claims.length} supported`;
  }

  function renderStages(result) {
    const stages = result.stages || [];
    refs.stages.querySelectorAll(".gate-stage").forEach((element) => {
      const stage = stages.find((item) => item.stage === element.dataset.stage);
      const meta = element.querySelector(".gate-stage-meta");
      if (!stage) {
        delete element.dataset.state;
        meta.textContent = "";
        return;
      }
      element.dataset.state = stage.status === "done" ? "done" : stage.status;
      meta.textContent =
        stage.status === "skipped"
          ? "skipped"
          : `${stage.ms || 0} ms · ${formatCredits(stage.credits)} cr`;
    });
  }

  function setStageState(stateName) {
    refs.stages.querySelectorAll(".gate-stage").forEach((element) => {
      if (stateName) element.dataset.state = stateName;
      else delete element.dataset.state;
      element.querySelector(".gate-stage-meta").textContent = "";
    });
  }

  function renderDelivery(result, payload) {
    const draft = (payload && payload.draft) || result.draft || "";
    const claims = countedClaims(result);
    const contradicted = claims.filter((claim) => claim.verdict === "contradicted");

    const draftPane = (body) => `
      <div class="gate-delivery-pane">
        <span class="gate-delivery-label">Assistant draft</span>
        <p class="gate-draft-text">${body}</p>
      </div>`;

    if (!contradicted.length) {
      const correction =
        result.decision === "publish"
          ? "Cleared to publish."
          : result.decision === "hold"
            ? "Nothing was published. A reviewer must resolve this hold."
            : result.coverage && result.coverage.value === true
              ? "Add the omitted condition before publishing."
              : "No contradicted claim found.";
      refs.delivery.innerHTML =
        draftPane(esc(draft)) +
        `<div class="gate-delivery-pane">
          <span class="gate-delivery-label">Required corrections</span>
          <p class="gate-draft-text">${correction}</p>
        </div>`;
      return;
    }

    let marked = esc(draft);
    for (const claim of contradicted) {
      const text = esc(claim.claim);
      if (text) marked = marked.split(text).join(`<mark>${text}</mark>`);
    }

    refs.delivery.innerHTML =
      draftPane(marked) +
      `<div class="gate-delivery-pane">
        <span class="gate-delivery-label">Required corrections</span>
        <ul class="gate-corrections">
          ${contradicted
            .map(
              (claim) =>
                `<li><b>${esc(claim.claim)}</b><span>${esc(claim.governing_quote || "Not stated in the governing document.")}</span></li>`
            )
            .join("")}
        </ul>
      </div>`;
  }

  function renderAuthority(result) {
    const trace = [...((result.authority && result.authority.trace) || [])].sort(
      (left, right) => outcomeRank(left.outcome) - outcomeRank(right.outcome)
    );

    if (!trace.length) {
      refs.authority.innerHTML = '<p class="gate-claim-quote">No authority trace returned.</p>';
      return;
    }

    const labels = {
      governing: "In force",
      superseded: "Superseded",
      "out of scope": "Out of scope",
    };

    refs.authority.innerHTML = trace
      .map((row) => {
        const outcome = row.outcome || "out of scope";
        const precedence = Number(row.precedence) === 1 ? "overrides" : "normal precedence";
        return `<div class="gate-authority-row" data-outcome="${esc(outcome)}">
          <span class="gate-authority-dot" aria-hidden="true"></span>
          <div>
            <b>${esc(row.title)}</b>
            <small>${esc(row.jurisdiction || "—")} · effective ${esc(row.effective_date || "—")} · ${precedence} — ${esc(row.rule_reason || row.why || "")}</small>
          </div>
          <span class="gate-tag" data-kind="${esc(outcome)}">${esc(labels[outcome] || outcome)}</span>
        </div>`;
      })
      .join("");
  }

  function outcomeRank(outcome) {
    return { governing: 0, superseded: 1, "out of scope": 2 }[outcome] ?? 3;
  }

  function renderClaims(result) {
    const claims = countedClaims(result);
    refs.claimsMeta.textContent = `${claims.length} in draft`;

    if (!claims.length) {
      refs.claims.innerHTML = '<p class="gate-claim-quote">No counted claims.</p>';
      return;
    }

    refs.claims.innerHTML = claims
      .map((claim) => {
        const verdict = claim.verdict || "not_stated";
        const label = verdict.replace(/_/g, " ");
        return `<div class="gate-claim-row">
          <div class="gate-claim-top">
            <span class="gate-claim-text">${esc(claim.claim)}</span>
            <span class="gate-tag" data-kind="${esc(verdict)}">${esc(label)}</span>
          </div>
          ${
            claim.governing_quote
              ? `<p class="gate-claim-quote"><b>Governing clause${claim.governing_doc ? ` · ${esc(claim.governing_doc)}` : ""}</b><br>${esc(claim.governing_quote)}</p>`
              : ""
          }
        </div>`;
      })
      .join("");
  }

  function renderGuard(result) {
    const guard = result && result.guard;
    if (!guard || typeof guard.injection !== "number") {
      refs.guardBlock.hidden = true;
      return;
    }
    refs.guardBlock.hidden = false;
    const risk = Math.max(0, Math.min(100, guard.injection * 100));
    const risky = guard.verdict === "injection" || risk >= 50;
    refs.guard.dataset.risky = String(risky);
    refs.guardMeta.textContent = risky ? "injection risk" : "safe";
    const evidence = Array.isArray(guard.evidence) ? guard.evidence : [];
    refs.guard.innerHTML = `
      <div class="gate-guard-meter"><span style="width:${risk}%"></span></div>
      <div class="gate-guard-head">
        <strong>${risk.toFixed(0)}%</strong>
        <span>${esc(guard.category || "instruction risk")} · ${esc(guard.severity || "unknown")}</span>
      </div>
      ${
        evidence.length
          ? `<div class="gate-guard-evidence">${evidence
              .map(
                (item) => `<div class="gate-guard-quote">
                  <b>${esc(item.category || "instruction")} · ${(Number(item.confidence || 0) * 100).toFixed(0)}%</b>
                  <p>${esc(item.quote || "")}</p>
                </div>`
              )
              .join("")}</div>`
          : ""
      }
    `;
  }

  function renderInspect(result) {
    const inspect = result && result.inspect;
    if (!inspect) {
      refs.inspectBlock.hidden = true;
      return;
    }
    refs.inspectBlock.hidden = false;
    const verdict = String(inspect.verdict || "").toLowerCase();
    const risky =
      inspect.malicious === true ||
      verdict === "malicious" ||
      verdict === "suspicious" ||
      verdict === "unsafe" ||
      Number(inspect.probability) >= 0.5;
    const probability = Number(inspect.probability);
    const risk = Number.isFinite(probability)
      ? Math.max(0, Math.min(100, probability * 100))
      : risky
        ? 100
        : 0;
    refs.inspect.dataset.risky = String(risky);
    refs.inspectMeta.textContent = risky ? "unsafe script" : "script cleared";
    const evidence = Array.isArray(inspect.evidence) ? inspect.evidence : [];
    refs.inspect.innerHTML = `
      <div class="gate-guard-meter"><span style="width:${risk}%"></span></div>
      <div class="gate-guard-head">
        <strong>${risk.toFixed(0)}%</strong>
        <span>${esc(inspect.category || "script risk")} · ${esc(inspect.severity || "unknown")}</span>
      </div>
      ${
        evidence.length
          ? `<div class="gate-guard-evidence">${evidence
              .map(
                (item) => `<div class="gate-guard-quote">
                  <b>${esc(item.category || "script")} · ${(Number(item.confidence || 0) * 100).toFixed(0)}%</b>
                  <p>${esc(item.quote || item.line || "")}</p>
                </div>`
              )
              .join("")}</div>`
          : ""
      }
    `;
  }

  function renderCoverage(result) {
    const coverage = result && result.coverage;
    if (!coverage) {
      refs.coverageBlock.hidden = true;
      return;
    }
    refs.coverageBlock.hidden = false;
    const obligations = coverage.obligations || [];
    const gap = coverage.value === true;
    refs.coverageMeta.textContent = gap
      ? "omission found"
      : coverage.value === false
        ? "no omission"
        : "unavailable";
    const chips = obligations
      .map((item) => `<span class="gate-coverage-chip">${esc(String(item))}</span>`)
      .join("");
    const missing = String(coverage.missing_conditions || "").trim();
    refs.coverage.innerHTML = `
      ${chips ? `<div class="gate-coverage-chips">${chips}</div>` : `<p class="gate-coverage-empty">No material obligations were extracted.</p>`}
      ${gap ? `<div class="gate-coverage-gap"><strong>Missing condition</strong><span>${esc(missing || "The draft does not address a material policy condition.")}</span></div>` : ""}
    `;
  }

  function renderConflicts(result) {
    const pairs = result.compare && result.compare.pairs;
    if (!pairs || !pairs.length) {
      refs.conflictsBlock.hidden = true;
      return;
    }

    const clauseMap = new Map();
    for (const row of (result.rerank && result.rerank.rows) || []) {
      clauseMap.set(row.clause_id, { docId: row.doc_id, title: row.doc_title });
    }

    const governingId = result.authority && result.authority.governing && result.authority.governing.id;
    const superseded = new Set(
      (((result.authority && result.authority.superseded) || []).map((item) => item.id))
    );

    const blocks = [];
    for (const pair of pairs) {
      for (const conflict of pair.conflicts || []) {
        const a = conflict.a;
        const b = conflict.b;
        const aDoc = clauseMap.get(a.document) || { docId: String(a.document).split("-")[0], title: a.document };
        const bDoc = clauseMap.get(b.document) || { docId: String(b.document).split("-")[0], title: b.document };
        const aIsGoverning = aDoc.docId === governingId;
        const aIsSuperseded = superseded.has(aDoc.docId);
        const governing = aIsGoverning || !aIsSuperseded ? a : b;
        const supersededQuote = governing === a ? b : a;
        const governingDoc = governing === a ? aDoc : bDoc;
        const supersededDoc = governing === a ? bDoc : aDoc;

        blocks.push(`<div class="gate-conflict">
          <div class="gate-conflict-head">Conflicting · ${esc(governingDoc.title)} vs ${esc(supersededDoc.title)}</div>
          <div class="gate-conflict-grid">
            <div class="gate-conflict-col"><b>Governing</b><p>${esc(governing.quote)}</p></div>
            <div class="gate-conflict-col"><b>Superseded</b><p>${esc(supersededQuote.quote)}</p></div>
          </div>
        </div>`);

        if (blocks.length >= 4) break;
      }
      if (blocks.length >= 4) break;
    }

    if (!blocks.length) {
      refs.conflictsBlock.hidden = true;
      return;
    }
    refs.conflictsBlock.hidden = false;
    refs.conflicts.innerHTML = blocks.join("");
  }

  function renderRerank(result) {
    const rows = (result.rerank && result.rerank.rows) || [];
    if (!rows.length) {
      refs.rerank.innerHTML = '<p class="gate-claim-quote">No rerank rows returned.</p>';
      return;
    }

    refs.rerank.innerHTML = rows
      .map((row) => {
        const score = Math.round(Number(row.relevance || 0) * 100);
        return `<div class="gate-rerank-row" data-action="${esc(row.action || "skip")}">
          <span class="gate-rerank-action">${esc(row.action || "skip")}</span>
          <span class="gate-rerank-text" title="${esc(row.text)}">${esc(row.doc_title)}: ${esc(row.text)}</span>
          <span class="gate-rerank-meta">${esc(row.reason || "")} ${score}%</span>
        </div>`;
      })
      .join("");
  }

  function renderDrawers(result, payload) {
    refs.requestJson.textContent = JSON.stringify(payload || {}, null, 2);
    refs.rawJson.textContent = JSON.stringify((result && result.raw) || {}, null, 2);
  }

  /* --------------------------------------------------------------- audit */
  function addRecent(result, payload) {
    if (!payload || !payload.question) return;
    const claims = countedClaims(result);
    const supported = claims.filter((claim) => claim.verdict === "supported").length;
    const entry = {
      checked_at: result.checked_at || new Date().toISOString(),
      question: payload.question,
      decision: result.decision || "hold",
      governing: (result.authority && result.authority.governing && result.authority.governing.title) || "—",
      claims: `${supported}/${claims.length}`,
      credits: result.credits || 0,
      latency_ms: result.latency_ms || 0,
    };

    let rows = [];
    try {
      rows = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    } catch {
      rows = [];
    }
    rows.unshift(entry);
    rows = rows.slice(0, 8);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
    } catch {
      /* storage can be unavailable */
    }
    renderRecent();
  }

  function renderRecent() {
    if (!refs.recentBody || !refs.recentEmpty) return;
    let rows = [];
    try {
      rows = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    } catch {
      rows = [];
    }
    if (!Array.isArray(rows)) rows = [];

    refs.recentBody.innerHTML = rows
      .map((row) => {
        const decision = String(row.decision || "hold").toLowerCase();
        return `<tr>
          <td>${esc(formatTime(row.checked_at) || "—")}</td>
          <td title="${esc(row.question)}">${esc(row.question)}</td>
          <td><span class="gate-tag" data-kind="${esc(decision)}">${esc(decision)}</span></td>
          <td>${esc(row.governing || "—")}</td>
          <td>${esc(row.claims || "0/0")}</td>
          <td>${esc(formatCredits(row.credits))}</td>
          <td>${esc(formatSeconds(row.latency_ms))}</td>
        </tr>`;
      })
      .join("");

    refs.recentEmpty.hidden = rows.length > 0;
  }

  /* -------------------------------------------------------------- samples */
  async function checkHealth() {
    try {
      const response = await fetch("/api/health", { cache: "no-store" });
      const data = await response.json();
      setLive(Boolean(data && data.ok));
    } catch {
      setLive(false);
    }
  }

  function setLive(ok) {
    if (!refs.live) return;
    refs.live.dataset.state = ok ? "live" : "offline";
    const text = refs.live.querySelector("span");
    if (text) text.textContent = ok ? "Live" : "Offline";
  }

  async function loadSamples() {
    try {
      const response = await fetch("/api/samples", { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const samples = await response.json();
      state.samples = Array.isArray(samples) && samples.length ? samples : FALLBACK_SAMPLES;
      renderExamples();
    } catch {
      state.samples = FALLBACK_SAMPLES;
      renderExamples();
      setLive(false);
    }
  }

  function renderExamples() {
    refs.examples.innerHTML = state.samples
      .map((sample) => {
        const tag = String(sample.tag || "case").toLowerCase();
        return `<button type="button" class="gate-example" data-id="${esc(sample.id)}">
          <span class="gate-example-tag" data-tag="${esc(tag)}">${esc(tag)}</span>
          <span class="gate-example-title">${esc(sample.label || sample.id)}</span>
          <span class="gate-example-copy">${esc(sample.blurb || "")}</span>
          <span class="gate-example-load">Load case</span>
        </button>`;
      })
      .join("");
  }

  async function loadSample(id) {
    if (!id) return;
    try {
      const response = await fetch(`/api/samples/${encodeURIComponent(id)}`, { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const sample = await response.json();
      const context = sample.context || {};

      refs.question.value = sample.question || "";
      refs.country.value = context.country || "";
      refs.role.value = context.role || "";
      refs.plan.value = context.plan || "";
      refs.draft.value = sample.draft || "";

      state.documents = (sample.documents || []).slice(0, MAX_DOCS).map((doc) => ({
        title: String(doc.title || ""),
        jurisdiction: String(doc.jurisdiction || "Global"),
        effective_date: String(doc.effective_date || ""),
        expires_date: String(doc.expires_date || ""),
        precedence: Number(doc.precedence) || 0,
        text: String(doc.text || ""),
      }));
      if (!state.documents.length) state.documents = [blankDoc()];

      state.activeDoc = 0;
      state.last = null;
      state.lastPayload = null;
      renderDocs();
      updateDraftCount();
      clearError();
      clearInvalid();
      resetResult();
      setMode("case", "Example loaded — edit any field.");
      setStatus("input", "Ready", "");
      setStatus("verdict", "Idle", "");
    } catch (error) {
      showError(`Could not load that example. ${error.message}`);
    }
  }

  /* --------------------------------------------------------- import/export */
  async function importCase(file) {
    let payload;
    try {
      payload = JSON.parse(await file.text());
    } catch {
      showError("That file is not valid JSON.");
      return;
    }
    if (!payload || !Array.isArray(payload.documents) || !payload.documents.length) {
      showError("Expected a JSON case with a non-empty documents array.");
      return;
    }

    refs.question.value = String(payload.question || "").slice(0, 2000);
    refs.country.value = String(payload.country || "").slice(0, 40);
    refs.role.value = String(payload.role || "").slice(0, 60);
    refs.plan.value = String(payload.plan || "").slice(0, 60);
    refs.draft.value = String(payload.draft || "").slice(0, 10000);

    state.documents = payload.documents.slice(0, MAX_DOCS).map((doc) => ({
      title: String(doc.title || "").slice(0, 120),
      jurisdiction: String(doc.jurisdiction || "Global").slice(0, 20),
      effective_date: String(doc.effective_date || "").slice(0, 10),
      expires_date: String(doc.expires_date || "").slice(0, 10),
      precedence: Number(doc.precedence) || 0,
      text: String(doc.text || "").slice(0, 60000),
    }));
    if (!state.documents.length) state.documents = [blankDoc()];

    state.activeDoc = 0;
    state.last = null;
    state.lastPayload = null;
    renderDocs();
    updateDraftCount();
    clearError();
    clearInvalid();
    resetResult();
    setMode("case", "Imported case — edit anything.");
    setStatus("input", "Ready", "");
    setStatus("verdict", "Idle", "");
  }

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

  function clearAll() {
    refs.question.value = "";
    refs.country.value = "";
    refs.role.value = "";
    refs.plan.value = "";
    refs.draft.value = "";
    state.documents = [blankDoc()];
    state.activeDoc = 0;
    state.last = null;
    state.lastPayload = null;
    renderDocs();
    updateDraftCount();
    clearError();
    clearInvalid();
    resetResult();
    setMode("case", "Your own policies, question and draft.");
    setStatus("input", "Ready", "");
    setStatus("verdict", "Idle", "");
  }

  function resetResult() {
    refs.result.hidden = true;
    refs.empty.hidden = false;
    refs.checking.hidden = true;
    refs.verdictHead.dataset.state = "hold";
    setStageState(null);
    applyDocOutcomes();
  }

  /* ---------------------------------------------------------------- status */
  function setStatus(which, text, stateName) {
    const element = which === "input" ? refs.inputStatus : refs.verdictStatus;
    if (!element) return;
    element.textContent = text;
    if (stateName) element.dataset.state = stateName;
    else delete element.dataset.state;
  }

  /* ----------------------------------------------------------------- errors */
  function showError(message) {
    refs.error.textContent = message;
    refs.error.hidden = false;
  }

  function clearError() {
    refs.error.textContent = "";
    refs.error.hidden = true;
  }

  function markInvalid(element) {
    clearInvalid();
    if (!element) return;
    element.classList.add("is-invalid");
    element.setAttribute("aria-invalid", "true");
    element.focus();
  }

  function clearInvalid() {
    refs.docEditor.querySelectorAll(".is-invalid").forEach((element) => {
      element.classList.remove("is-invalid");
      element.removeAttribute("aria-invalid");
    });
    for (const input of [refs.question, refs.draft, refs.country, refs.role, refs.plan]) {
      input.classList.remove("is-invalid");
      input.removeAttribute("aria-invalid");
    }
  }

  boot();
})();
