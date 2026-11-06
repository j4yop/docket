(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const esc = (value) =>
    String(value == null ? "" : value).replace(/[&<>"']/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[character]));

  const TOUR = [
    {
      id: "precedence",
      name: "Precedence over recency",
      proves: "An older France annex overrides a newer global policy.",
      sample: "precedence-recency",
      expected: "rewrite",
      code: "contradicted",
    },
    {
      id: "version",
      name: "Version supersession",
      proves: "The draft keeps the old deadline and receipt threshold.",
      sample: "expense-update",
      expected: "rewrite",
    },
    {
      id: "omission",
      name: "Omitted condition",
      proves: "The draft leaves out a material condition.",
      sample: "omitted-condition",
      expected: "rewrite",
      code: "coverage_gap",
    },
    {
      id: "clean",
      name: "Clean access request",
      proves: "A draft that matches the policy publishes.",
      sample: "access-request",
      expected: "publish",
    },
    {
      id: "injection",
      name: "Injected policy note",
      proves: "Guard holds an instruction inside the source.",
      sample: "injected-policy",
      expected: "hold",
      code: "prompt_injection",
    },
    {
      id: "runbook",
      name: "Unsafe runbook",
      proves: "Inspect holds a command that disables endpoint protection.",
      sample: "unsafe-runbook",
      expected: "hold",
      code: "unsafe_script",
    },
    {
      id: "unapproved",
      name: "Unapproved policy",
      proves: "A custom policy with no approval cannot publish.",
      kind: "unapproved",
      expected: "hold",
      code: "policy_unapproved",
    },
    {
      id: "tampered",
      name: "Tampered policy",
      proves: "A signed policy changed after approval cannot publish.",
      kind: "tampered",
      expected: "hold",
      code: "policy_tampered",
    },
  ];

  const state = {
    sessionToken: null,
    sessionExpires: 0,
    samples: {},
    cleanEnvelope: null,
    running: false,
    retryIds: new Set(),
    matched: 0,
  };

  function decisionLabel(value) {
    const normalized = String(value || "").toLowerCase();
    if (normalized === "publish") return "Publish";
    if (normalized === "rewrite") return "Rewrite";
    if (normalized === "hold") return "Hold";
    return "Waiting";
  }

  function badge(value, label) {
    const normalized = String(value || "pending").toLowerCase();
    return `<span class="badge" data-v="${esc(normalized)}">${esc(label || decisionLabel(normalized))}</span>`;
  }

  function formatCredits(value) {
    const number = Number(value || 0);
    return Number.isInteger(number) ? String(number) : number.toFixed(1);
  }

  function renderRows() {
    const body = $("tour-rows");
    body.innerHTML = TOUR.map(
      (item, index) => `<tr data-case="${esc(item.id)}" style="--row:${index}">
        <td class="tour-case" data-label="Case"><b>${esc(item.name)}</b><span>${esc(item.proves)}</span></td>
        <td data-label="Expected">${badge(item.expected)}</td>
        <td class="actual" data-label="Actual">${badge("pending", "Waiting")}</td>
        <td class="governing" data-label="Governing">—</td>
        <td class="calls" data-label="Calls">—</td>
        <td class="credits" data-label="Credits">—</td>
        <td class="audit" data-label="Audit">—</td>
      </tr>`,
    ).join("");
  }

  async function getSession() {
    if (state.sessionToken && Date.now() / 1000 < state.sessionExpires - 30) {
      return state.sessionToken;
    }
    let lastError = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const response = await fetch("/api/session", { cache: "no-store" });
        if (response.status >= 500 && attempt < 2) {
          await new Promise((resolve) => window.setTimeout(resolve, 600 * (attempt + 1)));
          continue;
        }
        const body = await response.json().catch(() => null);
        if (!response.ok || !body || !body.token) {
          throw new Error((body && body.detail) || "Could not start a Docket session.");
        }
        state.sessionToken = body.token;
        state.sessionExpires = Number(body.expires_at) || 0;
        return state.sessionToken;
      } catch (error) {
        lastError = error;
        if (attempt < 2) {
          await new Promise((resolve) => window.setTimeout(resolve, 600 * (attempt + 1)));
          continue;
        }
      }
    }
    throw lastError || new Error("Could not reach Docket. Network request failed.");
  }

  const sleep = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

  async function postCheck(payload, token) {
    let lastError = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const response = await fetch("/api/check", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Docket-Session": token,
          },
          body: JSON.stringify(payload),
        });
        if (response.status >= 500 && attempt < 2) {
          await sleep(600 * (attempt + 1));
          continue;
        }
        return response;
      } catch (error) {
        lastError = error;
        if (attempt < 2) {
          await sleep(600 * (attempt + 1));
          continue;
        }
      }
    }
    throw lastError || new Error("The check could not reach Docket.");
  }

  async function getSample(sampleId) {
    if (state.samples[sampleId]) return state.samples[sampleId];
    let lastError = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const response = await fetch(`/api/samples/${encodeURIComponent(sampleId)}`, { cache: "no-store" });
        if (response.status >= 500 && attempt < 2) {
          await new Promise((resolve) => window.setTimeout(resolve, 600 * (attempt + 1)));
          continue;
        }
        if (!response.ok) throw new Error(`Could not load ${sampleId} (HTTP ${response.status}).`);
        const sample = await response.json();
        state.samples[sampleId] = sample;
        return sample;
      } catch (error) {
        lastError = error;
        if (attempt < 2) {
          await new Promise((resolve) => window.setTimeout(resolve, 600 * (attempt + 1)));
          continue;
        }
      }
    }
    throw lastError || new Error(`Could not load ${sampleId}.`);
  }

  function payloadFromSample(sample) {
    return {
      question: sample.question,
      draft: sample.draft,
      country: (sample.context && sample.context.country) || "",
      role: (sample.context && sample.context.role) || "",
      plan: (sample.context && sample.context.plan) || "",
      documents: sample.documents.map((document) => ({
        title: document.title,
        text: document.text,
        jurisdiction: document.jurisdiction || "Global",
        effective_date: document.effective_date || null,
        expires_date: document.expires_date || null,
        precedence: Number(document.precedence) || 0,
      })),
    };
  }

  function unapprovedPayload() {
    return {
      question: "How long do I have to submit an expense?",
      draft: "Expenses must be submitted within 30 days.",
      country: "Global",
      role: "Employee",
      plan: "Standard",
      documents: [
        {
          title: "Unapproved expense policy",
          text: "Expense policy — effective 1 January 2026.\n\nExpenses must be submitted within 30 days of the purchase date.",
          jurisdiction: "Global",
          effective_date: "2026-01-01",
          expires_date: null,
          precedence: 0,
        },
      ],
    };
  }

  async function tamperedPayload() {
    if (!state.cleanEnvelope) {
      throw new Error("The clean case did not return a policy envelope; the tamper test cannot run.");
    }
    const sample = await getSample("access-request");
    const document = sample.documents[0];
    return {
      question: sample.question,
      draft: "Access requests require manager approval and completion of security training.",
      country: (sample.context && sample.context.country) || "",
      role: (sample.context && sample.context.role) || "",
      plan: (sample.context && sample.context.plan) || "",
      documents: [
        {
          title: document.title,
          text: document.text.replace("manager approval", "director approval"),
          jurisdiction: document.jurisdiction || "Global",
          effective_date: document.effective_date || null,
          expires_date: document.expires_date || null,
          precedence: Number(document.precedence) || 0,
          policy_envelope: state.cleanEnvelope,
        },
      ],
    };
  }

  async function payloadFor(item) {
    if (item.kind === "unapproved") return unapprovedPayload();
    if (item.kind === "tampered") return tamperedPayload();
    return payloadFromSample(await getSample(item.sample));
  }

  function setRowStatus(item, label, stateName) {
    const row = document.querySelector(`tr[data-case="${CSS.escape(item.id)}"]`);
    if (!row) return;
    row.querySelector(".actual").innerHTML = badge(stateName || "pending", label);
  }

  function updateRow(item, body) {
    const row = document.querySelector(`tr[data-case="${CSS.escape(item.id)}"]`);
    if (!row) return;
    const decision = String(body.decision || "hold").toLowerCase();
    const codes = Array.isArray(body.codes) ? body.codes : [];
    const decisionOk = decision === item.expected;
    const codeOk = !item.code || codes.includes(item.code);
    const matched = decisionOk && codeOk;
    row.dataset.state = "done";
    row.querySelector(".actual").innerHTML = `${badge(decision)}<span class="tour-match" data-state="${matched ? "matched" : "different"}">${matched ? "as expected" : "different"}</span>`;
    const governing = body.authority && body.authority.governing ? body.authority.governing.title : "—";
    row.querySelector(".governing").textContent = governing;
    row.querySelector(".calls").textContent = String(body.api_calls || 0);
    row.querySelector(".credits").textContent = formatCredits(body.credits);
    const audit = body.audit || {};
    row.querySelector(".audit").innerHTML = audit.seq
      ? `<a class="text-link" href="/ledger">seq ${esc(audit.seq)}</a>`
      : "—";
    return matched;
  }

  function setRowError(item, error) {
    const row = document.querySelector(`tr[data-case="${CSS.escape(item.id)}"]`);
    if (!row) return;
    row.dataset.state = "error";
    row.querySelector(".actual").innerHTML = `${badge("hold", "Error")}<span class="tour-match" data-state="error">${esc(error.message || "failed")}</span>`;
  }

  async function runTour() {
    if (state.running) return;
    const retrying = state.retryIds.size > 0;
    const queue = retrying ? TOUR.filter((item) => state.retryIds.has(item.id)) : TOUR;
    if (!queue.length) return;

    state.running = true;
    if (!retrying) {
      state.cleanEnvelope = null;
      state.matched = 0;
      state.retryIds.clear();
      renderRows();
    }
    const button = $("run-tour");
    button.disabled = true;
    button.textContent = "Running…";
    $("tour-status").textContent = "Running";
    $("tour-status").dataset.state = "running";
    $("tour-note").dataset.state = "";
    $("tour-note").textContent = retrying
      ? `Retrying ${queue.length} failed case${queue.length === 1 ? "" : "s"}.`
      : "Running the eight cases in order. This takes about half a minute.";
    $("tour-count").textContent = `${state.matched}/8`;
    $("tour-meta").textContent = "Starting…";

    let credits = 0;
    let latency = 0;
    let fatal = null;

    try {
      const token = await getSession();
      for (let index = 0; index < queue.length; index += 1) {
        const item = queue[index];
        setRowStatus(item, "Running", "running");
        $("tour-note").textContent = `Running ${index + 1} of ${queue.length}: ${item.name}.`;
        try {
          const payload = await payloadFor(item);
          const response = await postCheck(payload, token);
          const body = await response.json().catch(() => null);
          if (!response.ok) {
            const detail = (body && (body.detail || body.error)) || `HTTP ${response.status}`;
            const error = new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
            error.fatal = response.status === 429 || response.status === 401;
            error.retryAfter = Number(response.headers.get("retry-after")) || 0;
            throw error;
          }
          state.retryIds.delete(item.id);
          const isMatch = updateRow(item, body);
          if (isMatch) state.matched += 1;
          if (item.id === "clean" && Array.isArray(body.policy_envelopes) && body.policy_envelopes[0]) {
            state.cleanEnvelope = body.policy_envelopes[0];
          }
          credits += Number(body.credits || 0);
          latency += Number(body.latency_ms || 0);
        } catch (error) {
          setRowError(item, error);
          state.retryIds.add(item.id);
          if (error.fatal) {
            fatal = error;
            for (const remaining of queue.slice(index + 1)) state.retryIds.add(remaining.id);
            break;
          }
        }
        $("tour-count").textContent = `${state.matched}/8`;
      }

      const remaining = state.retryIds.size;
      const completed = TOUR.length - remaining;
      if (fatal) {
        const wait = fatal.retryAfter ? ` Retry in about ${Math.max(1, Math.ceil(fatal.retryAfter / 60))} minute(s).` : "";
        $("tour-status").textContent = "Stopped";
        $("tour-status").dataset.state = "held";
        $("tour-note").dataset.state = "error";
        $("tour-note").textContent = `The tour stopped: ${fatal.message}${wait}`;
      } else if (remaining) {
        $("tour-status").textContent = "Incomplete";
        $("tour-status").dataset.state = "held";
        $("tour-note").dataset.state = "error";
        $("tour-note").textContent = `${remaining} case${remaining === 1 ? "" : "s"} failed. The tour is not complete; retry only the failed cases.`;
      } else {
        $("tour-status").textContent = "Complete";
        $("tour-status").dataset.state = "determined";
        $("tour-note").textContent = "All eight cases ran. Open the ledger to verify the records.";
      }
      $("tour-count").textContent = `${state.matched}/8`;
      $("tour-meta").textContent = `${completed} of 8 ran · ${state.matched} as expected · ${formatCredits(credits)} credits · ${(latency / 1000).toFixed(1)}s total`;
      button.textContent = remaining ? "Retry failed cases" : "Run again";
    } catch (error) {
      $("tour-status").textContent = "Stopped";
      $("tour-status").dataset.state = "held";
      $("tour-note").dataset.state = "error";
      $("tour-note").textContent = `The tour could not start: ${error.message}`;
      button.textContent = state.retryIds.size ? "Retry failed cases" : "Retry the tour";
    } finally {
      state.running = false;
      button.disabled = false;
    }
  }

  function init() {
    renderRows();
    $("run-tour").addEventListener("click", runTour);
  }

  init();
})();
