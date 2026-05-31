import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";

const env = loadEnv(".env");
const url = env.VITE_SUPABASE_URL;
const anonKey = env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  fail("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env.");
}

const supabase = createClient(url, anonKey);
const suppliedEmail = process.env.PROMPT_DOSSIER_TEST_EMAIL;
const suppliedPassword = process.env.PROMPT_DOSSIER_TEST_PASSWORD;
const generatedEmail = `prompt-dossier-check-${Date.now()}@gmail.com`;
const generatedPassword = `PromptDossier!${Date.now()}`;
const email = suppliedEmail || generatedEmail;
const password = suppliedPassword || generatedPassword;

const authResult = suppliedEmail && suppliedPassword
  ? await supabase.auth.signInWithPassword({ email, password })
  : await supabase.auth.signUp({ email, password });

if (authResult.error) {
  if (!suppliedEmail && isAuthSetupBlocker(authResult.error.message)) {
    console.log(
      JSON.stringify(
        {
          ok: false,
          blocked: authResult.error.message,
          hasSession: false,
          nextStep:
            "Set PROMPT_DOSSIER_TEST_EMAIL and PROMPT_DOSSIER_TEST_PASSWORD for a confirmed user, then rerun npm run check:supabase-persistence.",
        },
        null,
        2,
      ),
    );
    process.exit(2);
  }

  fail(`Authentication failed: ${authResult.error.message}`);
}

const session = authResult.data.session;
const user = authResult.data.user;

if (!session || !user) {
  console.log(
    JSON.stringify(
      {
        ok: false,
        blocked: "Email confirmation required before Supabase can issue a test session.",
        hasUser: Boolean(user),
        hasSession: false,
        nextStep:
          "Set PROMPT_DOSSIER_TEST_EMAIL and PROMPT_DOSSIER_TEST_PASSWORD for a confirmed user, then rerun npm run check:supabase-persistence.",
      },
      null,
      2,
    ),
  );
  process.exit(2);
}

const promptId = crypto.randomUUID();
const title = `Persistence check ${Date.now()}`;
const editedTitle = `${title} edited`;

try {
  await assertNoError(
    supabase.from("prompts").insert({
      id: promptId,
      user_id: user.id,
      title,
      prompt_text: "Initial prompt body from persistence check.",
      category: "scene",
      notes: "Created by scripts/check-supabase-persistence.mjs",
      model: "gpt-4o",
      status: "active",
      is_favorite: false,
    }),
    "insert prompt",
  );

  const { data: tag } = await assertNoError(
    supabase
      .from("prompt_dossier_tags")
      .upsert({ user_id: user.id, name: "persistence-check" }, { onConflict: "user_id,name" })
      .select("id, name")
      .single(),
    "upsert tag",
  );

  await assertNoError(
    supabase.from("prompt_dossier_prompt_tags").insert({
      prompt_id: promptId,
      tag_id: tag.id,
      user_id: user.id,
    }),
    "link tag",
  );

  await assertNoError(
    supabase.from("prompt_dossier_variables").insert({
      prompt_id: promptId,
      user_id: user.id,
      variable_name: "camera_angle",
      default_value: "wide",
      is_required: true,
    }),
    "insert variable",
  );

  await assertNoError(
    supabase.from("prompt_dossier_versions").insert({
      prompt_id: promptId,
      user_id: user.id,
      version_number: 1,
      prompt_text: "Initial prompt body from persistence check.",
      notes: "Initial check version.",
    }),
    "insert version",
  );

  await assertNoError(
    supabase
      .from("prompts")
      .update({
        title: editedTitle,
        prompt_text: "Edited prompt body from persistence check.",
        is_favorite: true,
      })
      .eq("id", promptId)
      .eq("user_id", user.id),
    "edit prompt",
  );

  const { data: fetched } = await assertNoError(
    supabase
      .from("prompts")
      .select(
        `
        id,
        title,
        prompt_text,
        is_favorite,
        tags:prompt_dossier_prompt_tags(tag:prompt_dossier_tags(id, name)),
        prompt_dossier_variables(id, variable_name, default_value, is_required),
        prompt_dossier_versions(id, version_number, prompt_text, notes, created_at)
      `,
      )
      .eq("id", promptId)
      .single(),
    "fetch edited prompt",
  );

  if (fetched.title !== editedTitle) fail("Edited title did not persist.");
  if (fetched.prompt_text !== "Edited prompt body from persistence check.") fail("Edited prompt text did not persist.");
  if (!fetched.is_favorite) fail("Favorite toggle did not persist.");
  if (fetched.tags?.[0]?.tag?.name !== "persistence-check") fail("Tag relation did not persist.");
  if (fetched.prompt_dossier_variables?.[0]?.variable_name !== "camera_angle") fail("Variable did not persist.");
  if (fetched.prompt_dossier_versions?.[0]?.version_number !== 1) fail("Version did not persist.");

  console.log(
    JSON.stringify(
      {
        ok: true,
        projectRef: new URL(url).hostname.replace(".supabase.co", ""),
        verified: ["insert", "edit", "favorite", "tag relation", "variable", "version", "nested fetch"],
      },
      null,
      2,
    ),
  );
} finally {
  await supabase.from("prompts").delete().eq("id", promptId).eq("user_id", user?.id);
  await supabase.auth.signOut();
}

async function assertNoError(query, step) {
  const result = await query;
  if (result.error) fail(`${step} failed: ${result.error.message}`);
  return result;
}

function loadEnv(path) {
  if (!fs.existsSync(path)) return {};

  return Object.fromEntries(
    fs
      .readFileSync(path, "utf8")
      .split(/\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const index = line.indexOf("=");
        return [line.slice(0, index), line.slice(index + 1).replace(/^['"]|['"]$/g, "")];
      }),
  );
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

function isAuthSetupBlocker(message) {
  const normalized = message.toLowerCase();
  return normalized.includes("email rate limit") || normalized.includes("email not confirmed");
}
