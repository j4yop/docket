/* Docket footer — the Docket footer interaction, applied to / and /integrations. */
(function () {
  "use strict";

  const HOME = location.pathname === "/" || location.pathname === "/index.html";
  const GITHUB = "https://github.com/j4yop/docket";
  const CONSOLE = "/console";

  const COLUMNS = [
    {
      label: "Product",
      links: [
        { label: "Live Gate", href: HOME ? "/console#docket-gate" : "#docket-gate" },
        { label: "How it Works", href: HOME ? "/console#gate-stages" : "#gate-stages" },
        { label: "Scenarios", href: HOME ? "/console#gate-panel-examples" : "#gate-panel-examples" },
        { label: "API", href: "https://github.com/j4yop/docket#api", external: true },
      ],
    },
    {
      label: "Build",
      links: [
        { label: "GitHub", href: GITHUB, external: true },
        { label: "README", href: "https://github.com/j4yop/docket#readme", external: true },
        { label: "Architecture", href: "https://github.com/j4yop/docket/blob/main/ARCHITECTURE.md", external: true },
        { label: "Clocked", href: "https://clocked.rezolve.ai/", external: true },
      ],
    },
    {
      label: "Social",
      links: [
        { label: "LinkedIn", href: "https://www.linkedin.com/in/jaygopaltripathy/", external: true },
        { label: "X", href: "https://x.com/j4y_op", external: true },
        { label: "GitHub", href: GITHUB, external: true },
      ],
    },
  ];

  function columnMarkup(column) {
    const links = column.links
      .map((link) => {
        const external = link.external ? ' target="_blank" rel="noopener noreferrer"' : "";
        return `<a href="${link.href}"${external}>${link.label}</a>`;
      })
      .join("");
    return `<div class="relative h-fit w-max max-w-full dk-footer-col" data-dk-col>
      <span class="dk-footer-col-highlight" aria-hidden="true"></span>
      <span class="dk-footer-col-rail" aria-hidden="true"></span>
      <span class="dk-footer-col-label font-misc">${column.label}</span>
      <div class="dk-footer-col-links">${links}</div>
    </div>`;
  }

  function replaceText(footer, from, to) {
    const walker = document.createTreeWalker(footer, NodeFilter.SHOW_TEXT, null);
    let node;
    while ((node = walker.nextNode())) {
      if (node.nodeValue && node.nodeValue.indexOf(from) !== -1) {
        node.nodeValue = node.nodeValue.replace(from, to);
      }
    }
  }

  function updateCopy(footer) {
    const heading = footer.querySelector("h3");
    if (heading) heading.innerHTML = "PUBLISH ANSWERS<br>WITH PROOF";

    const description = footer.querySelector("p.text-d2");
    if (description) {
      description.textContent =
        "The publish gate for service-desk knowledge. Resolve authority, compare clauses, and verify every claim before an answer ships.";
    }

    const tagline = [...footer.querySelectorAll("span, p")].find(
      (el) => (el.textContent || "").trim() === "Stop Wondering"
    );
    if (tagline) tagline.textContent = "Publish With Proof";

    footer.querySelectorAll("img").forEach((image) => {
      const src = image.getAttribute("src") || "";
      if (!/logo-mobile|logo\.890d0c79|docket-wordmark|docket-mark/.test(src)) return;
      const mobile = image.className.indexOf("md:hidden") !== -1;
      if (mobile) {
        image.src = "/images/footer/docket-mark.svg";
        image.width = 682;
        image.height = 600;
      } else {
        image.src = "/images/footer/docket-wordmark.svg";
        image.width = 119;
        image.height = 20;
      }
    });

    const mark = footer.querySelector(".mix-blend-overlay");
    if (mark) mark.classList.add("dk-footer-mark");

    const newsletterForm = footer.querySelector("form");
    if (newsletterForm) {
      const newsletter = newsletterForm.closest(".flex.min-h-16") || newsletterForm.parentElement;
      const row = newsletter ? newsletter.parentElement : null;
      if (newsletter) newsletter.remove();
      if (row) row.classList.add("dk-footer-no-newsletter");
    }

    const privacy = [...footer.querySelectorAll("a")].find(
      (link) => (link.textContent || "").trim().toLowerCase() === "privacy"
    );
    if (privacy && privacy.parentElement) {
      const legal = privacy.parentElement.parentElement;
      privacy.parentElement.remove();
      if (legal) legal.classList.add("dk-footer-legal");
    }

    footer.querySelectorAll("a").forEach((link) => {
      const href = link.getAttribute("href") || "";
      if (link.dataset.docketConsole === "true") {
        link.href = CONSOLE;
        link.removeAttribute("target");
        link.removeAttribute("rel");
        link.dataset.docketConsole = "true";
        link.textContent = "Open console";
      }
      if (href.indexOf("demo=true") !== -1 || link.dataset.docketGithub === "true") {
        link.href = GITHUB;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.dataset.docketGithub = "true";
        link.textContent = "GitHub";
      }
    });
  }

  function buildColumns(footer) {
    const current = [...footer.querySelectorAll(".relative.h-fit.w-max.max-w-full")];
    if (current.length !== 3) return;
    if (current.every((col) => col.querySelector(".dk-footer-col-highlight"))) return;

    current.forEach((col, index) => {
      const template = document.createElement("template");
      template.innerHTML = columnMarkup(COLUMNS[index]).trim();
      col.replaceWith(template.content.firstElementChild);
    });
    return true;
  }

  function initColumns(footer) {
    footer.querySelectorAll(".dk-footer-col").forEach((column) => {
      if (column.dataset.dkInteractive === "true") return;
      column.dataset.dkInteractive = "true";

      const highlight = column.querySelector(".dk-footer-col-highlight");
      const rail = column.querySelector(".dk-footer-col-rail");
      const label = column.querySelector(".dk-footer-col-label");
      const links = [...column.querySelectorAll(".dk-footer-col-links a")];
      if (!highlight || !rail) return;

      const reset = () => {
        column.classList.remove("is-active");
        highlight.style.removeProperty("top");
        highlight.style.removeProperty("height");
        highlight.style.removeProperty("width");
        rail.style.removeProperty("top");
        links.forEach((link) => link.classList.remove("is-hot"));
      };

      const activate = (link) => {
        const columnRect = column.getBoundingClientRect();
        const linkRect = link.getBoundingClientRect();
        const top = linkRect.top - columnRect.top;
        column.classList.add("is-active");
        links.forEach((item) => item.classList.toggle("is-hot", item === link));
        highlight.style.top = `${top}px`;
        highlight.style.height = `${linkRect.height}px`;
        highlight.style.width = `${Math.max(112, linkRect.width + 8)}px`;
        rail.style.top = `${top + linkRect.height / 2}px`;
      };

      links.forEach((link) => {
        link.addEventListener("pointerenter", () => activate(link));
        link.addEventListener("focus", () => activate(link));
      });
      if (label) label.addEventListener("pointerenter", reset);
      column.addEventListener("pointerleave", reset);
      column.addEventListener("focusout", (event) => {
        if (!column.contains(event.relatedTarget)) reset();
      });
    });
  }

  function initReveal(footer) {
    if (footer.dataset.dkFooterReveal === "true") return;
    footer.dataset.dkFooterReveal = "true";
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const targets = [
      ...footer.querySelectorAll(".dk-footer-col, .dk-footer-mark"),
    ];
    footer.classList.add("dk-footer-enhanced");

    if (reduce || !("IntersectionObserver" in window)) {
      targets.forEach((target) => target.classList.add("is-in"));
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
    targets.forEach((target) => observer.observe(target));

    const revealVisible = () => {
      const limit = window.innerHeight - 24;
      targets.forEach((target) => {
        if (!target.classList.contains("is-in") && target.getBoundingClientRect().top < limit) {
          target.classList.add("is-in");
        }
      });
    };
    window.addEventListener("scroll", () => requestAnimationFrame(revealVisible), { passive: true });
    revealVisible();
  }


  function apply() {
    const footer =
      document.querySelector('footer[data-page-find-surface="red"]') ||
      document.querySelector(".bg-background > footer") ||
      document.querySelector("footer");
    if (!footer) return;
    updateCopy(footer);
    const rebuilt = buildColumns(footer);
    if (rebuilt) delete footer.dataset.dkFooterReveal;
    initColumns(footer);
    initReveal(footer);
  }

  if (HOME) {
    // The homepage footer belongs to the React tree. Apply after hydration so
    // the Docket content is not overwritten by a late render.
    window.addEventListener("load", () => {
      setTimeout(apply, 350);
      setTimeout(() => {
        apply();
        document.documentElement.classList.add("dk-footer-ready");
      }, 1300);
    });
  } else if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      apply();
      document.documentElement.classList.add("dk-footer-ready");
    });
  } else {
    apply();
    document.documentElement.classList.add("dk-footer-ready");
  }
})();
