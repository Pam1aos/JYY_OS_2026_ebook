/* JYY OS 2026 — full-page RAG workspace */
(() => {
  "use strict";

  const shell = document.querySelector(".rag-shell");
  if (!shell) return;

  const $ = (selector, context = document) => context.querySelector(selector);
  const $$ = (selector, context = document) => Array.from(context.querySelectorAll(selector));

  const state = {
    scope: "all",
    scopeTitle: "全部 30 讲",
    depth: "deep",
    messages: [],
    citations: [],
    busy: false,
  };

  const messagesEl = $("#ragMessages");
  const input = $("#ragInput");
  const form = $("#ragForm");
  const sendBtn = $("#ragSend");
  const scopeLabel = $("#ragScopeLabel");
  const evidenceList = $("#ragEvidenceList");
  const evidenceSummary = $("#ragEvidenceSummary");
  const statusEl = $(".rag-status");
  const header = $("#ragHeader");
  const navToggle = $("#ragNavToggle");
  const scrim = $("#ragScrim");

  const icons = {
    spark:
      '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M10 2.6c.55 3.3 2.1 4.85 5.4 5.4-3.3.55-4.85 2.1-5.4 5.4-.55-3.3-2.1-4.85-5.4-5.4 3.3-.55 4.85-2.1 5.4-5.4Z" fill="currentColor"/><path d="M15.8 13.1c.25 1.5.95 2.2 2.45 2.45-1.5.25-2.2.95-2.45 2.45-.25-1.5-.95-2.2-2.45-2.45 1.5-.25 2.2-.95 2.45-2.45Z" fill="currentColor"/></svg>',
  };

  function escapeHtml(value) {
    return String(value)
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

  function renderMarkdown(raw) {
    const escaped = escapeHtml(raw);
    const blocks = escaped.split(/(```[\s\S]*?```)/g);
    const html = [];
    for (const block of blocks) {
      if (!block) continue;
      if (block.startsWith("```")) {
        const code = block.replace(/^```[^\n]*\n?/, "").replace(/```$/, "");
        html.push(`<pre><code>${code.replace(/\n$/, "")}</code></pre>`);
      } else {
        html.push(renderTextBlock(block));
      }
    }
    return html.join("");
  }

  function setBusy(value) {
    state.busy = value;
    input.disabled = value;
    sendBtn.disabled = value;
    if (!value) input.focus();
  }

  function scrollBottom() {
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

  function setMode(mode) {
    if (!statusEl) return;
    if (mode === "demo") {
      statusEl.innerHTML = '<i style="background:#d9a459"></i> 检索演示模式';
    } else {
      statusEl.innerHTML = '<i></i> 知识库已连接';
    }
  }

  function renderWelcome() {
    const scoped = state.scope !== "all";
    const suggestions = scoped
      ? [
          `用三句话总结第 ${state.scope} 讲`,
          "这一讲最重要的三个概念是什么？",
          "帮我出 3 道这一讲的复习题",
          "这一讲和前后内容有什么联系？",
        ]
      : [
          "用三句话总结第 14 讲：互斥",
          "互斥锁和信号量到底有什么区别？",
          "第 29 讲讲的三条虚拟化路线是什么？",
          "帮我出 5 道操作系统期末复习题",
        ];
    messagesEl.innerHTML = `<div class="rag-welcome">
      <span class="rag-welcome-icon">${icons.spark}</span>
      <span class="eyebrow plain">START A DIALOGUE</span>
      <h3>${scoped ? `正在阅读第 ${state.scope} 讲的知识切片。` : "从 30 讲里，找到真正有出处的答案。"}</h3>
      <p>我会先检索原文，再结合上下文回答。每一条关键结论都会附上可跳转的课程出处。</p>
      <div class="rag-suggestions">${suggestions
        .map(
          (suggestion) =>
            `<button class="rag-suggestion" type="button">${suggestion}</button>`
        )
        .join("")}</div>
      <div class="rag-pipeline"><span>检索</span><i>→</i><span>阅读</span><i>→</i><span>回答</span><i>→</i><span>引用</span></div>
    </div>`;
    $$(".rag-suggestion", messagesEl).forEach((button) => {
      button.addEventListener("click", () => send(button.textContent));
    });
  }

  function addMessage(role, text) {
    const row = document.createElement("div");
    row.className = `rag-row ${role}`;
    if (role === "assistant") {
      const avatar = document.createElement("span");
      avatar.className = "rag-avatar";
      avatar.textContent = "J";
      row.appendChild(avatar);
    }
    const stack = document.createElement("div");
    stack.className = "rag-stack";
    const bubble = document.createElement("div");
    bubble.className = "rag-bubble";
    if (role === "assistant") bubble.innerHTML = renderMarkdown(text);
    else bubble.textContent = text;
    stack.appendChild(bubble);
    row.appendChild(stack);
    messagesEl.appendChild(row);
    scrollBottom();
    return { row, stack, bubble };
  }

  function addCitations(stack, citations) {
    if (!citations || !citations.length) return;
    const wrap = document.createElement("div");
    wrap.className = "rag-cites";
    citations.forEach((citation) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "rag-cite";
      button.dataset.n = String(citation.n);
      button.title = `第${citation.lecture}讲 · ${citation.lectureTitle} / ${citation.section}`;
      const number = document.createElement("b");
      number.textContent = `[${citation.n}]`;
      button.appendChild(number);
      const label = document.createElement("span");
      label.textContent = `第${citation.lecture}讲 · ${citation.section}`;
      button.appendChild(label);
      button.addEventListener("click", () => activateCitation(citation.n));
      wrap.appendChild(button);
    });
    stack.appendChild(wrap);
  }

  function evidenceScopeLabel(citations) {
    const unique = [];
    const seen = new Set();
    for (const citation of citations) {
      const key = `${citation.lecture}:${citation.lectureTitle}`;
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(citation);
    }
    if (unique.length === 1) {
      return `第${unique[0].lecture}讲 · ${unique[0].lectureTitle}`;
    }
    return `${unique.length} 讲范围`;
  }

  function renderEvidence(citations) {
    state.citations = citations || [];
    evidenceList.innerHTML = "";
    if (!state.citations.length) {
      evidenceList.innerHTML = `<div class="rag-evidence-empty">${icons.spark}<strong>还没有检索结果</strong><p>提问后，命中的课程原文会出现在这里。</p></div>`;
      evidenceSummary.textContent = "检索到的片段会显示在这里。";
      return;
    }
    evidenceSummary.textContent = `检索到 ${state.citations.length} 段原文 · ${evidenceScopeLabel(state.citations)} · ${depthLabel(state.depth)}模式`;
    state.citations.forEach((citation) => {
      const card = document.createElement("article");
      card.className = "rag-evidence-card";
      card.dataset.n = String(citation.n);
      const head = document.createElement("header");
      const number = document.createElement("b");
      number.textContent = `[${citation.n}]`;
      head.appendChild(number);
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
      link.textContent = "在原文中查看 ↗";
      card.append(head, title, excerpt, link);
      card.addEventListener("click", () => setActiveCitation(citation.n));
      evidenceList.appendChild(card);
    });
  }

  function setActiveCitation(n) {
    $$(".rag-evidence-card", evidenceList).forEach((card) => {
      card.classList.toggle("is-active", card.dataset.n === String(n));
    });
    $$(".rag-cite", messagesEl).forEach((chip) => {
      chip.classList.toggle("is-active", chip.dataset.n === String(n));
    });
    const active = $(`.rag-evidence-card[data-n="${n}"]`, evidenceList);
    if (active) active.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  function activateCitation(n) {
    if (window.matchMedia("(max-width: 1280px)").matches) openPanel("evidence");
    setActiveCitation(n);
    const active = $(`.rag-evidence-card[data-n="${n}"]`, evidenceList);
    if (active) {
      window.setTimeout(
        () => active.scrollIntoView({ block: "center", behavior: "smooth" }),
        250
      );
    }
  }

  function depthLabel(depth) {
    return depth === "deep" ? "深入" : depth === "brief" ? "精简" : "标准";
  }

  function updateScopeLabel() {
    if (!scopeLabel) return;
    scopeLabel.textContent =
      state.scope === "all" ? "全部 30 讲" : `第 ${state.scope} 讲 · ${state.scopeTitle}`;
  }

  function updateEvidenceSummary() {
    if (!state.citations.length) return;
    evidenceSummary.textContent = `检索到 ${state.citations.length} 段原文 · ${evidenceScopeLabel(state.citations)} · ${depthLabel(state.depth)}模式`;
  }

  function openPanel(name) {
    document.body.classList.toggle(`rag-${name}-open`, true);
    if (name === "library") document.body.classList.remove("rag-evidence-open");
    if (name === "evidence") document.body.classList.remove("rag-library-open");
  }

  function closePanels() {
    document.body.classList.remove("rag-library-open", "rag-evidence-open");
  }

  function selectScope(scope, title) {
    state.scope = scope;
    state.scopeTitle = scope === "all" ? "全部 30 讲" : title;
    $$(".rag-scope").forEach((button) =>
      button.classList.toggle("is-active", scope === "all")
    );
    $$(".rag-source").forEach((button) =>
      button.classList.toggle("is-active", button.dataset.lecture === scope)
    );
    updateScopeLabel();
    if (messagesEl.querySelector(".rag-welcome")) renderWelcome();
    closePanels();
  }

  function setDepth(depth) {
    state.depth = depth;
    $$(".rag-depth button").forEach((button) =>
      button.classList.toggle("is-active", button.dataset.depth === depth)
    );
  }

  async function readError(response) {
    try {
      const data = await response.json();
      return data.error || `请求失败（${response.status}）`;
    } catch (_) {
      return `请求失败（${response.status}）`;
    }
  }

  async function send(rawText) {
    const content = String(rawText || "").trim();
    if (!content || state.busy) return;
    if ($(".rag-welcome", messagesEl)) messagesEl.innerHTML = "";
    setBusy(true);
    input.value = "";
    input.style.height = "auto";
    addMessage("user", content);
    state.messages.push({ role: "user", content });

    const typing = addMessage("assistant", "");
    typing.bubble.innerHTML =
      '<span class="rag-typing"><i></i><i></i><i></i></span>';

    let answer = "";
    let citations = [];

    try {
      const response = await fetch("/api/chat/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: state.messages.slice(-10),
          scope: state.scope,
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
              setMode(payload.mode);
              renderEvidence(citations);
              updateEvidenceSummary();
            } else if (payload.type === "delta") {
              answer += payload.content || "";
              const stick =
                messagesEl.scrollHeight -
                  messagesEl.scrollTop -
                  messagesEl.clientHeight <
                120;
              typing.bubble.innerHTML = renderMarkdown(answer);
              if (stick) scrollBottom();
            } else if (payload.type === "error") {
              throw new Error(payload.message || "回答中断了。");
            }
          }
        }
      }

      if (!answer.trim()) answer = "这次没有收到回答，请再试一次。";
      typing.bubble.innerHTML = renderMarkdown(answer);
      addCitations(typing.stack, citations);
      const meta = document.createElement("div");
      meta.className = "rag-answer-meta";
      meta.innerHTML = `<span class="live-dot"></span><span>检索 ${citations.length} 段原文 · ${depthLabel(state.depth)}模式</span>`;
      typing.stack.appendChild(meta);
      state.messages.push({ role: "assistant", content: answer });
    } catch (error) {
      typing.bubble.textContent =
        error && error.message
          ? `暂时无法回答：${error.message}`
          : "暂时无法回答，请稍后再试。";
      typing.bubble.classList.add("chat-error");
    } finally {
      setBusy(false);
      if (answer.length > 260) scrollMessageStart(typing.row);
      else scrollBottom();
    }
  }

  /* Library selection and filtering */
  $$(".rag-scope").forEach((button) => {
    button.addEventListener("click", () =>
      selectScope(button.dataset.scope || "all", "全部 30 讲")
    );
  });
  $$(".rag-source").forEach((button) => {
    button.addEventListener("click", () =>
      selectScope(
        button.dataset.lecture,
        button.querySelector(".rag-source-name")?.textContent || ""
      )
    );
  });
  const search = $("#ragLibrarySearch");
  if (search) {
    search.addEventListener("input", () => {
      const query = search.value.trim().toLowerCase();
      let visible = 0;
      $$(".rag-source").forEach((button) => {
        const show =
          !query ||
          (button.dataset.search || "").toLowerCase().includes(query) ||
          button.textContent.toLowerCase().includes(query);
        button.hidden = !show;
        if (show) visible += 1;
      });
      $$(".rag-lib-group").forEach((group) => {
        group.hidden = !$$(".rag-source:not([hidden])", group).length;
      });
      let empty = $(".rag-lib-empty", $("#ragLibraryList"));
      if (!visible && !empty) {
        empty = document.createElement("p");
        empty.className = "rag-lib-empty";
        empty.textContent = "没有匹配的讲次。";
        $("#ragLibraryList").appendChild(empty);
      } else if (visible && empty) {
        empty.remove();
      }
    });
    document.addEventListener("keydown", (event) => {
      if (
        event.key === "/" &&
        !/INPUT|TEXTAREA|SELECT/.test((event.target && event.target.tagName) || "")
      ) {
        event.preventDefault();
        search.focus();
      }
    });
  }

  $$(".rag-depth button").forEach((button) => {
    button.addEventListener("click", () => setDepth(button.dataset.depth));
  });

  $("#ragNewChat")?.addEventListener("click", () => {
    state.messages = [];
    state.citations = [];
    setMode("model");
    renderWelcome();
    renderEvidence([]);
    input.focus();
  });

  $("#ragLibraryToggle")?.addEventListener("click", () => openPanel("library"));
  $("#ragEvidenceToggle")?.addEventListener("click", () => openPanel("evidence"));
  $$("[data-close-panel]").forEach((button) => {
    button.addEventListener("click", closePanels);
  });
  scrim?.addEventListener("click", closePanels);

  form?.addEventListener("submit", (event) => {
    event.preventDefault();
    send(input.value);
  });
  input?.addEventListener("input", () => {
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, 120)}px`;
  });
  input?.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      send(input.value);
    }
  });

  navToggle?.addEventListener("click", () => {
    const open = header.classList.toggle("menu-open");
    navToggle.setAttribute("aria-expanded", String(open));
  });
  $$("#ragNavLinks a").forEach((link) => {
    link.addEventListener("click", () => {
      header.classList.remove("menu-open");
      navToggle?.setAttribute("aria-expanded", "false");
    });
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    closePanels();
    header?.classList.remove("menu-open");
    navToggle?.setAttribute("aria-expanded", "false");
  });

  renderWelcome();
  renderEvidence([]);
  updateScopeLabel();
  setDepth("deep");
})();
