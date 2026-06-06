(function (root) {
  "use strict";

  const RENDERER_VERSION = "workbench_message_renderer_070E_v0.1";
  const PLAIN_TEXT = "plain_text";
  const SAFE_MARKDOWN = "safe_markdown";

  const RISK_PATTERNS = [
    { id: "unsafe_script_tag", pattern: /<\s*\/?\s*script\b/i },
    { id: "unsafe_event_handler", pattern: /\bon[a-z]+\s*=/i },
    { id: "unsafe_javascript_url", pattern: /javascript\s*:/i }
  ];

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function textWithBreaks(value) {
    return escapeHtml(value).replace(/\r?\n/g, "<br>");
  }

  function normalizeRole(role) {
    const value = String(role || "").trim().toLowerCase();
    if (value === "teacher") return "teacher";
    if (value === "assistant" || value === "xb" || value === "xiaobei") return "assistant";
    if (value === "system") return "system";
    return "unknown";
  }

  function contentFrom(payload) {
    if (payload && typeof payload === "object" && !Array.isArray(payload)) {
      return payload.content ?? payload.text ?? "";
    }
    return payload ?? "";
  }

  function requestedFormatFrom(payload) {
    if (payload && typeof payload === "object" && !Array.isArray(payload)) {
      return payload.content_format || payload.contentFormat || "";
    }
    return "";
  }

  function riskWarnings(content) {
    const text = String(content ?? "");
    return RISK_PATTERNS
      .filter((item) => item.pattern.test(text))
      .map((item) => item.id);
  }

  function rawHtmlTagNames(content) {
    const names = new Set();
    const text = String(content ?? "");
    const pattern = /<\s*([a-z][a-z0-9:-]*)\b/gi;
    let match = pattern.exec(text);
    while (match) {
      names.add(match[1].toLowerCase());
      match = pattern.exec(text);
    }
    return names;
  }

  function rendererLeakedRawHtml(content, html) {
    const names = rawHtmlTagNames(content);
    if (!names.size) return false;
    const output = String(html || "");
    for (const name of names) {
      const pattern = new RegExp(`<\\s*${name}(?:\\s|>|/)`, "i");
      if (pattern.test(output)) return true;
    }
    return false;
  }

  function normalizeFormat(role, requestedFormat, warnings) {
    const requested = String(requestedFormat || "").trim().toLowerCase();
    if (requested === "html") {
      warnings.push("content_format_html_downgraded");
      return PLAIN_TEXT;
    }
    if (role === "teacher") {
      if (requested && requested !== PLAIN_TEXT) warnings.push("teacher_markdown_downgraded");
      return PLAIN_TEXT;
    }
    if (role === "system" || role === "unknown") {
      if (requested && requested !== PLAIN_TEXT) warnings.push(`${role}_format_downgraded`);
      return PLAIN_TEXT;
    }
    if (role === "assistant") {
      if (!requested) return SAFE_MARKDOWN;
      if (requested === SAFE_MARKDOWN || requested === PLAIN_TEXT) return requested;
      warnings.push(`unsupported_content_format_${requested}_downgraded`);
      return PLAIN_TEXT;
    }
    return PLAIN_TEXT;
  }

  function renderSafeMarkdown(content, warnings) {
    const engine070H = root.XIAOBEI_MARKDOWN_ENGINE_ADAPTER_070H;
    if (engine070H && typeof engine070H.renderSafeMarkdown === "function") {
      try {
        const result = engine070H.renderSafeMarkdown(content, { source: "message_renderer_v1" }) || {};
        const html = String(result.html || "");
        if (Array.isArray(result.warnings)) {
          result.warnings.forEach((warning) => warnings.push(`070H_${warning}`));
        }
        if (rendererLeakedRawHtml(content, html)) {
          warnings.push("raw_html_leak_guard_fallback_plain_text");
          return textWithBreaks(content);
        }
        return html;
      } catch (_) {
        warnings.push("markdown_engine_070H_error_fallback_legacy_renderer");
      }
    }

    const renderer = root.XIAOBEI_MARKDOWN_RENDERER_V1;
    if (!renderer || typeof renderer.render !== "function") {
      warnings.push("markdown_renderer_missing_fallback_plain_text");
      return textWithBreaks(content);
    }
    try {
      const html = String(renderer.render(content) || "");
      if (rendererLeakedRawHtml(content, html)) {
        warnings.push("raw_html_leak_guard_fallback_plain_text");
        return textWithBreaks(content);
      }
      return html;
    } catch (_) {
      warnings.push("markdown_renderer_error_fallback_plain_text");
      return textWithBreaks(content);
    }
  }

  function htmlText(value) {
    return String(value || "")
      .replace(/<[^>]*>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, "\"")
      .replace(/&#39;/g, "'")
      .trim();
  }

  function addClassToTag(tag, classNames) {
    if (!classNames.length) return tag;
    if (/\sclass=(["'])/.test(tag)) {
      return tag.replace(/\sclass=(["'])([^"']*)\1/, (_, quote, existing) => ` class=${quote}${existing} ${classNames.join(" ")}${quote}`);
    }
    return tag.replace(/>$/, ` class="${classNames.join(" ")}">`);
  }

  function isTeacherInputPrompt(text) {
    return /(追问|待确认|需要.*(提供|补充|填写|确认)|请.*(提供|补充|填写|确认)|老师.*(提供|补充|填写|确认)|下一步|资料)/.test(String(text || ""));
  }

  function decorateAssistantHtml(html) {
    let headingIndex = 0;
    return String(html || "")
      .replace(/<h([1-6])([^>]*)>([\s\S]*?)<\/h\1>/g, (match, level, attrs, body) => {
        const text = htmlText(body);
        const classes = [];
        if (headingIndex === 0) classes.push("wb-md-title-heading");
        if (isTeacherInputPrompt(text)) classes.push("wb-md-question-heading");
        headingIndex += 1;
        if (!classes.length) return match;
        return `${addClassToTag(`<h${level}${attrs}>`, classes)}${body}</h${level}>`;
      })
      .replace(/<p>([\s\S]*?)<\/p>/g, (match, body) => {
        const text = htmlText(body);
        if (!isTeacherInputPrompt(text)) return match;
        return `<p class="wb-md-question-lead">${body}</p>`;
      });
  }

  function renderMessage(payload) {
    const content = contentFrom(payload);
    const warnings = [];
    const role = normalizeRole(payload && typeof payload === "object" ? payload.role : "");
    if (role === "unknown") warnings.push("unknown_role_plain_text");

    const risks = riskWarnings(content);
    risks.forEach((warning) => warnings.push(warning));

    let contentFormat = normalizeFormat(role, requestedFormatFrom(payload), warnings);
    if (risks.length) contentFormat = PLAIN_TEXT;

    const html = contentFormat === SAFE_MARKDOWN
      ? decorateAssistantHtml(renderSafeMarkdown(content, warnings))
      : textWithBreaks(content);

    return {
      html,
      role,
      content_format: contentFormat,
      renderer_version: RENDERER_VERSION,
      warnings
    };
  }

  function renderTeacherMessage(payload) {
    const data = payload && typeof payload === "object" && !Array.isArray(payload)
      ? payload
      : { content: payload };
    return renderMessage({ ...data, role: "teacher" });
  }

  function renderAssistantMessage(payload) {
    const data = payload && typeof payload === "object" && !Array.isArray(payload)
      ? payload
      : { content: payload };
    return renderMessage({ ...data, role: "assistant" });
  }

  function renderSystemMessage(payload) {
    const data = payload && typeof payload === "object" && !Array.isArray(payload)
      ? payload
      : { content: payload };
    return renderMessage({ ...data, role: "system" });
  }

  const api = {
    escapeHtml,
    renderMessage,
    renderTeacherMessage,
    renderAssistantMessage,
    renderSystemMessage
  };

  root.XIAOBEI_MESSAGE_RENDERER_V1 = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
