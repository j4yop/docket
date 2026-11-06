/* Docket brand layer — injected by server.mjs.
   Keeps the header logo and CTAs in sync after React hydration. */
(function () {
  var GITHUB = "https://github.com/j4yop/docket";
  var CONSOLE = "/console";
  var NAV_LINK_CLASS =
    "clickeable-hitbox px-[calc(var(--nav-gap)/2)] transition-[color,opacity] duration-300 " +
    "group-has-[a:hover]/nav:opacity-50 group-has-[button:hover]/nav:opacity-50 hover:opacity-100!";
  var SECTION_HREFS = {
    Problem: "#security-and-compliance",
    Product: "#product-intro",
    "How it Works": "#how-docket-works",
    Scenarios: "#scenarios",
    API: "#api",
    "Judge Tour": "/tour",
  };
  var NAV_ITEMS = [
    { label: "Problem", href: SECTION_HREFS.Problem },
    { label: "Product", href: SECTION_HREFS.Product },
    { label: "How it Works", href: SECTION_HREFS["How it Works"] },
    { label: "Scenarios", href: SECTION_HREFS.Scenarios },
    { label: "API", href: SECTION_HREFS.API },
    { label: "Judge Tour", href: SECTION_HREFS["Judge Tour"], navClass: "dk-tour-nav" },
  ];
  var MOBILE_NAV_ITEMS = [
    { label: "Problem", href: SECTION_HREFS.Problem },
    { label: "Product", href: SECTION_HREFS.Product },
    { label: "How it Works", href: SECTION_HREFS["How it Works"] },
    { label: "Scenarios", href: SECTION_HREFS.Scenarios },
    { label: "API", href: SECTION_HREFS.API },
    { label: "Judge Tour", href: SECTION_HREFS["Judge Tour"], primary: true },
    { label: "GitHub", href: GITHUB, external: true, primary: true },
    { label: "Open console", href: CONSOLE, primary: true },
  ];

  function corners() {
    return [
      "top: -5px; left: -5px; border-top: 1.5px solid; border-left: 1.5px solid; border-top-left-radius: 1.5px;",
      "top: -5px; right: -5px; border-top: 1.5px solid; border-right: 1.5px solid; border-top-right-radius: 1.5px;",
      "bottom: -5px; left: -5px; border-bottom: 1.5px solid; border-left: 1.5px solid; border-bottom-left-radius: 1.5px;",
      "bottom: -5px; right: -5px; border-bottom: 1.5px solid; border-right: 1.5px solid; border-bottom-right-radius: 1.5px;",
    ]
      .map(function (style, index) {
        return (
          '<span class="pointer-events-none absolute opacity-0" data-corner="' +
          index +
          '" style="width: 12px; height: 12px; ' +
          style +
          '"></span>'
        );
      })
      .join("");
  }

  function navLabels(ul) {
    return Array.prototype.map
      .call(ul.children, function (li) {
        var link = li.querySelector("a");
        return link ? link.textContent.trim() : "";
      })
      .join("|");
  }

  function applyNav() {
    var nav = document.querySelector('nav[data-header-nav="true"]');
    var ul = nav && nav.querySelector("ul");
    if (!ul) return;
    if (navLabels(ul) === "Problem|Product|How it Works|Scenarios|API|Judge Tour") {
      Array.prototype.forEach.call(ul.querySelectorAll("a"), function (link) {
        var href = SECTION_HREFS[link.textContent.trim()];
        if (href && link.getAttribute("href") !== href) link.setAttribute("href", href);
      });
      return;
    }
    ul.innerHTML = NAV_ITEMS.map(function (item) {
      return (
        "<li" +
        (item.navClass ? ' class="' + item.navClass + '"' : "") +
        '><a class="' +
        NAV_LINK_CLASS +
        '" href="' +
        item.href +
        '"' +
        (item.external ? ' target="_blank" rel="noopener noreferrer"' : "") +
        ">" +
        item.label +
        "</a></li>"
      );
    }).join("");
  }

  function applyMobileBrand(root) {
    var labels = root.querySelectorAll("p[data-scramble]");
    for (var i = 0; i < labels.length; i += 1) {
      var value = labels[i].getAttribute("data-scramble");
      if (value === "docket.corp®") {
        labels[i].setAttribute("data-scramble", "docket.corp®");
        labels[i].textContent = "docket.corp®";
      } else if (value === "ai-native") {
        labels[i].setAttribute("data-scramble", "policy control");
        labels[i].textContent = "policy control";
      }
    }
  }

  function applyMobileNav() {
    var roots = document.querySelectorAll("div.fixed.inset-0");
    var root = null;
    for (var i = 0; i < roots.length; i += 1) {
      if (String(roots[i].className).indexOf("z-[var(--z-menu-overlay)]") !== -1) {
        root = roots[i];
        break;
      }
    }
    if (root) applyMobileBrand(root);
    var ul = root && root.querySelector("ul");
    if (!ul) return;
    if (navLabels(ul) === "Problem|Product|How it Works|Scenarios|API|Judge Tour|GitHub|Open console") return;

    ul.innerHTML = MOBILE_NAV_ITEMS.map(function (item) {
      var primary = item.primary ? " text-primary" : "";
      var glow = item.primary
        ? ' style="text-shadow: currentcolor 0px 0px 0.02em, currentcolor 0px 0px 0.15em, currentcolor 0px 0px 0.5em;"'
        : "";
      return (
        '<li class="relative px-3 py-1' +
        primary +
        '"' +
        glow +
        '><a class="transition-colors" href="' +
        item.href +
        '"' +
        (item.external ? ' target="_blank" rel="noopener noreferrer"' : "") +
        ">" +
        item.label +
        "</a>" +
        corners() +
        "</li>"
      );
    }).join("");

    ul.addEventListener("click", function (event) {
      var target = event.target;
      if (!target || !target.closest || !target.closest("a")) return;
      var buttons = document.querySelectorAll("header button");
      for (var b = 0; b < buttons.length; b += 1) {
        if (buttons[b].textContent.trim().toLowerCase() === "close") {
          buttons[b].click();
          break;
        }
      }
    });
  }

  var GITHUB_ICON =
    '<svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true" focusable="false" fill="currentColor" style="flex:none">' +
    '<path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z"/>' +
    "</svg>";

  function replaceLabel(root, from, to) {
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    var node;
    while ((node = walker.nextNode())) {
      if (node.nodeValue && node.nodeValue.indexOf(from) !== -1) {
        node.nodeValue = node.nodeValue.replace(from, to);
        return;
      }
    }
  }

  function applyLogo() {
    document.querySelectorAll('a[href="/"]').forEach(function (link) {
      if (!link.querySelector('svg[viewBox="0 0 155 26"]')) return;
      if (link.getAttribute("aria-label") !== "Docket home") {
        link.setAttribute("aria-label", "Docket home");
      }
    });
  }

  function applyCtas() {
    // Dark header tab: Book a Demo -> GitHub repository.
    var book = document.querySelector('button[class*="group/book"]');
    if (book) {
      var bookLabel = book.querySelector("span.absolute");
      if (bookLabel && bookLabel.dataset.docketCta !== "github") {
        bookLabel.dataset.docketCta = "github";
        bookLabel.innerHTML = GITHUB_ICON + "<span>GitHub</span>";
        bookLabel.style.display = "inline-flex";
        bookLabel.style.alignItems = "center";
        bookLabel.style.gap = "8px";
      }
      if (book.getAttribute("aria-label") !== "Docket on GitHub") {
        book.setAttribute("aria-label", "Docket on GitHub");
        book.setAttribute("title", "Docket on GitHub");
      }
    }

    // Every Get Started CTA -> Open console.
    document
      .querySelectorAll('a[href$="/sign-up"], a[href$="/signup"], header a[href$="/console"], a[data-docket-console="true"]')
      .forEach(function (link) {
        link.dataset.docketConsole = "true";
        if (link.getAttribute("href") !== CONSOLE) {
          link.setAttribute("href", CONSOLE);
          link.removeAttribute("target");
          link.removeAttribute("rel");
        }
        if (link.getAttribute("aria-label") !== "Open the Docket console") {
          link.setAttribute("aria-label", "Open the Docket console");
        }
        replaceLabel(link, "Get Started", "Open console");
      });

    // Every Book a Demo text CTA -> GitHub repository.
    document
      .querySelectorAll('a[href*="demo=true"], a[data-docket-github="true"]')
      .forEach(function (link) {
        if (link.dataset.docketGithubReady === "true") return;
        link.dataset.docketGithub = "true";
        link.dataset.docketGithubReady = "true";
        if (link.getAttribute("href") !== GITHUB) {
          link.setAttribute("href", GITHUB);
          link.setAttribute("target", "_blank");
          link.setAttribute("rel", "noopener noreferrer");
        }
        if (link.getAttribute("aria-label") !== "Docket on GitHub") {
          link.setAttribute("aria-label", "Docket on GitHub");
        }
        replaceLabel(link, "Book a Demo", "GitHub");
        // The mirrored footer CTA still carries a React click handler that
        // rewrites the URL to ?demo=true. Replacing the node keeps the visual
        // anchor but removes that handler, so the repo link wins.
        var clean = link.cloneNode(true);
        link.replaceWith(clean);
      });
  }

  // Build the Judge Tour tab from the GitHub tab's exact shape, then place it
  // immediately to the left. This keeps the dark notched-tab treatment 1:1.
  function makeTourTab() {
    var github = document.querySelector('a[data-docket-github-link="true"]');
    if (!github || document.querySelector('a[data-docket-tour-tab="true"]')) return;
    var tab = github.cloneNode(true);
    tab.dataset.docketTourTab = "true";
    tab.removeAttribute("data-docket-github-link");
    tab.href = "/tour";
    tab.removeAttribute("target");
    tab.removeAttribute("rel");
    tab.setAttribute("aria-label", "Take the Judge Tour");
    tab.setAttribute("title", "Take the Judge Tour");
    tab.classList.add("dk-tour-tab");
    // The tab fills the parallelogram up to GitHub's left edge: its bottom
    // right corner meets GitHub's bottom-left corner instead of leaving the
    // black triangular gap that a 216px clone leaves.
    var shapePath = "M 0 0 C 6 0 9 5 13 10.14 L 34.7 38 C 39.5 44.16 42.5 46.666 51.5 46.666 H 267.5 L 216 0 H 0 Z";
    tab.style.width = "267.5px";
    tab.style.right = "295.5px";
    tab.style.clipPath = 'path("' + shapePath + '")';
    var shape = tab.querySelector('svg[viewBox="0 0 216 56"]');
    if (shape) {
      shape.setAttribute("viewBox", "0 0 267.5 56");
      Array.prototype.forEach.call(shape.querySelectorAll("path"), function (pathNode) {
        pathNode.setAttribute("d", shapePath);
      });
    }
    var overlay = tab.querySelector('[data-slot="header-button-overlay"]');
    if (overlay) {
      // GitHub centers its inset hover frame at 104px on a 216px tab. The
      // Judge Tour parallelogram adds 51.5px on the bottom-right, so the
      // visual center is 134px; shift the same inset frame to stay centered.
      overlay.style.left = "56px";
    }
    var label = tab.querySelector('[data-docket-cta="github"]');
    if (label) {
      label.removeAttribute("data-docket-cta");
      label.innerHTML =
        '<svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true" focusable="false" fill="currentColor" style="flex:none">' +
        '<path d="M4.75 2.9c0-.77.84-1.25 1.5-.86l8 5.1c.62.4.62 1.32 0 1.72l-8 5.1c-.66.39-1.5-.09-1.5-.86V2.9Z"></path>' +
        "</svg><span>Judge Tour</span>";
      label.style.left = "134px";
      label.style.gap = "8px";
    }
    github.parentNode.insertBefore(tab, github);
  }

  // The header GitHub tab is rendered as a button. Turn it into a real link
  // so open-in-new-tab, copy-link and keyboard activation all work without JS.
  function makeGithubLinks() {
    document.querySelectorAll('button[class*="group/book"]').forEach(function (button) {
      if (button.dataset.docketGithubLink === "true") return;
      var link = document.createElement("a");
      Array.prototype.forEach.call(button.attributes, function (attribute) {
        if (attribute.name !== "type") link.setAttribute(attribute.name, attribute.value);
      });
      link.href = GITHUB;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.dataset.docketGithubLink = "true";
      link.style.visibility = "visible";
      link.style.opacity = "1";
      link.style.transform = "none";
      link.style.translate = "none";
      link.style.pointerEvents = "auto";
      link.setAttribute("aria-label", "Docket on GitHub");
      link.setAttribute("title", "Docket on GitHub");
      link.innerHTML = button.innerHTML;
      button.replaceWith(link);
    });
  }

  // On the previous page this section belongs directly below the hero,
  // before the "Catch the issues..." feature section.
  function applyCompliancePosition() {
    var section = document.getElementById("security-and-compliance");
    var detect = document.getElementById("detect-issues");
    if (!section || !detect || section.parentElement !== detect.parentElement) return;
    var anchor = document.getElementById("product-intro") || detect;
    if (section.nextElementSibling === anchor) return;
    detect.parentElement.insertBefore(section, anchor);
  }

  function problemMarkup() {
    return (
      '<div class="dk-problem">' +
        '<p class="dk-problem-kicker dk-problem-reveal"><span class="dk-problem-kicker-line" aria-hidden="true"></span>The problem</p>' +
        '<div class="dk-problem-head">' +
          '<h2 id="security-and-compliance-title" class="dk-problem-title dk-problem-reveal">Grounded in the<br /><span>wrong source.</span></h2>' +
          '<p class="dk-problem-lede dk-problem-reveal">The answer is fluent, cited, and wrong — because the source it used is stale, superseded, or written for a different country or plan. Nothing in the answer signals which.</p>' +
        '</div>' +
        '<div class="dk-problem-stats dk-problem-reveal">' +
          '<div class="dk-problem-stat">' +
            '<p class="dk-problem-number">76%<sup>+</sup></p>' +
            '<p class="dk-problem-copy">of 143 founders, operators and engineers have watched an AI tool surface an outdated document and answer confidently.</p>' +
            '<p class="dk-problem-source">Slite, 2026 — vendor survey</p>' +
          '</div>' +
          '<div class="dk-problem-stat">' +
            '<p class="dk-problem-number">15–30%</p>' +
            '<p class="dk-problem-copy">of knowledge articles conflict with another document, according to industry guides.</p>' +
            '<p class="dk-problem-source">Knowledge-management research</p>' +
          '</div>' +
          '<blockquote class="dk-problem-quote">' +
            '<p>“Every single runbook is either 2 years out of date or just doesn\'t exist.”</p>' +
            '<cite>r/sre, May 2026</cite>' +
          '</blockquote>' +
        '</div>' +
        '<div class="dk-problem-callout dk-problem-reveal">' +
          '<p>Retrieval and groundedness checks cannot catch this. A perfectly grounded answer can still cite a policy that no longer governs.</p>' +
        '</div>' +
      '</div>'
    );
  }

  function applyProblemSection() {
    var section = document.getElementById("security-and-compliance");
    if (!section) return;
    var container = section.querySelector(".container") || section.firstElementChild;
    if (!container) return;

    var problem = container.querySelector(".dk-problem");
    if (!problem) {
      container.innerHTML = problemMarkup();
      problem = container.querySelector(".dk-problem");
      section.classList.add("dk-problem-ready");
    }
    if (!problem || problem.dataset.dkReady === "true") return;
    problem.dataset.dkReady = "true";

    var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || !("IntersectionObserver" in window)) {
      problem.classList.add("is-in");
      return;
    }

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          problem.classList.add("is-in");
          observer.disconnect();
        });
      },
      { threshold: 0.15 }
    );
    observer.observe(problem);
  }

  function authorityArt() {
    return (
      '<div class="dk-evidence-card">' +
        '<div class="dk-evidence-head"><span>Authority trace</span><span class="dk-mono">Deterministic</span></div>' +
        '<div class="dk-trace-row">' +
          '<span class="dk-trace-dot is-amber" aria-hidden="true"></span>' +
          '<div class="dk-trace-name"><strong>Global contractor policy</strong><span>Global · 2026-01-01 · precedence 0</span></div>' +
          '<span class="dk-badge is-amber">Superseded</span>' +
        '</div>' +
        '<div class="dk-trace-row is-governing">' +
          '<span class="dk-trace-dot is-green" aria-hidden="true"></span>' +
          '<div class="dk-trace-name"><strong>Germany addendum</strong><span>DE · 2026-02-01 · precedence 1</span></div>' +
          '<span class="dk-badge is-green">Governing</span>' +
        '</div>' +
        '<div class="dk-trace-row">' +
          '<span class="dk-trace-dot is-gray" aria-hidden="true"></span>' +
          '<div class="dk-trace-name"><strong>US addendum</strong><span>US · 2026-03-01 · precedence 1</span></div>' +
          '<span class="dk-badge is-gray">Out of scope</span>' +
        '</div>' +
        '<div class="dk-evidence-foot"><span>Selected: precedence 1, country match, effective 2026-02-01.</span></div>' +
      '</div>'
    );
  }

  function compareArt() {
    return (
      '<div class="dk-evidence-card">' +
        '<div class="dk-evidence-head"><span>Governing · Return policy</span><span class="dk-mono">Compare</span></div>' +
        '<div class="dk-evidence-body dk-compare-body">' +
          '<p>Defective items may be returned within <strong>45 days</strong> of delivery.</p>' +
          '<div class="dk-conflict-line"><span>Conflict · Numeric</span></div>' +
          '<p class="dk-evidence-label">Draft</p>' +
          '<p>Defective items can be returned within <strong>30 days</strong>.</p>' +
        '</div>' +
        '<div class="dk-evidence-foot"><span>compare · 5 credits · 1.1s</span><span>Both passages cited</span></div>' +
      '</div>'
    );
  }

  function verifyArt() {
    return (
      '<div class="dk-evidence-card">' +
        '<div class="dk-evidence-head"><span>Claim</span><span class="dk-mono">Verdict</span></div>' +
        '<div class="dk-claim-row"><p>Monitor reimbursement requires prior manager approval.</p><span class="dk-badge is-amber">Contradicted</span></div>' +
        '<div class="dk-claim-row"><p>Delivery is expected within 5 business days.</p><span class="dk-badge is-green">Supported</span></div>' +
        '<div class="dk-evidence-foot"><span>1 / 2 supported</span><span>verify · 3 credits</span></div>' +
      '</div>'
    );
  }

  function rerankArt() {
    return (
      '<div class="dk-evidence-card">' +
        '<div class="dk-clause-row">' +
          '<div class="dk-clause-head"><span>Clause 02</span><span class="dk-badge is-green">Use</span></div>' +
          '<p>For employees in France, monitor reimbursement does not require prior manager approval.</p>' +
        '</div>' +
        '<div class="dk-clause-row">' +
          '<div class="dk-clause-head"><span>Clause 05</span><span class="dk-badge is-amber">Expand</span></div>' +
          '<p>Approval requirements vary by country and plan.</p>' +
        '</div>' +
        '<div class="dk-clause-row">' +
          '<div class="dk-clause-head"><span>Clause 09</span><span class="dk-badge is-gray">Skip</span></div>' +
          '<p>Equipment returns follow the global returns policy.</p>' +
        '</div>' +
      '</div>'
    );
  }

  function productSectionMarkup(config) {
    var items = config.list
      .map(function (item) {
        return "<li>" + item + "</li>";
      })
      .join("");
    return (
      '<div class="container dk-product-feature">' +
        '<div class="dk-product-copy">' +
          '<div class="dk-product-marker"><span class="dk-product-num">' + config.num + '</span><span class="dk-product-label">' + config.label + '</span></div>' +
          '<div class="dk-product-rule" aria-hidden="true"></div>' +
          '<h2 id="' + config.titleId + '" class="dk-product-title dk-product-reveal">' + config.title + '</h2>' +
          '<p class="dk-product-body dk-product-reveal">' + config.body + '</p>' +
          '<div class="dk-product-details dk-product-reveal">' +
            '<h3>' + config.detailsLabel + '</h3>' +
            '<ul class="dk-product-list">' + items + '</ul>' +
          '</div>' +
        '</div>' +
        '<div class="dk-product-art dk-product-reveal"><div class="dk-art-frame">' + config.art + '</div></div>' +
      '</div>'
    );
  }

  var PRODUCT_SECTIONS = [
    {
      id: "detect-issues",
      titleId: "detect-issues-title",
      num: "01",
      label: "Authority",
      title: "Resolve the governing text.",
      body: "A newer global policy does not beat an older country annex. A model should not decide that. Docket ranks the documents by the rules you set, shows every candidate, and holds when authority is ambiguous.",
      detailsLabel: "Authority trace",
      list: [
        "Jurisdiction match",
        "Explicit precedence",
        "Effective date",
        "Governing / superseded",
        "Out of scope",
        "Tie returns Hold",
      ],
      art: authorityArt(),
    },
    {
      id: "security",
      titleId: "security-title",
      num: "02",
      label: "Compare",
      title: "The clause, not the document.",
      body: "A whole-document diff is noise — 584 credits, 17 seconds, and conflicts that do not change the answer. Docket aligns the short clauses that matter and compares only those.",
      detailsLabel: "Clause compare",
      list: [
        "Clause-level diff",
        "5 credits per compare",
        "1.1s, not 17s",
        "Both passages cited",
        "Conflict flagged",
        "No document noise",
      ],
      art: compareArt(),
    },
    {
      id: "search-logs",
      titleId: "search-logs-title",
      num: "03",
      label: "Verify",
      title: "Every claim, accounted for.",
      body: "The draft is split into claims. Each claim is checked against the whole governing document, not a retrieved snippet. The result is claim-level: supported, contradicted, or not stated.",
      detailsLabel: "Claim verification",
      list: [
        "Supported",
        "Contradicted",
        "Not stated",
        "Whole governing text",
        "Evidence per claim",
        "3 credits per verify",
      ],
      art: verifyArt(),
    },
    {
      id: "live-dashboards",
      titleId: "live-dashboards-title",
      num: "04",
      label: "Rerank",
      title: "The right clause, not the nearest one.",
      body: "Retrieval finds nearby text. Rerank finds the clause that answers the question under the authority rules — use, expand, or skip, with a reason.",
      detailsLabel: "Source selection",
      list: [
        "Use / expand / skip",
        "Authority rules first",
        "Clause-level selection",
        "Reason attached",
        "Governing clause",
        "Not nearest text",
      ],
      art: rerankArt(),
    },
  ];

  function setupProductReveal(section) {
    var feature = section.querySelector(".dk-product-feature");
    if (!feature || feature.dataset.dkReady === "true") return;
    feature.dataset.dkReady = "true";

    var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || !("IntersectionObserver" in window)) {
      feature.classList.add("is-in");
      return;
    }

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          feature.classList.add("is-in");
          observer.disconnect();
        });
      },
      { threshold: 0.12 }
    );
    observer.observe(feature);
  }

  function productIntroMarkup() {
    return (
      '<div class="container dk-product-intro-inner">' +
        '<p class="dk-product-intro-kicker dk-product-reveal"><span class="dk-product-kicker-line" aria-hidden="true"></span>The product</p>' +
        '<div class="dk-product-intro-grid">' +
          '<h2 id="product-intro-title" class="dk-product-intro-title dk-product-reveal">Authority is a rule,<br /><span>not a guess.</span></h2>' +
          '<p class="dk-product-intro-lede dk-product-reveal">Docket answers one question before it checks anything else: which document governs <em>this</em> employee? Jurisdiction first, then explicit precedence, then effective date. The trace is deterministic and shown with the verdict.</p>' +
        '</div>' +
      '</div>'
    );
  }

  function applyProductIntro() {
    var detect = document.getElementById("detect-issues");
    if (!detect) return;
    var intro = document.getElementById("product-intro");
    if (!intro) {
      intro = document.createElement("section");
      intro.id = "product-intro";
      intro.className = "dk-product-intro";
      intro.setAttribute("aria-labelledby", "product-intro-title");
      intro.innerHTML = productIntroMarkup();
      detect.parentElement.insertBefore(intro, detect);
    }
    if (intro.dataset.dkReady === "true") return;
    intro.dataset.dkReady = "true";

    var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || !("IntersectionObserver" in window)) {
      intro.classList.add("is-in");
      return;
    }

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          intro.classList.add("is-in");
          observer.disconnect();
        });
      },
      { threshold: 0.15 }
    );
    observer.observe(intro);
  }

  function applyProductSections() {
    PRODUCT_SECTIONS.forEach(function (config) {
      var section = document.getElementById(config.id);
      if (!section) return;
      if (!section.querySelector(".dk-product-feature")) {
        section.innerHTML = productSectionMarkup(config);
        section.classList.add("dk-product-section");
      }
      setupProductReveal(section);
    });
  }

  var API_REQUEST_CODE = [
    "curl -s https://docket-clocked.vercel.app/api/check \\",
    "  -H 'Content-Type: application/json' \\",
    "  -d '{",
    '    "question": "What notice period applies to a contractor in Germany?",',
    '    "draft": "Contractors must give 30 days notice.",',
    '    "country": "DE",',
    '    "role": "Contractor",',
    '    "documents": [',
    '      { "title": "Global contractor policy", "jurisdiction": "Global",',
    '        "effective_date": "2026-01-01", "precedence": 0,',
    '        "text": "Contractors must give 30 days notice." },',
    '      { "title": "Germany addendum", "jurisdiction": "DE",',
    '        "effective_date": "2026-02-01", "precedence": 1,',
    '        "text": "For contractors in Germany, the notice period is 14 days." }',
    "    ]",
    "  }'",
  ].join("\n");

  var API_RESPONSE_CODE = [
    "{",
    '  "decision": "rewrite",',
    '  "headline": "One claim contradicts Germany addendum.",',
    '  "authority": {',
    '    "governing": { "title": "Germany addendum" },',
    '    "trace": [',
    '      { "title": "Germany addendum", "outcome": "governing" },',
    '      { "title": "Global contractor policy", "outcome": "superseded" }',
    "    ]",
    "  },",
    '  "claims": [',
    '    { "verdict": "contradicted",',
    '      "claim": "Contractors must give 30 days notice." }',
    "  ],",
    '  "credits": 7,',
    '  "latency_ms": 1985',
    "}",
  ].join("\n");

  function howMarkup() {
    return (
      '<div class="container dk-how">' +
        '<p class="dk-how-kicker dk-how-reveal"><span class="dk-how-kicker-line" aria-hidden="true"></span>The pipeline</p>' +
        '<h2 id="how-docket-works-title" class="dk-how-title dk-how-reveal">Four steps. One stamped<br />record.</h2>' +
        '<ol class="dk-how-track">' +
          '<li class="dk-how-step dk-how-reveal">' +
            '<span class="dk-how-index">01</span>' +
            '<h3>Paste the case</h3>' +
            '<p>The question, the employee context, up to six policies, and the draft answer.</p>' +
          '</li>' +
          '<li class="dk-how-step dk-how-reveal">' +
            '<span class="dk-how-index">02</span>' +
            '<h3>Resolve authority</h3>' +
            '<p>Jurisdiction, then precedence, then effective date. A tie holds the answer.</p>' +
          '</li>' +
          '<li class="dk-how-step dk-how-reveal">' +
            '<span class="dk-how-index">03</span>' +
            '<h3>Check the draft</h3>' +
            '<p>Rerank selects clauses, Compare finds conflicts, Verify checks every claim.</p>' +
          '</li>' +
          '<li class="dk-how-step dk-how-reveal">' +
            '<span class="dk-how-index">04</span>' +
            '<h3>Stamp the record</h3>' +
            '<p>Publish, Rewrite, or Hold — with a ref, citations, credits, and latency.</p>' +
          '</li>' +
        '</ol>' +
      '</div>'
    );
  }

  function scenariosMarkup() {
    var cases = [
      {
        index: "Case 01",
        badge: '<span class="dk-badge is-amber">Rewrite</span>',
        title: "Precedence over recency",
        body: "An older France annex outranks a newer global policy. “Latest wins” publishes the wrong answer.",
        tests: "Tests · jurisdiction + precedence",
      },
      {
        index: "Case 02",
        badge: '<span class="dk-badge is-amber">Rewrite</span>',
        title: "Version supersession",
        body: "A new policy changes two numbers. The draft still uses the old ones.",
        tests: "Tests · effective date + claim check",
      },
      {
        index: "Case 03",
        badge: '<span class="dk-badge is-green">Publish</span>',
        title: "Clean access request",
        body: "One governing source. The draft matches it. Docket lets the answer ship.",
        tests: "Tests · the positive path",
      },
      {
        index: "Case 04",
        badge: '<span class="dk-badge is-red">Hold</span>',
        title: "Ambiguous authority",
        body: "Two documents at the same precedence, with different text. Docket refuses to guess.",
        tests: "Tests · fail-closed",
      },
    ];
    var cards = cases
      .map(function (item, index) {
        return (
          '<article class="dk-scenario-card dk-scenarios-reveal" style="--dk-delay:' + index * 70 + 'ms">' +
            '<div class="dk-scenario-top"><span class="dk-scenario-index">' + item.index + "</span>" + item.badge + "</div>" +
            "<h3>" + item.title + "</h3>" +
            "<p>" + item.body + "</p>" +
            '<p class="dk-scenario-tests">' + item.tests + "</p>" +
          "</article>"
        );
      })
      .join("");

    return (
      '<div class="container dk-scenarios">' +
        '<p class="dk-scenarios-kicker dk-scenarios-reveal"><span class="dk-scenarios-kicker-line" aria-hidden="true"></span>What it catches</p>' +
        '<div class="dk-scenarios-head">' +
          '<h2 id="dk-scenarios-title" class="dk-scenarios-title dk-scenarios-reveal">Three cases that break<br />ordinary checkers.</h2>' +
          '<p class="dk-scenarios-lede dk-scenarios-reveal">These are not edge cases. They are the normal shape of a policy library: overlapping documents, country annexes, and versions that disagree.</p>' +
        "</div>" +
        '<div class="dk-scenario-grid">' + cards + "</div>" +
      "</div>"
    );
  }

  function apiMarkup() {
    return (
      '<div class="container dk-api">' +
        '<p class="dk-api-kicker dk-api-reveal"><span class="dk-api-kicker-line" aria-hidden="true"></span>The API</p>' +
        '<div class="dk-api-head">' +
          '<h2 id="dk-api-title" class="dk-api-title dk-api-reveal">One endpoint.<br />The same gate.</h2>' +
          '<p class="dk-api-lede dk-api-reveal">The web app is a client of <code>POST /api/check</code>. Send the question, context, documents, and draft. Get the verdict, authority trace, conflicts, claims, credits, and latency. Use it from an agent, a workflow, or your own UI.</p>' +
        "</div>" +
        '<div class="dk-api-grid dk-api-reveal">' +
          '<div class="dk-api-panel dk-api-request">' +
            '<div class="dk-api-panel-head"><span>Request</span><button type="button" class="dk-api-copy">Copy</button></div>' +
            '<pre><code id="dk-api-request-code">' + API_REQUEST_CODE + "</code></pre>" +
          "</div>" +
          '<div class="dk-api-panel dk-api-response">' +
            '<div class="dk-api-panel-head"><span>Response · 200</span><span>7 credits · 1.9s</span></div>' +
            '<pre><code>' + API_RESPONSE_CODE + "</code></pre>" +
          "</div>" +
        "</div>" +
      "</div>"
    );
  }

  function setupScrollReveal(root) {
    if (!root || root.dataset.dkRevealed === "true") return;
    root.dataset.dkRevealed = "true";
    var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || !("IntersectionObserver" in window)) {
      root.classList.add("is-in");
      return;
    }
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          root.classList.add("is-in");
          observer.disconnect();
        });
      },
      { threshold: 0.12 }
    );
    observer.observe(root);
  }

  function setupApiCopy(api) {
    var button = api.querySelector(".dk-api-copy");
    var code = api.querySelector("#dk-api-request-code");
    if (!button || !code || button.dataset.dkCopy === "true") return;
    button.dataset.dkCopy = "true";
    button.addEventListener("click", function () {
      var text = code.textContent || "";
      var done = function () {
        var original = button.textContent;
        button.textContent = "Copied";
        window.setTimeout(function () {
          button.textContent = original;
        }, 1600);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done).catch(function () {
          done();
        });
      } else {
        done();
      }
    });
  }

  function applyHowItWorks() {
    var section = document.getElementById("how-docket-works");
    if (!section) return;
    section.classList.add("dk-how-section");
    if (!section.querySelector(".dk-how")) {
      section.innerHTML = howMarkup();
    }
    setupScrollReveal(section.querySelector(".dk-how"));
  }

  function applyScenarios() {
    var section =
      document.getElementById("scenarios") ||
      document.querySelector('section[aria-labelledby="home-case-studies"]');
    if (!section) return;
    section.id = "scenarios";
    section.setAttribute("aria-labelledby", "dk-scenarios-title");
    if (!section.querySelector(".dk-scenarios")) {
      section.innerHTML = scenariosMarkup();
    }
    setupScrollReveal(section.querySelector(".dk-scenarios"));
  }

  function applyApiSection() {
    var scenarios = document.getElementById("scenarios");
    if (!scenarios) return;
    var api = document.getElementById("api");
    if (!api || !api.classList.contains("dk-api-section")) {
      api = document.createElement("section");
      api.id = "api";
      api.className = "dk-api-section";
      api.setAttribute("aria-labelledby", "dk-api-title");
      api.innerHTML = apiMarkup();
      scenarios.parentElement.insertBefore(api, scenarios.nextSibling);
    }
    if (scenarios.nextElementSibling !== api) {
      scenarios.parentElement.insertBefore(api, scenarios.nextSibling);
    }
    var root = api.querySelector(".dk-api");
    setupScrollReveal(root);
    setupApiCopy(api);
  }

  function apply() {
    applyCompliancePosition();
    applyProblemSection();
    applyProductIntro();
    applyProductSections();
    applyHowItWorks();
    applyScenarios();
    applyApiSection();
    applyNav();
    applyMobileNav();
    applyLogo();
    applyCtas();
    makeGithubLinks();
    makeTourTab();
  }

  // The header demo button carries a React click handler. Capture the click
  // before it reaches the React root, then open the repository instead.
  document.addEventListener(
    "click",
    function (event) {
      var target = event.target;
      if (!target || !target.closest) return;
      var book = target.closest('button[class*="group/book"]');
      if (!book) return;
      event.preventDefault();
      event.stopPropagation();
      if (event.stopImmediatePropagation) event.stopImmediatePropagation();
      window.open(GITHUB, "_blank", "noopener,noreferrer");
    },
    true
  );

  // The header stays visible while the page scrolls. Hiding it made the
  // navigation and console link disappear as soon as a visitor scrolled.

  apply();
  window.addEventListener("load", function () {
    setTimeout(apply, 250);
  });

  if ("MutationObserver" in window) {
    var queued = false;
    var schedule = function () {
      if (queued) return;
      queued = true;
      requestAnimationFrame(function () {
        queued = false;
        apply();
      });
    };
    new MutationObserver(schedule).observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["aria-label", "href"],
    });
  }
})();
