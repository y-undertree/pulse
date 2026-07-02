import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const skillName = "pulse-shared-state";
const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "..");
const sourceSkillDir = join(repoRoot, "skills", skillName);

function usage() {
  return "usage: node scripts/install-codex-skill.mjs [--skills-dir DIR]\n";
}

function parseArgs(args) {
  let skillsDir;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--skills-dir") {
      const value = args[index + 1];
      if (value === undefined || value.startsWith("--")) {
        throw new Error("--skills-dir requires a value");
      }
      skillsDir = value;
      index += 1;
      continue;
    }
    throw new Error(`unknown option: ${arg}`);
  }
  return { skillsDir };
}

function defaultSkillsDir(env) {
  if (env.CODEX_HOME !== undefined && env.CODEX_HOME.trim() !== "") {
    return join(env.CODEX_HOME, "skills");
  }
  return join(homedir(), ".codex", "skills");
}

function installSkill(skillsDir) {
  if (!existsSync(sourceSkillDir)) {
    throw new Error(`source skill is missing: ${sourceSkillDir}`);
  }

  const destinationRoot = resolve(skillsDir);
  const destinationSkillDir = join(destinationRoot, skillName);
  if (resolve(sourceSkillDir) === resolve(destinationSkillDir)) {
    throw new Error("source and destination skill directories are identical");
  }

  mkdirSync(destinationRoot, { recursive: true });
  rmSync(destinationSkillDir, { recursive: true, force: true });
  cpSync(sourceSkillDir, destinationSkillDir, { recursive: true });
  return destinationSkillDir;
}

try {
  const { skillsDir } = parseArgs(process.argv.slice(2));
  const destination = installSkill(skillsDir ?? defaultSkillsDir(process.env));
  process.stdout.write(`Installed Pulse skill: ${destination}\n`);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`install-codex-skill: error: ${message}\n${usage()}`);
  process.exitCode = 1;
}
