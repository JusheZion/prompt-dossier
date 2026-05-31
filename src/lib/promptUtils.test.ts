import { describe, expect, it } from "vitest";
import { demoPrompts } from "../data/demoData";
import {
  createPromptFromDraft,
  duplicatePrompt,
  filterPrompts,
  formatVariables,
  normalizeList,
  parseVariables,
} from "./promptUtils";

describe("prompt utilities", () => {
  it("normalizes comma lists and removes case-insensitive duplicates", () => {
    expect(normalizeList("Kron, temple, kron,  ritual ")).toEqual(["Kron", "temple", "ritual"]);
  });

  it("parses prompt variables from editable lines", () => {
    expect(parseVariables("camera_angle | front wide | required\nlighting | dramatic")).toMatchObject([
      { name: "camera_angle", defaultValue: "front wide", isRequired: true },
      { name: "lighting", defaultValue: "dramatic", isRequired: false },
    ]);
  });

  it("formats prompt variables back to editable lines", () => {
    const variables = parseVariables("camera_angle | front wide | required\nlighting | dramatic");
    expect(formatVariables(variables)).toBe("camera_angle | front wide | required\nlighting | dramatic");
  });

  it("filters by search, category, tag, model, entity, and favorite state", () => {
    const result = filterPrompts(demoPrompts, {
      search: "temple",
      category: "scene",
      tag: "ritual",
      model: "gpt-4o",
      entity: "Kron",
      favoritesOnly: true,
    });

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Kron temple reveal");
  });

  it("creates a new version when an existing prompt body changes", () => {
    const original = demoPrompts[1];
    const updated = createPromptFromDraft(
      {
        id: original.id,
        title: original.title,
        promptText: `${original.promptText}\nAdditional atmosphere note.`,
        category: original.category,
        notes: original.notes,
        model: original.model,
        status: original.status,
        isFavorite: original.isFavorite,
        tags: original.tags.join(", "),
        collections: original.collections.join(", "),
        characters: original.characters.map((entity) => entity.name).join(", "),
        looks: original.looks.map((entity) => entity.name).join(", "),
        scenes: original.scenes.map((entity) => entity.name).join(", "),
        variables: formatVariables(original.variables),
      },
      original,
    );

    expect(updated.versions[0].versionNumber).toBe(4);
    expect(updated.versions[0].promptText).toContain("Additional atmosphere note.");
  });

  it("duplicates prompts as editable non-favorite drafts", () => {
    const draft = duplicatePrompt(demoPrompts[1]);
    expect(draft.id).toBeUndefined();
    expect(draft.title).toBe("Kron temple reveal copy");
    expect(draft.isFavorite).toBe(false);
  });
});
