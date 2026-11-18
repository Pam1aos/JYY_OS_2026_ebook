/* JYY OS 2026 — course assistant widget */
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
  };

  const icons = {
    spark:
      '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M10 2.6c.55 3.3 2.1 4.85 5.4 5.4-3.3.55-4.85 2.1-5.4 5.4-.55-3.3-2.1-4.85-5.4-5.4 3.3-.55 4.85-2.1 5.4-5.4Z" fill="currentColor"/><path d="M15.8 13.1c.25 1.5.95 2.2 2.45 2.45-1.5.25-2.2.95-2.45 2.45-.25-1.5-.95-2.2-2.45-2.45 1.5-.25 2.2-.95 2.45-2.45Z" fill="currentColor"/></svg>',
    send:
      '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m2.2 7.6 11.1-4.4-4.4 11.1-2-4.7-4.7-2Z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="m6.9 9.2 3.1-3.1" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>',
    reset:
      '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3.2 8a4.8 4.8 0 1 0 1.45-3.44M3.2 3.4v3.2h3.2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  };

  const suggestions = isChapter
    ? [
        `用三句话总结第 ${chapter} 讲`,
        "这一讲最重要的三个概念是什么？",
        "帮我出 3 道复习题",
      ]
    : [
        "这门课应该怎么学？",
        "并发和并行的区别是什么？",
        "第 29 讲讲什么？",
      ];

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
        <div class="chat-head-copy"><h3>课程助教</h3><p>基于 30 讲课程原文回答</p></div>
        <span class="chat-mode" data-chat-mode>RAG</span>
        <button class="chat-reset" type="button" data-chat-reset aria-label="开始新对话">${icons.reset}</button>
        <button class="chat-close" type="button" data-chat-close aria-label="关闭课程助教">×</button>
      </header>
      <div class="chat-context"><b data-chat-context>全书 · 30 讲课程</b></div>
      <div class="chat-messages" data-chat-messages aria-live="polite"></div>
      <form class="chat-form" data-chat-form>
        <textarea class="chat-input" data-chat-input rows="1" maxlength="2000" placeholder="问一个课程问题…" aria-label="输入问题"></textarea>
        <button class="chat-send" data-chat-send type="submit" aria-label="发送问题">${icons.send}</button>
      </form>
      <p class="chat-footnote">回答基于课程原文，可能有误差，请以原课为准。</p>
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
    contextEl.textContent = `第 ${chapter} 讲${chapterTitle ? ` · ${chapterTitle}` : ""}${
      section ? ` / ${section}` : ""
    }`;
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
      const paragraphs = block.split(/\n{2,}/);
      for (const paragraph of paragraphs) {
        if (!paragraph.trim()) continue;
        html.push(
          `<p>${inlineMarkdown(paragraph).replace(/\n/g, "<br>")}</p>`
        );
      }
    }
    return html.join("");
  }

  function scrollToBottom() {
    messagesEl.scrollTop = messagesEl.scrollHeight;
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
    citations.slice(0, 5).forEach((citation) => {
      const link = document.createElement("a");
      link.className = "chat-citation";
      link.href = citation.url;
      link.target = "_blank";
      link.rel = "noopener";
      link.title = `第${citation.lecture}讲 · ${citation.lectureTitle} / ${citation.section}`;
      const number = document.createElement("b");
      number.textContent = `[${citation.n}]`;
      link.appendChild(number);
      const label = document.createElement("span");
      label.textContent = `第${citation.lecture}讲 · ${citation.section}`;
      link.appendChild(label);
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

  function resetChat() {
    state.history = [];
    setMode("model");
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
    let finished = false;

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: state.history.slice(-10),
          context,
        }),
      });

      if (!response.ok) {
        throw new Error(await readError(response));
      }
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
            } else if (payload.type === "delta") {
              assistantText += payload.content || "";
              typing.bubble.innerHTML = renderMarkdown(assistantText);
              scrollToBottom();
            } else if (payload.type === "error") {
              throw new Error(payload.message || "回答中断了。");
            } else if (payload.type === "done") {
              finished = true;
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
      if (!finished) setMode(state.mode);
    } catch (error) {
      typing.bubble.textContent =
        error && error.message
          ? `暂时无法回答：${error.message}`
          : "暂时无法回答，请稍后再试。";
      typing.bubble.classList.add("chat-error");
    } finally {
      setBusy(false);
      scrollToBottom();
    }
  }

  fab.addEventListener("click", openChat);
  root.querySelectorAll("[data-chat-close]").forEach((button) => {
    button.addEventListener("click", closeChat);
  });
  resetBtn.addEventListener("click", resetChat);
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
    if (event.key === "Escape" && state.open) closeChat();
  });

  showWelcome();
})();
