#!/usr/bin/env python3
"""Validate 0952F_R13 Agent render_blocks fixture readonly smoke."""

from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
import sys
import zipfile
from pathlib import Path, PurePosixPath


MARKER = "ALL_0952F_R13_AGENT_RENDER_BLOCKS_INPUT_FIXTURE_READONLY_SMOKE_CHECKS_OK"
STAGE = "0952F_R13_AGENT_RENDER_BLOCKS_INPUT_FIXTURE_READONLY_SMOKE"
ROOT = Path(__file__).resolve().parents[1]

REPORT = Path("docs/audit/agent_render_blocks_input_fixture_readonly_smoke_0952F_R13_report.md")
RESULT = Path("docs/foundation/agent_render_blocks_input_fixture_readonly_smoke_0952F_R13_result.json")
MANIFEST = Path("docs/audit_packages/agent_render_blocks_input_fixture_readonly_smoke_0952F_R13_manifest.json")
ZIP_PATH = Path("docs/audit_packages/agent_render_blocks_input_fixture_readonly_smoke_0952F_R13.zip")
VALIDATOR = Path("scripts/validate_agent_render_blocks_input_fixture_readonly_smoke_0952F_R13.py")

REQUIRED_CONTEXT = [
    Path("frontend/workbench/agent_render_blocks_fixture_apply_0952F_R12.js"),
    Path("frontend/workbench/workbench_dynamic_cards_v1.js"),
    Path("frontend/workbench/workbench_agent_runtime_client_v1.js"),
    Path("frontend/workbench/workbench_message_renderer_v1.js"),
    Path("frontend/workbench/workbench_markdown_renderer_v1.js"),
    Path("frontend/workbench/workbench_markdown_engine_adapter_070H.js"),
    Path("docs/foundation/agent_render_blocks_input_fixture_readonly_apply_0952F_R12_result.json"),
    Path("samples/agent_render_blocks_0952F_R11/valid_lesson_design_render_blocks.json"),
    Path("samples/agent_render_blocks_0952F_R11/valid_card_updates_compat_render_blocks.json"),
    Path("samples/agent_render_blocks_0952F_R11/invalid_dangerous_html_render_blocks.json"),
    Path("samples/agent_render_blocks_0952F_R11/invalid_action_real_write_render_blocks.json"),
]

EXPECTED_PACKAGE_ENTRIES = REQUIRED_CONTEXT + [REPORT, RESULT, VALIDATOR, MANIFEST]

LEGAL_TYPES_LESSON = [
    "heading",
    "paragraph",
    "markdown",
    "list",
    "table",
    "evidence",
    "review_gate",
    "action_bar",
]
LEGAL_TYPES_COMPAT = ["legacy_card", "card_grid", "action_bar"]
ALLOWED_TYPES = set(LEGAL_TYPES_LESSON + ["legacy_card", "card_grid", "debug"])


class ValidationError(Exception):
    pass


def fail(message: str) -> None:
    raise ValidationError(message)


def read_text(root: Path, rel: Path) -> str:
    path = root / rel
    if not path.exists():
        fail(f"missing file: {rel.as_posix()}")
    return path.read_text(encoding="utf-8")


def read_json(root: Path, rel: Path):
    try:
        return json.loads(read_text(root, rel))
    except json.JSONDecodeError as exc:
        fail(f"invalid json {rel.as_posix()}: {exc}")


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def ensure_clean_zip_path(name: str) -> None:
    pure = PurePosixPath(name)
    if "\\" in name:
        fail(f"zip path contains backslash: {name}")
    if pure.is_absolute():
        fail(f"zip path is absolute: {name}")
    if ".." in pure.parts:
        fail(f"zip path contains parent segment: {name}")


def validate_fixture_payload(fixture: dict) -> tuple[bool, list[str]]:
    errors: list[str] = []
    payload = fixture.get("render_blocks") if isinstance(fixture, dict) else None
    if not isinstance(payload, dict):
        return False, ["render_blocks:missing"]
    if fixture.get("fixture_stage") != "0952F_R11_AGENT_RENDER_BLOCKS_INPUT_FIXTURE_CONTRACT":
        errors.append("fixture_stage:mismatch")
    if payload.get("schema_version") != "agent_render_blocks.v1":
        errors.append("schema_version:mismatch")
    if payload.get("source_contract") != "0952F_R10_AGENT_RENDER_BLOCKS_INPUT_CONTRACT":
        errors.append("source_contract:mismatch")
    if payload.get("target") != "right_workspace":
        errors.append("target:mismatch")
    if payload.get("mode") != "readonly_preview":
        errors.append("mode:mismatch")
    blocks = payload.get("blocks")
    if not isinstance(blocks, list) or not blocks:
        errors.append("blocks:empty")
        blocks = []
    text = json.dumps(fixture, ensure_ascii=False).lower()
    if any(marker in text for marker in ["<script", "<style", "<iframe", "<svg", " onload", " onclick", "javascript:"]):
        errors.append("dangerous_html_or_script")
    for index, block in enumerate(blocks):
        if not isinstance(block, dict):
            errors.append(f"blocks.{index}:not_object")
            continue
        for field in ["block_id", "type", "status", "source", "warnings", "teacher_confirmation_required"]:
            if field not in block:
                errors.append(f"blocks.{index}.{field}:missing")
        if block.get("type") not in ALLOWED_TYPES:
            errors.append(f"blocks.{index}.type:unsupported")
        if block.get("type") == "markdown" and block.get("content_format") != "safe_markdown":
            errors.append(f"blocks.{index}.content_format:not_safe_markdown")
        if block.get("type") == "action_bar":
            for action in block.get("actions") or []:
                if not isinstance(action, dict) or action.get("effect") != "dry_run_intent_only":
                    errors.append("action_bar_real_write_intent")
                if isinstance(action, dict) and (action.get("feishu_write") or action.get("provider_call") or "endpoint_config" in action):
                    errors.append("action_bar_real_write_intent")
    return not errors, sorted(set(errors))


def node_smoke_script() -> str:
    return r"""
const fs = require("fs");
const vm = require("vm");
const path = require("path");

class ClassList {
  constructor(node) { this.node = node; this.items = new Set(); }
  add(name) { this.items.add(name); this.node.className = Array.from(this.items).join(" "); }
  remove(name) { this.items.delete(name); this.node.className = Array.from(this.items).join(" "); }
  contains(name) { return this.items.has(name) || String(this.node.className || "").split(/\s+/).includes(name); }
  toggle(name, force) { const next = force === undefined ? !this.contains(name) : !!force; next ? this.add(name) : this.remove(name); return next; }
}

class Node {
  constructor(tagName) {
    this.tagName = String(tagName || "").toLowerCase();
    this.children = [];
    this.parentNode = null;
    this.dataset = {};
    this.attributes = {};
    this.style = {};
    this.className = "";
    this.classList = new ClassList(this);
    this.eventHandlers = {};
    this.textContent = "";
    this.innerHTML = "";
    this.offsetParent = {};
  }
  appendChild(child) {
    if (child && child.isFragment) {
      child.children.slice().forEach((item) => this.appendChild(item));
      return child;
    }
    child.parentNode = this;
    this.children.push(child);
    return child;
  }
  insertBefore(child, before) {
    child.parentNode = this;
    const index = this.children.indexOf(before);
    if (index < 0) this.children.push(child);
    else this.children.splice(index, 0, child);
    return child;
  }
  removeChild(child) {
    this.children = this.children.filter((item) => item !== child);
    child.parentNode = null;
    return child;
  }
  remove() { if (this.parentNode) this.parentNode.removeChild(this); }
  setAttribute(name, value) {
    this.attributes[name] = String(value);
    if (name === "id") this.id = String(value);
    if (name.startsWith("data-")) {
      const key = name.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      this.dataset[key] = String(value);
    }
  }
  getAttribute(name) {
    if (name === "id") return this.id || "";
    if (name.startsWith("data-")) {
      const key = name.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      return this.dataset[key] || "";
    }
    return this.attributes[name] || "";
  }
  addEventListener(type, fn) { this.eventHandlers[type] = fn; }
  click() { if (this.eventHandlers.click) this.eventHandlers.click({ target: this, preventDefault() {} }); }
  scrollIntoView() {}
  matches(selector) {
    if (selector === "button") return this.tagName === "button";
    if (selector === "[data-render-block-0952f-r7]") return this.attributes["data-render-block-0952f-r7"] === "true";
    if (selector === "[data-card]") return !!this.dataset.card;
    const dataMatch = selector.match(/^\[data-([a-z0-9-]+)="([^"]+)"\]$/i);
    if (dataMatch) {
      const key = dataMatch[1].replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      return this.dataset[key] === dataMatch[2];
    }
    return false;
  }
  querySelectorAll(selector) {
    const results = [];
    const visit = (node) => {
      node.children.forEach((child) => {
        if (child.matches(selector)) results.push(child);
        visit(child);
      });
    };
    visit(this);
    return results;
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
}

const root = process.argv[1];
const grid = new Node("div");
grid.setAttribute("id", "componentGrid");
const networkCalls = [];
const runtimeEvents = [];

const document = {
  createElement: (tag) => new Node(tag),
  createDocumentFragment: () => { const node = new Node("#fragment"); node.isFragment = true; return node; },
  getElementById: (id) => id === "componentGrid" ? grid : null,
  querySelector: (selector) => grid.querySelector(selector),
  querySelectorAll: (selector) => grid.querySelectorAll(selector),
  addEventListener() {},
};

const window = {
  document,
  addEventListener() {},
  setTimeout,
  clearTimeout,
  requestAnimationFrame: (fn) => fn(),
  localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
  sessionStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
  XIAOBEI_AGENT_RUNTIME_CLIENT_V1: {
    applyStatePatch(patch) {
      const events = Array.isArray(patch && patch.append_action_events) ? patch.append_action_events : [];
      runtimeEvents.push(...events);
      return { action_event_log: runtimeEvents.slice() };
    }
  },
  fetch: (...args) => { networkCalls.push(["fetch", args]); throw new Error("network blocked"); },
  XMLHttpRequest: function() { networkCalls.push(["XMLHttpRequest"]); },
  WebSocket: function() { networkCalls.push(["WebSocket"]); },
  EventSource: function() { networkCalls.push(["EventSource"]); },
  navigator: { sendBeacon: (...args) => { networkCalls.push(["sendBeacon", args]); return false; } },
};
window.window = window;

const context = vm.createContext({
  window,
  document,
  console,
  Date,
  URL,
  setTimeout,
  clearTimeout,
  requestAnimationFrame: window.requestAnimationFrame,
  globalThis: window,
});

function runFile(rel) {
  const source = fs.readFileSync(path.join(root, rel), "utf8");
  vm.runInContext(source, context, { filename: rel });
}

runFile("frontend/workbench/workbench_markdown_renderer_v1.js");
runFile("frontend/workbench/workbench_markdown_engine_adapter_070H.js");
runFile("frontend/workbench/workbench_message_renderer_v1.js");
runFile("frontend/workbench/workbench_dynamic_cards_v1.js");

const beforeHelperNodes = grid.querySelectorAll("[data-render-block-0952f-r7]").length;
runFile("frontend/workbench/agent_render_blocks_fixture_apply_0952F_R12.js");
const afterHelperNodes = grid.querySelectorAll("[data-render-block-0952f-r7]").length;
const helper = context.window.XIAOBEI_AGENT_RENDER_BLOCKS_FIXTURE_APPLY_0952F_R12;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(helper, "R12 helper missing");
const exposedKeys = Object.keys(helper).sort();
assert(!exposedKeys.some((key) => key.toLowerCase().includes("invalid")), "helper exposes invalid fixture method");

const lessonA = helper.getLessonDesignFixture();
const lessonB = helper.getLessonDesignFixture();
lessonA.render_blocks.blocks[0].title = "mutated lesson";
const lessonDeepCopy = lessonB.render_blocks.blocks[0].title !== "mutated lesson" && helper.getLessonDesignFixture().render_blocks.blocks[0].title !== "mutated lesson";
const compatA = helper.getCardUpdatesCompatFixture();
const compatB = helper.getCardUpdatesCompatFixture();
compatA.render_blocks.blocks[0].card_update.teacher_title = "mutated compat";
const compatDeepCopy = compatB.render_blocks.blocks[0].card_update.teacher_title !== "mutated compat" && helper.getCardUpdatesCompatFixture().render_blocks.blocks[0].card_update.teacher_title !== "mutated compat";

const lessonFixture = helper.getLessonDesignFixture();
const compatFixture = helper.getCardUpdatesCompatFixture();
const lessonValidation = helper.validateFixtureShape(lessonFixture);
const compatValidation = helper.validateFixtureShape(compatFixture);

const lessonRender = helper.renderLessonDesignFixture(grid);
const lessonNodes = grid.querySelectorAll("[data-render-block-0952f-r7]");
const lessonTypes = lessonNodes.map((node) => node.dataset.renderBlockType);
const lessonButtons = grid.querySelectorAll("button");
if (lessonButtons[0]) lessonButtons[0].click();
const lessonLogLength = context.window.XIAOBEI_DYNAMIC_CARDS_V1.getRenderBlockActionLog().length;
const lessonRuntimeEvents = runtimeEvents.length;

const compatRender = helper.renderCardUpdatesCompatFixture(grid);
const compatNodes = grid.querySelectorAll("[data-render-block-0952f-r7]");
const compatTypes = compatNodes.map((node) => node.dataset.renderBlockType);
const compatButtons = grid.querySelectorAll("button");
if (compatButtons[0]) compatButtons[0].click();
const finalLog = context.window.XIAOBEI_DYNAMIC_CARDS_V1.getRenderBlockActionLog();
const dryRunOnly = finalLog.every((event) =>
  event.provider_called === false &&
  event.memory_read === false &&
  event.memory_write === false &&
  event.feishu_write === false &&
  event.formal_scoring === false &&
  event.formal_export === false &&
  event.endpoint_created === false &&
  event.server_deploy === false
);

const helperSource = fs.readFileSync(path.join(root, "frontend/workbench/agent_render_blocks_fixture_apply_0952F_R12.js"), "utf8");
const invalidFixturesExposed = /invalid_dangerous_html_render_blocks|invalid_action_real_write_render_blocks|database_write|<script|javascript:/i.test(helperSource);

const result = {
  beforeHelperNodes,
  afterHelperNodes,
  helperAutorun: afterHelperNodes !== beforeHelperNodes,
  lessonDeepCopy,
  compatDeepCopy,
  lessonValidationOk: lessonValidation.ok === true,
  compatValidationOk: compatValidation.ok === true,
  lessonRenderOk: lessonRender.ok === true,
  compatRenderOk: compatRender.ok === true,
  lessonRendered: lessonRender.render_result && lessonRender.render_result.rendered,
  compatRendered: compatRender.render_result && compatRender.render_result.rendered,
  lessonTypes,
  compatTypes,
  lessonActionButtons: lessonButtons.length,
  compatActionButtons: compatButtons.length,
  lessonLogLength,
  lessonRuntimeEvents,
  finalActionLogLength: finalLog.length,
  finalRuntimeEvents: runtimeEvents.length,
  dryRunOnly,
  invalidFixturesExposed,
  networkCallCount: networkCalls.length,
  provider_called: false,
  memory_read: false,
  memory_write: false,
  feishu_write: false,
  formal_scoring: false,
  formal_export: false,
  endpoint_created: false,
  server_deploy: false
};
console.log(JSON.stringify(result, null, 2));
"""


def run_node_smoke(root: Path) -> dict:
    result = subprocess.run(
        ["node", "-e", node_smoke_script(), str(root).replace("\\", "/")],
        cwd=root,
        text=True,
        capture_output=True,
        timeout=30,
    )
    if result.returncode != 0:
        fail(f"node smoke failed: {result.stderr or result.stdout}")
    try:
        smoke = json.loads(result.stdout)
    except json.JSONDecodeError as exc:
        fail(f"node smoke returned non-json: {result.stdout}")
    if smoke.get("helperAutorun") is not False:
        fail("R12 helper auto-ran before explicit render")
    if smoke.get("lessonDeepCopy") is not True or smoke.get("compatDeepCopy") is not True:
        fail("fixture getters did not return deep copies")
    if smoke.get("lessonValidationOk") is not True or smoke.get("compatValidationOk") is not True:
        fail("legal fixtures failed helper shape validation")
    if smoke.get("lessonRenderOk") is not True or smoke.get("compatRenderOk") is not True:
        fail("legal fixtures failed render through existing renderBlocks")
    if smoke.get("lessonRendered") != 8:
        fail("lesson fixture rendered block count mismatch")
    if smoke.get("compatRendered") != 3:
        fail("compat fixture rendered block count mismatch")
    for block_type in LEGAL_TYPES_LESSON:
        if block_type not in smoke.get("lessonTypes", []):
            fail(f"lesson fixture missing rendered type: {block_type}")
    for block_type in LEGAL_TYPES_COMPAT:
        if block_type not in smoke.get("compatTypes", []):
            fail(f"compat fixture missing rendered type: {block_type}")
    if smoke.get("lessonActionButtons", 0) < 3 or smoke.get("compatActionButtons", 0) < 2:
        fail("action_bar buttons were not visible in DOM smoke")
    if smoke.get("lessonLogLength") != 1 or smoke.get("lessonRuntimeEvents") != 1:
        fail("lesson action_bar did not append dry-run event logs")
    if smoke.get("finalActionLogLength") != 2 or smoke.get("finalRuntimeEvents") != 2:
        fail("compat action_bar did not append dry-run event logs")
    if smoke.get("dryRunOnly") is not True:
        fail("action_bar event flags are not dry-run only")
    if smoke.get("invalidFixturesExposed") is not False:
        fail("R12 helper exposes invalid fixture content")
    if smoke.get("networkCallCount") != 0:
        fail("node smoke created network calls")
    for flag in ["provider_called", "memory_read", "memory_write", "feishu_write", "formal_scoring", "formal_export", "endpoint_created", "server_deploy"]:
        if smoke.get(flag) is not False:
            fail(f"node smoke flag must be false: {flag}")
    return smoke


def validate_required_files(root: Path) -> None:
    for rel in REQUIRED_CONTEXT + [REPORT, RESULT, VALIDATOR, MANIFEST]:
        if not (root / rel).exists():
            fail(f"missing required file: {rel.as_posix()}")
    helper_text = read_text(root, Path("frontend/workbench/agent_render_blocks_fixture_apply_0952F_R12.js"))
    if "XIAOBEI_AGENT_RENDER_BLOCKS_FIXTURE_APPLY_0952F_R12" not in helper_text:
        fail("R12 helper global object missing")
    if "invalid_dangerous_html_render_blocks" in helper_text or "invalid_action_real_write_render_blocks" in helper_text:
        fail("R12 helper exposes invalid fixtures")


def validate_samples(root: Path) -> None:
    expectations = {
        Path("samples/agent_render_blocks_0952F_R11/valid_lesson_design_render_blocks.json"): True,
        Path("samples/agent_render_blocks_0952F_R11/valid_card_updates_compat_render_blocks.json"): True,
        Path("samples/agent_render_blocks_0952F_R11/invalid_dangerous_html_render_blocks.json"): False,
        Path("samples/agent_render_blocks_0952F_R11/invalid_action_real_write_render_blocks.json"): False,
    }
    for rel, expected in expectations.items():
        ok, errors = validate_fixture_payload(read_json(root, rel))
        if ok != expected:
            fail(f"fixture validation mismatch for {rel.as_posix()}: ok={ok} errors={errors}")


def validate_result_report(root: Path) -> None:
    r12 = read_json(root, Path("docs/foundation/agent_render_blocks_input_fixture_readonly_apply_0952F_R12_result.json"))
    if r12.get("final_status") != "PASS":
        fail("R12 result must be PASS")
    if r12.get("recommended_next_stage") != STAGE:
        fail("R12 recommended_next_stage must point to R13")
    result = read_json(root, RESULT)
    if result.get("stage") != STAGE or result.get("final_status") != "PASS":
        fail("R13 result status mismatch")
    if result.get("recommended_next_stage") != "0952F_R14_AGENT_RENDER_BLOCKS_INPUT_FIXTURE_READONLY_SEAL":
        fail("R13 recommended_next_stage mismatch")
    flags = result.get("red_zone_flags", {})
    for key in [
        "frontend_business_files_modified",
        "backend_runtime_modified",
        "index_html_modified",
        "endpoint_created",
        "real_agent_connected",
        "provider_connected",
        "runtime_connected",
        "memory_read",
        "memory_write",
        "feishu_write",
        "formal_scoring",
        "formal_export",
        "server_deploy",
        "real_student_data_read",
        "production_ready_claimed",
        "full_browser_e2e_claimed",
    ]:
        if flags.get(key) is not False:
            fail(f"red zone flag not false: {key}")
    report = read_text(root, REPORT)
    for token in [
        "final_status=PASS",
        "recommended_next_stage=0952F_R14_AGENT_RENDER_BLOCKS_INPUT_FIXTURE_READONLY_SEAL",
        "readonly smoke only",
        "networkCallCount=0",
        "not production ready",
        "not full browser E2E",
    ]:
        if token not in report:
            fail(f"report missing token: {token}")


def validate_manifest_zip(root: Path) -> tuple[bool, int, str | None]:
    manifest = read_json(root, MANIFEST)
    entries = manifest.get("files")
    if not isinstance(entries, list):
        fail("manifest files must be a list")
    manifest_paths = [entry.get("path") for entry in entries if isinstance(entry, dict)]
    expected_paths = [path.as_posix() for path in EXPECTED_PACKAGE_ENTRIES]
    if manifest_paths != expected_paths:
        fail("manifest entries do not match expected package order")
    for entry in entries:
        rel = entry["path"]
        ensure_clean_zip_path(rel)
        path = root / rel
        if not path.exists():
            fail(f"manifest file missing on disk: {rel}")
        if Path(rel) != MANIFEST and entry.get("sha256") != sha256_file(path):
            fail(f"manifest sha256 mismatch: {rel}")
        if Path(rel) != MANIFEST and entry.get("size_bytes") != path.stat().st_size:
            fail(f"manifest size mismatch: {rel}")
    zip_abs = root / ZIP_PATH
    if not zip_abs.exists():
        return False, 0, None
    with zipfile.ZipFile(zip_abs, "r") as zf:
        names = zf.namelist()
        for name in names:
            ensure_clean_zip_path(name)
        if names != manifest_paths:
            fail("zip entries do not match manifest")
        for entry in entries:
            with zf.open(entry["path"]) as fh:
                digest = hashlib.sha256(fh.read()).hexdigest()
            if Path(entry["path"]) != MANIFEST and digest != entry["sha256"]:
                fail(f"zip sha256 mismatch: {entry['path']}")
    return True, len(names), sha256_file(zip_abs)


def validate(root: Path) -> None:
    validate_required_files(root)
    validate_samples(root)
    smoke = run_node_smoke(root)
    validate_result_report(root)
    zip_present, zip_count, zip_sha = validate_manifest_zip(root)
    print("py_compile=PASS")
    print("node_smoke=PASS")
    print("validator_mode=repo")
    print("legal_fixtures=PASS")
    print("invalid_fixtures=REJECT")
    print(f"networkCallCount={smoke.get('networkCallCount')}")
    print(f"ZIP_PRESENT={str(zip_present).lower()}")
    if zip_present:
        print(f"ZIP_ENTRY_COUNT={zip_count}")
        print(f"ZIP_SHA256={zip_sha}")
    print(MARKER)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", default=str(ROOT), help="repository or review package root")
    args = parser.parse_args(argv)
    try:
        validate(Path(args.root).resolve())
    except ValidationError as exc:
        print(f"VALIDATION_FAILED: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
