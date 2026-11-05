/* Docket homepage hero — content transplant with the existing hero stage. */
(function () {
  "use strict";

  if (location.pathname !== "/" && location.pathname !== "/index.html") return;

  const TITLE = "The newest policy is often not the governing one.";
  const LINES = [
    ["The", "newest", "policy"],
    ["is", "often", "not", "the"],
    ["governing", "one."],
  ];

  function corners() {
    return ["c0", "c1", "c2", "c3"]
      .map((c) => `<span class="dk-hero-corner ${c}" aria-hidden="true"></span>`)
      .join("");
  }

  function applyProduct() {
    const product = document.querySelector('[data-slot="hero-product"]');
    const img = product && product.querySelector("img");
    if (!product || !img) return;
    if (img.getAttribute("src") === "/images/hero/docket-gate.webp") {
      product.classList.add("dk-hero-product-applied");
      return;
    }

    product.querySelectorAll("source").forEach((source) => source.remove());
    img.removeAttribute("srcset");
    img.removeAttribute("sizes");
    img.src = "/images/hero/docket-gate.webp";
    img.width = 1920;
    img.height = 1152;
    img.alt = "Docket console showing a Rewrite verdict, authority trace, and clause-level claims";
    img.style.position = "absolute";
    img.style.inset = "0";
    img.style.width = "100%";
    img.style.height = "100%";
    img.style.maxWidth = "none";
    img.style.objectFit = "cover";
    product.classList.add("dk-hero-product-applied");
  }

  function apply() {
    applyProduct();
    const copy = document.querySelector('[data-slot="hero-copy"]');
    const h1 = copy && copy.querySelector('[data-slot="hero-title"]');
    if (!copy || !h1) return;

    copy.querySelectorAll(".dk-hero-stats").forEach((stats) => stats.remove());
    const finish = () => {
      copy.classList.add("dk-hero-applied");
    };

    const alreadyNew = h1.querySelector(".dk-hero-line") && copy.querySelector(".dk-hero-actions");
    if (alreadyNew) {
      finish();
      return;
    }

    let index = 0;
    h1.classList.add("dk-hero-title");
    h1.setAttribute("aria-label", TITLE);
    h1.innerHTML = LINES.map((line) => {
      const words = line.map((word) => {
        const not = word === "not" ? " dk-hero-not" : "";
        const html = `<span class="dk-hero-word${not}" style="--dk-i:${index}">${word}${corners()}</span>`;
        index += 1;
        return html;
      });
      return `<span class="dk-hero-line">${words.join(" ")}</span>`;
    }).join("");

    const description = copy.querySelector('[data-slot="hero-description"]');
    if (description) {
      description.classList.add("dk-hero-copy-description");
      description.innerHTML =
        'Docket reads the policies, resolves which one governs, and holds the AI answer that cites a superseded rule. <strong>Publish, Rewrite, or Hold</strong> — with citations.';
    }

    const oldCta = copy.querySelector('a[data-analytics-placement="home_hero"]');
    if (oldCta) {
      const parent = oldCta.parentElement;
      oldCta.remove();
      if (parent && parent !== copy && !parent.children.length) parent.remove();
    }

    let actions = copy.querySelector(".dk-hero-actions");
    if (!actions) {
      actions = document.createElement("div");
      actions.className = "dk-hero-actions";
      (description || h1).insertAdjacentElement("afterend", actions);
    }
    actions.innerHTML =
      '<a class="dk-hero-cta dk-hero-cta-primary" href="/console">Run a check <span class="dk-hero-arrow" aria-hidden="true">↗</span></a>' +
      '<a class="dk-hero-cta dk-hero-cta-secondary" href="https://github.com/j4yop/docket" target="_blank" rel="noopener noreferrer">Read the repo</a>';

    const hidden = document.querySelector("section.sr-only");
    if (hidden) {
      hidden.innerHTML =
        `<p id="home-page-title">${TITLE}</p>` +
        `<p>Docket reads the policies, resolves which one governs, and holds the AI answer that cites a superseded rule. Publish, Rewrite, or Hold — with citations.</p>`;
    }
    document.title = "Docket — The newest policy is often not the governing one.";
    const metaDescription = "Docket reads the policies, resolves which one governs, and holds an AI answer that cites a superseded rule — Publish, Rewrite, or Hold, with citations.";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", metaDescription);
    document.querySelectorAll('meta[property="og:title"], meta[name="twitter:title"]').forEach((tag) => {
      tag.setAttribute("content", "Docket — The newest policy is often not the governing one.");
    });
    document.querySelectorAll('meta[property="og:description"], meta[name="twitter:description"]').forEach((tag) => {
      tag.setAttribute("content", metaDescription);
    });
    finish();
  }

  function schedule() {
    apply();
    setTimeout(apply, 450);
    setTimeout(apply, 1200);
  }

  if (document.readyState === "complete") schedule();
  else window.addEventListener("load", schedule);
})();
