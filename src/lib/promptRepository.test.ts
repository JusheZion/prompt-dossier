import { describe, expect, it } from "vitest";
import { savePrompt } from "./promptRepository";
import type { PromptDraft } from "./types";

describe("prompt repository", () => {
  it("saves relationships through prompt-dossier-owned tables", async () => {
    const calls: Array<{ table: string; action: string }> = [];
    const client = createRecordingClient(calls);

    const draft: PromptDraft = {
      title: "Test prompt",
      promptText: "Describe the scene.",
      category: "scene",
      notes: "",
      model: "gpt-4o",
      status: "active",
      isFavorite: false,
      tags: "cinematic",
      collections: "issue one",
      characters: "Kron",
      looks: "moonlit armor",
      scenes: "temple",
      variables: "angle | wide | required",
    };

    await savePrompt(client as never, { id: "user-1" } as never, draft);

    const tables = calls.map((call) => call.table);
    expect(tables).toContain("prompts");
    expect(tables).toContain("prompt_dossier_tags");
    expect(tables).toContain("prompt_dossier_collections");
    expect(tables).toContain("prompt_dossier_characters");
    expect(tables).toContain("prompt_dossier_looks");
    expect(tables).toContain("prompt_dossier_scenes");
    expect(tables).toContain("prompt_dossier_prompt_tags");
    expect(tables).toContain("prompt_dossier_prompt_collections");
    expect(tables).toContain("prompt_dossier_prompt_characters");
    expect(tables).toContain("prompt_dossier_prompt_looks");
    expect(tables).toContain("prompt_dossier_prompt_scenes");
    expect(tables).toContain("prompt_dossier_variables");
    expect(tables).toContain("prompt_dossier_versions");
    expect(tables).not.toContain("characters");
    expect(tables).not.toContain("prompt_characters");
  });
});

function createRecordingClient(calls: Array<{ table: string; action: string }>) {
  return {
    from(table: string) {
      const record = (action: string) => calls.push({ table, action });
      const builder = {
        upsert(rows: Array<{ name?: string }> | object) {
          record("upsert");
          return {
            error: null,
            select() {
              const sourceRows = Array.isArray(rows) ? rows : [];
              return {
                data: sourceRows.map((row, index) => ({
                  id: `${table}-${index + 1}`,
                  name: row.name ?? `${table}-${index + 1}`,
                })),
                error: null,
              };
            },
          };
        },
        insert() {
          record("insert");
          return { error: null };
        },
        delete() {
          record("delete");
          return builder;
        },
        eq() {
          return builder;
        },
      };
      return builder;
    },
  };
}
