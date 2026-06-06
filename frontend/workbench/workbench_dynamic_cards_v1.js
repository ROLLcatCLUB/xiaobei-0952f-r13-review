(function () {
  "use strict";

  const CARD_ORDER_ANCHOR = "[data-card=\"packageCheck\"]";
  const LAST_CANDIDATE_STORAGE_KEY = "xiaobei_workbench_last_candidate_v1";
  const LAST_CANDIDATE_BASE_KEY = "last_candidate";
  const CONTEXT_BASE_KEY = "context_state";
  let lastCandidate = null;
  let lastCandidateSessionId = "";

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function getGrid() {
    return document.getElementById("componentGrid");
  }

  function showExtraCards() {
    const grid = getGrid();
    if (grid) grid.classList.add("show-extra");
  }

  const RENDER_BLOCK_MARKER = "data-render-block-0952f-r7";
  const RENDER_BLOCK_TYPES = [
    "heading",
    "paragraph",
    "markdown",
    "list",
    "table",
    "evidence",
    "review_gate",
    "action_bar",
    "legacy_card",
    "card_grid",
    "debug"
  ];

  function asObject(value) {
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  }

  function asArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function appendText(parent, tagName, text, className) {
    const node = document.createElement(tagName);
    if (className) node.className = className;
    node.textContent = String(text == null ? "" : text);
    parent.appendChild(node);
    return node;
  }

  function safeBlockId(block, fallback) {
    const value = String(asObject(block).id || asObject(block).block_id || fallback || "").trim();
    return value.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80) || fallback || "render_block";
  }

  function markRenderBlock(node, block, type) {
    if (!node || typeof node.setAttribute !== "function") return node;
    node.setAttribute(RENDER_BLOCK_MARKER, "true");
    node.dataset.renderBlockType = type || asObject(block).type || "debug";
    node.dataset.renderBlockId = safeBlockId(block, `block_${Date.now()}`);
    return node;
  }

  function markdownRenderer() {
    const renderer = window.XIAOBEI_MESSAGE_RENDERER_V1;
    if (renderer && typeof renderer.renderMessage === "function") return renderer;
    return null;
  }

  function renderSafeMarkdown(parent, content, className) {
    const node = document.createElement("div");
    node.className = className || "wb-render-block-markdown";
    const renderer = markdownRenderer();
    if (renderer) {
      const result = renderer.renderMessage({
        role: "assistant",
        content_format: "safe_markdown",
        content: String(content == null ? "" : content)
      });
      node.dataset.contentFormat = result.content_format || "safe_markdown";
      node.innerHTML = String(result.html || "");
    } else {
      node.textContent = String(content == null ? "" : content);
      node.style.whiteSpace = "pre-wrap";
    }
    parent.appendChild(node);
    return node;
  }

  function baseBlockArticle(block, type, className) {
    const article = document.createElement("article");
    article.className = `component ${className || ""}`.trim();
    markRenderBlock(article, block, type);
    return article;
  }

  function blockTitle(block, fallback) {
    const source = asObject(block);
    return source.title || source.heading || source.label || fallback || "";
  }

  function renderHeadingBlock(block) {
    const source = asObject(block);
    const article = baseBlockArticle(block, "heading", "render-block-heading");
    const level = Math.min(Math.max(Number(source.level || 3), 2), 4);
    const heading = document.createElement(`h${level}`);
    heading.textContent = String(blockTitle(source, source.text || "工作区内容"));
    article.appendChild(heading);
    if (source.subtitle) appendText(article, "p", source.subtitle);
    return article;
  }

  function renderParagraphBlock(block) {
    const article = baseBlockArticle(block, "paragraph", "render-block-paragraph");
    appendText(article, "p", asObject(block).text || asObject(block).content || "");
    return article;
  }

  function renderMarkdownBlock(block) {
    const article = baseBlockArticle(block, "markdown", "render-block-markdown-card");
    if (blockTitle(block)) appendText(article, "h3", blockTitle(block));
    renderSafeMarkdown(article, asObject(block).markdown || asObject(block).content || asObject(block).text || "");
    return article;
  }

  function renderListBlock(block) {
    const source = asObject(block);
    const article = baseBlockArticle(block, "list", "render-block-list");
    if (blockTitle(source, "")) appendText(article, "h3", blockTitle(source));
    const list = document.createElement(source.ordered === true ? "ol" : "ul");
    asArray(source.items).forEach((item) => {
      const li = document.createElement("li");
      if (item && typeof item === "object") {
        appendText(li, "strong", item.title || item.label || item.key || "");
        if (item.text || item.value || item.summary) appendText(li, "span", item.text || item.value || item.summary);
      } else {
        li.textContent = String(item == null ? "" : item);
      }
      list.appendChild(li);
    });
    article.appendChild(list);
    return article;
  }

  function renderTableBlock(block) {
    const source = asObject(block);
    const article = baseBlockArticle(block, "table", "render-block-table");
    if (blockTitle(source, "")) appendText(article, "h3", blockTitle(source));
    const columns = asArray(source.columns).map((column) => String(column && typeof column === "object" ? (column.label || column.key || "") : column));
    const table = document.createElement("table");
    const thead = document.createElement("thead");
    const headRow = document.createElement("tr");
    columns.forEach((column) => appendText(headRow, "th", column));
    thead.appendChild(headRow);
    table.appendChild(thead);
    const tbody = document.createElement("tbody");
    asArray(source.rows).forEach((row) => {
      const tr = document.createElement("tr");
      if (Array.isArray(row)) {
        row.forEach((cell) => appendText(tr, "td", cell));
      } else {
        const rowObject = asObject(row);
        columns.forEach((column) => appendText(tr, "td", rowObject[column] || rowObject[column.toLowerCase()] || ""));
      }
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    article.appendChild(table);
    return article;
  }

  function renderEvidenceBlock(block) {
    const source = asObject(block);
    const article = baseBlockArticle(block, "evidence", "render-block-evidence");
    const head = document.createElement("div");
    head.className = "component-head";
    const wrap = document.createElement("div");
    appendText(wrap, "span", source.status || "证据", "pill blue");
    appendText(wrap, "h3", blockTitle(source, "证据区"));
    head.appendChild(wrap);
    article.appendChild(head);
    const list = document.createElement("div");
    list.className = "list";
    asArray(source.items || source.evidence).forEach((item) => {
      const row = document.createElement("div");
      row.className = "row";
      const body = document.createElement("div");
      appendText(body, "strong", asObject(item).title || asObject(item).label || "证据");
      appendText(body, "small", asObject(item).summary || asObject(item).text || item || "");
      row.appendChild(body);
      if (asObject(item).status) appendText(row, "span", asObject(item).status, "pill wait");
      list.appendChild(row);
    });
    article.appendChild(list);
    return article;
  }

  function renderReviewGateBlock(block) {
    const source = asObject(block);
    const article = baseBlockArticle(block, "review_gate", "render-block-review-gate");
    appendText(article, "h3", blockTitle(source, "教师确认闸门"));
    appendText(article, "p", source.message || "当前只读预览，进入成果包前仍需要老师确认。");
    const list = document.createElement("ul");
    [...asArray(source.blocking_reasons), ...asArray(source.warnings)].forEach((item) => appendText(list, "li", item));
    if (!list.children.length) appendText(list, "li", "未发现阻断项。");
    article.appendChild(list);
    return article;
  }

  function appendActionEvent(event) {
    const current = Array.isArray(window.XIAOBEI_RENDER_BLOCK_ACTION_EVENT_LOG_0952F_R7)
      ? window.XIAOBEI_RENDER_BLOCK_ACTION_EVENT_LOG_0952F_R7
      : [];
    current.push(event);
    window.XIAOBEI_RENDER_BLOCK_ACTION_EVENT_LOG_0952F_R7 = current.slice(-50);
    const runtime = window.XIAOBEI_AGENT_RUNTIME_CLIENT_V1;
    if (runtime && typeof runtime.applyStatePatch === "function") {
      runtime.applyStatePatch({ append_action_events: [event] }, { source: "0952F_R7_action_bar_dry_run" });
    }
    return event;
  }

  function renderActionBarBlock(block) {
    const source = asObject(block);
    const article = baseBlockArticle(block, "action_bar", "render-block-action-bar");
    if (blockTitle(source, "")) appendText(article, "h3", blockTitle(source));
    const actions = document.createElement("div");
    actions.className = "component-actions";
    asArray(source.actions).forEach((action, index) => {
      const item = asObject(action);
      const button = document.createElement("button");
      const style = index === 0 ? "primary" : index === 1 ? "ai" : "ghost";
      button.className = `btn ${item.style || style}`.trim();
      button.type = "button";
      button.textContent = String(item.label || item.action || item.action_id || "记录动作");
      button.addEventListener("click", () => {
        appendActionEvent({
          event_id: `render_block_action_${Date.now()}_${index}`,
          event_type: "render_block_action",
          source: "0952F_R7_action_bar_dry_run",
          block_id: safeBlockId(source, "action_bar"),
          action_id: String(item.action_id || item.action || `action_${index + 1}`),
          action: String(item.action || item.action_id || ""),
          label: String(item.label || ""),
          provider_called: false,
          memory_read: false,
          memory_write: false,
          feishu_write: false,
          formal_scoring: false,
          formal_export: false,
          endpoint_created: false,
          server_deploy: false,
          created_at: new Date().toISOString()
        });
      });
      actions.appendChild(button);
    });
    if (!actions.children.length) appendText(actions, "span", "无可记录动作", "pill off");
    article.appendChild(actions);
    return article;
  }

  function cardUpdateToLegacyBlock(update) {
    const source = asObject(update);
    return {
      type: "legacy_card",
      id: `legacy_${mapBackendCardId(source.card_id)}`,
      card_update: JSON.parse(JSON.stringify(source))
    };
  }

  function cardUpdatesToCardGridBlock(updates) {
    return {
      type: "card_grid",
      id: "legacy_card_updates_grid",
      title: "兼容卡片组",
      cards: asArray(updates).map(cardUpdateToLegacyBlock)
    };
  }

  function renderLegacyCardBlock(block) {
    const update = asObject(asObject(block).card_update || asObject(block).update || block);
    const article = baseBlockArticle(block, "legacy_card", "render-block-legacy-card");
    article.dataset.legacyCardId = mapBackendCardId(update.card_id);
    const head = document.createElement("div");
    head.className = "component-head";
    const wrap = document.createElement("div");
    appendText(wrap, "span", statusToTeacherLabel(update.status), "pill wait");
    appendText(wrap, "h3", update.teacher_title || update.title || "兼容卡片");
    head.appendChild(wrap);
    appendText(head, "span", "legacy_card", "pill");
    article.appendChild(head);
    appendText(article, "p", update.teacher_summary || update.summary || "旧 card_updates 已按 legacy_card 只读渲染。");
    if (update.candidate_text || update.content) {
      const box = document.createElement("div");
      box.className = "box candidate";
      appendText(box, "strong", "预览结果");
      appendText(box, "p", update.candidate_text || update.content);
      article.appendChild(box);
    }
    return article;
  }

  function renderCardGridBlock(block, context) {
    const source = asObject(block);
    const article = baseBlockArticle(block, "card_grid", "render-block-card-grid");
    appendText(article, "h3", blockTitle(source, "卡片组"));
    const cards = document.createElement("div");
    cards.className = "render-block-card-grid-inner";
    asArray(source.cards || source.items).forEach((card, index) => {
      cards.appendChild(renderBlock(asObject(card).type ? card : cardUpdateToLegacyBlock(card), { ...context, nested: true, index }));
    });
    article.appendChild(cards);
    return article;
  }

  function renderDebugBlock(block, message) {
    const article = baseBlockArticle(block, "debug", "render-block-debug");
    appendText(article, "h3", "调试信息");
    appendText(article, "p", message || asObject(block).message || asObject(block).text || "未知 block 已安全降级。");
    appendText(article, "small", `type=${String(asObject(block).type || "unknown")}`, "section-safe-note");
    return article;
  }

  const blockRendererRegistry = {
    heading: renderHeadingBlock,
    paragraph: renderParagraphBlock,
    markdown: renderMarkdownBlock,
    list: renderListBlock,
    table: renderTableBlock,
    evidence: renderEvidenceBlock,
    review_gate: renderReviewGateBlock,
    action_bar: renderActionBarBlock,
    legacy_card: renderLegacyCardBlock,
    card_grid: renderCardGridBlock,
    debug: renderDebugBlock
  };

  function renderBlock(block, context = {}) {
    const source = asObject(block);
    const type = RENDER_BLOCK_TYPES.includes(source.type) ? source.type : "debug";
    if (type === "debug") {
      const message = source.type === "debug"
        ? (source.message || context.message || "")
        : `未知 block.type=${String(source.type || "")}，已按 debug 只读显示。`;
      return renderDebugBlock(source, message);
    }
    const renderer = blockRendererRegistry[type] || renderDebugBlock;
    return renderer(source, context);
  }

  function normalizeRenderBlocksPayload(renderBlocksPayload) {
    if (Array.isArray(renderBlocksPayload)) return renderBlocksPayload;
    const source = asObject(renderBlocksPayload);
    if (Array.isArray(source.render_blocks)) return source.render_blocks;
    if (Array.isArray(source.blocks)) return source.blocks;
    if (Array.isArray(source.card_updates)) return [cardUpdatesToCardGridBlock(source.card_updates)];
    return [];
  }

  function renderBlocks(renderBlocksPayload, targetOrOptions) {
    const options = targetOrOptions && typeof targetOrOptions.appendChild === "function"
      ? { target: targetOrOptions }
      : asObject(targetOrOptions);
    const target = options.target || getGrid();
    if (!target) return { rendered: 0, reason: "component_grid_missing" };
    target.querySelectorAll(`[${RENDER_BLOCK_MARKER}]`).forEach((node) => node.remove());
    const blocks = normalizeRenderBlocksPayload(renderBlocksPayload);
    const fragment = document.createDocumentFragment();
    blocks.forEach((block, index) => fragment.appendChild(renderBlock(block, { ...options, index })));
    target.appendChild(fragment);
    return {
      rendered: blocks.length,
      block_types: blocks.map((block) => asObject(block).type || "debug"),
      provider_called: false,
      memory_read: false,
      memory_write: false,
      feishu_write: false,
      formal_scoring: false,
      formal_export: false,
      endpoint_created: false,
      server_deploy: false
    };
  }

  function readonlyRenderBlockSmokeFixture() {
    return {
      render_blocks: [
        { type: "heading", id: "r7_heading", level: 2, title: "0952F_R7 只读 block 渲染" },
        { type: "paragraph", id: "r7_paragraph", text: "这组内容只在浏览器 DOM 中渲染，不创建 endpoint，不调用 provider，不读写 memory。" },
        { type: "markdown", id: "r7_markdown", title: "安全 Markdown", content: "**可读预览**：raw HTML/script/style/iframe 不作为 Agent 字段直接渲染。" },
        { type: "list", id: "r7_list", title: "覆盖类型", items: ["heading", "paragraph", "list", "table", "evidence", "review_gate", "action_bar", "legacy_card", "card_grid", "debug"] },
        { type: "table", id: "r7_table", title: "只读验收表", columns: ["项目", "状态"], rows: [["can_render_card_updates", "保留"], ["can_render_blocks", "additive"], ["action_bar", "dry-run log"]] },
        { type: "evidence", id: "r7_evidence", title: "证据区", items: [{ title: "073E0/070D2", summary: "继承既有 block 与 safe markdown 合同。" }, { title: "0952F_R6", summary: "合同补桥，不升级真实 runtime。" }] },
        { type: "review_gate", id: "r7_review_gate", title: "教师确认闸门", warnings: ["本阶段仍是 readonly apply。"] },
        { type: "action_bar", id: "r7_action_bar", title: "只记录动作", actions: [{ action_id: "accept", label: "记录采用", action: "accept" }, { action_id: "refine", label: "记录精修", action: "refine" }, { action_id: "ask_followup", label: "记录追问", action: "ask_followup" }] },
        cardUpdateToLegacyBlock({ card_id: "activity_2_candidate", teacher_title: "legacy_card 兼容", status: "pending_review", teacher_summary: "旧 card_updates 可以映射成 legacy_card。", candidate_text: "这是只读兼容卡片。" }),
        cardUpdatesToCardGridBlock([
          { card_id: "task_sheet_candidate", teacher_title: "card_grid A", status: "pending_review", teacher_summary: "多卡兼容组 A" },
          { card_id: "resource_cards", teacher_title: "card_grid B", status: "pending_review", teacher_summary: "多卡兼容组 B" }
        ]),
        { type: "unknown_type", id: "r7_debug", message: "unknown block 会降级到 debug/warning。" }
      ]
    };
  }

  function runRenderBlockSmokeFixture(target) {
    return renderBlocks(readonlyRenderBlockSmokeFixture(), target || getGrid());
  }

  function focusCard(cardId, options = {}) {
    const shouldSync = options.sync !== false;
    if (shouldSync && window.XIAOBEI_FOCUS_WORKSPACE_V1 && typeof window.XIAOBEI_FOCUS_WORKSPACE_V1.setFocusTask === "function") {
      window.XIAOBEI_FOCUS_WORKSPACE_V1.setFocusTask(cardId);
    }
    if (shouldSync && typeof window.focusCard === "function") {
      window.focusCard(cardId);
      return;
    }
    const card = document.querySelector(`[data-card="${cardId}"]`);
    if (!card) return;
    if (card.classList.contains("collapsed-extra")) showExtraCards();
    card.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function cardUpdateFromCandidate(candidate, applied = false) {
    if (!candidate || typeof candidate !== "object") return null;
    const payload = candidate.card_update_payload && typeof candidate.card_update_payload === "object"
      ? JSON.parse(JSON.stringify(candidate.card_update_payload))
      : {};
    const topic = candidate.topic || "当前备课";
    const lessons = candidate.planned_lessons ? `${candidate.planned_lessons}课时` : "";
    const title = payload.teacher_title || (candidate.candidate_type === "unit_brief_candidate"
      ? `《${topic}》${lessons}大单元概要`
      : `《${topic}》预览`);
    payload.card_id = payload.card_id || candidate.candidate_type || "unit_brief_candidate";
    payload.teacher_title = title;
    payload.teacher_summary = payload.teacher_summary || (applied
      ? `已把《${topic}》结果放入本次备课预览，确认前不会进入最终成果包。`
      : `我读到了《${topic}》的预览结果，仍等待老师确认。`);
    payload.candidate_text = payload.candidate_text || candidate.candidate_text || "";
    payload.status = applied ? "preview" : (payload.status || "ready_for_teacher_review");
    payload.requires_teacher_acceptance = true;
    payload.locked_target = false;
    return payload;
  }

  function restoreLastCandidateCard(options = {}) {
    const candidate = getLastCandidate();
    if (!candidate) return null;
    const update = cardUpdateFromCandidate(candidate, options.applied === true);
    if (!update) return null;
    const mappedCardId = mapBackendCardId(update.card_id);
    if (mappedCardId !== "semesterSchedule") {
      ensureCard(mappedCardId, cardHtmlFromUpdate(update), { featured: false, focus: false });
    }
    if (window.XIAOBEI_FOCUS_WORKSPACE_V1 && typeof window.XIAOBEI_FOCUS_WORKSPACE_V1.syncFromUpdate === "function") {
      window.XIAOBEI_FOCUS_WORKSPACE_V1.syncFromUpdate(update);
    }
    focusCard(mappedCardId, { sync: false });
    return {
      candidate: JSON.parse(JSON.stringify(candidate)),
      update,
      card_id: mappedCardId
    };
  }

  function ensureCard(cardId, html, options = {}) {
    const grid = getGrid();
    if (!grid) return null;

    let card = grid.querySelector(`[data-card="${cardId}"]`);
    if (!card) {
      card = document.createElement("article");
      const anchor = grid.querySelector(CARD_ORDER_ANCHOR);
      if (anchor && anchor.nextSibling) {
        grid.insertBefore(card, anchor.nextSibling);
      } else {
        grid.appendChild(card);
      }
    }

    card.className = `component ${options.featured ? "featured" : ""}`.trim();
    if (options.collapsed) card.classList.add("collapsed-extra");
    card.dataset.card = cardId;
    card.innerHTML = html;

    if (options.focus !== false) {
      card.classList.add("focus-visible");
      requestAnimationFrame(() => focusCard(cardId));
    }
    if (window.XIAOBEI_FOCUS_WORKSPACE_V1 && typeof window.XIAOBEI_FOCUS_WORKSPACE_V1.syncFromCard === "function") {
      window.XIAOBEI_FOCUS_WORKSPACE_V1.syncFromCard(cardId);
    }
    return card;
  }

  function updateStatusLine(text) {
    const line = document.querySelector(".context-line");
    if (line && text) line.innerHTML = text;
  }

  function updateBrandContext(text) {
    const node = document.querySelector(".brand small");
    if (node && text) node.textContent = text;
  }

  function updateQuickPrompts(items) {
    const row = document.querySelector(".quick-prompt-row");
    if (!row || !Array.isArray(items) || !items.length) return;
    row.innerHTML = items.map(item => `<button class="quick-prompt" data-fill="${escapeHtml(item.fill || item.label || "")}">${escapeHtml(item.label || item.fill || "")}</button>`).join("");
  }

  function scopedStorage() {
    return window.XIAOBEI_WORKBENCH_SESSION_STORAGE_V1;
  }

  function activeSessionId() {
    const storage = scopedStorage();
    if (storage && typeof storage.getActiveWorkbenchSessionId === "function") return storage.getActiveWorkbenchSessionId();
    return "";
  }

  function safeSetJson(key, value) {
    const storage = scopedStorage();
    if (!storage || typeof storage.setJson !== "function") return;
    storage.setJson(key === LAST_CANDIDATE_STORAGE_KEY ? LAST_CANDIDATE_BASE_KEY : key, value || {});
  }

  function safeReadJson(key) {
    const storage = scopedStorage();
    if (!storage || typeof storage.getJson !== "function") return null;
    return storage.getJson(key === LAST_CANDIDATE_STORAGE_KEY ? LAST_CANDIDATE_BASE_KEY : key, null);
  }

  function safeRemoveJson(key) {
    const storage = scopedStorage();
    if (!storage || typeof storage.removeJson !== "function") return;
    storage.removeJson(key === LAST_CANDIDATE_STORAGE_KEY ? LAST_CANDIDATE_BASE_KEY : key);
  }

  function rememberContextFromCandidate(candidate) {
    if (!candidate || !candidate.topic) return;
    const previous = window.XIAOBEI_WORKBENCH_CONTEXT_STATE_V1 && typeof window.XIAOBEI_WORKBENCH_CONTEXT_STATE_V1 === "object"
      ? window.XIAOBEI_WORKBENCH_CONTEXT_STATE_V1
      : {};
    const state = {
      session_id: activeSessionId(),
      route_source: previous.route_source || "backend_runtime_router",
      canonical_route_context: previous.canonical_route_context || {},
      detected_context: {
        topic: candidate.topic || "",
        grade: candidate.grade || "",
        subject: candidate.subject || "美术",
        design_scope: candidate.design_scope || "unknown",
        planned_lessons: candidate.planned_lessons || null,
        current_topic_locked: true,
        context_intent: candidate.design_scope === "unit" ? "unit_brief_request" : "continue_current",
      },
      current_task: {
        title: candidate.topic || "当前备课",
        topic: candidate.topic || "",
        grade: candidate.grade || "",
        subject: candidate.subject || "美术",
        design_scope: candidate.design_scope || "unknown",
        planned_lessons: candidate.planned_lessons || null,
        current_topic_locked: true,
      },
      context_policy: "use_current_context",
      intent: "continue_current",
      updated_at: new Date().toISOString(),
    };
    window.XIAOBEI_WORKBENCH_CONTEXT_STATE_V1 = state;
    safeSetJson(CONTEXT_BASE_KEY, state);
  }

  function rememberLastCandidate(candidate) {
    if (!candidate || typeof candidate !== "object") return null;
    const sessionId = activeSessionId();
    lastCandidate = JSON.parse(JSON.stringify(candidate));
    lastCandidateSessionId = sessionId;
    window.XIAOBEI_WORKBENCH_LAST_CANDIDATE_V1 = lastCandidate;
    safeSetJson(LAST_CANDIDATE_STORAGE_KEY, lastCandidate);
    rememberContextFromCandidate(lastCandidate);
    return lastCandidate;
  }

  function hasCandidate(value) {
    return !!(value && typeof value === "object" && Object.keys(value).length && (value.candidate_type || value.topic || value.card_update_payload));
  }

  function candidateFromResponse(response) {
    if (!response || typeof response !== "object") return null;
    const nested = response.assistant_response && typeof response.assistant_response === "object" ? response.assistant_response : {};
    const runtimeState = response.runtime_state && typeof response.runtime_state === "object" ? response.runtime_state : {};
    const patchSet = response.state_patch && response.state_patch.set && typeof response.state_patch.set === "object" ? response.state_patch.set : {};
    const values = [
      response.last_candidate,
      response.pending_candidate,
      Array.isArray(response.candidate_updates) ? response.candidate_updates[0] : null,
      runtimeState.last_candidate,
      runtimeState.pending_candidate,
      patchSet.last_candidate,
      patchSet.pending_candidate,
      nested.last_candidate,
      nested.pending_candidate
    ];
    for (const value of values) {
      if (hasCandidate(value)) return JSON.parse(JSON.stringify(value));
    }
    return null;
  }

  function rememberCanonicalRouteContext(response) {
    const route = response && response.intent_route && typeof response.intent_route === "object" ? response.intent_route : {};
    const canonical = response && response.canonical_route_context && typeof response.canonical_route_context === "object"
      ? response.canonical_route_context
      : (route.canonical_route_context && typeof route.canonical_route_context === "object" ? route.canonical_route_context : null);
    if (!canonical) return;
    const updated = canonical.updated_context && typeof canonical.updated_context === "object" ? canonical.updated_context : {};
    const resolved = canonical.resolved_context && typeof canonical.resolved_context === "object" ? canonical.resolved_context : {};
    const entities = canonical.entities && typeof canonical.entities === "object" ? canonical.entities : {};
    const topic = updated.topic || resolved.raw_topic || resolved.topic || entities.topic || "";
    const state = {
      session_id: activeSessionId(),
      route_source: "backend_runtime_router",
      canonical_route_context: JSON.parse(JSON.stringify(canonical)),
      detected_context: {
        topic,
        grade: updated.grade || resolved.grade || entities.grade || "",
        subject: updated.subject || resolved.subject || entities.subject || "美术",
        lesson_no: updated.lesson_no || resolved.lesson_no || entities.lesson_no || "",
        design_scope: updated.design_scope || resolved.design_scope || entities.design_scope || "unknown",
        planned_lessons: updated.planned_lessons || resolved.planned_lessons || entities.planned_lessons || null,
        context_intent: canonical.intent_id || "",
        current_topic_locked: !!topic,
      },
      current_task: {
        title: topic || "当前备课",
        topic,
        grade: updated.grade || resolved.grade || entities.grade || "",
        subject: updated.subject || resolved.subject || entities.subject || "美术",
        design_scope: updated.design_scope || resolved.design_scope || entities.design_scope || "unknown",
        planned_lessons: updated.planned_lessons || resolved.planned_lessons || entities.planned_lessons || null,
        context_intent: canonical.intent_id || "",
        current_topic_locked: !!topic,
      },
      context_policy: canonical.context_policy || "",
      intent: canonical.intent_id || "",
      updated_at: new Date().toISOString(),
    };
    window.XIAOBEI_WORKBENCH_CONTEXT_STATE_V1 = state;
    safeSetJson(CONTEXT_BASE_KEY, state);
  }

  function getLastCandidate() {
    const sessionId = activeSessionId();
    if (lastCandidate && lastCandidateSessionId === sessionId) return JSON.parse(JSON.stringify(lastCandidate));
    const cached = window.XIAOBEI_WORKBENCH_LAST_CANDIDATE_V1;
    if (cached && typeof cached === "object" && lastCandidateSessionId === sessionId) return JSON.parse(JSON.stringify(cached));
    const stored = safeReadJson(LAST_CANDIDATE_STORAGE_KEY);
    if (stored && typeof stored === "object" && stored.candidate_type) {
      lastCandidate = stored;
      lastCandidateSessionId = sessionId;
      window.XIAOBEI_WORKBENCH_LAST_CANDIDATE_V1 = stored;
      return JSON.parse(JSON.stringify(stored));
    }
    return null;
  }

  function newLessonTasksCard(currentTask = {}) {
    const title = escapeHtml(currentTask.title || currentTask.topic || "新备课");
    return `
      <div class="component-head">
        <div><span class="pill wait">新课题</span><h3>${title}</h3></div>
        <span class="pill">结果待确认</span>
      </div>
      <div class="list compact-list">
        <div class="row"><div><strong>当前课题</strong><small>${title}</small></div><span class="pill wait">待生成</span></div>
        <div class="row"><div><strong>备课框架</strong><small>等待小备按新课题生成预览结果。</small></div><span class="pill wait">待确认</span></div>
        <div class="row"><div><strong>旧预览内容</strong><small>新备课已清空旧活动、旧任务单和旧资料预览。</small></div><span class="pill off">已隔离</span></div>
      </div>`;
  }

  function packageCheckPendingCard() {
    return `
      <div class="component-head">
        <div><span class="pill blue">教学包预览</span><h3>教学包检查</h3></div>
        <span class="pill wait">新课题待确认</span>
      </div>
      <div class="list">
        <div class="row"><div><strong>教师阅读版</strong><small>等待当前课题结果确认后再更新。</small></div><span class="pill wait">待确认</span></div>
        <div class="row"><div><strong>学生任务单</strong><small>新课题任务单尚未生成。</small></div><span class="pill wait">待生成</span></div>
        <div class="row"><div><strong>课堂使用</strong><small>当前只做备课预览。</small></div><span class="pill off">未连接</span></div>
      </div>`;
  }

  function resetForNewLesson(currentTask = {}) {
    lastCandidate = null;
    lastCandidateSessionId = activeSessionId();
    window.XIAOBEI_WORKBENCH_LAST_CANDIDATE_V1 = null;
    safeRemoveJson(LAST_CANDIDATE_STORAGE_KEY);
    const title = currentTask.title || currentTask.topic || "新备课";
    updateStatusLine(`<strong>${escapeHtml(title)}</strong> · 新课题 · 待生成结果`);
    updateBrandContext(title);
    updateQuickPrompts([
      { label: "继续完善框架", fill: "继续完善当前备课框架" },
      { label: "改成大单元", fill: "这是一个大单元，有3课时" },
      { label: "进入字段追问", fill: "让小备开始做官方字段追问" }
    ]);
    ["candidate", "taskSheet", "resources", "downloadPackage", "impact"].forEach((cardId) => {
      const node = document.querySelector(`[data-card="${cardId}"]`);
      if (node && node.parentNode) node.parentNode.removeChild(node);
    });
    ensureCard("tasks", newLessonTasksCard(currentTask), { featured: true, focus: false });
    ensureCard("packageCheck", packageCheckPendingCard(), { featured: false, focus: false });
    if (window.XIAOBEI_FOCUS_WORKSPACE_V1 && typeof window.XIAOBEI_FOCUS_WORKSPACE_V1.setFocusTask === "function") {
      window.XIAOBEI_FOCUS_WORKSPACE_V1.setFocusTask("tasks", {
        taskTitle: title,
        taskStatus: "新课题待生成",
        currentStage: "新备课",
        pendingItems: "备课框架、活动设计、任务单",
        nextStep: "让小备生成备课结果预览",
        intro: `我已切换到“${title}”。旧预览内容已隔离，右侧正在处理当前新课题。`
      });
    }
  }

  function resetForUnitScope(currentTask = {}) {
    const title = currentTask.title || currentTask.topic || "大单元";
    const lessons = currentTask.planned_lessons ? `${currentTask.planned_lessons}课时` : "多课时";
    updateStatusLine(`<strong>${escapeHtml(title)}</strong> · ${lessons}大单元 · 结果待确认`);
    updateBrandContext(`${title} · ${lessons}大单元`);
    updateQuickPrompts([
      { label: "修改某个字段", fill: "我想修改大观念/基本问题/三课时安排中的一个字段" },
      { label: "重新生成某个字段", fill: "请重新生成大观念，其他字段先保留" },
      { label: "进入课时部分", fill: "进入课时部分，先拆第1课时、第2课时、第3课时的课时组件" }
    ]);
    ["candidate", "taskSheet", "resources", "downloadPackage", "impact"].forEach((cardId) => {
      const node = document.querySelector(`[data-card="${cardId}"]`);
      if (node && node.parentNode) node.parentNode.removeChild(node);
    });
  }

  function setLayoutMode(mode) {
    document.documentElement.dataset.workbenchLayout = mode || "B";
  }

  function setActiveNav(name) {
    document.querySelectorAll(".nav-tab").forEach((node) => {
      node.classList.toggle("active", node.dataset.open === name);
    });
  }


  function lessonBriefCard() {
    return `
      <div class="component-head">
        <div><span class="pill wait">?????</span><h3>??????2??????</h3></div>
        <span class="pill">????</span>
      </div>
      <div class="list compact-list">
        <div class="row"><div><strong>????</strong><small>???????????????????????????</small></div></div>
        <div class="row"><div><strong>????</strong><small>???? ? ???? ? ???? ? ?????</small></div></div>
        <div class="row"><div><strong>????</strong><small>?????????????? 3 ???????????</small></div></div>
        <div class="row"><div><strong>????</strong><small>????????????????</small></div></div>
        <div class="row"><div><strong>????</strong><small>????????????????????????</small></div></div>
      </div>
      <div class="component-actions">
        <button class="btn ai" data-fill="???????">???????</button>
        <button class="btn ai" data-fill="????????????">???????</button>
        <button class="btn primary" data-candidate-action="accept" data-card-id="lessonBrief">????????</button>
      </div>`;
  }

  function taskSheetCard() {
    return `
      <div class="component-head">
        <div><span class="pill wait">待老师确认</span><h3>学生任务单草稿</h3></div>
        <span class="pill">不会覆盖正式内容</span>
      </div>
      <p>小备已根据活动二预览生成任务单草稿。确认前只作为本次备课预览。</p>
      <div class="list">
        <div class="row"><div><strong>任务一：观察主题素材</strong><small>观察 3 组与当前课题相关的素材，圈出视觉感受最强的一组。</small></div><span class="pill wait">待确认</span></div>
        <div class="row"><div><strong>任务二：填写观察表</strong><small>记录颜色组合、明暗变化和画面感受。</small></div><span class="pill wait">待确认</span></div>
        <div class="row"><div><strong>任务三：完成小作品</strong><small>尝试用本课材料完成一件小作品或模型局部。</small></div><span class="pill wait">待确认</span></div>
        <div class="row"><div><strong>任务四：写创作说明</strong><small>用 1-2 句话说明自己选择材料或方法的原因。</small></div><span class="pill wait">待确认</span></div>
      </div>
      <div class="component-actions">
        <button class="btn primary" data-candidate-action="accept" data-card-id="taskSheet">确认任务单</button>
        <button class="btn ai" data-candidate-action="revise" data-card-id="taskSheet">继续修改</button>
        <button class="btn ghost" data-candidate-action="discard" data-card-id="taskSheet">暂不采用</button>
      </div>`;
  }

  function resourceCard() {
    return `
      <div class="component-head">
        <div><span class="pill blue">资源建议</span><h3>当前课题资源</h3></div>
        <button class="btn ai" data-fill="把当前课题资源加入本课资源清单区">加入教学包</button>
      </div>
      <p>小备先帮你挑出可直接服务活动二和任务单的资源，确认后再加入教学包。</p>
      <div class="resource-grid">
        <div class="resource"><strong>作品参考图</strong><p>用于导入观察和课件展示。</p></div>
        <div class="resource"><strong>材料方法卡</strong><p>用于解释材料特性和操作方法。</p></div>
        <div class="resource"><strong>表达词汇卡</strong><p>用于学生任务单表达支架。</p></div>
      </div>
      <div class="component-actions">
        <button class="btn primary" data-fill="把作品参考图加入课件候选">加入课件</button>
        <button class="btn ai" data-fill="把表达词汇卡加入学生任务单">加入任务单</button>
      </div>`;
  }

  function packageCheckCard() {
    return `
      <div class="component-head">
        <div><span class="pill blue">教学包预览</span><h3>教学包检查</h3></div>
        <span class="pill off">当前只做备课预览</span>
      </div>
      <div class="list">
        <div class="row"><div><strong>教师阅读版</strong><small>已生成，可继续预览。</small></div><span class="pill">完成</span></div>
        <div class="row"><div><strong>学生任务单</strong><small>已生成草稿，仍待老师确认。</small></div><span class="pill wait">待确认</span></div>
        <div class="row"><div><strong>评价建议</strong><small>需要和活动二观察证据再对齐。</small></div><span class="pill wait">待确认</span></div>
        <div class="row"><div><strong>课堂使用</strong><small>当前只做备课预览，不进入课堂使用。</small></div><span class="pill off">未连接</span></div>
      </div>
      <div class="component-actions">
        <button class="btn primary" data-fill="继续完善教学包检查中的待确认项">继续完善</button>
        <button class="btn ai" data-fill="生成下载清单">生成下载清单</button>
      </div>`;
  }

  function downloadCard() {
    return `
      <div class="component-head">
        <div><span class="pill wait">下载前检查</span><h3>成果包下载清单</h3></div>
        <span class="pill wait">暂不可下载</span>
      </div>
      <p>学生任务单和评价建议仍待确认，所以当前只显示下载清单预览。</p>
      <div class="list">
        <div class="row"><div><strong>教师阅读版</strong><small>可预览。</small></div><span class="pill">已就绪</span></div>
        <div class="row"><div><strong>学生任务单</strong><small>需要老师确认。</small></div><span class="pill wait">待确认</span></div>
        <div class="row"><div><strong>材料清单</strong><small>可预览。</small></div><span class="pill">已就绪</span></div>
        <div class="row"><div><strong>评价建议表</strong><small>需要老师确认，只做教师建议。</small></div><span class="pill wait">待确认</span></div>
      </div>
      <div class="component-actions">
        <button class="btn primary" data-fill="先确认任务单和评价建议，再准备导出成果包">继续确认</button>
      </div>`;
  }

  function activityRefineCard() {
    return `
      <div class="component-head">
        <div><span class="pill wait">预览修改</span><h3>活动二预览</h3></div>
        <span class="pill">不覆盖正式内容</span>
      </div>
      <div class="two">
        <div class="box"><strong>正式内容</strong><p>自由尝试颜色组合，通过大量试错找到对比色规律，时间较充裕。</p></div>
        <div class="box candidate"><strong>预览修改</strong><p>用颜色卡片对比 3 组对比色，填写观察表，归纳规律，时间压缩至 12 分钟，并明确学生输出。</p></div>
      </div>
      <div class="component-actions">
        <button class="btn primary" data-candidate-action="accept" data-card-id="candidate">确认预览</button>
        <button class="btn ai" data-candidate-action="revise" data-card-id="candidate">继续修改</button>
        <button class="btn ghost" data-candidate-action="discard" data-card-id="candidate">放弃</button>
      </div>`;
  }


  function cardHtmlFromUpdate(update) {
    const title = escapeHtml(update.teacher_title || "工作卡");
    const status = escapeHtml(statusToTeacherLabel(update.status));
    const summary = escapeHtml(update.teacher_summary || "小备已整理好预览结果，等待老师确认。届时不会直接覆盖正式内容。");
    const candidate = escapeHtml(update.candidate_text || "小备已准备好预览结果，等待老师确认。");
    const targets = Array.isArray(update.impact_targets) ? update.impact_targets : [];
    const targetRows = targets.map((target) => `<div class="row"><div><strong>${escapeHtml(target)}</strong><small>可能受到本次调整影响，确认前不会进入最终成果包。</small></div><span class="pill wait">待确认</span></div>`).join("");
    const fieldRows = Array.isArray(update.field_rows) ? update.field_rows : [];
    const fieldRowsHtml = fieldRows.map((row) => {
      const value = row.value || row.summary || "当前大单元字段，等待老师确认或继续追问。";
      return `<div class="row"><div><strong>${escapeHtml(row.field || "")}</strong><small>${escapeHtml(value)}</small></div><span class="pill wait">${escapeHtml(row.status || "待确认")}</span></div>`;
    }).join("");
    const recommended = Array.isArray(update.recommended_teacher_actions) ? update.recommended_teacher_actions : [];
    const isUnitCard = update.card_id === "unit_brief_candidate";
    const actionHtml = recommended.length
      ? recommended.map((item, index) => `<button class="btn ${index === 0 ? "primary" : index === 1 ? "ai" : "ghost"}" data-fill="${escapeHtml(item.fill || item.label || "")}">${escapeHtml(item.label || "")}</button>`).join("")
      : isUnitCard
        ? `
        <button class="btn primary" data-fill="进入课时部分，先拆第1课时、第2课时、第3课时的课时组件">进入课时部分</button>
        <button class="btn ai" data-fill="我想修改大观念/基本问题/三课时安排中的一个字段">修改某个字段</button>
        <button class="btn ghost" data-fill="请重新生成大观念，其他字段先保留">重新生成某个字段</button>`
        : `
        <button class="btn primary" data-candidate-action="accept" data-card-id="${escapeHtml(mapBackendCardId(update.card_id))}">确认预览</button>
        <button class="btn ai" data-candidate-action="revise" data-card-id="${escapeHtml(mapBackendCardId(update.card_id))}">继续修改</button>
        <button class="btn ghost" data-candidate-action="discard" data-card-id="${escapeHtml(mapBackendCardId(update.card_id))}">暂不采用</button>`;
    return `
      <div class="component-head">
        <div><span class="pill wait">${status}</span><h3>${title}</h3></div>
        <span class="pill">待老师确认</span>
      </div>
      <p>${summary}</p>
      <div class="box candidate"><strong>预览结果</strong><p>${candidate}</p></div>
      ${fieldRowsHtml ? `<div class="list">${fieldRowsHtml}</div>` : ""}
      ${targetRows ? `<div class="list">${targetRows}</div>` : ""}
      <div class="component-actions">
        ${actionHtml}
      </div>`;
  }

  function statusToTeacherLabel(status) {
    const map = {
      candidate: "预览修改",
      pending_review: "待老师确认",
      preview: "预览",
      ready_for_teacher_review: "可请老师确认"
    };
    return map[status] || "待老师确认";
  }

  function applyAiDryRunResponse(response) {
    rememberCanonicalRouteContext(response);
    const responseCandidate = candidateFromResponse(response);
    if (responseCandidate) rememberLastCandidate(responseCandidate);
    const candidate = getLastCandidate();
    if (candidate && candidate.topic) {
      const lessons = candidate.planned_lessons ? `${candidate.planned_lessons}课时` : "";
      const scope = candidate.design_scope === "unit" || candidate.candidate_type === "unit_brief_candidate"
        ? `${lessons}大单元`.trim()
        : "结果待确认";
      const status = response && response.mode === "apply_last_candidate_to_preview" ? "已放入本次备课预览" : "结果待确认";
      updateStatusLine(`<strong>${escapeHtml(candidate.topic)}</strong> · ${escapeHtml(scope)} · ${escapeHtml(status)}`);
      updateBrandContext(`${candidate.topic}${scope ? " · " + scope : ""}`);
    }
    const nested = response && response.assistant_response && typeof response.assistant_response === "object" ? response.assistant_response : {};
    const updates = Array.isArray(response && response.card_updates)
      ? response.card_updates
      : (Array.isArray(nested.card_updates) ? nested.card_updates : []);
    let focused = "tasks";
    let lastRenderableUpdate = null;
    updates.forEach((update) => {
      if (!update || update.locked_target === true) return;
      const cardId = mapBackendCardId(update.card_id);
      focused = cardId;
      lastRenderableUpdate = update;
      if (cardId !== "semesterSchedule") {
        ensureCard(cardId, cardHtmlFromUpdate(update), { featured: false, focus: false });
      }
      if (window.XIAOBEI_FOCUS_WORKSPACE_V1 && typeof window.XIAOBEI_FOCUS_WORKSPACE_V1.syncFromUpdate === "function") {
        window.XIAOBEI_FOCUS_WORKSPACE_V1.syncFromUpdate(update);
      }
    });
    if (!updates.length && candidate) {
      const restored = restoreLastCandidateCard({ applied: response && response.mode === "apply_last_candidate_to_preview" });
      if (restored && restored.card_id) focused = restored.card_id;
    }
    if (focused) focusCard(focused, { sync: false });
    if (lastRenderableUpdate && window.XIAOBEI_FOCUS_WORKSPACE_V1 && typeof window.XIAOBEI_FOCUS_WORKSPACE_V1.syncFromUpdate === "function") {
      const updateCopy = JSON.parse(JSON.stringify(lastRenderableUpdate));
      requestAnimationFrame(() => window.XIAOBEI_FOCUS_WORKSPACE_V1.syncFromUpdate(updateCopy));
      window.setTimeout(() => window.XIAOBEI_FOCUS_WORKSPACE_V1.syncFromUpdate(updateCopy), 80);
    }
    return focused;
  }

  function mapBackendCardId(cardId) {
    const map = {
      activity_2_candidate: "candidate",
      task_sheet_candidate: "taskSheet",
      lesson_brief_candidate: "lessonBrief",
      unit_brief_candidate: "unitBrief",
      semester_plan_candidate: "semesterSchedule",
      semester_schedule_planning: "semesterSchedule",
      semester_schedule: "semesterSchedule",
      resource_cards: "resources",
      teaching_package_check: "packageCheck",
      download_manifest_preview: "downloadPackage",
      lesson_component_split: "lessonComponents",
      field_edit_selector: "fieldEdit",
      task_object_memory_summary: "taskObject",
      candidate_reject_status: "candidateStatus",
      candidate_apply_blocked: "candidateStatus"
    };
    return map[cardId] || cardId || "tasks";
  }
  window.addEventListener("xiaobei:workbench-session-changed", () => {
    lastCandidate = null;
    lastCandidateSessionId = activeSessionId();
    window.XIAOBEI_WORKBENCH_LAST_CANDIDATE_V1 = null;
  });
  window.XIAOBEI_DYNAMIC_CARDS_V1 = {
    escapeHtml,
    ensureCard,
    focusCard,
    showExtraCards,
    setActiveNav,
    updateStatusLine,
    resetForNewLesson,
    resetForUnitScope,
    rememberLastCandidate,
    getLastCandidate,
    restoreLastCandidateCard,
    setLayoutMode,
    applyAiDryRunResponse,
    blockRendererRegistry,
    renderBlock,
    renderBlocks,
    cardUpdateToLegacyBlock,
    cardUpdatesToCardGridBlock,
    readonlyRenderBlockSmokeFixture,
    runRenderBlockSmokeFixture,
    getRenderBlockActionLog: () => asArray(window.XIAOBEI_RENDER_BLOCK_ACTION_EVENT_LOG_0952F_R7).slice(),
    allowedRenderBlockTypes: RENDER_BLOCK_TYPES.slice(),
    cardHtmlFromUpdate,
    cards: {
      taskSheet: taskSheetCard,
      resources: resourceCard,
      packageCheck: packageCheckCard,
      download: downloadCard,
      activityRefine: activityRefineCard,
      lessonBrief: lessonBriefCard
    }
  };
})();





/* 061B focus workspace may present dynamic cards on demand. */
