(function () {
  "use strict";

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function inlineMarkdownHtml(value) {
    return escapeHtml(value)
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  }

  const FIELD_LABELS = [
    "单元名称", "单元主题", "学科融合", "跨学科融合", "大观念", "大观念候选",
    "基本问题", "基本问题候选", "表现性任务", "表现性任务候选", "学习证据",
    "评价建议", "三课时安排", "课时安排", "每课时任务", "教学流程", "核心活动",
    "课时主题核心任务", "学生任务", "教师组织", "三年级支架", "活动目标", "材料准备", "下一步建议", "下一步追问",
    "确认边界", "当前任务", "当前阶段", "待确认", "可能影响", "候选修改", "正式内容"
  ];

  function normalizeLabel(value) {
    return String(value || "")
      .replace(/\*\*/g, "")
      .replace(/[：:]\s*$/g, "")
      .replace(/^[\s|]+|[\s|]+$/g, "")
      .trim();
  }

  function isLikelyFieldLabel(value) {
    const label = normalizeLabel(value);
    if (!label || label.length > 18) return false;
    if (FIELD_LABELS.includes(label)) return true;
    return /(候选|安排|任务|证据|建议|目标|主题|流程|活动|支架|材料|边界|影响|阶段|内容)$/.test(label);
  }

  function isLikelyStandaloneHeading(value) {
    const label = normalizeLabel(value);
    if (!label || label.length > 28) return false;
    if (isLikelyFieldLabel(label)) return true;
    return /^(第\s*[一二三四五六七八九十\d]+\s*课时|[①②③④⑤⑥⑦⑧⑨⑩]\s*第?\s*[一二三四五六七八九十\d]+|一、|二、|三、|四、)/.test(label);
  }

  function renderField(label, value) {
    const cleanLabel = normalizeLabel(label);
    const cleanValue = String(value || "").trim();
    if (!cleanValue) return `<h5>${inlineMarkdownHtml(cleanLabel)}</h5>`;
    return `<div class="wb-md-field"><strong>${inlineMarkdownHtml(cleanLabel)}</strong><span>${inlineMarkdownHtml(cleanValue)}</span></div>`;
  }

  function tableCells(row) {
    return String(row || "")
      .split("|")
      .map((cell) => cell.trim())
      .filter((cell, index, arr) => index > 0 && index < arr.length - 1);
  }

  function readableMarkdownText(value) {
    let text = String(value || "").replace(/\r\n/g, "\n").trim();
    if (!text) return "";
    text = text
      .replace(/[ \t]+/g, " ")
      .replace(/\n{2,}(\*\*[^*\n：:]{1,28}\*\*)\n{1,2}/g, "\n\n$1\n\n")
      .replace(/\s+(?=\*\*[^*\n]{2,80}\*\*\s*\|)/g, "\n\n")
      .replace(/(\|[^|\n]+(?:\|[^|\n]+){2,}\|)\s+(?=\|[^|\n]+(?:\|[^|\n]+){2,}\|)/g, "$1\n")
      .replace(/(?:^|\n)\s*(\u2014{2,}|[-*_]{3,})\s*(?=\n|$)/g, "\n\n$1\n\n")
      .replace(/\s+(#{1,4}\s+)/g, "\n\n$1")
      .replace(/\s+([①②③④⑤⑥⑦⑧⑨⑩]\s*第?\s*[一二三四五六七八九十\d]+\s*课时[：:])/g, "\n\n$1")
      .replace(/(^|[^①②③④⑤⑥⑦⑧⑨⑩])\s+(第\s*[一二三四五六七八九十\d]+\s*课时[：:])/g, "$1\n\n$2")
      .replace(/\s*•\s*/g, "\n• ")
      .replace(/\s*——\s*([^—\n]{2,28})\s*——\s*/g, "\n\n$1\n")
      .replace(/([^\n])\s*(第\s*[一二三四五六七八九十\d]+\s*课时)/g, "$1\n$2")
      .replace(/(课时主题核心任务)\s*(第\s*[一二三四五六七八九十\d]+\s*课时)/g, "$1\n$2")
      .replace(/([^\n])\s*(下一步(?:追问|建议)[：:]?)/g, "$1\n\n$2")
      .replace(/\s*(\*\*[^*\n]{2,56}[：:：]\s*\*\*)\s*/g, "\n\n$1\n")
      .replace(/\s*(\*\*[^*\n：:]{2,28}\*\*)\s*(?=\n\s*[-*]|\n\s*(?:\d+|[一二三四五六七八九十]+)[.)）．、]|\n\s*[①②③④⑤⑥⑦⑧⑨⑩]|$)/g, "\n\n$1\n")
      .replace(/\s*(\*\*[^*\n]{2,80}\*\*)\s*(?=\n?\|)/g, "\n\n$1\n")
      .replace(/\|\s+\|/g, "|\n|")
      .replace(/([。！？?；;：:])\s*((?:\d+|[一二三四五六七八九十]+)[.)）．、]\s*)/g, "$1\n$2")
      .replace(/([）)])\s+((?:\d+|[一二三四五六七八九十]+)[.)）．、]\s*)/g, "$1\n$2")
      .replace(/([^\n])\s+([-*]\s+)/g, "$1\n$2")
      .replace(/([。！？?])\s*(#{1,4}\s+)/g, "$1\n\n$2")
      .replace(/\s+([，。！？；：、）])/g, "$1")
      .replace(/([（])\s+/g, "$1");

    const blocks = text.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);
    return blocks.map((block) => {
      if (/^(#{1,4}\s|[-*]\s|(?:\d+|[一二三四五六七八九十]+)[.)）．、]\s*|>\s|[-*_]{3,}$|\|.+\|$)/m.test(block)) return block;
      if (block.length < 120) return block;
      const sentences = block.match(/[^。！？?；;]+[。！？?；;]?/g) || [block];
      const groups = [];
      let current = "";
      sentences.forEach((sentence) => {
        const next = `${current}${sentence}`.trim();
        if (current && next.length > 90) {
          groups.push(current.trim());
          current = sentence;
        } else {
          current = next;
        }
      });
      if (current.trim()) groups.push(current.trim());
      return groups.join("\n\n");
    }).join("\n\n");
  }

  function render(value) {
    const lines = readableMarkdownText(value).split("\n");
    const html = [];
    let paragraph = [];
    let listType = "";
    let listItems = [];
    let tableRows = [];

    const flushParagraph = () => {
      if (!paragraph.length) return;
      html.push(`<p>${paragraph.map(inlineMarkdownHtml).join("<br>")}</p>`);
      paragraph = [];
    };

    const flushTable = () => {
      if (!tableRows.length) return;
      const rows = tableRows
        .map(tableCells)
        .filter((row) => row.length);
      const separatorIndex = rows.findIndex((row) => row.every((cell) => /^:?-{2,}:?$/.test(cell)));
      if (separatorIndex < 0 && rows.length <= 4) {
        const parts = [];
        let pairCount = 0;
        rows.forEach((row) => {
          for (let index = 0; index < row.length; index += 2) {
            const label = row[index];
            const value = row[index + 1] || "";
            if (isLikelyFieldLabel(label) && value) {
              parts.push(renderField(label, value));
              pairCount += 1;
            } else if (!value && isLikelyStandaloneHeading(label)) {
              parts.push(`<h5>${inlineMarkdownHtml(normalizeLabel(label))}</h5>`);
            }
          }
        });
        if (pairCount > 0) {
          html.push(`<div class="wb-md-field-grid">${parts.join("")}</div>`);
          tableRows = [];
          return;
        }
      }
      const head = separatorIndex > 0 ? rows.slice(0, separatorIndex) : rows.slice(0, 1);
      const body = separatorIndex >= 0 ? rows.slice(separatorIndex + 1) : rows.slice(1);
      const labels = head[0] || [];
      const headHtml = head.length ? `<thead>${head.map((row) => `<tr>${row.map((cell) => `<th>${inlineMarkdownHtml(cell)}</th>`).join("")}</tr>`).join("")}</thead>` : "";
      const bodyHtml = body.length ? `<tbody>${body.map((row) => `<tr>${row.map((cell, index) => `<td data-label="${escapeHtml(labels[index] || "")}">${inlineMarkdownHtml(cell)}</td>`).join("")}</tr>`).join("")}</tbody>` : "";
      html.push(`<div class="wb-md-table-wrap"><table>${headHtml}${bodyHtml}</table></div>`);
      tableRows = [];
    };

    const flushList = () => {
      if (!listItems.length) return;
      html.push(`<${listType}>${listItems.map((item) => `<li>${inlineMarkdownHtml(item)}</li>`).join("")}</${listType}>`);
      listType = "";
      listItems = [];
    };

    const pushListItem = (type, text) => {
      flushParagraph();
      if (listType && listType !== type) flushList();
      listType = type;
      listItems.push(text);
    };

    lines.forEach((rawLine) => {
      let line = rawLine.trim();
      if (!line) {
        flushParagraph();
        flushList();
        flushTable();
        return;
      }
      const boldOnlyHeading = line.match(/^\*\*([^*\n]{2,56}[：:：])\*\*$/);
      if (boldOnlyHeading) {
        flushParagraph();
        flushList();
        flushTable();
        html.push(`<h5>${inlineMarkdownHtml(boldOnlyHeading[1])}</h5>`);
        return;
      }
      const boldField = line.match(/^\*\*([^*\n：:]{2,40})\*\*\s*[：:]\s*(.+)$/);
      if (boldField && isLikelyFieldLabel(boldField[1])) {
        flushParagraph();
        flushList();
        flushTable();
        html.push(renderField(boldField[1], boldField[2]));
        return;
      }
      const boldHeadingWithValue = line.match(/^\*\*([^*\n]{2,40}[：:])\*\*\s*(.+)$/);
      if (boldHeadingWithValue && isLikelyFieldLabel(boldHeadingWithValue[1])) {
        flushParagraph();
        flushList();
        flushTable();
        html.push(renderField(boldHeadingWithValue[1], boldHeadingWithValue[2]));
        return;
      }
      const boldOnly = line.match(/^\*\*([^*\n：:]{2,40})\*\*$/);
      if (boldOnly && isLikelyStandaloneHeading(boldOnly[1])) {
        flushParagraph();
        flushList();
        flushTable();
        html.push(`<h5>${inlineMarkdownHtml(boldOnly[1])}</h5>`);
        return;
      }
      if (line.startsWith("|") && !line.endsWith("|") && line.split("|").length >= 3) line = `${line} |`;
      const isTableLine = /^\|.+\|$/.test(line) && line.split("|").length >= 3;
      if (isTableLine) {
        flushParagraph();
        flushList();
        tableRows.push(line);
        return;
      }
      flushTable();
      const heading = line.match(/^(#{1,4})\s+(.+)$/);
      if (heading) {
        flushParagraph();
        flushList();
        const level = Math.min(5, heading[1].length + 3);
        html.push(`<h${level}>${inlineMarkdownHtml(heading[2])}</h${level}>`);
        return;
      }
      if (/^[-*_]{3,}$/.test(line)) {
        flushParagraph();
        flushList();
        html.push("<hr>");
        return;
      }
      const lessonHeading = line.match(/^(?:([①②③④⑤⑥⑦⑧⑨⑩])\s*)?(第\s*[一二三四五六七八九十\d]+\s*课时(?:[：:].+|.{2,90}))$/);
      if (lessonHeading) {
        flushParagraph();
        flushList();
        html.push(`<h5 class="wb-md-lesson-heading">${inlineMarkdownHtml(`${lessonHeading[1] ? lessonHeading[1] + " " : ""}${lessonHeading[2]}`)}</h5>`);
        return;
      }
      const circledHeading = line.match(/^([①②③④⑤⑥⑦⑧⑨⑩])\s*(.+)$/);
      if (circledHeading && /课时|活动|任务|步骤/.test(circledHeading[2]) && circledHeading[2].length <= 52) {
        flushParagraph();
        flushList();
        html.push(`<h5 class="wb-md-lesson-heading">${inlineMarkdownHtml(`${circledHeading[1]} ${circledHeading[2]}`)}</h5>`);
        return;
      }
      if (isLikelyStandaloneHeading(line)) {
        flushParagraph();
        flushList();
        flushTable();
        html.push(`<h5>${inlineMarkdownHtml(line)}</h5>`);
        return;
      }
      const plainField = line.match(/^([^：:\n]{2,18})[：:]\s*(.+)$/);
      if (plainField && isLikelyFieldLabel(plainField[1])) {
        flushParagraph();
        flushList();
        html.push(renderField(plainField[1], plainField[2]));
        return;
      }
      const unordered = line.match(/^[-*•]\s+(.+)$/);
      if (unordered) {
        pushListItem("ul", unordered[1]);
        return;
      }
      const ordered = line.match(/^(?:\d+|[一二三四五六七八九十]+)[.)）．、]\s*(.+)$/);
      if (ordered) {
        pushListItem("ol", ordered[1]);
        return;
      }
      const quote = line.match(/^>\s*(.+)$/);
      if (quote) {
        flushParagraph();
        flushList();
        html.push(`<blockquote>${inlineMarkdownHtml(quote[1])}</blockquote>`);
        return;
      }
      flushList();
      paragraph.push(line);
    });

    flushParagraph();
    flushList();
    flushTable();
    return html.join("");
  }

  window.XIAOBEI_MARKDOWN_RENDERER_V1 = {
    escapeHtml,
    readableMarkdownText,
    render
  };
})();
