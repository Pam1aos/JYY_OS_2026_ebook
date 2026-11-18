/* JYY OS 2026 — course assistant, evidence sidecar and knowledge graph */
(() => {
  "use strict";

  if (document.querySelector(".chat-root")) return;

  const body = document.body;
  const chapter = (body.dataset.chapter || "").padStart(2, "0");
  const isChapter = /^\d{2}$/.test(chapter);
  const chapterTitleEl = document.querySelector(".chapter-head h1");
  const chapterTitle = chapterTitleEl
    ? chapterTitleEl.textContent.replace(/\s+/g, " ").trim()
    : "";

  const state = {
    open: false,
    busy: false,
    history: [],
    mode: "model",
    depth: "deep",
    citations: [],
    evidenceOpen: false,
    graphOpen: false,
    graphLoading: false,
    graph: null,
    kgPart: "all",
    kgView: { x: 0, y: 0, scale: 1 },
  };

  const icons = {
    spark:
      '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M10 2.6c.55 3.3 2.1 4.85 5.4 5.4-3.3.55-4.85 2.1-5.4 5.4-.55-3.3-2.1-4.85-5.4-5.4 3.3-.55 4.85-2.1 5.4-5.4Z" fill="currentColor"/><path d="M15.8 13.1c.25 1.5.95 2.2 2.45 2.45-1.5.25-2.2.95-2.45 2.45-.25-1.5-.95-2.2-2.45-2.45 1.5-.25 2.2-.95 2.45-2.45Z" fill="currentColor"/></svg>',
    send:
      '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m2.2 7.6 11.1-4.4-4.4 11.1-2-4.7-4.7-2Z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="m6.9 9.2 3.1-3.1" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>',
    reset:
      '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3.2 8a4.8 4.8 0 1 0 1.45-3.44M3.2 3.4v3.2h3.2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    layers:
      '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m8 2 6 3-6 3-6-3 6-3Z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="m2 8 6 3 6-3M2 11l6 3 6-3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    bookmark:
      '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M4 2.7h8v10.6L8 10.8l-4 2.5V2.7Z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>',
    close:
      '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>',
    zoomIn:
      '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M8 3.2v9.6M3.2 8h9.6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>',
    zoomOut:
      '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3.2 8h9.6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>',
    fit:
      '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M2.7 6V2.7H6M10 2.7h3.3V6M13.3 10v3.3H10M6 13.3H2.7V10" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  };

  const savedDepth = (() => {
    try {
      return localStorage.getItem("jyy-os-2026:chat-depth") === "brief"
        ? "brief"
        : "deep";
    } catch (_) {
      return "deep";
    }
  })();
  state.depth = savedDepth;

  const suggestions = isChapter
    ? [
        `用三句话总结第 ${chapter} 讲`,
        "这一讲最重要的三个概念是什么？",
        "帮我出 3 道复习题",
      ]
    : ["这门课应该怎么学？", "并发和并行的区别是什么？", "第 29 讲讲什么？"];

  const root = document.createElement("div");
  root.className = "chat-root";
  root.innerHTML = `
    <button class="chat-fab" type="button" aria-label="打开课程助教" aria-controls="courseChat" aria-expanded="false">
      <span class="chat-fab-orb">${icons.spark}</span>
      <span class="chat-fab-copy"><strong>问课程</strong><small>Course AI</small></span>
      <span class="live-dot" aria-hidden="true"></span>
    </button>
    <div class="chat-scrim" data-chat-close aria-hidden="true"></div>
    <section class="chat-panel" id="courseChat" role="dialog" aria-modal="true" aria-label="JYY OS 课程助教" aria-hidden="true">
      <header class="chat-head">
        <span class="chat-head-avatar" aria-hidden="true">${icons.spark}</span>
        <div class="chat-head-copy"><h3>课程助教</h3><p>30 讲全文知识库</p></div>
        <span class="chat-mode" data-chat-mode>RAG</span>
        <button class="chat-reset" type="button" data-chat-reset aria-label="开始新对话">${icons.reset}</button>
        <button class="chat-close" type="button" data-chat-close aria-label="关闭课程助教">×</button>
      </header>
      <div class="chat-context"><b data-chat-context>全书 · 30 讲课程</b></div>
      <div class="chat-tools">
        <div class="chat-depth" role="group" aria-label="回答模式">
          <button type="button" data-depth="brief" aria-pressed="false">精简</button>
          <button type="button" data-depth="deep" aria-pressed="true">深入</button>
        </div>
        <div class="chat-tool-group">
          <button class="chat-tool" type="button" data-evidence-toggle aria-pressed="false" aria-controls="chatEvidence">依据 <b data-evidence-count>0</b></button>
          <button class="chat-tool" type="button" data-graph-toggle aria-label="打开知识图谱">${icons.layers}<span>图谱</span></button>
        </div>
      </div>
      <div class="chat-messages" data-chat-messages aria-live="polite"></div>
      <form class="chat-form" data-chat-form>
        <textarea class="chat-input" data-chat-input rows="1" maxlength="2000" placeholder="问一个课程问题…" aria-label="输入问题"></textarea>
        <button class="chat-send" data-chat-send type="submit" aria-label="发送问题">${icons.send}</button>
      </form>
      <p class="chat-footnote">精简给结论，深入会结合课程原文做联想延伸。</p>
    </section>
    <aside class="chat-evidence" id="chatEvidence" aria-label="原文依据" aria-hidden="true">
      <header class="chat-evidence-head">
        <div><span>RETRIEVED SOURCES</span><h4>原文依据 <b data-evidence-count>0</b></h4></div>
        <button type="button" data-evidence-close aria-label="关闭原文依据">${icons.close}</button>
      </header>
      <div class="chat-evidence-list" data-evidence-list>
        <div class="chat-evidence-empty">${icons.bookmark}<strong>还没有检索结果</strong><p>提问后，课程原文会显示在这里。</p></div>
      </div>
    </aside>
    <div class="kg-scrim" data-graph-close aria-hidden="true"></div>
    <section class="kg-modal" id="knowledgeGraph" role="dialog" aria-modal="true" aria-label="课程关系知识图谱" aria-hidden="true">
      <header class="kg-head">
        <div><span>COURSE KNOWLEDGE MAP</span><h3>操作系统知识图谱</h3><p>30 讲 · 7 个主题 · 概念关系网络</p></div>
        <button type="button" data-graph-close class="kg-close">关闭图谱 ${icons.close}</button>
      </header>
      <div class="kg-body">
        <div class="kg-canvas">
          <svg class="kg-svg" viewBox="0 0 1100 720" role="img" aria-label="课程关系知识图谱"></svg>
          <div class="kg-loading">正在构建关系网络…</div>
          <div class="kg-controls">
            <button type="button" data-kg-zoom="in" aria-label="放大">${icons.zoomIn}</button>
            <button type="button" data-kg-zoom="out" aria-label="缩小">${icons.zoomOut}</button>
            <button type="button" data-kg-zoom="reset" aria-label="恢复视图">${icons.fit}</button>
          </div>
          <div class="kg-legend" data-kg-legend></div>
        </div>
        <aside class="kg-detail" data-kg-detail>
          <span class="kg-detail-kicker">SELECTED NODE</span>
          <h4>从一个节点开始</h4>
          <p>点击图谱里的讲次、主题或概念，查看它与其他内容的连接。</p>
        </aside>
      </div>
    </section>`;
  body.appendChild(root);

  const fab = root.querySelector(".chat-fab");
  const panel = root.querySelector(".chat-panel");
  const scrim = root.querySelector(".chat-scrim");
  const messagesEl = root.querySelector("[data-chat-messages]");
  const form = root.querySelector("[data-chat-form]");
  const input = root.querySelector("[data-chat-input]");
  const sendBtn = root.querySelector("[data-chat-send]");
  const contextEl = root.querySelector("[data-chat-context]");
  const modeEl = root.querySelector("[data-chat-mode]");
  const resetBtn = root.querySelector("[data-chat-reset]");
  const evidenceEl = root.querySelector("#chatEvidence");
  const evidenceList = root.querySelector("[data-evidence-list]");
  const evidenceToggle = root.querySelector("[data-evidence-toggle]");
  const evidenceCounts = $$("[data-evidence-count]", root);
  const depthButtons = $$(".chat-depth button", root);
  const graphModal = root.querySelector("#knowledgeGraph");
  const kgScrim = root.querySelector(".kg-scrim");
  const kgSvg = root.querySelector(".kg-svg");
  const kgDetail = root.querySelector("[data-kg-detail]");
  const kgLegend = root.querySelector("[data-kg-legend]");
  const kgLoading = root.querySelector(".kg-loading");

  function $(selector, ctx = document) {
    return ctx.querySelector(selector);
  }
  function $$(selector, ctx = document) {
    return Array.from(ctx.querySelectorAll(selector));
  }

  function currentSection() {
    if (!isChapter) return "";
    const headings = Array.from(
      document.querySelectorAll(".prose h2[id], .prose h3[id]")
    );
    let active = null;
    for (const heading of headings) {
      if (heading.getBoundingClientRect().top < 170) active = heading;
      else break;
    }
    return active ? active.innerText.replace(/^#\s*/, "").trim() : "";
  }

  function currentSelection() {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return "";
    const text = selection.toString().trim();
    if (!text) return "";
    const prose = document.querySelector(".prose");
    if (!prose) return "";
    const node = selection.anchorNode;
    const element = node && (node.nodeType === 1 ? node : node.parentElement);
    if (!element || !prose.contains(element)) return "";
    return text.slice(0, 1200);
  }

  function updateContext() {
    if (!isChapter) {
      contextEl.textContent = "全书 · 30 讲课程";
      return;
    }
    const section = currentSection();
    contextEl.textContent = `第 ${chapter} 讲${
      chapterTitle ? ` · ${chapterTitle}` : ""
    }${section ? ` / ${section}` : ""}`;
  }

  function escapeHtml(value) {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function inlineMarkdown(value) {
    return value
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/`([^`]+)`/g, "<code>$1</code>");
  }

  function renderMarkdown(raw) {
    const escaped = escapeHtml(raw);
    const blocks = escaped.split(/(```[\s\S]*?```)/g);
    const html = [];
    for (const block of blocks) {
      if (!block) continue;
      if (block.startsWith("```")) {
        const code = block.replace(/^```[^\n]*\n?/, "").replace(/```$/, "");
        html.push(`<pre><code>${code.replace(/\n$/, "")}</code></pre>`);
        continue;
      }
      html.push(renderTextBlock(block));
    }
    return html.join("");
  }

  function renderTextBlock(block) {
    const lines = block.split("\n");
    const html = [];
    let listType = "";
    let listItems = [];
    let paragraph = [];

    const flushList = () => {
      if (!listType) return;
      html.push(
        `<${listType}>${listItems
          .map((item) => `<li>${inlineMarkdown(item)}</li>`)
          .join("")}</${listType}>`
      );
      listType = "";
      listItems = [];
    };
    const flushParagraph = () => {
      if (!paragraph.length) return;
      html.push(
        `<p>${inlineMarkdown(paragraph.join("\n")).replace(/\n/g, "<br>")}</p>`
      );
      paragraph = [];
    };

    for (const line of lines) {
      const heading = line.match(/^\s*#{1,4}\s+(.+)$/);
      const bullet = line.match(/^\s*[-*]\s+(.+)$/);
      const numbered = line.match(/^\s*\d+[.)]\s+(.+)$/);
      const quote = line.match(/^\s*>\s?(.*)$/);
      if (heading) {
        flushList();
        flushParagraph();
        html.push(`<h4>${inlineMarkdown(heading[1])}</h4>`);
      } else if (bullet) {
        flushParagraph();
        if (listType !== "ul") {
          flushList();
          listType = "ul";
        }
        listItems.push(bullet[1]);
      } else if (numbered) {
        flushParagraph();
        if (listType !== "ol") {
          flushList();
          listType = "ol";
        }
        listItems.push(numbered[1]);
      } else if (quote) {
        flushList();
        flushParagraph();
        html.push(`<blockquote>${inlineMarkdown(quote[1])}</blockquote>`);
      } else if (!line.trim()) {
        flushList();
        flushParagraph();
      } else if (listType) {
        listItems[listItems.length - 1] += `<br>${line}`;
      } else {
        paragraph.push(line);
      }
    }
    flushList();
    flushParagraph();
    return html.join("");
  }

  function scrollToBottom() {
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function scrollMessageStart(row) {
    const top =
      row.getBoundingClientRect().top -
      messagesEl.getBoundingClientRect().top +
      messagesEl.scrollTop -
      6;
    messagesEl.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  }

  function welcomeMarkup() {
    return `<div class="chat-welcome">
      <span class="chat-welcome-mark">J</span>
      <h4>${isChapter ? "这一讲，哪里没看懂？" : "从 30 讲里，找到你要的答案。"}</h4>
      <p>${isChapter ? "我会结合当前章节的原文回答，并给出可跳转的出处。" : "问我概念、代码、课程脉络，或让我帮你出复习题。答案会标注课程原文出处。"}</p>
      <div class="chat-suggestions">${suggestions
        .map(
          (suggestion) =>
            `<button class="chat-suggestion" type="button">${suggestion}</button>`
        )
        .join("")}</div>
    </div>`;
  }

  function showWelcome() {
    messagesEl.innerHTML = welcomeMarkup();
    messagesEl.querySelectorAll(".chat-suggestion").forEach((button) => {
      button.addEventListener("click", () => send(button.textContent));
    });
  }

  function appendMessage(role, text) {
    const row = document.createElement("div");
    row.className = `chat-row ${role}`;
    if (role === "assistant") {
      const avatar = document.createElement("span");
      avatar.className = "chat-avatar-mini";
      avatar.textContent = "J";
      row.appendChild(avatar);
    }
    const stack = document.createElement("div");
    stack.className = "chat-stack";
    const bubble = document.createElement("div");
    bubble.className = "chat-bubble";
    if (role === "assistant") bubble.innerHTML = renderMarkdown(text);
    else bubble.textContent = text;
    stack.appendChild(bubble);
    row.appendChild(stack);
    messagesEl.appendChild(row);
    scrollToBottom();
    return { row, stack, bubble };
  }

  function addCitations(stack, citations) {
    if (!citations || !citations.length) return;
    const wrap = document.createElement("div");
    wrap.className = "chat-citations";
    citations.forEach((citation) => {
      const link = document.createElement("a");
      link.className = "chat-citation";
      link.href = citation.url;
      link.target = "_blank";
      link.rel = "noopener";
      link.dataset.cite = String(citation.n);
      link.title = `第${citation.lecture}讲 · ${citation.lectureTitle} / ${citation.section}`;
      const number = document.createElement("b");
      number.textContent = `[${citation.n}]`;
      link.appendChild(number);
      const label = document.createElement("span");
      label.textContent = `第${citation.lecture}讲 · ${citation.section}`;
      link.appendChild(label);
      link.addEventListener("click", (event) => {
        event.preventDefault();
        openEvidence();
        activateEvidence(citation.n);
      });
      wrap.appendChild(link);
    });
    stack.appendChild(wrap);
    scrollToBottom();
  }

  function setBusy(value) {
    state.busy = value;
    input.disabled = value;
    sendBtn.disabled = value;
    panel.classList.toggle("is-streaming", value);
    if (!value) input.focus();
  }

  function setMode(mode) {
    state.mode = mode;
    modeEl.textContent = mode === "demo" ? "DEMO" : "RAG";
    modeEl.classList.toggle("demo", mode === "demo");
  }

  function setDepth(depth) {
    state.depth = depth === "brief" ? "brief" : "deep";
    depthButtons.forEach((button) => {
      const active = button.dataset.depth === state.depth;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    try {
      localStorage.setItem("jyy-os-2026:chat-depth", state.depth);
    } catch (_) {
      /* private mode */
    }
  }

  function renderEvidence(citations) {
    state.citations = citations || [];
    const count = state.citations.length;
    evidenceCounts.forEach((el) => (el.textContent = String(count)));
    evidenceToggle?.classList.toggle("has-sources", count > 0);
    evidenceToggle?.setAttribute("disabled", String(count === 0));
    evidenceList.innerHTML = "";
    if (!count) {
      evidenceList.innerHTML = `<div class="chat-evidence-empty">${icons.bookmark}<strong>还没有检索结果</strong><p>提问后，课程原文会显示在这里。</p></div>`;
      return;
    }
    state.citations.forEach((citation) => {
      const card = document.createElement("article");
      card.className = "chat-source";
      card.dataset.cite = String(citation.n);
      const head = document.createElement("header");
      const badge = document.createElement("b");
      badge.textContent = `[${citation.n}]`;
      head.appendChild(badge);
      const meta = document.createElement("span");
      meta.textContent = `第${citation.lecture}讲 · ${citation.lectureTitle}`;
      head.appendChild(meta);
      const title = document.createElement("h4");
      title.textContent = citation.section;
      const excerpt = document.createElement("p");
      excerpt.textContent = citation.excerpt || "";
      const link = document.createElement("a");
      link.href = citation.url;
      link.target = "_blank";
      link.rel = "noopener";
      link.textContent = "查看原文 ↗";
      card.append(head, title, excerpt, link);
      card.addEventListener("click", () => activateEvidence(citation.n));
      evidenceList.appendChild(card);
    });
  }

  function activateEvidence(n) {
    $$(".chat-source", evidenceList).forEach((card) => {
      card.classList.toggle("is-active", card.dataset.cite === String(n));
    });
    $$(".chat-citation", messagesEl).forEach((chip) => {
      chip.classList.toggle("is-active", chip.dataset.cite === String(n));
    });
    const card = $(`.chat-source[data-cite="${n}"]`, evidenceList);
    if (card) card.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  function openEvidence() {
    if (!state.citations.length) return;
    state.evidenceOpen = true;
    evidenceEl.classList.add("open");
    evidenceEl.setAttribute("aria-hidden", "false");
    evidenceToggle?.setAttribute("aria-pressed", "true");
    if (window.innerWidth <= 900) {
      evidenceEl.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }

  function closeEvidence() {
    state.evidenceOpen = false;
    evidenceEl.classList.remove("open");
    evidenceEl.setAttribute("aria-hidden", "true");
    evidenceToggle?.setAttribute("aria-pressed", "false");
  }

  function resetChat() {
    state.history = [];
    state.citations = [];
    setMode("model");
    closeEvidence();
    renderEvidence([]);
    showWelcome();
    input.value = "";
    input.style.height = "auto";
    input.focus();
  }

  function openChat() {
    state.open = true;
    body.classList.add("chat-open");
    panel.classList.add("open");
    panel.setAttribute("aria-hidden", "false");
    fab.setAttribute("aria-expanded", "true");
    updateContext();
    if (!messagesEl.children.length) showWelcome();
    window.setTimeout(() => input.focus(), 320);
  }

  function closeChat() {
    closeGraph();
    closeEvidence();
    state.open = false;
    body.classList.remove("chat-open");
    panel.classList.remove("open");
    panel.setAttribute("aria-hidden", "true");
    fab.setAttribute("aria-expanded", "false");
    fab.focus();
  }

  async function readError(response) {
    try {
      const data = await response.json();
      return data.error || `请求失败（${response.status}）`;
    } catch (_) {
      return `请求失败（${response.status}）`;
    }
  }

  /* Knowledge graph -------------------------------------------------- */
  function graphPartLabel(part) {
    const hub = state.graph?.nodes.find(
      (node) => node.type === "hub" && node.part === part
    );
    return hub ? hub.label : part;
  }

  async function openGraph() {
    if (!state.open) return;
    state.graphOpen = true;
    body.classList.add("kg-open");
    graphModal.classList.add("open");
    graphModal.setAttribute("aria-hidden", "false");
    kgScrim.classList.add("open");
    if (!state.graph && !state.graphLoading) {
      state.graphLoading = true;
      kgLoading.classList.add("show");
      try {
        const response = await fetch("/data/knowledge-graph.json", {
          cache: "no-cache",
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        state.graph = await response.json();
        buildGraph(state.graph);
      } catch (error) {
        kgDetail.innerHTML = `<span class="kg-detail-kicker">GRAPH ERROR</span><h4>图谱暂时加载失败</h4><p>${escapeHtml(error.message || "请稍后再试。")}</p>`;
      } finally {
        state.graphLoading = false;
        kgLoading.classList.remove("show");
      }
    } else if (state.graph) {
      requestAnimationFrame(() => resetGraphView());
    }
  }

  function closeGraph() {
    state.graphOpen = false;
    body.classList.remove("kg-open");
    graphModal.classList.remove("open");
    graphModal.setAttribute("aria-hidden", "true");
    kgScrim.classList.remove("open");
  }

  function nodeRadius(node) {
    if (node.type === "core") return 29;
    if (node.type === "hub") return 21;
    if (node.type === "lecture") return 12;
    return 8;
  }

  function buildGraph(data) {
    const W = 1100;
    const H = 720;
    const cx = W / 2;
    const cy = H / 2;
    const nodes = data.nodes.map((node) => ({ ...node }));
    const byId = new Map(nodes.map((node) => [node.id, node]));
    const core = byId.get("core");
    const hubs = nodes.filter((node) => node.type === "hub");
    const partOrder = hubs.map((hub) => hub.part);
    core.x = cx;
    core.y = cy;
    core.fixed = true;

    hubs.forEach((hub, index) => {
      const angle = -Math.PI / 2 + (index * Math.PI * 2) / hubs.length;
      hub.x = cx + Math.cos(angle) * 185;
      hub.y = cy + Math.sin(angle) * 185;
      hub.angle = angle;
      hub.fixed = true;

      const lectures = nodes.filter(
        (node) => node.type === "lecture" && node.part === hub.part
      );
      const concepts = nodes.filter(
        (node) => node.type === "concept" && node.part === hub.part
      );
      lectures.forEach((node, i) => {
        const spread = 0.62;
        const a =
          angle +
          (i - (lectures.length - 1) / 2) *
            (spread / Math.max(1, lectures.length - 1));
        node.x = cx + Math.cos(a) * (300 + (i % 2) * 14);
        node.y = cy + Math.sin(a) * (300 + (i % 2) * 14);
      });
      concepts.forEach((node, i) => {
        const spread = 0.48;
        const a =
          angle +
          (i - (concepts.length - 1) / 2) *
            (spread / Math.max(1, concepts.length - 1));
        node.x = cx + Math.cos(a) * (205 + (i % 2) * 12);
        node.y = cy + Math.sin(a) * (205 + (i % 2) * 12);
      });
    });

    // Pull related nodes together, but keep hubs/core fixed so each part stays
    // in its own visual sector instead of collapsing into a hairball.
    const links = data.edges
      .map((edge) => ({
        ...edge,
        sourceNode: byId.get(edge.source),
        targetNode: byId.get(edge.target),
      }))
      .filter((edge) => edge.sourceNode && edge.targetNode);

    for (const node of nodes) {
      node.vx = 0;
      node.vy = 0;
    }

    const linkLength = {
      core: 220,
      contains: 122,
      focus: 94,
      explains: 84,
      related: 120,
      next: 105,
    };
    const linkStrength = {
      core: 0.03,
      contains: 0.025,
      focus: 0.035,
      explains: 0.025,
      related: 0.018,
      next: 0.012,
    };

    for (let step = 0; step < 170; step += 1) {
      for (let i = 0; i < nodes.length; i += 1) {
        for (let j = i + 1; j < nodes.length; j += 1) {
          const a = nodes[i];
          const b = nodes[j];
          let dx = b.x - a.x;
          let dy = b.y - a.y;
          const distance = Math.max(20, Math.hypot(dx, dy));
          const force = 3600 / (distance * distance);
          dx /= distance;
          dy /= distance;
          a.vx -= dx * force;
          a.vy -= dy * force;
          b.vx += dx * force;
          b.vy += dy * force;
        }
      }
      for (const link of links) {
        const a = link.sourceNode;
        const b = link.targetNode;
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        const distance = Math.max(1, Math.hypot(dx, dy));
        const desired = linkLength[link.type] || 100;
        const force =
          (distance - desired) * (linkStrength[link.type] || 0.02) * 0.12;
        dx /= distance;
        dy /= distance;
        a.vx += dx * force;
        a.vy += dy * force;
        b.vx -= dx * force;
        b.vy -= dy * force;
      }
      for (const node of nodes) {
        if (node.fixed) {
          node.x = node.id === "core" ? cx : node.x;
          node.y = node.id === "core" ? cy : node.y;
          node.vx = 0;
          node.vy = 0;
          continue;
        }
        node.vx += (cx - node.x) * 0.0008;
        node.vy += (cy - node.y) * 0.0008;
        node.vx *= 0.72;
        node.vy *= 0.72;
        node.x = Math.max(54, Math.min(W - 54, node.x + node.vx));
        node.y = Math.max(54, Math.min(H - 54, node.y + node.vy));
      }
    }

    // A few collision passes make the concept labels readable.
    for (let pass = 0; pass < 4; pass += 1) {
      for (let i = 0; i < nodes.length; i += 1) {
        for (let j = i + 1; j < nodes.length; j += 1) {
          const a = nodes[i];
          const b = nodes[j];
          let dx = b.x - a.x;
          let dy = b.y - a.y;
          let distance = Math.hypot(dx, dy);
          const minimum = nodeRadius(a) + nodeRadius(b) + 13;
          if (distance >= minimum || distance === 0) continue;
          dx /= distance;
          dy /= distance;
          const push = (minimum - distance) / 2;
          if (!a.fixed) {
            a.x -= dx * push;
            a.y -= dy * push;
          }
          if (!b.fixed) {
            b.x += dx * push;
            b.y += dy * push;
          }
        }
      }
    }

    renderGraphSvg(nodes, links, partOrder);
  }

  function renderGraphSvg(nodes, links, partOrder) {
    const ns = "http://www.w3.org/2000/svg";
    kgSvg.innerHTML = "";
    const viewport = document.createElementNS(ns, "g");
    viewport.setAttribute("class", "kg-viewport");
    kgSvg.appendChild(viewport);
    state.kgViewport = viewport;
    state.kgNodes = nodes;
    state.kgLinks = links;
    state.kgNodeEls = new Map();
    state.kgLinkEls = [];

    for (const link of links) {
      const line = document.createElementNS(ns, "line");
      line.setAttribute("x1", link.sourceNode.x);
      line.setAttribute("y1", link.sourceNode.y);
      line.setAttribute("x2", link.targetNode.x);
      line.setAttribute("y2", link.targetNode.y);
      line.setAttribute("class", `kg-edge kg-edge--${link.type}`);
      line.dataset.source = link.source;
      line.dataset.target = link.target;
      viewport.appendChild(line);
      state.kgLinkEls.push(line);
    }

    for (const node of nodes) {
      const group = document.createElementNS(ns, "g");
      group.setAttribute("class", `kg-node kg-node--${node.type} kg-part-${node.part}`);
      group.setAttribute("transform", `translate(${node.x} ${node.y})`);
      group.dataset.id = node.id;
      group.dataset.part = node.part;
      group.setAttribute("tabindex", "0");
      group.setAttribute("role", "button");
      group.setAttribute("aria-label", node.title || node.label);
      const circle = document.createElementNS(ns, "circle");
      circle.setAttribute("r", String(nodeRadius(node)));
      group.appendChild(circle);
      if (node.type === "lecture") {
        const text = document.createElementNS(ns, "text");
        text.setAttribute("class", "kg-node-number");
        text.textContent = node.label;
        group.appendChild(text);
      } else {
        const text = document.createElementNS(ns, "text");
        text.setAttribute("class", "kg-node-label");
        text.setAttribute("x", "0");
        text.setAttribute("y", String(nodeRadius(node) + 12));
        text.textContent = node.label;
        group.appendChild(text);
      }
      const title = document.createElementNS(ns, "title");
      title.textContent = node.title
        ? `第${node.label}讲 · ${node.title}`
        : node.label;
      group.appendChild(title);
      group.addEventListener("click", () => selectGraphNode(node));
      group.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          selectGraphNode(node);
        }
      });
      viewport.appendChild(group);
      state.kgNodeEls.set(node.id, group);
    }

    const hubByPart = new Map(
      nodes.filter((node) => node.type === "hub").map((node) => [node.part, node])
    );
    kgLegend.innerHTML =
      `<button class="kg-legend-item is-active" type="button" data-kg-part="all"><i class="kg-dot kg-dot--all"></i>全部</button>` +
      partOrder
        .map((part) => {
          const hub = hubByPart.get(part);
          return `<button class="kg-legend-item" type="button" data-kg-part="${part}"><i class="kg-dot kg-part-${part}"></i>${escapeHtml(hub ? hub.label : part)}</button>`;
        })
        .join("");
    kgLegend.querySelectorAll("[data-kg-part]").forEach((button) => {
      button.addEventListener("click", () => {
        state.kgPart = button.dataset.kgPart;
        kgLegend
          .querySelectorAll(".kg-legend-item")
          .forEach((item) => item.classList.toggle("is-active", item === button));
        applyGraphFilter();
      });
    });

    state.kgPart = "all";
    applyGraphFilter();
    resetGraphView();
    selectGraphNode(nodes.find((node) => node.id === "core"));
  }

  function applyGraphFilter() {
    const part = state.kgPart;
    if (!state.kgNodeEls) return;
    state.kgNodes.forEach((node) => {
      const visible =
        part === "all" || node.part === part || node.type === "core";
      state.kgNodeEls.get(node.id)?.classList.toggle("is-dim", !visible);
    });
    state.kgLinks.forEach((link) => {
      const source = state.kgNodes.find((node) => node.id === link.source);
      const target = state.kgNodes.find((node) => node.id === link.target);
      const visible =
        part === "all" ||
        (source && (source.part === part || source.type === "core")) ||
        (target && (target.part === part || target.type === "core"));
      const el = state.kgLinkEls.find(
        (line) =>
          line.dataset.source === link.source &&
          line.dataset.target === link.target
      );
      el?.classList.toggle("is-dim", !visible);
    });
  }

  function selectGraphNode(node) {
    if (!node) return;
    state.kgNodeEls?.forEach((element, id) =>
      element.classList.toggle("is-active", id === node.id)
    );
    kgDetail.innerHTML = "";
    const kicker = document.createElement("span");
    kicker.className = "kg-detail-kicker";
    kicker.textContent =
      node.type === "concept"
        ? "CONCEPT"
        : node.type === "lecture"
          ? "LECTURE"
          : node.type === "hub"
            ? "PART"
            : "COURSE";
    const title = document.createElement("h4");
    title.textContent =
      node.type === "lecture" ? `第${node.label}讲 · ${node.title}` : node.label;
    const desc = document.createElement("p");
    desc.textContent = node.desc || "";
    kgDetail.append(kicker, title, desc);

    const lectureNums = node.lectures || [];
    if (lectureNums.length) {
      const label = document.createElement("span");
      label.className = "kg-detail-label";
      label.textContent = node.type === "lecture" ? "直接打开" : "关联讲次";
      kgDetail.appendChild(label);
      const list = document.createElement("div");
      list.className = "kg-detail-links";
      lectureNums.slice(0, 8).forEach((num) => {
        const lecture = state.graph.nodes.find(
          (item) => item.id === `L${num}`
        );
        if (!lecture) return;
        const link = document.createElement("a");
        link.href = lecture.href;
        link.textContent = `第${num}讲 · ${lecture.title}`;
        list.appendChild(link);
      });
      kgDetail.appendChild(list);
    }

    if (node.type === "concept" && node.related?.length) {
      const label = document.createElement("span");
      label.className = "kg-detail-label";
      label.textContent = "相关概念";
      const related = document.createElement("div");
      related.className = "kg-related";
      node.related.forEach((id) => {
        const item = state.graph.nodes.find((entry) => entry.id === id);
        if (!item) return;
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = item.label;
        button.addEventListener("click", () => selectGraphNode(item));
        related.appendChild(button);
      });
      kgDetail.append(label, related);
    }
  }

  function applyGraphView() {
    if (!state.kgViewport) return;
    const { x, y, scale } = state.kgView;
    state.kgViewport.setAttribute(
      "transform",
      `translate(${x} ${y}) scale(${scale})`
    );
  }

  function resetGraphView() {
    state.kgView = { x: 0, y: 0, scale: 1 };
    applyGraphView();
  }

  function zoomGraph(factor) {
    const next = Math.max(0.6, Math.min(2.4, state.kgView.scale * factor));
    state.kgView.scale = next;
    applyGraphView();
  }

  function openGraphFromButton() {
    if (!state.open) return;
    openGraph();
  }

  /* Sending ---------------------------------------------------------- */
  async function send(rawText) {
    const content = String(rawText || "").trim();
    if (!content || state.busy) return;
    if (messagesEl.querySelector(".chat-welcome")) messagesEl.innerHTML = "";
    setBusy(true);
    input.value = "";
    input.style.height = "auto";
    appendMessage("user", content);
    state.history.push({ role: "user", content });

    const typing = appendMessage("assistant", "");
    typing.bubble.innerHTML =
      '<span class="chat-typing"><i></i><i></i><i></i></span>';

    const context = isChapter
      ? {
          chapter,
          lectureTitle: chapterTitle,
          section: currentSection(),
          selection: currentSelection(),
        }
      : {};

    let assistantText = "";
    let citations = [];

    try {
      const response = await fetch("/api/chat/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: state.history.slice(-10),
          context,
          depth: state.depth,
        }),
      });

      if (!response.ok) throw new Error(await readError(response));
      if (!response.body) throw new Error("浏览器不支持流式响应。");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() || "";
        for (const event of events) {
          for (const line of event.split("\n")) {
            if (!line.startsWith("data:")) continue;
            const data = line.slice(5).trim();
            if (!data) continue;
            let payload;
            try {
              payload = JSON.parse(data);
            } catch (_) {
              continue;
            }
            if (payload.type === "meta") {
              citations = payload.citations || [];
              setMode(payload.mode === "demo" ? "demo" : "model");
              renderEvidence(citations);
              if (citations.length && window.innerWidth > 900) {
                openEvidence();
              }
            } else if (payload.type === "delta") {
              assistantText += payload.content || "";
              const stick =
                messagesEl.scrollHeight -
                  messagesEl.scrollTop -
                  messagesEl.clientHeight <
                120;
              typing.bubble.innerHTML = renderMarkdown(assistantText);
              if (stick) scrollToBottom();
            } else if (payload.type === "error") {
              throw new Error(payload.message || "回答中断了。");
            }
          }
        }
      }

      if (!assistantText.trim()) {
        assistantText = "这次没有收到回答，请再试一次。";
      }
      typing.bubble.innerHTML = renderMarkdown(assistantText);
      addCitations(typing.stack, citations);
      state.history.push({ role: "assistant", content: assistantText });
    } catch (error) {
      typing.bubble.textContent =
        error && error.message
          ? `暂时无法回答：${error.message}`
          : "暂时无法回答，请稍后再试。";
      typing.bubble.classList.add("chat-error");
    } finally {
      setBusy(false);
      if (typing.bubble.classList.contains("chat-error")) {
        scrollToBottom();
      } else if (assistantText.length > 260) {
        scrollMessageStart(typing.row);
      } else {
        scrollToBottom();
      }
    }
  }

  /* Wiring ----------------------------------------------------------- */
  fab.addEventListener("click", openChat);
  root.querySelectorAll("[data-chat-close]").forEach((button) => {
    button.addEventListener("click", closeChat);
  });
  resetBtn.addEventListener("click", resetChat);
  depthButtons.forEach((button) => {
    button.addEventListener("click", () => setDepth(button.dataset.depth));
  });
  evidenceToggle?.addEventListener("click", () => {
    if (state.evidenceOpen) closeEvidence();
    else openEvidence();
  });
  root.querySelector("[data-evidence-close]")?.addEventListener("click", closeEvidence);
  root.querySelector("[data-graph-toggle]")?.addEventListener("click", openGraphFromButton);
  root.querySelectorAll("[data-graph-close]").forEach((button) => {
    button.addEventListener("click", closeGraph);
  });
  kgScrim.addEventListener("click", closeGraph);
  kgSvg.addEventListener(
    "wheel",
    (event) => {
      event.preventDefault();
      zoomGraph(event.deltaY < 0 ? 1.1 : 0.9);
    },
    { passive: false }
  );
  root.querySelectorAll("[data-kg-zoom]").forEach((button) => {
    button.addEventListener("click", () => {
      const action = button.dataset.kgZoom;
      if (action === "reset") resetGraphView();
      else zoomGraph(action === "in" ? 1.16 : 0.86);
    });
  });

  // Simple pan for the graph canvas.
  let drag = null;
  kgSvg.addEventListener("pointerdown", (event) => {
    if (event.target.closest(".kg-node")) return;
    drag = { x: event.clientX, y: event.clientY, vx: state.kgView.x, vy: state.kgView.y };
    kgSvg.classList.add("is-panning");
    kgSvg.setPointerCapture?.(event.pointerId);
  });
  kgSvg.addEventListener("pointermove", (event) => {
    if (!drag) return;
    state.kgView.x = drag.vx + (event.clientX - drag.x);
    state.kgView.y = drag.vy + (event.clientY - drag.y);
    applyGraphView();
  });
  kgSvg.addEventListener("pointerup", () => {
    drag = null;
    kgSvg.classList.remove("is-panning");
  });
  kgSvg.addEventListener("pointercancel", () => {
    drag = null;
    kgSvg.classList.remove("is-panning");
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    send(input.value);
  });
  input.addEventListener("input", () => {
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, 102)}px`;
  });
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      send(input.value);
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (state.graphOpen) {
      closeGraph();
      return;
    }
    if (state.evidenceOpen) {
      closeEvidence();
      return;
    }
    if (state.open) closeChat();
  });

  setDepth(state.depth);
  renderEvidence([]);
  showWelcome();
})();
