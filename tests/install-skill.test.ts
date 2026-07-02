import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

test("install script copies the bundled Pulse skill to a skills directory", () => {
  const skillsDir = mkdtempSync(join(tmpdir(), "pulse-skills-"));
  try {
    const result = spawnSync(process.execPath, ["scripts/install-codex-skill.mjs", "--skills-dir", skillsDir], {
      cwd: process.cwd(),
      encoding: "utf8",
    });

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Installed Pulse skill:/);

    const installedSkill = join(skillsDir, "pulse-shared-state");
    assert.equal(existsSync(join(installedSkill, "SKILL.md")), true);
    assert.equal(existsSync(join(installedSkill, "agents", "openai.yaml")), true);
    assert.match(readFileSync(join(installedSkill, "SKILL.md"), "utf8"), /pulse summary/);
  } finally {
    rmSync(skillsDir, { recursive: true, force: true });
  }
});

test("install script rejects invalid arguments", () => {
  const result = spawnSync(process.execPath, ["scripts/install-codex-skill.mjs", "--skills-dir"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /--skills-dir requires a value/);
});
