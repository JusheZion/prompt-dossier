import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { LinkedEntity, PromptDraft, PromptRecord, PromptVariable, PromptVersion } from "./types";
import { createPromptFromDraft, normalizeList, parseVariables } from "./promptUtils";

type NamedTable =
  | "prompt_dossier_tags"
  | "prompt_dossier_collections"
  | "prompt_dossier_characters"
  | "prompt_dossier_looks"
  | "prompt_dossier_scenes";
type JoinTable =
  | "prompt_dossier_prompt_tags"
  | "prompt_dossier_prompt_collections"
  | "prompt_dossier_prompt_characters"
  | "prompt_dossier_prompt_looks"
  | "prompt_dossier_prompt_scenes";

interface DatabasePromptRow {
  id: string;
  title: string;
  prompt_text: string;
  category: PromptRecord["category"];
  notes: string | null;
  model: string | null;
  status: string | null;
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
  tags?: Array<{ tag: { id: string; name: string } | null }>;
  collections?: Array<{ collection: { id: string; name: string } | null }>;
  characters?: Array<{ character: LinkedEntity | null }>;
  looks?: Array<{ look: LinkedEntity | null }>;
  scenes?: Array<{ scene: LinkedEntity | null }>;
  prompt_dossier_variables?: Array<{
    id: string;
    variable_name: string;
    default_value: string | null;
    is_required: boolean;
  }>;
  prompt_dossier_versions?: Array<{
    id: string;
    version_number: number;
    prompt_text: string;
    notes: string | null;
    created_at: string;
  }>;
}

export interface RepositoryStatus {
  mode: "database" | "demo";
  label: string;
}

export async function fetchPrompts(client: SupabaseClient, user: User): Promise<PromptRecord[]> {
  const { data, error } = await client
    .from("prompts")
    .select(
      `
      id,
      title,
      prompt_text,
      category,
      notes,
      model,
      status,
      is_favorite,
      created_at,
      updated_at,
      tags:prompt_dossier_prompt_tags(tag:prompt_dossier_tags(id, name)),
      collections:prompt_dossier_prompt_collections(collection:prompt_dossier_collections(id, name)),
      characters:prompt_dossier_prompt_characters(character:prompt_dossier_characters(id, name, description)),
      looks:prompt_dossier_prompt_looks(look:prompt_dossier_looks(id, name, description)),
      scenes:prompt_dossier_prompt_scenes(scene:prompt_dossier_scenes(id, name, description)),
      prompt_dossier_variables(id, variable_name, default_value, is_required),
      prompt_dossier_versions(id, version_number, prompt_text, notes, created_at)
    `,
    )
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return (((data ?? []) as unknown) as DatabasePromptRow[]).map(mapPromptRow);
}

export async function savePrompt(
  client: SupabaseClient,
  user: User,
  draft: PromptDraft,
  existing?: PromptRecord,
): Promise<void> {
  const prompt = createPromptFromDraft(draft, existing);
  const id = prompt.id;

  const { error: promptError } = await client.from("prompts").upsert(
    {
      id,
      user_id: user.id,
      title: prompt.title,
      prompt_text: prompt.promptText,
      category: prompt.category,
      notes: prompt.notes,
      model: prompt.model,
      status: prompt.status,
      is_favorite: prompt.isFavorite,
    },
    { onConflict: "id" },
  );
  if (promptError) throw promptError;

  await syncNamedJoin(
    client,
    user.id,
    id,
    "prompt_dossier_tags",
    "prompt_dossier_prompt_tags",
    "tag_id",
    normalizeList(draft.tags),
  );
  await syncNamedJoin(
    client,
    user.id,
    id,
    "prompt_dossier_collections",
    "prompt_dossier_prompt_collections",
    "collection_id",
    normalizeList(draft.collections),
  );
  await syncNamedJoin(
    client,
    user.id,
    id,
    "prompt_dossier_characters",
    "prompt_dossier_prompt_characters",
    "character_id",
    normalizeList(draft.characters),
  );
  await syncNamedJoin(
    client,
    user.id,
    id,
    "prompt_dossier_looks",
    "prompt_dossier_prompt_looks",
    "look_id",
    normalizeList(draft.looks),
  );
  await syncNamedJoin(
    client,
    user.id,
    id,
    "prompt_dossier_scenes",
    "prompt_dossier_prompt_scenes",
    "scene_id",
    normalizeList(draft.scenes),
  );
  await syncVariables(client, user.id, id, parseVariables(draft.variables));

  if (!existing || existing.promptText !== draft.promptText) {
    const nextVersion = existing?.versions.length
      ? Math.max(...existing.versions.map((version) => version.versionNumber)) + 1
      : 1;
    const { error: versionError } = await client.from("prompt_dossier_versions").insert({
      prompt_id: id,
      user_id: user.id,
      version_number: nextVersion,
      prompt_text: draft.promptText,
      notes: existing ? "Saved from editor." : "Initial draft.",
    });
    if (versionError) throw versionError;
  }
}

export async function deletePrompt(client: SupabaseClient, user: User, promptId: string): Promise<void> {
  const { error } = await client.from("prompts").delete().eq("id", promptId).eq("user_id", user.id);
  if (error) throw error;
}

export async function toggleFavorite(client: SupabaseClient, user: User, prompt: PromptRecord): Promise<void> {
  const { error } = await client
    .from("prompts")
    .update({ is_favorite: !prompt.isFavorite })
    .eq("id", prompt.id)
    .eq("user_id", user.id);
  if (error) throw error;
}

async function syncNamedJoin(
  client: SupabaseClient,
  userId: string,
  promptId: string,
  table: NamedTable,
  joinTable: JoinTable,
  joinColumn: string,
  names: string[],
) {
  await client.from(joinTable).delete().eq("prompt_id", promptId).eq("user_id", userId);
  const entities = await ensureNamedEntities(client, userId, table, names);

  if (!entities.length) return;

  const { error } = await client.from(joinTable).insert(
    entities.map((entity) => ({
      prompt_id: promptId,
      user_id: userId,
      [joinColumn]: entity.id,
    })),
  );
  if (error) throw error;
}

async function ensureNamedEntities(client: SupabaseClient, userId: string, table: NamedTable, names: string[]) {
  if (!names.length) return [];

  const rows = names.map((name) => ({ user_id: userId, name }));
  const { data, error } = await client.from(table).upsert(rows, { onConflict: "user_id,name" }).select("id, name");
  if (error) throw error;
  return (data ?? []) as Array<{ id: string; name: string }>;
}

async function syncVariables(client: SupabaseClient, userId: string, promptId: string, variables: PromptVariable[]) {
  await client.from("prompt_dossier_variables").delete().eq("prompt_id", promptId).eq("user_id", userId);

  if (!variables.length) return;

  const { error } = await client.from("prompt_dossier_variables").insert(
    variables.map((variable) => ({
      prompt_id: promptId,
      user_id: userId,
      variable_name: variable.name,
      default_value: variable.defaultValue,
      is_required: variable.isRequired,
    })),
  );
  if (error) throw error;
}

function mapPromptRow(row: DatabasePromptRow): PromptRecord {
  return {
    id: row.id,
    title: row.title,
    promptText: row.prompt_text,
    category: row.category,
    notes: row.notes ?? "",
    model: row.model ?? "",
    status: row.status ?? "active",
    isFavorite: row.is_favorite,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    tags: compactNames(row.tags?.map((item) => item.tag)),
    collections: compactNames(row.collections?.map((item) => item.collection)),
    characters: compactEntities(row.characters?.map((item) => item.character)),
    looks: compactEntities(row.looks?.map((item) => item.look)),
    scenes: compactEntities(row.scenes?.map((item) => item.scene)),
    variables: (row.prompt_dossier_variables ?? []).map((variable) => ({
      id: variable.id,
      name: variable.variable_name,
      defaultValue: variable.default_value ?? "",
      isRequired: variable.is_required,
    })),
    versions: (row.prompt_dossier_versions ?? [])
      .map(
        (version): PromptVersion => ({
          id: version.id,
          versionNumber: version.version_number,
          promptText: version.prompt_text,
          notes: version.notes ?? "",
          createdAt: version.created_at,
        }),
      )
      .sort((a, b) => b.versionNumber - a.versionNumber),
  };
}

function compactNames(items: Array<{ name: string } | Array<{ name: string }> | null | undefined> = []): string[] {
  return items.flatMap((item) => {
    if (Array.isArray(item)) return item.flatMap((nested) => (nested.name ? [nested.name] : []));
    return item?.name ? [item.name] : [];
  });
}

function compactEntities(items: Array<LinkedEntity | LinkedEntity[] | null | undefined> = []): LinkedEntity[] {
  return items.flatMap((item) => {
    if (Array.isArray(item)) {
      return item.flatMap((nested) =>
        nested.name ? [{ id: nested.id, name: nested.name, description: nested.description }] : [],
      );
    }
    return item?.name ? [{ id: item.id, name: item.name, description: item.description }] : [];
  });
}
