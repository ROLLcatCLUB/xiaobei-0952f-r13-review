(function () {
  "use strict";

  const RUNTIME_STATE_STORAGE_KEY = "xiaobei_workbench_agent_runtime_state_v1";
  const CONTEXT_STATE_STORAGE_KEY = "xiaobei_workbench_context_state_v1";
  const LAST_CANDIDATE_STORAGE_KEY = "xiaobei_workbench_last_candidate_v1";
  const RUNTIME_STATE_BASE_KEY = "runtime_state";
  const CONTEXT_STATE_BASE_KEY = "context_state";
  const LAST_CANDIDATE_BASE_KEY = "last_candidate";
  const DEFAULT_TIMEOUT_MS = 130000;

  function apiClient() {
    return window.XIAOBEI_WORKBENCH_API_CLIENT_V1;
  }

  function scopedStorage() {
    return window.XIAOBEI_WORKBENCH_SESSION_STORAGE_V1;
  }

  function activeSessionInfo(options = {}) {
    const storage = scopedStorage();
    if (storage && typeof storage.ensureActiveWorkbenchSession === "function") {
      return storage.ensureActiveWorkbenchSession(options);
    }
    return { session_id: "", session_created: false, reason: "session_storage_unavailable" };
  }

  function safeReadJson(baseKey) {
    const storage = scopedStorage();
    if (!storage || typeof storage.getJson !== "function") return null;
    return storage.getJson(baseKey, null);
  }

  function safeSetJson(baseKey, value) {
    const storage = scopedStorage();
    if (!storage || typeof storage.setJson !== "function") return { ok: false, reason: "session_storage_unavailable" };
    return storage.setJson(baseKey, value || {});
  }

  function activeSessionId() {
    return activeSessionInfo().session_id || "";
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value || {}));
  }

  function hasCandidate(value) {
    return !!(value && typeof value === "object" && Object.keys(value).length && (value.candidate_type || value.topic || value.card_update_payload));
  }

  function firstCandidate(...values) {
    for (const value of values) {
      if (hasCandidate(value)) return clone(value);
    }
    return {};
  }

  function visibleCards() {
    return Array.from(document.querySelectorAll("[data-card]")).map((node) => ({
      card_id: node.getAttribute("data-card") || "",
      visible: node.offsetParent !== null,
      title: (node.querySelector("h3") && node.querySelector("h3").textContent.trim()) || ""
    })).filter((item) => item.card_id);
  }

  function dynamicLastCandidate() {
    const dynamic = window.XIAOBEI_DYNAMIC_CARDS_V1;
    if (dynamic && typeof dynamic.getLastCandidate === "function") {
      const candidate = dynamic.getLastCandidate();
      if (hasCandidate(candidate)) return candidate;
    }
    return firstCandidate(safeReadJson(LAST_CANDIDATE_BASE_KEY));
  }

  function currentFieldState() {
    const flow = window.XIAOBEI_OFFICIAL_FIELD_QUESTION_FLOW_V1;
    if (flow && typeof flow.getState === "function") return flow.getState();
    return {};
  }

  function teacherProfile() {
    const user = window.XIAOBEI_WORKBENCH_USER;
    if (user && typeof user.ensureProfile === "function") return user.ensureProfile();
    try {
      return JSON.parse(window.localStorage.getItem("xiaobei_teacher_profile_v1") || "{}");
    } catch (_) {
      return {};
    }
  }

  function semesterScheduleState() {
    const api = window.XIAOBEI_SEMESTER_SCHEDULE_PLANNING_V1;
    if (api && typeof api.getRuntimeState === "function") return api.getRuntimeState();
    if (api && typeof api.getTeacherInputs === "function") {
      return {
        fields: api.getTeacherInputs(),
        active_slot: typeof api.getActiveQuestionKey === "function" ? api.getActiveQuestionKey() : "",
        ready: typeof api.isReady === "function" ? api.isReady() : false
      };
    }
    return {};
  }

  function getRuntimeState() {
    const session = activeSessionInfo();
    const storedRaw = safeReadJson(RUNTIME_STATE_BASE_KEY) || {};
    const stored = storedRaw.session_id && session.session_id && storedRaw.session_id !== session.session_id ? {} : storedRaw;
    const windowContext = window.XIAOBEI_WORKBENCH_CONTEXT_STATE_V1;
    const contextState = windowContext && windowContext.session_id === session.session_id
      ? windowContext
      : (safeReadJson(CONTEXT_STATE_BASE_KEY) || {});
    const detected = contextState.detected_context || {};
    const task = contextState.current_task || {};
    const candidate = dynamicLastCandidate();
    const lastCandidate = firstCandidate(candidate, stored.last_candidate, stored.pending_candidate);
    const profile = teacherProfile();
    const semesterState = semesterScheduleState();
    return {
      state_version: "064C_agent_runtime_state_v1",
      session_id: session.session_id,
      session_created: session.session_created === true,
      session_created_reason: session.reason || "",
      browser_session_id: stored.browser_session_id || browserSessionId(),
      current_topic: lastCandidate.topic || stored.current_topic || detected.topic || task.topic || task.title || "",
      grade: lastCandidate.grade || stored.grade || detected.grade || task.grade || "",
      subject: lastCandidate.subject || stored.subject || detected.subject || task.subject || "美术",
      design_scope: lastCandidate.design_scope || stored.design_scope || detected.design_scope || task.design_scope || "unknown",
      planned_lessons: lastCandidate.planned_lessons || stored.planned_lessons || detected.planned_lessons || task.planned_lessons || null,
      current_stage: stored.current_stage || "intent_routing",
      current_task: stored.current_task || task || {},
      current_task_object: stored.current_task_object || {},
      task_object_memory: stored.task_object_memory || {},
      teacher_profile: stored.teacher_profile || profile || {},
      semester_schedule_state: stored.semester_schedule_state || semesterState || {},
      skill_runtime: stored.skill_runtime || {},
      current_card_id: stored.current_card_id || "",
      last_candidate: lastCandidate,
      pending_candidate: firstCandidate(stored.pending_candidate, lastCandidate),
      rejected_candidate_ids: stored.rejected_candidate_ids || [],
      accepted_candidate_ids: stored.accepted_candidate_ids || [],
      accepted_preview_items: stored.accepted_preview_items || [],
      field_question_state: currentFieldState().active ? currentFieldState() : (stored.field_question_state || {}),
      package_preview_state: stored.package_preview_state || {},
      doc_preview_state: stored.doc_preview_state || {},
      export_gate_state: stored.export_gate_state || {},
      message_summary: stored.message_summary || "",
      recent_messages: stored.recent_messages || [],
      action_event_log: stored.action_event_log || [],
      canonical_route_context: stored.canonical_route_context || {},
      route_source: stored.route_source || "",
      locked_items: stored.locked_items || [],
      safety_flags: {
        database_write_allowed: false,
        direct_write_allowed: false,
        overwrite_content_allowed: false,
        feishu_write_allowed: false,
        formal_scoring_allowed: false,
        classroom_app_connect_allowed: false,
        student_submit_allowed: false,
        real_export_allowed: false,
        real_download_allowed: false,
        teacher_review_required: true
      }
    };
  }

  function browserSessionId() {
    try {
      const key = "xiaobei_workbench_browser_session_id_v1";
      let value = window.sessionStorage && window.sessionStorage.getItem(key);
      if (!value) {
        value = `browser_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
        window.sessionStorage && window.sessionStorage.setItem(key, value);
      }
      return value || "";
    } catch (_) {
      return "";
    }
  }

  function applyStatePatch(patch = {}, response = {}) {
    const current = getRuntimeState();
    const session = activeSessionInfo();
    const runtimeState = response.runtime_state && typeof response.runtime_state === "object" ? response.runtime_state : {};
    const next = { ...current, ...runtimeState, ...((patch && patch.set) || {}), session_id: session.session_id || current.session_id };
    const events = Array.isArray(patch.append_action_events) ? patch.append_action_events : [];
    next.action_event_log = [...(current.action_event_log || []), ...events].slice(-30);
    const responseCandidate = firstCandidate(
      response.last_candidate,
      response.pending_candidate,
      response.candidate_updates && response.candidate_updates[0],
      runtimeState.last_candidate,
      runtimeState.pending_candidate,
      patch && patch.set && patch.set.last_candidate,
      patch && patch.set && patch.set.pending_candidate
    );
    if (hasCandidate(responseCandidate)) {
      next.last_candidate = clone(responseCandidate);
      next.pending_candidate = firstCandidate(response.pending_candidate, runtimeState.pending_candidate, responseCandidate);
      const dynamic = window.XIAOBEI_DYNAMIC_CARDS_V1;
      if (dynamic && typeof dynamic.rememberLastCandidate === "function") {
        dynamic.rememberLastCandidate(responseCandidate);
      }
    }
    const canonical = canonicalRouteContextFromResponse(response);
    if (canonical) {
      next.canonical_route_context = canonical;
      next.route_source = "backend_runtime_router";
      rememberCanonicalContext(canonical);
    }
    next.safety_flags = {
      ...(next.safety_flags || {}),
      database_write_allowed: false,
      feishu_write_allowed: false,
      formal_scoring_allowed: false,
      classroom_app_connect_allowed: false,
      student_submit_allowed: false,
      real_export_allowed: false,
      teacher_review_required: true
    };
    safeSetJson(RUNTIME_STATE_BASE_KEY, next);
    window.XIAOBEI_AGENT_RUNTIME_STATE_V1 = next;
    return next;
  }

  function buildTurnRequest(teacherMessage, context = {}) {
    const session = activeSessionInfo();
    const contextRuntimeState = context.runtime_state && typeof context.runtime_state === "object" ? context.runtime_state : {};
    const contextRuntimeSafe = contextRuntimeState.session_id && session.session_id && contextRuntimeState.session_id !== session.session_id
      ? {
          session_id: session.session_id,
          browser_session_id: browserSessionId(),
          safety_flags: contextRuntimeState.safety_flags || {}
        }
      : contextRuntimeState;
    const runtimeState = {
      ...getRuntimeState(),
      ...contextRuntimeSafe,
      session_id: session.session_id || contextRuntimeSafe.session_id || "",
      browser_session_id: contextRuntimeSafe.browser_session_id || browserSessionId()
    };
    const routeSource = String(context.route_source || context.route_decision_source || "").trim();
    const useBackendCanonicalFacts = routeSource === "backend_runtime_router" || routeSource === "backend_canonical";
    const request = {
      teacher_message: String(teacherMessage || ""),
      runtime_state: runtimeState,
      visible_cards: visibleCards(),
      current_input_source: context.current_input_source || "left_xiaobei_composer",
      client_capabilities: {
        can_render_card_updates: true,
        can_render_blocks: true,
        render_block_contract: "0952F_R6_WORKBENCH_RENDER_BLOCK_REGISTRY_CONTRACT",
        render_block_registry_version: "0952F_R7_readonly_apply",
        can_render_field_question_state: true,
        single_input_only: true
      },
      safety_flags: runtimeState.safety_flags,
      session_id: runtimeState.session_id,
      browser_session_id: runtimeState.browser_session_id,
      current_context: {
        topic: runtimeState.current_topic,
        grade: runtimeState.grade,
        subject: runtimeState.subject,
        design_scope: runtimeState.design_scope,
        planned_lessons: runtimeState.planned_lessons,
        field_question_state: runtimeState.field_question_state,
        last_candidate: runtimeState.last_candidate,
        pending_candidate: runtimeState.pending_candidate,
        current_task_object: runtimeState.current_task_object,
        teacher_profile: runtimeState.teacher_profile,
        semester_schedule_state: runtimeState.semester_schedule_state
      },
      current_task: runtimeState.current_task,
      current_task_object: runtimeState.current_task_object,
      teacher_profile: runtimeState.teacher_profile,
      semester_schedule_state: runtimeState.semester_schedule_state,
      task_object_memory: runtimeState.task_object_memory,
      last_candidate: runtimeState.last_candidate,
      pending_candidate: runtimeState.pending_candidate,
      ai_mode: context.ai_mode,
      context_policy: useBackendCanonicalFacts ? context.context_policy : undefined,
      detected_context: useBackendCanonicalFacts ? (context.detected_context || {}) : {},
      detected_intent: null,
      intent_route_decision: useBackendCanonicalFacts ? (context.intent_route_decision || null) : null,
      frontend_route_hint: context.frontend_route_hint || null,
      canonical_route_context: useBackendCanonicalFacts ? (context.canonical_route_context || null) : null,
      client_route_fact_source: "backend_canonical_required"
    };
    const storage = scopedStorage();
    const sessionCheck = storage && typeof storage.assertRequestSession === "function"
      ? storage.assertRequestSession(request)
      : { ok: true, warnings: [] };
    request.session_integrity = sessionCheck;
    if (!sessionCheck.ok) {
      const error = new Error("workbench_session_mismatch");
      error.reason = (sessionCheck.warnings || []).join(",") || "session_mismatch";
      error.session_integrity = sessionCheck;
      throw error;
    }
    return request;
  }

  async function requestAgentTurn(request) {
    const client = apiClient();
    const bases = client && typeof client.apiBases === "function"
      ? client.apiBases()
      : ["http://127.0.0.1:8082/api/workbench", "http://localhost:8082/api/workbench", "/api/workbench"];
    let lastError = null;
    for (const base of bases) {
      try {
        const controller = new AbortController();
        const timer = window.setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
        const res = await fetch(`${base}/agent/turn`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: base === "/api/workbench" ? "same-origin" : "omit",
          body: JSON.stringify(request),
          signal: controller.signal
        });
        window.clearTimeout(timer);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          const error = new Error("agent_runtime_request_failed");
          error.status = res.status;
          error.payload = data;
          throw error;
        }
        window.XIAOBEI_WORKBENCH_API_LAST_STATUS = { ok: true, api_base: base, checked_at: new Date().toISOString() };
        return data;
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError || new Error("agent_runtime_request_failed");
  }

  function validateTeacherSafe(response = {}) {
    const text = [
      response.assistant_message,
      response.teacher_visible_status,
      ...(response.card_updates || []).map((card) => `${card.teacher_title || ""} ${card.teacher_summary || ""} ${card.candidate_text || ""}`)
    ].join("\n");
    const forbidden = ["API", "backend", "dry-run", "mock", "candidate_content", "app_link", "official_field_name", "skipped_with_fallback", "direct_write", "overwrite_content", "feishu_write", "formal_scoring", "writeback"];
    return {
      ok: !forbidden.some((term) => text.includes(term)),
      reason: forbidden.find((term) => text.includes(term)) || ""
    };
  }

  async function agentTurn(teacherMessage, context = {}) {
    const request = buildTurnRequest(teacherMessage, context);
    const response = await requestAgentTurn(request);
    const safe = validateTeacherSafe(response);
    if (!safe.ok) {
      const error = new Error("agent_runtime_teacher_copy_rejected");
      error.reason = safe.reason;
      error.payload = response;
      throw error;
    }
    applyStatePatch(response.state_patch || {}, response);
    if (response.render_blocks) {
      const dynamic = window.XIAOBEI_DYNAMIC_CARDS_V1;
      if (dynamic && typeof dynamic.renderBlocks === "function") {
        dynamic.renderBlocks(response.render_blocks, { source: "agent_turn_readonly_render_blocks" });
      }
    }
    window.XIAOBEI_AGENT_LAST_TURN_V1 = {
      captured_at: new Date().toISOString(),
      request,
      response
    };
    return { request, response };
  }

  function canonicalRouteContextFromResponse(response = {}) {
    if (response.canonical_route_context && typeof response.canonical_route_context === "object") {
      return clone(response.canonical_route_context);
    }
    const route = response.intent_route && typeof response.intent_route === "object" ? response.intent_route : {};
    if (route.canonical_route_context && typeof route.canonical_route_context === "object") {
      return clone(route.canonical_route_context);
    }
    return null;
  }

  function rememberCanonicalContext(canonical) {
    if (!canonical || typeof canonical !== "object") return;
    const updated = canonical.updated_context && typeof canonical.updated_context === "object" ? canonical.updated_context : {};
    const resolved = canonical.resolved_context && typeof canonical.resolved_context === "object" ? canonical.resolved_context : {};
    const entities = canonical.entities && typeof canonical.entities === "object" ? canonical.entities : {};
    const session = activeSessionInfo();
    const detected = {
      grade: updated.grade || resolved.grade || entities.grade || "",
      subject: updated.subject || resolved.subject || entities.subject || "美术",
      topic: updated.topic || resolved.raw_topic || resolved.topic || entities.topic || "",
      lesson_no: updated.lesson_no || resolved.lesson_no || entities.lesson_no || "",
      design_scope: updated.design_scope || resolved.design_scope || entities.design_scope || "unknown",
      planned_lessons: updated.planned_lessons || resolved.planned_lessons || entities.planned_lessons || null,
      context_intent: canonical.intent_id || "",
      current_topic_locked: !!(updated.topic || resolved.raw_topic || entities.topic)
    };
    const state = {
      session_id: session.session_id || "",
      route_source: "backend_runtime_router",
      canonical_route_context: clone(canonical),
      detected_context: detected,
      current_task: {
        title: detected.topic || "当前备课",
        topic: detected.topic || "",
        grade: detected.grade || "",
        subject: detected.subject || "美术",
        lesson: detected.lesson_no || "",
        design_scope: detected.design_scope || "unknown",
        planned_lessons: detected.planned_lessons,
        context_intent: detected.context_intent || "",
        current_topic_locked: detected.current_topic_locked
      },
      context_policy: canonical.context_policy || "",
      intent: canonical.intent_id || "",
      updated_at: new Date().toISOString()
    };
    window.XIAOBEI_WORKBENCH_CONTEXT_STATE_V1 = state;
    safeSetJson(CONTEXT_STATE_BASE_KEY, state);
  }

  window.XIAOBEI_AGENT_RUNTIME_CLIENT_V1 = {
    RUNTIME_STATE_STORAGE_KEY,
    RUNTIME_STATE_BASE_KEY,
    CONTEXT_STATE_BASE_KEY,
    LAST_CANDIDATE_BASE_KEY,
    getRuntimeState,
    applyStatePatch,
    buildTurnRequest,
    agentTurn,
    validateTeacherSafe
  };
})();
