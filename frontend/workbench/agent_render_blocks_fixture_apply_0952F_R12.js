(function (root) {
  "use strict";

  const STAGE = "0952F_R12_AGENT_RENDER_BLOCKS_INPUT_FIXTURE_READONLY_APPLY";
  const FIXTURE_STAGE = "0952F_R11_AGENT_RENDER_BLOCKS_INPUT_FIXTURE_CONTRACT";
  const SOURCE_CONTRACT = "0952F_R10_AGENT_RENDER_BLOCKS_INPUT_CONTRACT";
  const SCHEMA_VERSION = "agent_render_blocks.v1";
  const ALLOWED_BLOCK_TYPES = Object.freeze([
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
  ]);

  const lessonDesignFixture = Object.freeze({
    fixture_id: "valid_lesson_design_render_blocks",
    fixture_stage: FIXTURE_STAGE,
    expected_validation: "PASS",
    render_blocks: {
      schema_version: SCHEMA_VERSION,
      source_contract: SOURCE_CONTRACT,
      target: "right_workspace",
      mode: "readonly_preview",
      blocks: [
        {
          block_id: "heading:lesson_overview",
          type: "heading",
          level: 2,
          title: "足球微缩模型大单元预览",
          status: "pending_review",
          source: { kind: "agent_lesson_design_fixture" },
          warnings: [],
          teacher_confirmation_required: true
        },
        {
          block_id: "paragraph:lesson_summary",
          type: "paragraph",
          text: "本样例只描述右侧工作区可读内容，不进入成果包，不写入任何外部系统。",
          status: "pending_review",
          source: { kind: "agent_lesson_design_fixture" },
          warnings: [],
          teacher_confirmation_required: true
        },
        {
          block_id: "markdown:lesson_plan",
          type: "markdown",
          title: "教学设计草稿",
          content_format: "safe_markdown",
          markdown: "**学习目标**\n\n- 观察足球微缩模型的比例与结构。\n- 用草图表达基本构思。\n- 说明材料选择理由。\n\n**确认边界**\n\n确认前只作为备课预览。",
          status: "pending_review",
          source: { kind: "agent_lesson_design_fixture" },
          warnings: [],
          teacher_confirmation_required: true
        },
        {
          block_id: "list:lesson_steps",
          type: "list",
          ordered: true,
          items: [
            { text: "观察样例并标注结构。" },
            { text: "画出微缩模型草图。" },
            { text: "列出材料与连接方式。" }
          ],
          status: "pending_review",
          source: { kind: "agent_lesson_design_fixture" },
          warnings: [],
          teacher_confirmation_required: true
        },
        {
          block_id: "table:evidence_checks",
          type: "table",
          title: "学习证据检查",
          columns: [{ key: "item", label: "项目" }, { key: "status", label: "状态" }],
          rows: [
            { item: "设计草图", status: "待确认" },
            { item: "材料清单", status: "待补充" },
            { item: "表达说明", status: "待确认" }
          ],
          status: "pending_review",
          source: { kind: "agent_lesson_design_fixture" },
          warnings: [],
          teacher_confirmation_required: true
        },
        {
          block_id: "evidence:lesson_context",
          type: "evidence",
          title: "上下文依据",
          items: [
            { title: "课题", summary: "足球微缩模型" },
            { title: "学科", summary: "四年级美术" }
          ],
          status: "pending_review",
          source: { kind: "agent_lesson_design_fixture" },
          warnings: [],
          teacher_confirmation_required: true
        },
        {
          block_id: "review_gate:teacher_confirm",
          type: "review_gate",
          title: "教师确认",
          message: "确认前不会进入成果包，也不会写入外部系统。",
          blocking_reasons: [],
          status: "pending_review",
          source: { kind: "agent_lesson_design_fixture" },
          warnings: [],
          teacher_confirmation_required: true
        },
        {
          block_id: "action_bar:lesson_preview",
          type: "action_bar",
          actions: [
            { action_id: "accept_preview", action_type: "accept", label: "记录采用", target_block_id: "markdown:lesson_plan", effect: "dry_run_intent_only" },
            { action_id: "refine_preview", action_type: "refine", label: "记录精修", target_block_id: "markdown:lesson_plan", effect: "dry_run_intent_only" },
            { action_id: "ask_followup", action_type: "ask_followup", label: "记录追问", target_block_id: "review_gate:teacher_confirm", effect: "dry_run_intent_only" }
          ],
          status: "pending_review",
          source: { kind: "agent_lesson_design_fixture" },
          warnings: [],
          teacher_confirmation_required: true
        }
      ],
      compatibility: {
        card_updates_preserved: true,
        legacy_card_allowed: true,
        card_grid_allowed: true
      },
      safety: {
        teacher_review_required: true,
        safe_markdown_only: true,
        raw_html_allowed: false,
        dom_output_allowed: false,
        script_allowed: false,
        style_allowed: false,
        iframe_allowed: false,
        svg_allowed: false,
        javascript_url_allowed: false,
        endpoint_config_allowed: false,
        provider_config_allowed: false,
        provider_call_allowed: false,
        runtime_mutation_allowed: false,
        memory_read_allowed: false,
        memory_write_allowed: false,
        feishu_write_allowed: false,
        formal_scoring_allowed: false,
        formal_export_allowed: false,
        server_deploy_allowed: false
      }
    }
  });

  const cardUpdatesCompatFixture = Object.freeze({
    fixture_id: "valid_card_updates_compat_render_blocks",
    fixture_stage: FIXTURE_STAGE,
    expected_validation: "PASS",
    render_blocks: {
      schema_version: SCHEMA_VERSION,
      source_contract: SOURCE_CONTRACT,
      target: "right_workspace",
      mode: "readonly_preview",
      blocks: [
        {
          block_id: "legacy_card:activity_2_candidate",
          type: "legacy_card",
          card_update: {
            card_id: "activity_2_candidate",
            teacher_title: "活动二预览",
            teacher_summary: "旧 card_updates 可映射为 legacy_card，仍需老师确认。",
            candidate_text: "用颜色卡片对比 3 组视觉关系，填写观察表。",
            status: "pending_review"
          },
          status: "pending_review",
          source: { kind: "card_updates", card_id: "activity_2_candidate" },
          warnings: [],
          teacher_confirmation_required: true
        },
        {
          block_id: "card_grid:compat_cards",
          type: "card_grid",
          title: "兼容卡片组",
          cards: [
            {
              block_id: "legacy_card:task_sheet_candidate",
              type: "legacy_card",
              card_update: {
                card_id: "task_sheet_candidate",
                teacher_title: "任务单草稿",
                teacher_summary: "任务单仍是预览草稿。",
                candidate_text: "观察、记录、制作、说明四步。",
                status: "pending_review"
              },
              status: "pending_review",
              source: { kind: "card_updates", card_id: "task_sheet_candidate" },
              warnings: [],
              teacher_confirmation_required: true
            },
            {
              block_id: "legacy_card:resource_cards",
              type: "legacy_card",
              card_update: {
                card_id: "resource_cards",
                teacher_title: "资源候选",
                teacher_summary: "资源只作为备课预览。",
                candidate_text: "参考图、材料方法卡、表达词汇卡。",
                status: "pending_review"
              },
              status: "pending_review",
              source: { kind: "card_updates", card_id: "resource_cards" },
              warnings: [],
              teacher_confirmation_required: true
            }
          ],
          status: "pending_review",
          source: { kind: "card_updates" },
          warnings: [],
          teacher_confirmation_required: true
        },
        {
          block_id: "action_bar:compat_cards",
          type: "action_bar",
          actions: [
            { action_id: "accept_compat", action_type: "accept", label: "记录采用", target_block_id: "card_grid:compat_cards", effect: "dry_run_intent_only" },
            { action_id: "defer_compat", action_type: "defer", label: "记录稍后处理", target_block_id: "card_grid:compat_cards", effect: "dry_run_intent_only" }
          ],
          status: "pending_review",
          source: { kind: "card_updates" },
          warnings: [],
          teacher_confirmation_required: true
        }
      ],
      compatibility: {
        card_updates_preserved: true,
        legacy_card_allowed: true,
        card_grid_allowed: true
      },
      safety: {
        teacher_review_required: true,
        safe_markdown_only: true,
        raw_html_allowed: false,
        dom_output_allowed: false,
        script_allowed: false,
        style_allowed: false,
        iframe_allowed: false,
        svg_allowed: false,
        javascript_url_allowed: false,
        endpoint_config_allowed: false,
        provider_config_allowed: false,
        provider_call_allowed: false,
        runtime_mutation_allowed: false,
        memory_read_allowed: false,
        memory_write_allowed: false,
        feishu_write_allowed: false,
        formal_scoring_allowed: false,
        formal_export_allowed: false,
        server_deploy_allowed: false
      }
    }
  });

  function cloneFixture(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function asObject(value) {
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  }

  function validateBlock(block, errors, path) {
    const source = asObject(block);
    ["block_id", "type", "status", "source", "warnings", "teacher_confirmation_required"].forEach((field) => {
      if (!(field in source)) errors.push(`${path}.${field}:missing`);
    });
    if (!ALLOWED_BLOCK_TYPES.includes(source.type)) errors.push(`${path}.type:unsupported`);
    if (!Array.isArray(source.warnings)) errors.push(`${path}.warnings:not_array`);
    if (typeof source.teacher_confirmation_required !== "boolean") errors.push(`${path}.teacher_confirmation_required:not_boolean`);
    if (source.type === "markdown" && source.content_format !== "safe_markdown") {
      errors.push(`${path}.content_format:not_safe_markdown`);
    }
    if (source.type === "action_bar") {
      const actions = Array.isArray(source.actions) ? source.actions : [];
      if (!actions.length) errors.push(`${path}.actions:empty`);
      actions.forEach((action, index) => {
        if (asObject(action).effect !== "dry_run_intent_only") {
          errors.push(`${path}.actions.${index}.effect:not_dry_run`);
        }
      });
    }
    if (source.type === "legacy_card" && asObject(source.source).kind !== "card_updates") {
      errors.push(`${path}.source.kind:not_card_updates`);
    }
    if (source.type === "card_grid") {
      if (asObject(source.source).kind !== "card_updates") errors.push(`${path}.source.kind:not_card_updates`);
      (Array.isArray(source.cards) ? source.cards : []).forEach((card, index) => validateBlock(card, errors, `${path}.cards.${index}`));
    }
  }

  function validateFixtureShape(fixture) {
    const errors = [];
    const source = asObject(fixture);
    const payload = asObject(source.render_blocks);
    if (source.fixture_stage !== FIXTURE_STAGE) errors.push("fixture_stage:mismatch");
    if (source.expected_validation !== "PASS") errors.push("expected_validation:not_pass");
    if (payload.schema_version !== SCHEMA_VERSION) errors.push("schema_version:mismatch");
    if (payload.source_contract !== SOURCE_CONTRACT) errors.push("source_contract:mismatch");
    if (payload.target !== "right_workspace") errors.push("target:mismatch");
    if (payload.mode !== "readonly_preview") errors.push("mode:mismatch");
    const blocks = Array.isArray(payload.blocks) ? payload.blocks : [];
    if (!blocks.length) errors.push("blocks:empty");
    blocks.forEach((block, index) => validateBlock(block, errors, `blocks.${index}`));
    return Object.freeze({
      ok: errors.length === 0,
      errors: Object.freeze(errors.slice()),
      fixture_id: source.fixture_id || "",
      block_count: blocks.length,
      stage: STAGE
    });
  }

  function renderFixture(fixture, target) {
    const validation = validateFixtureShape(fixture);
    if (!validation.ok) return Object.freeze({ ok: false, validation });
    const dynamicCards = root.XIAOBEI_DYNAMIC_CARDS_V1;
    if (!dynamicCards || typeof dynamicCards.renderBlocks !== "function") {
      return Object.freeze({ ok: false, validation, reason: "render_blocks_renderer_missing" });
    }
    return Object.freeze({
      ok: true,
      validation,
      render_result: dynamicCards.renderBlocks(fixture.render_blocks, target)
    });
  }

  const api = Object.freeze({
    stage: STAGE,
    source_fixture_stage: FIXTURE_STAGE,
    allowed_block_types: ALLOWED_BLOCK_TYPES.slice(),
    getLessonDesignFixture: () => cloneFixture(lessonDesignFixture),
    getCardUpdatesCompatFixture: () => cloneFixture(cardUpdatesCompatFixture),
    validateFixtureShape,
    renderLessonDesignFixture: (target) => renderFixture(cloneFixture(lessonDesignFixture), target),
    renderCardUpdatesCompatFixture: (target) => renderFixture(cloneFixture(cardUpdatesCompatFixture), target)
  });

  root.XIAOBEI_AGENT_RENDER_BLOCKS_FIXTURE_APPLY_0952F_R12 = api;
})(typeof window !== "undefined" ? window : globalThis);
