import { useEffect, useMemo, useState } from "react";
import type { Session, SupabaseClient, User } from "@supabase/supabase-js";
import {
  Archive,
  Boxes,
  ChevronDown,
  CircleDot,
  Copy,
  Database,
  Download,
  Edit3,
  FileClock,
  Folder,
  Grid3X3,
  Home,
  Layers3,
  Library,
  Plus,
  Search,
  Settings,
  SlidersHorizontal,
  Sparkles,
  Star,
  Trash2,
  Upload,
  Users,
  X,
} from "lucide-react";
import { demoPrompts } from "./data/demoData";
import {
  categoryMeta,
  createExport,
  createPromptFromDraft,
  draftFromPrompt,
  duplicatePrompt,
  emptyDraft,
  filterPrompts,
} from "./lib/promptUtils";
import {
  deletePrompt as deleteDatabasePrompt,
  fetchPrompts,
  savePrompt as saveDatabasePrompt,
  toggleFavorite as toggleDatabaseFavorite,
} from "./lib/promptRepository";
import { createPromptDossierClient } from "./lib/supabaseClient";
import type { LibraryFilters, PromptDraft, PromptRecord } from "./lib/types";

const navigation = [
  { label: "Dashboard", icon: Home },
  { label: "Library", icon: Library },
  { label: "Collections", icon: Folder },
  { label: "Entities", icon: Users },
  { label: "Favorites", icon: Star },
  { label: "Versions", icon: FileClock },
  { label: "Settings", icon: Settings },
];

const defaultFilters: LibraryFilters = {
  search: "",
  category: "all",
  tag: "",
  model: "",
  entity: "",
  favoritesOnly: false,
};

const categoryOptions = ["all", ...Object.keys(categoryMeta)] as Array<LibraryFilters["category"]>;

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return fallback;
}

export default function App() {
  const [client] = useState<SupabaseClient | null>(() => createPromptDossierClient());
  const [session, setSession] = useState<Session | null>(null);
  const [prompts, setPrompts] = useState<PromptRecord[]>(demoPrompts);
  const [selectedId, setSelectedId] = useState(demoPrompts[1]?.id ?? demoPrompts[0]?.id);
  const [filters, setFilters] = useState<LibraryFilters>(defaultFilters);
  const [editorDraft, setEditorDraft] = useState<PromptDraft | null>(null);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [status, setStatus] = useState("Demo data loaded. Configure Supabase to persist changes.");
  const [isBusy, setIsBusy] = useState(false);

  const user = session?.user ?? null;
  const isDatabaseReady = Boolean(client && user);
  const visiblePrompts = useMemo(() => filterPrompts(prompts, filters), [prompts, filters]);
  const selectedPrompt = prompts.find((prompt) => prompt.id === selectedId) ?? visiblePrompts[0] ?? prompts[0];
  const stats = useMemo(() => buildStats(prompts), [prompts]);

  useEffect(() => {
    if (!client) return;

    client.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = client.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession));
    return () => data.subscription.unsubscribe();
  }, [client]);

  useEffect(() => {
    if (!client || !user) {
      setPrompts(demoPrompts);
      return;
    }

    loadDatabasePrompts(client, user);
  }, [client, user]);

  async function loadDatabasePrompts(activeClient = client, activeUser = user) {
    if (!activeClient || !activeUser) return;
    setIsBusy(true);
    try {
      const databasePrompts = await fetchPrompts(activeClient, activeUser);
      setPrompts(databasePrompts.length ? databasePrompts : []);
      setSelectedId(databasePrompts[0]?.id ?? "");
      setStatus(databasePrompts.length ? "Database library synced." : "Database connected. Create your first prompt.");
    } catch (error) {
      setStatus(getErrorMessage(error, "Database sync failed."));
    } finally {
      setIsBusy(false);
    }
  }

  async function handleAuth() {
    if (!client) return;
    setIsBusy(true);
    try {
      const credentials = { email: authEmail, password: authPassword };
      const { error } =
        authMode === "signin" ? await client.auth.signInWithPassword(credentials) : await client.auth.signUp(credentials);
      if (error) throw error;
      setStatus(authMode === "signin" ? "Signed in." : "Account created. Check email confirmation settings if needed.");
    } catch (error) {
      setStatus(getErrorMessage(error, "Authentication failed."));
    } finally {
      setIsBusy(false);
    }
  }

  async function handleSave(draft: PromptDraft) {
    const existing = draft.id ? prompts.find((prompt) => prompt.id === draft.id) : undefined;
    const nextPrompt = createPromptFromDraft(draft, existing);
    setIsBusy(true);
    try {
      if (client && user) {
        await saveDatabasePrompt(client, user, draft, existing);
        await loadDatabasePrompts(client, user);
      } else {
        setPrompts((current) => {
          const withoutExisting = current.filter((prompt) => prompt.id !== nextPrompt.id);
          return [nextPrompt, ...withoutExisting];
        });
        setSelectedId(nextPrompt.id);
      }
      setEditorDraft(null);
      setStatus(isDatabaseReady ? "Prompt saved to database." : "Prompt saved in demo memory for this session.");
    } catch (error) {
      setStatus(getErrorMessage(error, "Prompt save failed."));
    } finally {
      setIsBusy(false);
    }
  }

  async function handleFavorite(prompt: PromptRecord) {
    try {
      if (client && user) {
        await toggleDatabaseFavorite(client, user, prompt);
        await loadDatabasePrompts(client, user);
      } else {
        setPrompts((current) =>
          current.map((item) => (item.id === prompt.id ? { ...item, isFavorite: !item.isFavorite } : item)),
        );
      }
      setStatus(prompt.isFavorite ? "Favorite removed." : "Prompt favorited.");
    } catch (error) {
      setStatus(getErrorMessage(error, "Favorite update failed."));
    }
  }

  async function handleDelete(prompt: PromptRecord) {
    try {
      if (client && user) {
        await deleteDatabasePrompt(client, user, prompt.id);
        await loadDatabasePrompts(client, user);
      } else {
        setPrompts((current) => current.filter((item) => item.id !== prompt.id));
      }
      setSelectedId(prompts.find((item) => item.id !== prompt.id)?.id ?? "");
      setStatus("Prompt deleted.");
    } catch (error) {
      setStatus(getErrorMessage(error, "Delete failed."));
    }
  }

  async function handleCopy(prompt: PromptRecord) {
    await navigator.clipboard.writeText(prompt.promptText);
    setStatus("Prompt copied.");
  }

  function handleExport() {
    const blob = new Blob([createExport(prompts)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "prompt-dossier-export.json";
    anchor.click();
    URL.revokeObjectURL(url);
    setStatus("Library export downloaded.");
  }

  async function handleImport(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    try {
      const parsed = JSON.parse(text) as { prompts?: PromptRecord[] };
      if (!Array.isArray(parsed.prompts)) throw new Error("Import file must include a prompts array.");
      setPrompts(parsed.prompts);
      setSelectedId(parsed.prompts[0]?.id ?? "");
      setStatus("Import loaded into the current UI session. Save edited records to persist them.");
    } catch (error) {
      setStatus(getErrorMessage(error, "Import failed."));
    } finally {
      event.target.value = "";
    }
  }

  return (
    <main className="app-shell">
      <aside className="nav-rail" aria-label="Primary navigation">
        <div className="brand-lockup">
          <div className="brand-sigil" aria-hidden="true">
            <CircleDot size={44} />
          </div>
          <div>
            <h1>Prompt Dossier</h1>
            <p>{isDatabaseReady ? "Database Archive" : "Reference Preview"} • v0.1.0</p>
          </div>
        </div>

        <nav className="nav-list">
          {navigation.map(({ label, icon: Icon }) => (
            <button className={label === "Library" ? "nav-item active" : "nav-item"} key={label} type="button">
              <Icon size={20} />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <section className="storage-panel" aria-label="Storage status">
          <h2>{isDatabaseReady ? "Database" : "Database Setup"}</h2>
          <p className="storage-dot">
            <span />
            {isDatabaseReady ? "Supabase connected" : client ? "Sign in required" : "Env missing"}
          </p>
          {!client ? (
            <p className="muted">Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to enable database persistence.</p>
          ) : user ? (
            <p className="muted">{user.email}</p>
          ) : (
            <AuthPanel
              authEmail={authEmail}
              authMode={authMode}
              authPassword={authPassword}
              isBusy={isBusy}
              onAuth={handleAuth}
              onEmailChange={setAuthEmail}
              onModeChange={setAuthMode}
              onPasswordChange={setAuthPassword}
            />
          )}
          <div className="sigil-map" aria-hidden="true" />
        </section>
      </aside>

      <section className="workbench">
        <header className="command-bar">
          <label className="search-box">
            <Search size={18} />
            <input
              aria-label="Search prompts"
              placeholder="Search prompts"
              value={filters.search}
              onChange={(event) => setFilters({ ...filters, search: event.target.value })}
            />
            <kbd>⌘ K</kbd>
          </label>

          <div className="command-icons" aria-label="View controls">
            <button type="button" title="Database status">
              <Database size={18} />
            </button>
            <button type="button" title="Filters">
              <SlidersHorizontal size={18} />
            </button>
            <button className="active" type="button" title="Card grid">
              <Grid3X3 size={18} />
            </button>
          </div>

          <button className="primary-action" type="button" onClick={() => setEditorDraft(emptyDraft)}>
            <Plus size={20} />
            New Prompt
          </button>
          <button className="drop-action" type="button" aria-label="New prompt menu">
            <ChevronDown size={18} />
          </button>
        </header>

        <section className="filter-row" aria-label="Filters">
          <select
            aria-label="Category filter"
            value={filters.category}
            onChange={(event) => setFilters({ ...filters, category: event.target.value as LibraryFilters["category"] })}
          >
            {categoryOptions.map((category) => (
              <option key={category} value={category}>
                {category === "all" ? "Category" : categoryMeta[category].label}
              </option>
            ))}
          </select>
          <input value={filters.tag} onChange={(event) => setFilters({ ...filters, tag: event.target.value })} placeholder="Tag" />
          <input
            value={filters.model}
            onChange={(event) => setFilters({ ...filters, model: event.target.value })}
            placeholder="Model"
          />
          <input
            value={filters.entity}
            onChange={(event) => setFilters({ ...filters, entity: event.target.value })}
            placeholder="Character / Scene"
          />
          <button
            className={filters.favoritesOnly ? "chip-button active" : "chip-button"}
            type="button"
            onClick={() => setFilters({ ...filters, favoritesOnly: !filters.favoritesOnly })}
          >
            <Star size={16} />
            Favorites
          </button>
        </section>

        <section className="library-frame" aria-label="Prompt library">
          <div className="library-header">
            <div>
              <strong>{visiblePrompts.length}</strong> prompts
            </div>
            <span>Sort: Last Edited</span>
          </div>

          <div className="prompt-grid">
            {visiblePrompts.map((prompt) => (
              <PromptCard
                key={prompt.id}
                onFavorite={handleFavorite}
                onSelect={() => setSelectedId(prompt.id)}
                prompt={prompt}
                selected={prompt.id === selectedPrompt?.id}
              />
            ))}
            {!visiblePrompts.length && (
              <div className="empty-state">
                <Sparkles size={30} />
                <h2>No prompts found</h2>
                <p>Adjust filters or create a new dossier card.</p>
              </div>
            )}
          </div>
        </section>
      </section>

      {selectedPrompt && (
        <Inspector
          onCopy={handleCopy}
          onDelete={handleDelete}
          onDuplicate={(prompt) => setEditorDraft(duplicatePrompt(prompt))}
          onEdit={(prompt) => setEditorDraft(draftFromPrompt(prompt))}
          onFavorite={handleFavorite}
          prompt={selectedPrompt}
        />
      )}

      <footer className="status-strip">
        <span className="status-message">{isBusy ? "Syncing..." : status}</span>
        <span>{prompts.length} prompts</span>
        <span>{stats.favorites} favorites</span>
        <span>{stats.collections} collections</span>
        <span>{stats.characters} characters</span>
        <span>{stats.scenes} scenes</span>
        <label className="file-action">
          <Upload size={17} />
          Import
          <input type="file" accept="application/json" onChange={handleImport} />
        </label>
        <button type="button" onClick={handleExport}>
          <Download size={17} />
          Export
        </button>
      </footer>

      {editorDraft && (
        <PromptEditor
          draft={editorDraft}
          isBusy={isBusy}
          onCancel={() => setEditorDraft(null)}
          onChange={setEditorDraft}
          onSave={handleSave}
        />
      )}
    </main>
  );
}

function AuthPanel(props: {
  authEmail: string;
  authPassword: string;
  authMode: "signin" | "signup";
  isBusy: boolean;
  onAuth: () => void;
  onEmailChange: (value: string) => void;
  onModeChange: (value: "signin" | "signup") => void;
  onPasswordChange: (value: string) => void;
}) {
  return (
    <div className="auth-panel">
      <input
        aria-label="Email"
        placeholder="email"
        value={props.authEmail}
        onChange={(event) => props.onEmailChange(event.target.value)}
      />
      <input
        aria-label="Password"
        placeholder="password"
        type="password"
        value={props.authPassword}
        onChange={(event) => props.onPasswordChange(event.target.value)}
      />
      <div className="auth-actions">
        <button disabled={props.isBusy} type="button" onClick={props.onAuth}>
          {props.authMode === "signin" ? "Sign in" : "Sign up"}
        </button>
        <button
          type="button"
          onClick={() => props.onModeChange(props.authMode === "signin" ? "signup" : "signin")}
        >
          {props.authMode === "signin" ? "Need account" : "Have account"}
        </button>
      </div>
    </div>
  );
}

function PromptCard(props: {
  prompt: PromptRecord;
  selected: boolean;
  onFavorite: (prompt: PromptRecord) => void;
  onSelect: () => void;
}) {
  const meta = categoryMeta[props.prompt.category];
  const entityLabel = props.prompt.characters[0]?.name ?? props.prompt.scenes[0]?.name ?? props.prompt.looks[0]?.name ?? "-";

  return (
    <article
      className={props.selected ? "prompt-card selected" : "prompt-card"}
      style={{ "--accent": meta.accent, "--accent-soft": meta.soft } as React.CSSProperties}
      onClick={props.onSelect}
    >
      <div className="card-band">
        <span>{meta.label}</span>
        <button
          aria-label={props.prompt.isFavorite ? "Remove favorite" : "Favorite prompt"}
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            props.onFavorite(props.prompt);
          }}
        >
          <Star fill={props.prompt.isFavorite ? "currentColor" : "none"} size={18} />
        </button>
      </div>
      <h2>{props.prompt.title}</h2>
      <p>{props.prompt.promptText}</p>
      <div className="card-links">
        <span>{entityLabel}</span>
        <span>{props.prompt.tags[0] ?? "-"}</span>
      </div>
      <div className="card-foot">
        <span>
          <Boxes size={14} />
          {props.prompt.model || "-"}
        </span>
        <span>{relativeTime(props.prompt.updatedAt)}</span>
      </div>
      <div className="card-status">{props.prompt.status}</div>
      <div className="card-sigil" aria-hidden="true" />
    </article>
  );
}

function Inspector(props: {
  prompt: PromptRecord;
  onCopy: (prompt: PromptRecord) => void;
  onDelete: (prompt: PromptRecord) => void;
  onDuplicate: (prompt: PromptRecord) => void;
  onEdit: (prompt: PromptRecord) => void;
  onFavorite: (prompt: PromptRecord) => void;
}) {
  const meta = categoryMeta[props.prompt.category];
  const links = [
    ...props.prompt.characters.map((entity) => ({ ...entity, type: "Character" })),
    ...props.prompt.scenes.map((entity) => ({ ...entity, type: "Scene" })),
    ...props.prompt.looks.map((entity) => ({ ...entity, type: "Look" })),
  ];

  return (
    <aside className="inspector" aria-label="Prompt inspector">
      <div className="inspector-top">
        <div>
          <h2>Prompt Inspector</h2>
          <p style={{ color: meta.accent }}>{meta.label} prompt</p>
        </div>
        <div className="inspector-tools">
          <button type="button">
            <Archive size={16} />
          </button>
          <button type="button">
            <X size={16} />
          </button>
        </div>
      </div>

      <section className="inspector-hero">
        <div>
          <h3>{props.prompt.title}</h3>
          <p>#{props.prompt.id.slice(0, 12)}</p>
          <div className="meta-row">
            <span>{props.prompt.status}</span>
            <span>{props.prompt.model}</span>
            <span>{relativeTime(props.prompt.updatedAt)}</span>
          </div>
        </div>
        <button className="favorite-mark" type="button" onClick={() => props.onFavorite(props.prompt)}>
          <Star fill={props.prompt.isFavorite ? "currentColor" : "none"} />
        </button>
      </section>

      <div className="inspector-actions">
        <button type="button" onClick={() => props.onCopy(props.prompt)}>
          <Copy size={16} />
          Copy
        </button>
        <button type="button" onClick={() => props.onEdit(props.prompt)}>
          <Edit3 size={16} />
          Edit
        </button>
        <button type="button" onClick={() => props.onDuplicate(props.prompt)}>
          <Layers3 size={16} />
          Duplicate
        </button>
        <button type="button" onClick={() => props.onDelete(props.prompt)}>
          <Trash2 size={16} />
          Delete
        </button>
      </div>

      <InspectorSection title="Prompt Body">
        <pre className="prompt-body">{props.prompt.promptText}</pre>
      </InspectorSection>

      <InspectorSection title="Linked Entities" count={`${links.length} links`}>
        <div className="entity-list">
          {links.map((entity) => (
            <div key={`${entity.type}-${entity.name}`}>
              <span>{entity.name}</span>
              <em>{entity.type}</em>
            </div>
          ))}
        </div>
      </InspectorSection>

      <InspectorSection title="Variables" count={`${props.prompt.variables.length} variables`}>
        <div className="variable-list">
          {props.prompt.variables.map((variable) => (
            <div key={variable.id}>
              <code>{`{ ${variable.name} }`}</code>
              <span>default: {variable.defaultValue || "-"}</span>
            </div>
          ))}
        </div>
      </InspectorSection>

      <div className="split-section">
        <InspectorSection title="Tags" count={`${props.prompt.tags.length} tags`}>
          <div className="token-list">{props.prompt.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
        </InspectorSection>
        <InspectorSection title="Collections" count={`${props.prompt.collections.length} collections`}>
          <div className="token-list">{props.prompt.collections.map((collection) => <span key={collection}>{collection}</span>)}</div>
        </InspectorSection>
      </div>

      <InspectorSection title="Version History" count={`${props.prompt.versions.length} versions`}>
        <div className="version-list">
          {props.prompt.versions.map((version) => (
            <div key={version.id}>
              <strong>v{version.versionNumber}</strong>
              <span>{version.notes || "Saved version."}</span>
              <time>{relativeTime(version.createdAt)}</time>
            </div>
          ))}
        </div>
      </InspectorSection>
    </aside>
  );
}

function InspectorSection(props: { title: string; count?: string; children: React.ReactNode }) {
  return (
    <section className="inspector-section">
      <header>
        <h2>{props.title}</h2>
        {props.count && <span>{props.count}</span>}
      </header>
      {props.children}
    </section>
  );
}

function PromptEditor(props: {
  draft: PromptDraft;
  isBusy: boolean;
  onCancel: () => void;
  onChange: (draft: PromptDraft) => void;
  onSave: (draft: PromptDraft) => void;
}) {
  const update = <K extends keyof PromptDraft>(key: K, value: PromptDraft[K]) => {
    props.onChange({ ...props.draft, [key]: value });
  };

  return (
    <div className="editor-backdrop" role="dialog" aria-modal="true" aria-label="Prompt editor">
      <form
        className="editor-panel"
        onSubmit={(event) => {
          event.preventDefault();
          props.onSave(props.draft);
        }}
      >
        <header>
          <div>
            <h2>{props.draft.id ? "Edit Prompt" : "New Prompt"}</h2>
            <p>Dossier records save prompt text, links, variables, and versions.</p>
          </div>
          <button type="button" onClick={props.onCancel}>
            <X size={18} />
          </button>
        </header>

        <label>
          Title
          <input value={props.draft.title} onChange={(event) => update("title", event.target.value)} required />
        </label>
        <label className="wide">
          Prompt text
          <textarea
            value={props.draft.promptText}
            onChange={(event) => update("promptText", event.target.value)}
            required
          />
        </label>
        <label>
          Category
          <select
            value={props.draft.category}
            onChange={(event) => update("category", event.target.value as PromptDraft["category"])}
          >
            {Object.entries(categoryMeta).map(([category, meta]) => (
              <option key={category} value={category}>
                {meta.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Model
          <input value={props.draft.model} onChange={(event) => update("model", event.target.value)} />
        </label>
        <label>
          Status
          <input value={props.draft.status} onChange={(event) => update("status", event.target.value)} />
        </label>
        <label>
          Tags
          <input value={props.draft.tags} onChange={(event) => update("tags", event.target.value)} />
        </label>
        <label>
          Collections
          <input value={props.draft.collections} onChange={(event) => update("collections", event.target.value)} />
        </label>
        <label>
          Characters
          <input value={props.draft.characters} onChange={(event) => update("characters", event.target.value)} />
        </label>
        <label>
          Looks
          <input value={props.draft.looks} onChange={(event) => update("looks", event.target.value)} />
        </label>
        <label>
          Scenes
          <input value={props.draft.scenes} onChange={(event) => update("scenes", event.target.value)} />
        </label>
        <label className="wide">
          Variables
          <textarea
            value={props.draft.variables}
            onChange={(event) => update("variables", event.target.value)}
            placeholder="camera_angle | front wide | required"
          />
        </label>
        <label className="wide">
          Notes
          <textarea value={props.draft.notes} onChange={(event) => update("notes", event.target.value)} />
        </label>
        <label className="check-row wide">
          <input
            checked={props.draft.isFavorite}
            type="checkbox"
            onChange={(event) => update("isFavorite", event.target.checked)}
          />
          Mark as favorite
        </label>

        <footer>
          <button type="button" onClick={props.onCancel}>
            Cancel
          </button>
          <button className="primary-action" disabled={props.isBusy} type="submit">
            Save Prompt
          </button>
        </footer>
      </form>
    </div>
  );
}

function buildStats(prompts: PromptRecord[]) {
  return {
    favorites: prompts.filter((prompt) => prompt.isFavorite).length,
    collections: new Set(prompts.flatMap((prompt) => prompt.collections)).size,
    characters: new Set(prompts.flatMap((prompt) => prompt.characters.map((character) => character.name))).size,
    scenes: new Set(prompts.flatMap((prompt) => prompt.scenes.map((scene) => scene.name))).size,
  };
}

function relativeTime(value: string) {
  const diffMs = Date.now() - Date.parse(value);
  const hours = Math.max(1, Math.round(diffMs / 36e5));
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}
