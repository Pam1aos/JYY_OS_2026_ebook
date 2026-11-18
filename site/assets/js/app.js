/* JYY OS 2026 — static reader interactions */
(() => {
  "use strict";

  const root = document.documentElement;
  root.classList.add("js");

  const READ_KEY = "jyy-os-2026:read";
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  const store = {
    read() {
      try {
        const raw = JSON.parse(localStorage.getItem(READ_KEY) || "[]");
        return new Set(Array.isArray(raw) ? raw.map(String) : []);
      } catch (_) {
        return new Set();
      }
    },
    save(set) {
      try {
        localStorage.setItem(READ_KEY, JSON.stringify(Array.from(set)));
      } catch (_) {
        /* private mode — the site still works, progress just won't persist */
      }
    },
  };

  let toastTimer = 0;
  function toast(message) {
    let el = $(".toast");
    if (!el) {
      el = document.createElement("div");
      el.className = "toast";
      el.setAttribute("role", "status");
      document.body.appendChild(el);
    }
    el.textContent = message;
    clearTimeout(toastTimer);
    requestAnimationFrame(() => el.classList.add("show"));
    toastTimer = setTimeout(() => el.classList.remove("show"), 2200);
  }

  function syncReadUI() {
    const read = store.read();
    $$("[data-chapter]").forEach((el) => {
      const num = String(el.dataset.chapter || "");
      el.classList.toggle("is-read", read.has(num));
    });
    $$("#readCount, [data-read-count]").forEach((el) => {
      el.textContent = `${read.size}`;
    });
    $$("[data-mark-read]").forEach((btn) => {
      const num = String(document.body.dataset.chapter || "");
      const isRead = read.has(num);
      btn.classList.toggle("is-read", isRead);
      btn.setAttribute("aria-pressed", String(isRead));
      const label = $("[data-read-label]", btn);
      if (label) label.textContent = isRead ? "已读完" : "标记已读";
    });
  }

  function setRead(num, on) {
    const read = store.read();
    if (on) read.add(String(num));
    else read.delete(String(num));
    store.save(read);
    syncReadUI();
  }

  function initReveal() {
    const items = $$(".reveal");
    if (!items.length) return;
    if (!("IntersectionObserver" in window)) {
      items.forEach((el) => el.classList.add("in"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("in");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.08, rootMargin: "0px 0px -40px 0px" }
    );
    items.forEach((el) => io.observe(el));
  }

  function initHome() {
    const cards = $$(".chapter-card");
    if (!cards.length) return;

    const search = $("#chapterSearch");
    const filters = $$(".filter");
    const parts = $$(".part");
    const empty = $("#emptyState");
    const summary = $("#resultCount");
    let part = "all";
    let query = "";

    const apply = () => {
      const q = query.trim().toLowerCase();
      let visible = 0;
      cards.forEach((card) => {
        const inPart = part === "all" || card.dataset.part === part;
        const text = (card.dataset.search || card.textContent).toLowerCase();
        const inQuery = !q || text.includes(q);
        const show = inPart && inQuery;
        card.hidden = !show;
        if (show) visible += 1;
      });
      parts.forEach((group) => {
        group.hidden = !$$(".chapter-card:not([hidden])", group).length;
      });
      if (empty) empty.hidden = visible !== 0;
      if (summary) {
        summary.textContent =
          visible === cards.length
            ? `${cards.length} 讲`
            : `${visible} / ${cards.length} 讲`;
      }
    };

    if (search) {
      search.addEventListener("input", () => {
        query = search.value;
        apply();
      });
      document.addEventListener("keydown", (event) => {
        const tag = (event.target && event.target.tagName) || "";
        if (
          event.key === "/" &&
          !/INPUT|TEXTAREA|SELECT/.test(tag) &&
          !event.metaKey &&
          !event.ctrlKey
        ) {
          event.preventDefault();
          search.focus();
        }
      });
    }

    filters.forEach((button) => {
      button.addEventListener("click", () => {
        part = button.dataset.filter || "all";
        filters.forEach((b) =>
          b.setAttribute("aria-pressed", String(b === button))
        );
        apply();
      });
    });

    apply();

    const nav = $(".site-header");
    const toggle = $("#navToggle");
    if (nav && toggle) {
      const closeNav = () => {
        nav.classList.remove("menu-open");
        document.body.classList.remove("nav-open");
        toggle.setAttribute("aria-expanded", "false");
      };
      toggle.addEventListener("click", () => {
        const open = nav.classList.toggle("menu-open");
        document.body.classList.toggle("nav-open", open);
        toggle.setAttribute("aria-expanded", String(open));
      });
      $$(".nav-links a", nav).forEach((link) =>
        link.addEventListener("click", closeNav)
      );
      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && nav.classList.contains("menu-open")) {
          closeNav();
        }
      });
      document.addEventListener("click", (event) => {
        if (
          nav.classList.contains("menu-open") &&
          !event.target.closest(".site-header")
        ) {
          closeNav();
        }
      });
    }
  }

  function initReader() {
    const article = $(".reader-article");
    if (!article) return;

    const chapter = String(document.body.dataset.chapter || "");
    const progress = $(".reader-progress span");
    const meter = $("#meterBar");
    const meterText = $("#meterText");
    const tocLinks = $$(".toc-nav a");
    const headings = $$(".prose h2[id]");
    const markButtons = $$("[data-mark-read]");

    const updateProgress = () => {
      const max = Math.max(
        1,
        document.documentElement.scrollHeight - window.innerHeight
      );
      const pct = Math.min(100, Math.max(0, (window.scrollY / max) * 100));
      if (progress) progress.style.width = `${pct}%`;
      if (meter) meter.style.width = `${pct}%`;
      if (meterText) meterText.textContent = `${Math.round(pct)}%`;
    };

    updateProgress();
    window.addEventListener("scroll", updateProgress, { passive: true });
    window.addEventListener("resize", updateProgress);

    if (headings.length && tocLinks.length) {
      const byId = new Map(tocLinks.map((link) => [link.hash.slice(1), link]));
      let active = null;
      const activate = (id) => {
        const link = byId.get(id);
        if (!link || link === active) return;
        if (active) active.classList.remove("active");
        active = link;
        active.classList.add("active");
      };
      if ("IntersectionObserver" in window) {
        const io = new IntersectionObserver(
          (entries) => {
            const visible = entries
              .filter((entry) => entry.isIntersecting)
              .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
            if (visible[0]) activate(visible[0].target.id);
          },
          { rootMargin: "-100px 0px -68% 0px", threshold: 0 }
        );
        headings.forEach((heading) => io.observe(heading));
      }
      activate(headings[0].id);
    }

    markButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const read = store.read();
        const next = !read.has(chapter);
        setRead(chapter, next);
        toast(next ? "已标记为读完 · 进度已保存" : "已取消完成标记");
      });
    });

    syncReadUI();

    const side = $(".reader-side");
    const current = $(".side-link.active", side || document);
    if (current && side) {
      const scroller = $(".side-scroll", side);
      if (scroller) {
        const group = current.closest(".side-group");
        const top = group ? group.offsetTop - 6 : current.offsetTop;
        scroller.scrollTop = Math.max(0, top);
      }
    }

    const menuBtn = $("#menuToggle");
    const scrim = $(".menu-scrim");
    const closeMenu = () => {
      document.body.classList.remove("menu-open");
      if (menuBtn) menuBtn.setAttribute("aria-expanded", "false");
    };
    if (menuBtn) {
      menuBtn.addEventListener("click", () => {
        const open = document.body.classList.toggle("menu-open");
        menuBtn.setAttribute("aria-expanded", String(open));
      });
    }
    if (scrim) scrim.addEventListener("click", closeMenu);
    $$(".side-link").forEach((link) =>
      link.addEventListener("click", closeMenu)
    );

    $$(".screenshot-card img").forEach((img) => {
      img.addEventListener("click", () => {
        const box = $("#lightbox");
        if (!box) return;
        const full = $("img", box);
        full.src = img.currentSrc || img.src;
        full.alt = img.alt || "课堂截图";
        box.classList.add("open");
        document.body.style.overflow = "hidden";
        const close = $(".lightbox-close", box);
        if (close) close.focus();
      });
    });

    const lightbox = $("#lightbox");
    if (lightbox) {
      const close = () => {
        lightbox.classList.remove("open");
        document.body.style.overflow = "";
      };
      lightbox.addEventListener("click", (event) => {
        if (event.target === lightbox || event.target.closest(".lightbox-close"))
          close();
      });
    }

    $$(".prose .highlight").forEach((block) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "copy-code";
      button.textContent = "COPY";
      button.setAttribute("aria-label", "复制代码");
      button.addEventListener("click", async () => {
        const code = $("pre", block);
        if (!code) return;
        const text = code.innerText;
        try {
          await navigator.clipboard.writeText(text);
          button.textContent = "COPIED";
          toast("代码已复制");
        } catch (_) {
          const area = document.createElement("textarea");
          area.value = text;
          area.style.position = "fixed";
          area.style.opacity = "0";
          document.body.appendChild(area);
          area.select();
          document.execCommand("copy");
          area.remove();
          button.textContent = "COPIED";
          toast("代码已复制");
        }
        setTimeout(() => (button.textContent = "COPY"), 1800);
      });
      block.appendChild(button);
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeMenu();
        if (lightbox && lightbox.classList.contains("open")) {
          lightbox.classList.remove("open");
          document.body.style.overflow = "";
        }
      }
    });

    const nav = $("#readerMenu");
    if (nav) {
      const toggle = $("#navToggle");
      if (toggle) {
        toggle.addEventListener("click", () => {
          const open = nav.classList.toggle("menu-open");
          toggle.setAttribute("aria-expanded", String(open));
        });
      }
    }
  }

  function init() {
    initHome();
    initReader();
    syncReadUI();
    initReveal();
    document.body.classList.add("page-ready");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
