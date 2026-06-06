# 0952F_R13 Agent Render Blocks Input Fixture Readonly Smoke Report

stage_id=0952F_R13_AGENT_RENDER_BLOCKS_INPUT_FIXTURE_READONLY_SMOKE
task_type=readonly smoke only
final_status=PASS
recommended_next_stage=0952F_R14_AGENT_RENDER_BLOCKS_INPUT_FIXTURE_READONLY_SEAL

## Scope

R13 validates the R12 fixture helper in a Node near-real DOM and renderer harness. It does not add a new apply, does not modify frontend business files, does not modify `index.html`, and does not modify backend runtime.

This is not production ready and not full browser E2E.

## Smoke Assertions

- R12 helper does not auto-run before explicit render.
- `getLessonDesignFixture()` returns deep copies.
- `getCardUpdatesCompatFixture()` returns deep copies.
- Both legal fixtures pass `validateFixtureShape()`.
- Both legal fixtures render through `window.XIAOBEI_DYNAMIC_CARDS_V1.renderBlocks(fixture.render_blocks, target)`.
- Lesson fixture renders heading, paragraph, markdown, list, table, evidence, review_gate, and action_bar.
- Compatibility fixture renders legacy_card, card_grid, and action_bar.
- action_bar clicks only append dry-run `action_event_log` and `append_action_events`.
- Invalid fixtures are not exposed by the helper.
- Dangerous HTML and real-write negative fixtures remain rejected.
- networkCallCount=0.

## Safety Boundaries

- frontend business files modified: false
- backend runtime modified: false
- index.html modified: false
- endpoint created: false
- real Agent connected: false
- provider connected: false
- runtime connected: false
- memory read: false
- memory write: false
- Feishu write: false
- formal scoring: false
- formal export: false
- server deploy: false
- real student data read: false

## Validation

Expected commands:

```text
python -m py_compile scripts/validate_agent_render_blocks_input_fixture_readonly_smoke_0952F_R13.py
python scripts/validate_agent_render_blocks_input_fixture_readonly_smoke_0952F_R13.py
python scripts/validate_agent_render_blocks_input_fixture_readonly_smoke_0952F_R13.py --root <repo-or-review-root>
```

Expected marker:

```text
ALL_0952F_R13_AGENT_RENDER_BLOCKS_INPUT_FIXTURE_READONLY_SMOKE_CHECKS_OK
```
