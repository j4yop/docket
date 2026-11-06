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
    necessity: null,
  };

  let refs = {};

  const blankDoc = () => ({
    title: "",
    jurisdiction: "Global",
    effective_date: "",
    expires_date: "",
    precedence: 0,
    approved_by: "",
    approval_reference: "",
    policy_envelope: null,
    seeded: false,
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
      shell: document.querySelector(".gate-shell"),
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
      tryFrance: $("gate-try-france"),
      empty: $("gate-empty"),
      checking: $("gate-checking"),
      result: $("gate-result"),
      refEl: $("gate-ref"),
      controlPolicies: $("gate-control-policies"),
      controlCalls: $("gate-control-calls"),
      controlCredits: $("gate-control-credits"),
      controlTime: $("gate-control-time"),
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
      extractBlock: $("gate-extract-block"),
      extractMeta: $("gate-extract-meta"),
      extract: $("gate-extract"),
      decideBlock: $("gate-decide-block"),
      decideMeta: $("gate-decide-meta"),
      decide: $("gate-decide"),
      coverageBlock: $("gate-coverage-block"),
      coverageMeta: $("gate-coverage-meta"),
      coverage: $("gate-coverage"),
      conflictsBlock: $("gate-conflicts-block"),
      conflicts: $("gate-conflicts"),
      policiesBlock: $("gate-policies-block"),
      policiesMeta: $("gate-policies-meta"),
      policies: $("gate-policies"),
      record: $("gate-record"),
      recordMeta: $("gate-record-meta"),
      editDraft: $("gate-edit-draft"),
      necessity: $("gate-necessity"),
      necessityMeta: $("gate-necessity-meta"),
      necessityStatus: $("gate-necessity-status"),
      auditNote: $("gate-audit-note"),
      ablateEndpoint: $("gate-ablate-endpoint"),
      ablateRun: $("gate-ablate-run"),
      ablationResult: $("gate-ablation-result"),
      rerank: $("gate-rerank"),
      requestJson: $("gate-request-json"),
      rawJson: $("gate-raw-json"),
      copyRequest: $("gate-copy-request"),
      copyCurl: $("gate-copy-curl"),
      copyRaw: $("gate-copy-raw"),
      recentBody: $("gate-recent-body"),
      recentEmpty: $("gate-recent-empty"),
      adminToken: $("gate-admin-token"),
      approvePolicy: $("gate-approve-policy"),
      approveStatus: $("gate-approve-status"),
      approvalEnvelope: $("gate-approval-envelope"),
      queueToken: $("gate-queue-token"),
      reviewFilter: $("gate-review-filter"),
      reviewLoad: $("gate-review-load"),
      reviewStatus: $("gate-review-status"),
      reviewMeta: $("gate-review-meta"),
      reviewList: $("gate-review-list"),
      healthMeta: $("gate-health-meta"),
      healthLedger: $("gate-health-ledger"),
      healthPolicy: $("gate-health-policy"),
      healthStorage: $("gate-health-storage"),
      healthTime: $("gate-health-time"),
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
    loadNecessity();
    initMotion();
  }

  function bindDocketNav() {
    const consoleCta = document.querySelector('a[data-docket-console="true"]');
    if (consoleCta) {
      const label = [...consoleCta.querySelectorAll("span")].find(
        (span) => span.textContent.trim().toLowerCase() === "open console"
      );
      if (label) label.textContent = "Ledger";
      consoleCta.setAttribute("href", "/ledger");
      consoleCta.setAttribute("aria-label", "Open the audit ledger");
      consoleCta.classList.add("gate-ledger-cta");
      consoleCta.removeAttribute("data-docket-console");
      document.addEventListener(
        "click",
        (event) => {
          const cta = event.target.closest("a.gate-ledger-cta");
          if (!cta) return;
          event.preventDefault();
          event.stopPropagation();
          window.location.assign("/ledger");
        },
        true,
      );
    }
    for (const link of document.querySelectorAll('a[href="#gate-stages"]')) {
      link.setAttribute("href", "#docket-gate");
    }
    const menuButton = [...document.querySelectorAll("header button")].find(
      (button) => button.textContent.trim().toLowerCase() === "menu"
    );
    const overlay = document.getElementById("docket-mobile-menu");
    if (overlay) {
      const cleanMenu = () => {
        for (const duplicate of overlay.querySelectorAll("#docket-menu-main > li")) {
          duplicate.remove();
        }
        for (const link of overlay.querySelectorAll("a")) {
          const text = link.textContent.trim().toLowerCase();
          if (["problem", "product", "how it works", "scenarios", "api"].includes(text)) {
            link.closest("li")?.remove();
          } else if (text === "open console") {
            link.setAttribute("href", "/ledger");
            link.textContent = "Ledger";
          }
        }
      };
      cleanMenu();
      if (window.MutationObserver) {
        new MutationObserver(cleanMenu).observe(overlay, { childList: true, subtree: true });
      }
    }
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
    refs.tryFrance.addEventListener("click", runFlagship);
    refs.editDraft.addEventListener("click", editDraft);
    refs.necessity.addEventListener("click", onNecessityClick);
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
    refs.ablateRun.addEventListener("click", runAblation);
    refs.approvePolicy.addEventListener("click", approveActivePolicy);
    refs.reviewLoad.addEventListener("click", loadReviews);
    refs.reviewList.addEventListener("click", onReviewAction);
    refs.record.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-review-action]");
      if (button) resolveReview(button.dataset.reviewAction, button);
    });

    refs.examples.addEventListener("click", (event) => {
      const card = event.target.closest(".gate-example");
      if (card) loadSample(card.dataset.id);
    });

    refs.docEditor.addEventListener("click", (event) => {
      if (event.target.closest("#gate-attest-doc")) attestActiveDoc();
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
    const trust = doc.policy_envelope
      ? String(doc.policy_envelope.approval_type || "approved")
      : doc.approved_by
        ? "operator"
        : doc.seeded
          ? "seeded"
          : "unapproved";
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
      <div class="gate-doc-grid gate-doc-approval">
        <div class="gate-field">
          <label for="gate-doc-approved-by">Approved by</label>
          <input id="gate-doc-approved-by" type="text" maxlength="120" placeholder="Name or role" data-field="approved_by" />
        </div>
        <div class="gate-field">
          <label for="gate-doc-reference">Approval reference</label>
          <input id="gate-doc-reference" type="text" maxlength="200" placeholder="Ticket, email or date" data-field="approval_reference" />
        </div>
      </div>
      <div class="gate-doc-attest">
        <button type="button" class="gate-mini" id="gate-attest-doc">Attest for this check</button>
        <span>One-check approval. Shared registry approval is admin-only.</span>
      </div>
      <p class="gate-doc-hint"><span class="gate-trust" data-trust="${esc(trust)}">${esc(trust)}</span>A custom policy needs an attestation or admin approval before the gate can publish.</p>
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
    $("gate-doc-approved-by").value = doc.approved_by || "";
    $("gate-doc-reference").value = doc.approval_reference || "";
    $("gate-doc-text").value = doc.text;

    refs.docCount.textContent = `${state.documents.length} of ${MAX_DOCS}`;
    refs.addDoc.disabled = state.documents.length >= MAX_DOCS;
    refs.removeDoc.disabled = state.documents.length <= 1;
  }

  function onDocEdit(event) {
    const target = event.target;
    if (!target.dataset || !target.dataset.field) return;
    const doc = state.documents[state.activeDoc];
    doc.seeded = false;
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
        approved_by: (doc.approved_by || "").trim(),
        approval_reference: (doc.approval_reference || "").trim(),
        policy_envelope: doc.policy_envelope || null,
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
  let sessionToken = null;
  let sessionExpires = 0;
  let ablateBusy = false;

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
          if (event === "result") result = parsed;
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

  async function runAblation() {
    if (!state.lastPayload || !state.last || ablateBusy) return;
    const endpoint = refs.ablateEndpoint.value;
    ablateBusy = true;
    refs.ablateRun.disabled = true;
    refs.ablateRun.textContent = "Running…";
    refs.ablationResult.hidden = false;
    refs.ablationResult.innerHTML = `<p class="gate-claim-quote">Running the same case without ${esc(endpoint)}…</p>`;
    try {
      const response = await authFetch("/api/ablate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.assign({}, state.lastPayload, { endpoint })),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        const detail = (body && (body.detail || body.error)) || `HTTP ${response.status}`;
        throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
      }
      const baseline = String((state.last && state.last.decision) || "hold").toUpperCase();
      const ablated = String(body.decision || "hold").toUpperCase();
      const changed = baseline !== ablated;
      const reasons = (body.reasons || []).slice(0, 3).map((reason) => `<li>${esc(reason)}</li>`).join("");
      refs.ablationResult.innerHTML = `
        <div class="gate-ablation-compare">
          <div><b>Baseline</b><span data-decision="${esc(baseline.toLowerCase())}">${esc(baseline)}</span></div>
          <div><b>Without ${esc(endpoint)}</b><span data-decision="${esc(ablated.toLowerCase())}">${esc(ablated)}</span></div>
          <div><b>Decision</b><span>${changed ? "changed" : "unchanged"}</span></div>
          <div><b>Cost</b><span>${esc(formatCredits(body.credits))} credits · ${body.api_calls || 0} calls</span></div>
        </div>
        <ul class="gate-reasons gate-ablation-reasons">${reasons}</ul>
        <p class="gate-ablation-note">${esc((body.ablation && body.ablation.note) || "Simulation only.")}</p>`;
    } catch (error) {
      refs.ablationResult.innerHTML = `<p class="gate-claim-quote">Counterfactual failed: ${esc(error.message)}</p>`;
    } finally {
      ablateBusy = false;
      refs.ablateRun.disabled = false;
      refs.ablateRun.textContent = "Run without it";
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

    if (refs.shell) refs.shell.dataset.hasResult = "true";
    state.lastPayload = payload || state.lastPayload;
    refs.ablationResult.hidden = true;
    refs.ablationResult.innerHTML = "";
    refs.empty.hidden = true;
    refs.checking.hidden = true;
    refs.result.hidden = false;

    refs.refEl.textContent = ref;
    refs.controlPolicies.textContent = `${((payload && payload.documents) || []).length} POLICIES`;
    refs.controlCalls.textContent = `${result.api_calls || 0} CALLS`;
    refs.controlCredits.textContent = `${formatCredits(result.credits)} CREDITS`;
    refs.controlTime.textContent = formatSeconds(result.latency_ms);

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

    const audit = result.audit || {};
    if (audit.error) {
      refs.auditNote.innerHTML = `<strong>Audit failed:</strong> the durable ledger did not record this check, so the verdict was held. <a href="/ledger">Open the ledger</a>.`;
    } else if (audit.hash) {
      refs.auditNote.innerHTML = `<strong>Audit:</strong> ${esc(audit.storage)} · seq ${esc(audit.seq)} · hash <span title="${esc(audit.hash)}">${esc(String(audit.hash).slice(0, 12))}…</span> · <a href="/ledger">Open the ledger</a>.`;
    } else {
      refs.auditNote.innerHTML = "<strong>Simulation:</strong> this run was not written to the audit ledger. <a href=\"/ledger\">Open the ledger</a>.";
    }

    refs.reasons.innerHTML = (result.reasons || [])
      .map((reason) => `<li>${esc(reason)}</li>`)
      .join("") || "<li>No reasons returned.</li>";

    renderTrace(result);
    renderDelivery(result, payload);
    renderPolicies(result);
    renderAuthority(result);
    renderClaims(result);
    renderGuard(result);
    renderInspect(result);
    renderExtract(result);
    renderDecide(result);
    renderCoverage(result);
    renderConflicts(result);
    renderRerank(result);
    renderDecisionRecord(result);
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
    const guardThreshold = Number(guard.threshold ?? 0.5);
    const inspectThreshold = Number(inspect.threshold ?? 0.5);
    const roles = {
      authority: "Resolves jurisdiction, precedence and valid time.",
      protect: "Redacts personal data before the audit preview is stored.",
      guard: "Screens source and draft for prompt injection.",
      inspect: "Reviews runbook scripts before an employee runs them.",
      extract: "Verifies the dates, jurisdiction and constraints authority depends on.",
      decide: "Classifies the request and routes high-impact cases to review.",
      rerank: "Selects the governing clauses that answer the question.",
      compare: "Aligns conflicts with superseded clauses.",
      coverage: "Extracts obligations and finds material omissions.",
      verify: "Checks every claim against the governing text.",
    };
    const without = {
      authority: "Without Authority, the newest policy could win.",
      protect: protect.entity_count ? "Without Protect, the audit preview would store raw PII." : "Without Protect, PII screening would be skipped.",
      guard: Number(guard.injection) >= guardThreshold ? "Without Guard, the injected source would continue to Rerank." : "Without Guard, injection risk would be unchecked.",
      inspect: inspect.verdict ? "Without Inspect, this script would not get a safety review." : "No runnable script in this draft.",
      extract: (result.extract && result.extract.conflicts && result.extract.conflicts.length)
        ? "Without Extract, the metadata conflict would be invisible."
        : "Without Extract, the policy facts behind authority would be unverified.",
      decide: (result.decide && result.decide.review_required)
        ? "Without Decide, this case would publish without human review."
        : "Without Decide, every request would use one generic verification profile.",
      rerank: "Without Rerank, authority would not select clause-level evidence.",
      compare: (result.compare_unacknowledged || []).length
        ? "Without Compare, the superseded value in the draft would go unnoticed."
        : "Without Compare, the superseded-clause diff would be missing.",
      coverage: coverage.value === true ? "Without Fill, the omission would be invisible." : "Without Fill, completeness would be unverified.",
      verify: contradicted ? "Without Verify, the contradiction would not be caught." : "Without Verify, support would be an assertion.",
    };
    const effects = {
      authority: result.authority && result.authority.governing ? "governing" : "blocked",
      protect: protect.entity_count ? `${protect.entity_count} redacted` : "clean",
      guard: Number(guard.injection) >= guardThreshold ? "HOLD" : "benign",
      inspect: inspect.verdict || (inspect.error ? "error" : "skipped"),
      extract: (result.extract && result.extract.conflicts && result.extract.conflicts.length)
        ? "HOLD"
        : `${Object.values((result.extract && result.extract.governing) || {}).filter(Boolean).length} facts`,
      decide: (result.decide && result.decide.review_required)
        ? "HOLD · review"
        : `${(result.decide && result.decide.request_type) || "skipped"}`,
      rerank: `${(result.rerank && result.rerank.selected && result.rerank.selected.length) || 0} clauses`,
      compare: (result.compare_unacknowledged || []).length
        ? `REWRITE · ${result.compare_unacknowledged.length} used`
        : result.compare && result.compare.pairs ? "conflicts" : "none",
      coverage: coverage.value === true ? "REWRITE" : "no omission",
      verify: `${supported}/${claims.length} supported`,
    };
    const impactFor = (stage) => {
      if (stage.status === "error") return "error";
      if (stage.status === "skipped") return "skip";
      if (stage.stage === "guard" && Number(guard.injection) >= guardThreshold) return "hold";
      if (stage.stage === "inspect" && (inspect.malicious === true || Number(inspect.probability) >= inspectThreshold)) return "hold";
      if (stage.stage === "authority" && (result.codes || []).some((code) => String(code).startsWith("policy_"))) return "hold";
      if (stage.stage === "extract" && (result.codes || []).includes("metadata_conflict")) return "hold";
      if (stage.stage === "decide" && (result.codes || []).includes("triage_review")) return "hold";
      if (stage.stage === "compare" && (result.compare_unacknowledged || []).length) return "rewrite";
      if (stage.stage === "coverage" && coverage.value === true) return "rewrite";
      if (stage.stage === "verify" && contradicted) return "rewrite";
      return "support";
    };
    const codes = Array.isArray(result.codes) ? result.codes : [];
    const relevant = stages.filter((stage) => {
      if (stage.status === "error") return true;
      if (stage.stage === "authority" || stage.stage === "verify") return true;
      if (stage.stage === "guard" && (codes.includes("prompt_injection") || Number(guard.injection) >= guardThreshold)) return true;
      if (stage.stage === "inspect" && (codes.includes("unsafe_script") || inspect.malicious === true)) return true;
      if (stage.stage === "extract" && codes.includes("metadata_conflict")) return true;
      if (stage.stage === "decide" && codes.includes("triage_review")) return true;
      if (stage.stage === "compare" && ((result.compare_unacknowledged || []).length || (result.compare && result.compare.conflict_count))) return true;
      if (stage.stage === "coverage" && codes.includes("coverage_gap")) return true;
      if (stage.stage === "protect" && protect.entity_count) return true;
      return false;
    });
    const shown = relevant.length ? relevant : stages.slice(0, 2);
    refs.trace.innerHTML = shown
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

  function renderDecisionRecord(result) {
    if (!refs.record) return;
    const audit = result.audit || {};
    const review = result.review || {};
    const envelopes = result.policy_envelopes || [];
    const decision = String(result.decision || "hold").toLowerCase();
    const auditText = audit.error
      ? "Ledger unavailable"
      : audit.seq
        ? `seq ${audit.seq} · ${audit.storage} · ${String(audit.hash || "").slice(0, 12)}…`
        : "Simulation · not recorded";
    const resolved = String(review.status || "") === "resolved";
    const resolution = review.resolution || {};
    const released = resolved && resolution.action === "approve";
    const sentBack = resolved && resolution.action === "reject";
    const reviewText = review.id
      ? `${review.status || "open"} · ${review.id}`
      : decision === "publish"
        ? "Released"
        : "Not opened";
    const releaseText = decision === "publish"
      ? "Released"
      : released
        ? "Released by reviewer"
        : sentBack
          ? "Sent back by reviewer"
          : review.id
            ? "Awaiting human release or send-back"
            : "No release record";
    refs.recordMeta.textContent = audit.seq ? `audit #${audit.seq}` : "not recorded";
    const policyItems = envelopes.length
      ? envelopes.map((envelope) => `<li>${esc(envelope.title || "Policy")} · ${esc(envelope.approval_type || "approved")} · ${esc(String(envelope.content_hash || "").slice(0, 12))}…</li>`).join("")
      : "<li>No signed policy envelopes.</li>";
    const resolutionBlock = resolved
      ? `<p><span>Resolution</span>${esc(resolution.action || "")} by ${esc(resolution.resolved_by || "")} · ${esc(resolution.note || "")}</p>
         <p><span>Review audit</span>${resolution.ledger && resolution.ledger.seq ? `seq ${esc(resolution.ledger.seq)} · ${esc(String(resolution.ledger.hash || "").slice(0, 12))}…` : "recorded"}</p>`
      : "";
    const reviewControls = resolved
      ? ""
      : `<div class="gate-record-fields">
          <label for="gate-review-actor">Reviewer<input id="gate-review-actor" type="text" value="Demo reviewer" maxlength="120" /></label>
          <label for="gate-review-note">Resolution note<input id="gate-review-note" type="text" maxlength="1000" placeholder="Why release or send back?" /></label>
        </div>
        <div class="gate-record-actions">
          ${String(review.status || "open") === "open" ? `<button type="button" class="gate-secondary" data-review-action="claim">Claim for review</button>` : `<span>Assigned to ${esc(review.assigned_to || "reviewer")}</span>`}
          <button type="button" class="gate-secondary" data-review-action="approve">Release answer</button>
          <button type="button" class="gate-secondary" data-review-action="reject">Send back</button>
          <span id="gate-review-status"></span>
        </div>
        <p class="gate-admin-note">This capability resolves only this review. The shared queue stays admin-only.</p>`;
    const reviewRecord = review.id
      ? `<div class="gate-record-review">
          <b>Review record</b>
          <p><span>Question</span>${esc(result.question || "")}</p>
          <p><span>Draft</span>${esc(result.draft || "")}</p>
          <p><span>Reasons</span>${esc((result.reasons || []).join(" · "))}</p>
          ${resolutionBlock}
          ${reviewControls}
        </div>`
      : "";
    refs.record.innerHTML = `
      <div class="gate-record-grid">
        <div class="gate-record-cell"><b>Audit</b><span>${esc(auditText)}</span></div>
        <div class="gate-record-cell"><b>Review</b><span>${esc(reviewText)}</span></div>
        <div class="gate-record-cell"><b>Release state</b><span>${esc(releaseText)}</span></div>
        <div class="gate-record-cell"><b>Links</b><span><a href="/ledger">Ledger</a> · <a href="#gate-review-block">Queue</a></span></div>
      </div>
      <div class="gate-record-policies"><b>Signed policies</b><ul>${policyItems}</ul></div>
      ${reviewRecord}`;
  }

  function renderPolicies(result) {
    const integrity = result && result.policy_integrity;
    const envelopes = (result && result.policy_envelopes) || [];
    if (!integrity && !envelopes.length) {
      refs.policiesBlock.hidden = true;
      return;
    }
    refs.policiesBlock.hidden = false;
    const failures = (integrity && integrity.failures) || [];
    refs.policiesMeta.textContent = failures.length
      ? `${failures.length} failed`
      : `${envelopes.length} approved`;
    if (failures.length) {
      refs.policies.innerHTML = failures
        .map((item) => `<div class="gate-policy gate-policy-failed">
          <div class="gate-policy-main"><b>${esc(item.code === "policy_tampered" ? "Tampered" : "Unapproved")}</b><span>${esc(item.message)}</span></div>
        </div>`)
        .join("");
      return;
    }
    refs.policies.innerHTML = envelopes
      .map((envelope) => {
        const trust = String(envelope.approval_type || "approved");
        const trustLabel =
          trust === "seeded"
            ? "Seeded · signed at startup"
            : trust === "admin"
              ? "Admin-approved"
              : trust === "operator"
                ? "Operator-attested · one check"
                : trust;
        return `<div class="gate-policy">
        <div class="gate-policy-main">
          <b>${esc(envelope.title || "Policy")}</b>
          <span><span class="gate-trust" data-trust="${esc(trust)}">${esc(trustLabel)}</span> · ${esc(envelope.approved_by || "")}</span>
        </div>
        <div class="gate-policy-meta">
          <span>${esc(envelope.policy_id || "")}</span>
          <span title="${esc(envelope.content_hash || "")}">${esc(String(envelope.content_hash || "").slice(0, 12))}</span>
        </div>
      </div>`;
      })
      .join("");
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
    const threshold = Number(guard.threshold ?? 0.5);
    const risky = guard.verdict === "injection" || guard.injection >= threshold;
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
    const threshold = Number(inspect.threshold ?? 0.5);
    const risky =
      inspect.malicious === true ||
      verdict === "malicious" ||
      verdict === "suspicious" ||
      verdict === "unsafe" ||
      Number(inspect.probability) >= threshold;
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

  function renderExtract(result) {
    const extract = result && result.extract;
    const documents = (extract && extract.documents) || [];
    if (!documents.length) {
      refs.extractBlock.hidden = true;
      return;
    }
    refs.extractBlock.hidden = false;
    const facts = (extract && extract.governing) || {};
    const labels = {
      policy_id: "Policy ID",
      effective_date: "Effective date",
      expiry_date: "Expiry date",
      jurisdiction: "Jurisdiction",
      approval_required: "Approval",
      amount_limit: "Amount limit",
      deadline_days: "Deadline",
      exception_condition: "Exception",
    };
    const present = Object.entries(labels).filter(([key]) => facts[key]);
    const conflicts = (extract && extract.conflicts) || [];
    refs.extractMeta.textContent = `${present.length} facts · ${conflicts.length} conflicts`;
    const factHtml = present
      .map(([key, label]) => `<div class="gate-fact"><b>${esc(label)}</b><span>${esc(facts[key])}</span></div>`)
      .join("");
    const conflictHtml = conflicts
      .map((item) => `<div class="gate-fact-alert">${esc(item)}</div>`)
      .join("");
    const adopted = (extract && extract.adopted) || [];
    const adoptedHtml = adopted
      .map((item) => `<div class="gate-fact-alert">${esc(item)}</div>`)
      .join("");
    refs.extract.innerHTML = `<div class="gate-facts">${factHtml || '<div class="gate-fact"><b>Facts</b><span>No named fact was stated in the policy text.</span></div>'}</div>${conflictHtml}${adoptedHtml}`;
  }

  function renderDecide(result) {
    const decide = result && result.decide;
    if (!decide || !decide.request_type) {
      refs.decideBlock.hidden = true;
      return;
    }
    refs.decideBlock.hidden = false;
    const probability = Number(decide.review_probability);
    const probabilityText = Number.isFinite(probability) ? `${Math.round(probability * 100)}%` : "n/a";
    refs.decideMeta.textContent = `${decide.request_type} · ${decide.risk}`;
    refs.decide.innerHTML = `
      <div class="gate-triage">
        <div class="gate-triage-cell"><b>Request</b><span>${esc(decide.request_type)}</span></div>
        <div class="gate-triage-cell"><b>Risk</b><span>${esc(decide.risk)}</span></div>
        <div class="gate-triage-cell" data-alert="${decide.review_required ? "true" : "false"}"><b>Human review</b><span>${decide.review_required ? "required" : "not required"} · ${probabilityText}</span></div>
        <div class="gate-triage-cell"><b>Profile</b><span>${esc(decide.request_type)}</span></div>
      </div>
      <div class="gate-triage-profile">${esc(decide.profile || "General verification profile.")}</div>`;
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

        const used = (result.compare_unacknowledged || []).find(
          (item) => item.superseded_quote === supersededQuote.quote
        );
        blocks.push(`<div class="gate-conflict">
          <div class="gate-conflict-head">Conflicting · ${esc(governingDoc.title)} vs ${esc(supersededDoc.title)}</div>
          <div class="gate-conflict-grid">
            <div class="gate-conflict-col"><b>Governing</b><p>${esc(governing.quote)}</p></div>
            <div class="gate-conflict-col"><b>Superseded</b><p>${esc(supersededQuote.quote)}</p></div>
          </div>
          ${used ? `<div class="gate-conflict-used">Used in the draft: ${(used.used_values || []).map(esc).join(", ")}</div>` : ""}
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
  function adminTokenValue(primary) {
    const first = primary && primary.value ? primary.value.trim() : "";
    if (first) return first;
    const other = primary === refs.adminToken ? refs.queueToken : refs.adminToken;
    return other && other.value ? other.value.trim() : "";
  }

  function showAdminError(target, message) {
    if (!target) return;
    target.dataset.state = "error";
    target.textContent = message;
  }

  function showAdminOk(target, message) {
    if (!target) return;
    target.dataset.state = "ok";
    target.textContent = message;
  }

  async function approveActivePolicy() {
    const doc = state.documents[state.activeDoc];
    const token = adminTokenValue(refs.adminToken);
    if (!token) {
      showAdminError(refs.approveStatus, "Enter the admin token. The approval endpoint returns 404 without it.");
      return;
    }
    if (!doc || !doc.title.trim() || doc.text.trim().length < 20) {
      showAdminError(refs.approveStatus, "The active policy needs a title and at least 20 characters of text.");
      return;
    }
    refs.approvePolicy.disabled = true;
    refs.approveStatus.dataset.state = "";
    refs.approveStatus.textContent = "Signing the active policy…";
    try {
      const response = await fetch("/api/policies/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Docket-Admin": token },
        body: JSON.stringify({
          title: doc.title.trim(),
          text: doc.text.trim(),
          policy_id: null,
          version: null,
          jurisdiction: doc.jurisdiction.trim() || "Global",
          effective_date: doc.effective_date || null,
          expiry_date: doc.expires_date || null,
          precedence: Number(doc.precedence) || 0,
          approved_by: (doc.approved_by || "").trim() || "Docket console admin",
        }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok || !body || !body.policy) {
        const detail = (body && (body.detail || body.error)) || `HTTP ${response.status}`;
        throw new Error(
          response.status === 404
            ? "Admin token not accepted. The approval endpoint returns 404 by design."
            : typeof detail === "string"
              ? detail
              : JSON.stringify(detail)
        );
      }
      const envelope = body.policy;
      doc.policy_envelope = envelope;
      renderDocs();
      refs.approvalEnvelope.hidden = false;
      refs.approvalEnvelope.innerHTML = `
        <div><b>Approval</b> ${esc(envelope.approval_type || "admin")} · ${esc(envelope.approved_by || "")}</div>
        <div><b>Policy id</b> ${esc(envelope.policy_id || "—")}</div>
        <div><b>Content hash</b> <code>${esc(envelope.content_hash || "")}</code></div>
        <div><b>Signed at</b> ${esc(envelope.approved_at || "—")}</div>
        <div><b>Signature</b> <code>${esc(String(envelope.signature || "").slice(0, 24))}…</code></div>`;
      showAdminOk(
        refs.approveStatus,
        "The active policy is signed and will be sent with the next check. Editing a signed field now produces a tamper HOLD."
      );
    } catch (error) {
      showAdminError(refs.approveStatus, `Approval failed. ${error.message}`);
    } finally {
      refs.approvePolicy.disabled = false;
    }
  }

  async function loadReviews() {
    const token = adminTokenValue(refs.queueToken);
    if (!token) {
      showAdminError(refs.reviewStatus, "Enter the admin token to read the queue. The endpoint returns 404 without it.");
      return;
    }
    refs.reviewLoad.disabled = true;
    refs.reviewStatus.dataset.state = "";
    refs.reviewStatus.textContent = "Reading the durable queue…";
    try {
      const status = refs.reviewFilter.value;
      const query = status ? `?status=${encodeURIComponent(status)}&limit=50` : "?limit=50";
      const response = await fetch(`/api/reviews${query}`, {
        cache: "no-store",
        headers: { "X-Docket-Admin": token },
      });
      const body = await response.json().catch(() => null);
      if (!response.ok || !body) {
        throw new Error(
          response.status === 404
            ? "Admin token not accepted. The review endpoint returns 404 by design."
            : (body && (body.detail || body.error)) || `HTTP ${response.status}`
        );
      }
      renderReviews(body.reviews || [], body.counts || {});
      showAdminOk(refs.reviewStatus, "Queue loaded from durable storage.");
    } catch (error) {
      showAdminError(refs.reviewStatus, `Queue unavailable. ${error.message}`);
    } finally {
      refs.reviewLoad.disabled = false;
    }
  }

  function renderReviews(records, counts) {
    const open = Number(counts.open || 0);
    const assigned = Number(counts.assigned || 0);
    const resolved = Number(counts.resolved || 0);
    refs.reviewMeta.textContent = `${open} open · ${assigned} assigned · ${resolved} resolved`;
    if (!records.length) {
      refs.reviewList.innerHTML = '<p class="gate-review-empty">No review records match this filter.</p>';
      return;
    }
    refs.reviewList.innerHTML = records
      .map((review) => {
        const id = String(review.id || "");
        const status = String(review.status || "open");
        const check = review.check || {};
        const resolution = review.resolution || null;
        const codes = (review.codes || []).join(", ") || "no codes";
        const resolvedCopy = resolution
          ? `<p class="gate-review-meta">Resolved: ${esc(resolution.action)} by ${esc(resolution.resolved_by || "")} — ${esc(resolution.note || "")}${resolution.ledger ? ` · ledger #${esc(resolution.ledger.seq)}` : ""}</p>`
          : "";
        const actions =
          status === "resolved"
            ? ""
            : `<div class="gate-review-actions">
                <input data-assignee placeholder="Assignee" value="${esc(review.assigned_to || "")}" aria-label="Assignee for ${esc(id)}" />
                <button type="button" data-review-action="assign">Assign</button>
                <input data-note placeholder="Resolution note" aria-label="Resolution note for ${esc(id)}" />
                <button type="button" data-review-action="approve">Approve</button>
                <button type="button" data-review-action="reject">Reject</button>
              </div>`;
        return `<article class="gate-review-card" data-review-id="${esc(id)}">
          <div class="gate-review-head"><b>${esc(id)}</b><span>${esc(status)}</span></div>
          <p class="gate-review-question">${esc(review.question || "—")}</p>
          <p class="gate-review-meta">${esc(review.decision || "hold")} · ${esc(codes)} · audit #${esc(check.seq == null ? "—" : check.seq)}${review.assigned_to ? ` · assigned to ${esc(review.assigned_to)}` : ""}</p>
          ${resolvedCopy}
          ${actions}
        </article>`;
      })
      .join("");
  }

  async function onReviewAction(event) {
    const button = event.target.closest("button[data-review-action]");
    if (!button) return;
    const card = button.closest("[data-review-id]");
    const id = card && card.dataset.reviewId;
    if (!id) return;
    const action = button.dataset.reviewAction;
    const token = adminTokenValue(refs.queueToken);
    if (!token) {
      showAdminError(refs.reviewStatus, "Enter the admin token first.");
      return;
    }
    button.disabled = true;
    try {
      let url;
      let payload;
      if (action === "assign") {
        const assignee = card.querySelector("[data-assignee]").value.trim();
        if (!assignee) throw new Error("Enter an assignee.");
        url = `/api/reviews/${encodeURIComponent(id)}/assign`;
        payload = { assignee };
      } else {
        const note = card.querySelector("[data-note]").value.trim();
        if (note.length < 3) throw new Error("Enter a resolution note.");
        url = `/api/reviews/${encodeURIComponent(id)}/resolve`;
        payload = {
          action,
          note,
          resolved_by: (card.querySelector("[data-assignee]").value.trim() || "console-admin"),
        };
      }
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Docket-Admin": token },
        body: JSON.stringify(payload),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok || !body) {
        throw new Error((body && (body.detail || body.error)) || `HTTP ${response.status}`);
      }
      const audit = body.audit ? ` Ledger event #${body.audit.seq}.` : "";
      await loadReviews();
      showAdminOk(refs.reviewStatus, `Review ${id} ${action === "assign" ? "assigned" : action + "d"}.${audit}`);
    } catch (error) {
      showAdminError(refs.reviewStatus, `Action failed. ${error.message}`);
    } finally {
      button.disabled = false;
    }
  }

  async function checkHealth() {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch("/api/health", { cache: "no-store", signal: controller.signal });
      const data = await response.json();
      renderHealth(data || {});
      setLive(Boolean(data && data.ok));
    } catch (error) {
      renderHealth({
        ok: false,
        error: error && error.name === "AbortError" ? "verification timed out" : "health check failed",
        ledger: { ok: false, detail: "Unavailable" },
        policy_registry: { ok: false, count: 0, registered: 0, missing: [], invalid: [] },
        audit_backend: "unknown",
      });
      setLive(false);
    } finally {
      window.clearTimeout(timeout);
    }
  }

  function renderHealth(data) {
    const ledger = data.ledger || {};
    const policy = data.policy_registry || {};
    const ok = Boolean(data.ok);
    if (refs.healthMeta) {
      refs.healthMeta.dataset.state = ok ? "ok" : "error";
      refs.healthMeta.textContent = ok ? "Verified" : "Attention";
    }
    if (refs.healthLedger) {
      refs.healthLedger.dataset.state = ledger.ok ? "ok" : "error";
      refs.healthLedger.textContent = ledger.ok
        ? `Verified · ${ledger.records || 0} records (${ledger.checks || 0} checks, ${ledger.events || 0} events)`
        : `Broken${ledger.broken_at != null ? ` at #${ledger.broken_at}` : ""} · ${ledger.detail || "not verified"}`;
    }
    if (refs.healthPolicy) {
      refs.healthPolicy.dataset.state = policy.ok ? "ok" : "error";
      refs.healthPolicy.textContent = policy.ok
        ? `${policy.registered || 0} / ${policy.count || 0} signed`
        : `${policy.registered || 0} / ${policy.count || 0} signed · ${(policy.missing || []).length} missing, ${(policy.invalid || []).length} invalid`;
    }
    if (refs.healthStorage) {
      refs.healthStorage.textContent = `${data.audit_backend || "unknown"}${data.durable_audit ? " · durable" : " · per-instance fallback"}`;
    }
    if (refs.healthTime) {
      refs.healthTime.textContent = data.last_verified_at ? new Date(data.last_verified_at).toLocaleString() : "—";
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
        return `<button type="button" class="gate-example" data-id="${esc(sample.id)}">
          <span class="gate-example-title">${esc(sample.label || sample.id)}</span>
          <span class="gate-example-copy">${esc(sample.blurb || "")}</span>
          <span class="gate-example-load">Open</span>
        </button>`;
      })
      .join("");
  }

  async function loadSample(id) {
    if (!id) return false;
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
        policy_envelope: doc.policy_envelope || null,
        seeded: true,
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
      setStatus("verdict", "Waiting", "");
      return true;
    } catch (error) {
      showError(`Could not load that example. ${error.message}`);
      return false;
    }
  }

  async function runFlagship() {
    if (state.busy) return;
    const loaded = await loadSample("precedence-recency");
    if (loaded) await run();
  }

  function proofBadge(decision) {
    const value = String(decision || "").toLowerCase();
    return `<span class="necessity-decision" data-decision="${esc(value)}">${esc(value ? value.toUpperCase() : "—")}</span>`;
  }

  function proofSummary(summary) {
    if (!summary) return '<span class="necessity-empty">—</span>';
    const signal = (summary.signal && summary.signal.label) || "";
    return `${proofBadge(summary.decision)}<span class="necessity-signal">${esc(signal)}</span>`;
  }

  function proofDelta(result) {
    if (!result || result.mode === "measure" || !result.ablated) return "Record / evidence only";
    const before = result.baseline || {};
    const after = result.ablated || {};
    if (String(before.decision) !== String(after.decision)) {
      return `${String(before.decision || "").toUpperCase()} → ${String(after.decision || "").toUpperCase()}`;
    }
    const first = (before.signal && before.signal.label) || "";
    const second = (after.signal && after.signal.label) || "";
    return first !== second ? `${first} → ${second}` : "No observable change";
  }

  function renderNecessity(data) {
    if (!refs.necessity) return;
    const proofs = (data && data.proofs) || [];
    if (!proofs.length) {
      refs.necessity.innerHTML = '<div class="gate-necessity-loading">No recorded proofs.</div>';
      return;
    }
    if (refs.necessityMeta) {
      const when = data.recorded_at ? new Date(data.recorded_at).toLocaleString() : "live";
      refs.necessityMeta.textContent = `recorded ${when}`;
    }
    refs.necessity.innerHTML = proofs.map((proof) => {
      const result = proof.result || {};
      const live = proof.live ? '<span class="necessity-live">live</span>' : "";
      const without = proofSummary(result.ablated);
      return `<div class="necessity-card" data-endpoint="${esc(proof.endpoint)}">
        <div class="necessity-card-head">
          <b>${esc(proof.label)}${live}</b>
          <span>${esc(proof.role)}</span>
          <button type="button" class="gate-link necessity-run" data-proof="${esc(proof.endpoint)}">Re-run</button>
        </div>
        <p class="necessity-case">Case · ${esc(proof.proof_case)}</p>
        <div class="necessity-result">
          <span class="necessity-side"><em>With</em>${proofSummary(result.baseline)}</span>
          <span class="necessity-arrow" aria-hidden="true">→</span>
          <span class="necessity-side"><em>Without</em>${without}</span>
        </div>
        <p class="necessity-delta">${esc(proof.delta || proofDelta(result))}</p>
      </div>`;
    }).join("");
  }

  async function loadNecessity() {
    try {
      const response = await fetch("/integrations/necessity.json?v=20261106a", { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      state.necessity = await response.json();
      renderNecessity(state.necessity);
    } catch (error) {
      if (refs.necessity) {
        refs.necessity.innerHTML = '<div class="gate-necessity-loading">The endpoint proof is unavailable. Re-run a check to refresh it.</div>';
      }
      if (refs.necessityStatus) refs.necessityStatus.textContent = "Recorded evidence could not load.";
    }
  }

  async function rerunProof(endpoint, button) {
    const proof = ((state.necessity && state.necessity.proofs) || []).find((item) => item.endpoint === endpoint);
    if (!proof || !proof.payload || button.disabled) return;
    button.disabled = true;
    const original = button.textContent;
    button.textContent = "Running…";
    if (refs.necessityStatus) refs.necessityStatus.textContent = `Running the ${proof.label} proof…`;
    try {
      const response = await authFetch("/api/prove", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.assign({}, proof.payload, { endpoint })),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error((body && (body.detail || body.error)) || `HTTP ${response.status}`);
      proof.result = body;
      proof.delta = proofDelta(body);
      proof.live = true;
      renderNecessity(state.necessity);
      if (refs.necessityStatus) refs.necessityStatus.textContent = `${proof.label} re-ran live. No audit record was written.`;
    } catch (error) {
      if (refs.necessityStatus) refs.necessityStatus.textContent = `${proof.label} proof failed: ${error.message}`;
      button.disabled = false;
      button.textContent = original;
    }
  }

  function onNecessityClick(event) {
    const button = event.target.closest("button[data-proof]");
    if (button) rerunProof(button.dataset.proof, button);
  }

  async function resolveReview(action, button) {
    const review = state.last && state.last.review;
    if (!review || !review.id || !review.capability) return;
    if (button && button.disabled) return;
    const actor = (document.querySelector("#gate-review-actor")?.value || "").trim() || "Demo reviewer";
    const note = (document.querySelector("#gate-review-note")?.value || "").trim();
    const status = document.querySelector("#gate-review-status");
    if (button) button.disabled = true;
    if (status) status.textContent = action === "claim" ? "Claiming…" : action === "approve" ? "Releasing…" : "Sending back…";
    try {
      if (action === "claim") {
        const response = await authFetch(`/api/reviews/${encodeURIComponent(review.id)}/assign`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Docket-Review": review.capability },
          body: JSON.stringify({ assignee: actor }),
        });
        const body = await response.json().catch(() => null);
        if (!response.ok) throw new Error((body && (body.detail || body.error)) || `HTTP ${response.status}`);
        state.last.review = body.review;
        renderDecisionRecord(state.last);
        const next = document.querySelector("#gate-review-status");
        if (next) next.textContent = `Claimed by ${actor}.`;
        return;
      }
      if (note.length < 3) {
        if (status) status.textContent = "Add a short note before resolving.";
        if (button) button.disabled = false;
        return;
      }
      const response = await authFetch(`/api/reviews/${encodeURIComponent(review.id)}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Docket-Review": review.capability },
        body: JSON.stringify({ action, note, resolved_by: actor }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error((body && (body.detail || body.error)) || `HTTP ${response.status}`);
      state.last.review = body.review;
      if (!state.last.review.capability) state.last.review.capability = review.capability;
      renderDecisionRecord(state.last);
      const next = document.querySelector("#gate-review-status");
      if (next) next.textContent = action === "approve" ? `Released by ${actor}.` : `Sent back by ${actor}.`;
    } catch (error) {
      if (status) status.textContent = `Could not resolve this review: ${error.message}`;
      if (button) button.disabled = false;
    }
  }

  function attestActiveDoc() {
    const doc = state.documents[state.activeDoc];
    if (!doc) return;
    doc.approved_by = (doc.approved_by || "").trim() || "Demo reviewer";
    doc.approval_reference = (doc.approval_reference || "").trim() || `CHECK-${Date.now().toString(36).toUpperCase()}`;
    doc.policy_envelope = null;
    const by = $("gate-doc-approved-by");
    const ref = $("gate-doc-reference");
    if (by) by.value = doc.approved_by;
    if (ref) ref.value = doc.approval_reference;
    const hint = refs.docEditor.querySelector(".gate-doc-hint");
    if (hint) {
      const effective = doc.seeded ? "seeded" : "operator";
      const note = doc.seeded
        ? "This built-in policy is already seeded; the check uses its startup envelope."
        : `This policy will be attested for the next check as ${esc(doc.approved_by)}.`;
      hint.innerHTML = `<span class="gate-trust" data-trust="${effective}">${effective}</span> ${note} Shared registry approval stays admin-only.`;
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
      policy_envelope: doc.policy_envelope || null,
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
    setStatus("verdict", "Waiting", "");
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
    setStatus("verdict", "Waiting", "");
  }

  function resetResult() {
    if (refs.shell) refs.shell.dataset.hasResult = "false";
    refs.result.hidden = true;
    refs.empty.hidden = false;
    refs.checking.hidden = true;
    refs.verdictHead.dataset.state = "hold";
    applyDocOutcomes();
  }

  function editDraft() {
    if (refs.shell) refs.shell.dataset.hasResult = "false";
    refs.result.hidden = true;
    refs.empty.hidden = false;
    setStatus("verdict", "Waiting", "");
    const input = document.querySelector(".gate-input");
    if (input) input.scrollIntoView({ behavior: "smooth", block: "start" });
    if (refs.question) refs.question.focus({ preventScroll: true });
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
