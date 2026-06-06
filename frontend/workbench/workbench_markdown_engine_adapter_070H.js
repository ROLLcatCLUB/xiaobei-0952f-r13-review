(function (root) {
  "use strict";

  const ENGINE_VERSION = "workbench_markdown_engine_adapter_070H_v0.1";
  const ENGINE_NAME = "builtin_safe_markdown_070H";
  const SAFE_LINK_PROTOCOLS = ["http:", "https:"];

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function escapeAttribute(value) {
    return escapeHtml(value).replace(/`/g, "&#96;");
  }

  function normalizeLines(value) {
    return String(value ?? "").replace(/\r\n?/g, "\n").split("\n");
  }

  function getKnownGaps() {
    return [
      "markdown_070H_is_not_full_gfm",
      "deeply_nested_mixed_lists_are_best_effort",
      "tables_keep_existing_basic_behavior"
    ];
  }

  function safeUrl(rawUrl) {
    const trimmed = String(rawUrl || "").trim();
    try {
      const parsed = new URL(trimmed, "https://xiaobei.invalid");
      if (!SAFE_LINK_PROTOCOLS.includes(parsed.protocol)) return "";
      return trimmed;
    } catch (_) {
      return "";
    }
  }

  function renderSimpleInline(text) {
    return escapeHtml(text)
      .replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>")
      .replace(/__([^_\n]+)__/g, "<strong>$1</strong>");
  }

  function renderLinksAndStrong(text) {
    const linkPattern = /\[([^\]\n]{1,120})\]\(([^)\s]{1,500})\)/g;
    let html = "";
    let lastIndex = 0;
    let match = linkPattern.exec(text);
    while (match) {
      html += renderSimpleInline(text.slice(lastIndex, match.index));
      const url = safeUrl(match[2]);
      if (url) {
        html += `<a href="${escapeAttribute(url)}" target="_blank" rel="noopener noreferrer">${renderSimpleInline(match[1])}</a>`;
      } else {
        html += escapeHtml(match[0]);
      }
      lastIndex = match.index + match[0].length;
      match = linkPattern.exec(text);
    }
    html += renderSimpleInline(text.slice(lastIndex));
    return html;
  }

  function renderInline(text) {
    const raw = String(text ?? "");
    const parts = raw.split(/(`[^`\n]*`)/g);
    return parts.map((part) => {
      if (/^`[^`\n]*`$/.test(part)) {
        return `<code>${escapeHtml(part.slice(1, -1))}</code>`;
      }
      return renderLinksAndStrong(part);
    }).join("");
  }

  function tableCells(row) {
    const cells = String(row || "")
      .trim()
      .split("|")
      .map((cell) => cell.trim());
    if (cells[0] === "") cells.shift();
    if (cells[cells.length - 1] === "") cells.pop();
    return cells;
  }

  function renderTable(rows) {
    const parsedRows = rows.map(tableCells).filter((row) => row.length);
    if (!parsedRows.length) return "";
    const separatorIndex = parsedRows.findIndex((row) => row.every((cell) => /^:?-{2,}:?$/.test(cell)));
    const headerRows = separatorIndex > 0 ? parsedRows.slice(0, separatorIndex) : parsedRows.slice(0, 1);
    const bodyRows = separatorIndex >= 0 ? parsedRows.slice(separatorIndex + 1) : parsedRows.slice(1);
    const labels = headerRows[0] || [];
    const head = headerRows.length
      ? `<thead>${headerRows.map((row) => `<tr>${row.map((cell) => `<th>${renderInline(cell)}</th>`).join("")}</tr>`).join("")}</thead>`
      : "";
    const body = bodyRows.length
      ? `<tbody>${bodyRows.map((row) => `<tr>${row.map((cell, index) => `<td data-label="${escapeAttribute(labels[index] || "")}">${renderInline(cell)}</td>`).join("")}</tr>`).join("")}</tbody>`
      : "";
    return `<div class="wb-md-table-wrap"><table>${head}${body}</table></div>`;
  }

  function listLine(rawLine) {
    const match = String(rawLine || "").match(/^(\s*)([-*+]|\d+[.)])\s+(.+)$/);
    if (!match) return null;
    const spaces = match[1].replace(/\t/g, "  ").length;
    return {
      level: Math.min(4, Math.floor(spaces / 2)),
      type: /^\d/.test(match[2]) ? "ol" : "ul",
      text: match[3]
    };
  }

  function renderListBlock(items) {
    function renderLevel(index, level) {
      let html = "";
      let current = index;
      while (current < items.length && items[current].level >= level) {
        if (items[current].level > level) {
          const nested = renderLevel(current, items[current].level);
          html += nested.html;
          current = nested.index;
          continue;
        }
        const type = items[current].type;
        html += `<${type}>`;
        while (current < items.length && items[current].level === level && items[current].type === type) {
          html += `<li>${renderInline(items[current].text)}`;
          current += 1;
          while (current < items.length && items[current].level > level) {
            const nested = renderLevel(current, items[current].level);
            html += nested.html;
            current = nested.index;
          }
          html += "</li>";
        }
        html += `</${type}>`;
      }
      return { html, index: current };
    }
    if (!items.length) return "";
    return renderLevel(0, items[0].level).html;
  }

  function renderSafeMarkdown(text, options) {
    const warnings = [];
    const knownGaps = [];
    const html = [];
    const lines = normalizeLines(text);
    let paragraph = [];
    let listItems = [];
    let tableRows = [];
    let codeLines = [];
    let inCode = false;

    const flushParagraph = () => {
      if (!paragraph.length) return;
      html.push(`<p>${paragraph.map(renderInline).join("<br>")}</p>`);
      paragraph = [];
    };

    const flushList = () => {
      if (!listItems.length) return;
      flushParagraph();
      html.push(renderListBlock(listItems));
      listItems = [];
    };

    const flushTable = () => {
      if (!tableRows.length) return;
      flushParagraph();
      flushList();
      html.push(renderTable(tableRows));
      tableRows = [];
    };

    const flushCode = () => {
      html.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
      codeLines = [];
    };

    lines.forEach((rawLine) => {
      const fence = String(rawLine || "").match(/^\s*```\s*([A-Za-z0-9_-]+)?\s*$/);
      if (fence) {
        if (inCode) {
          flushCode();
          inCode = false;
        } else {
          flushParagraph();
          flushList();
          flushTable();
          inCode = true;
          codeLines = [];
        }
        return;
      }

      if (inCode) {
        codeLines.push(String(rawLine ?? ""));
        return;
      }

      const line = String(rawLine ?? "");
      if (!line.trim()) {
        flushParagraph();
        flushList();
        flushTable();
        return;
      }

      const listItem = listLine(line);
      if (listItem) {
        flushParagraph();
        flushTable();
        listItems.push(listItem);
        return;
      }

      const tableLike = /^\s*\|.+\|\s*$/.test(line) && line.split("|").length >= 3;
      if (tableLike) {
        flushParagraph();
        flushList();
        tableRows.push(line);
        return;
      }

      flushList();
      flushTable();

      const heading = line.match(/^\s*(#{1,4})\s+(.+)$/);
      if (heading) {
        flushParagraph();
        const level = Math.min(5, heading[1].length + 3);
        html.push(`<h${level}>${renderInline(heading[2])}</h${level}>`);
        return;
      }

      if (/^\s*[-*_]{3,}\s*$/.test(line)) {
        flushParagraph();
        html.push("<hr>");
        return;
      }

      const quote = line.match(/^\s*>\s*(.+)$/);
      if (quote) {
        flushParagraph();
        html.push(`<blockquote>${renderInline(quote[1])}</blockquote>`);
        return;
      }

      paragraph.push(line.trim());
    });

    if (inCode) {
      warnings.push("unclosed_fenced_code_block_closed_by_adapter");
      flushCode();
    }
    flushParagraph();
    flushList();
    flushTable();

    const output = html.join("");
    if (/<\s*script\b/i.test(output) || /\bon[a-z]+\s*=/i.test(output) || /javascript\s*:/i.test(output)) {
      warnings.push("unsafe_pattern_removed_or_escaped");
    }
    if (options && options.collect_known_gaps === true) {
      knownGaps.push(...getKnownGaps());
    }

    return {
      html: output,
      engine_version: ENGINE_VERSION,
      engine_name: ENGINE_NAME,
      warnings,
      known_gaps: knownGaps
    };
  }

  function getEngineInfo() {
    return {
      engine_name: ENGINE_NAME,
      engine_version: ENGINE_VERSION,
      html_enabled: false,
      link_protocols: SAFE_LINK_PROTOCOLS.slice()
    };
  }

  const api = {
    renderSafeMarkdown,
    escapeHtml,
    getKnownGaps,
    getEngineInfo
  };

  root.XIAOBEI_MARKDOWN_ENGINE_ADAPTER_070H = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
