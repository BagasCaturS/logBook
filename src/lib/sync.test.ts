import { describe, expect, it, vi } from "vitest";
import { syncTable, type TableAdapter } from "./syncTable";

interface Local {
  id: string;
  updated_at: string;
  deleted?: boolean;
}

interface Row {
  id: string;
  updated_at: string;
  deleted?: boolean;
}

function makeClient(existing: Row[] = [], pages: Row[][] = [[]]) {
  const upserts: unknown[][] = [];
  let mode: "existing" | "pull" = "pull";
  const b: any = {
    from: () => b,
    select: () => b,
    eq: () => b,
    order: () => b,
    gt: () => b,
    in: () => {
      mode = "existing";
      return b;
    },
    range: (from: number) =>
      Promise.resolve({ data: pages[from / 1000] ?? [], error: null }),
    upsert: (rows: unknown[]) => {
      upserts.push(rows);
      return Promise.resolve({ error: null });
    },
    then: (resolve: (v: { data: Row[]; error: null }) => unknown) =>
      resolve({ data: mode === "existing" ? existing : [], error: null }),
  };
  return { client: b, upserts };
}

function makeAdapter(overrides: Partial<TableAdapter<Local>> = {}) {
  const applied = new Map<string, Local>();
  const cleaned: string[] = [];
  const adapter: TableAdapter<Local> = {
    selectColumns: "*",
    getLocal: async (id) => applied.get(id) ?? null,
    upsertLocal: async (r) => {
      applied.set(r.id, r);
    },
    markClean: async (id) => {
      cleaned.push(id);
    },
    payload: (r) => ({ ...r }),
    fromRemote: (r) => ({
      id: String(r.id),
      updated_at: String(r.updated_at),
      deleted: !!r.deleted,
    }),
    touchedAt: (r) => r.updated_at,
    idOf: (r) => r.id,
    ...overrides,
  };
  return { adapter, applied, cleaned };
}

const dirty = (id: string, updated_at: string) => [{ id, updated_at }];

describe("syncTable", () => {
  it("skips pushing a row when the remote copy is newer", async () => {
    const { client, upserts } = makeClient([
      { id: "a", updated_at: "2026-01-02T00:00:00.000Z" },
    ]);
    const { adapter, cleaned } = makeAdapter();

    await syncTable(
      client,
      "t",
      "u",
      "1970-01-01T00:00:00.000Z",
      async () => dirty("a", "2026-01-01T00:00:00.000Z"),
      adapter
    );

    expect(upserts).toHaveLength(0);
    expect(cleaned).toHaveLength(0);
  });

  it("pushes and marks clean when the local copy is newer", async () => {
    const { client, upserts } = makeClient([
      { id: "a", updated_at: "2026-01-01T00:00:00.000Z" },
    ]);
    const { adapter, cleaned } = makeAdapter();

    await syncTable(
      client,
      "t",
      "u",
      "1970-01-01T00:00:00.000Z",
      async () => dirty("a", "2026-01-02T00:00:00.000Z"),
      adapter
    );

    expect(upserts).toHaveLength(1);
    expect(cleaned).toEqual(["a"]);
  });

  it("applies remote rows to local storage", async () => {
    const row = { id: "a", updated_at: "2026-01-02T00:00:00.000Z" };
    const { client } = makeClient([], [[row]]);
    const { adapter, applied } = makeAdapter();

    const result = await syncTable(client, "t", "u", "", async () => [], adapter);

    expect(applied.get("a")).toMatchObject({ id: "a", updated_at: row.updated_at });
    expect(result.maxTs).toBe(Date.parse(row.updated_at));
    expect(result.blocked).toBe(false);
  });

  it("blocks the watermark on a tombstone still inside the undo grace", async () => {
    const now = new Date().toISOString();
    const row = { id: "a", updated_at: now, deleted: true };
    const { client } = makeClient([], [[row]]);
    const onRemoteDelete = vi.fn();
    const { adapter, applied } = makeAdapter({
      getLocal: async () => ({ id: "a", updated_at: "2026-01-01T00:00:00.000Z" }),
      onRemoteDelete,
    });

    const result = await syncTable(client, "t", "u", "", async () => [], adapter);

    expect(result.blocked).toBe(true);
    expect(onRemoteDelete).not.toHaveBeenCalled();
    expect(applied.has("a")).toBe(false);
  });

  it("deletes photos for a tombstone past the undo grace", async () => {
    const row = {
      id: "a",
      updated_at: new Date(Date.now() - 60_000).toISOString(),
      deleted: true,
    };
    const { client } = makeClient([], [[row]]);
    const onRemoteDelete = vi.fn();
    const { adapter, applied } = makeAdapter({
      getLocal: async () => ({ id: "a", updated_at: "2026-01-01T00:00:00.000Z" }),
      onRemoteDelete,
    });

    const result = await syncTable(client, "t", "u", "", async () => [], adapter);

    expect(result.blocked).toBe(false);
    expect(onRemoteDelete).toHaveBeenCalledTimes(1);
    expect(applied.get("a")?.deleted).toBe(true);
  });

  it("reads every page when the remote has more than 1000 rows", async () => {
    const first = Array.from({ length: 1000 }, (_, i) => ({
      id: `id-${i}`,
      updated_at: "2026-01-01T00:00:00.000Z",
    }));
    const second = [{ id: "last", updated_at: "2026-01-02T00:00:00.000Z" }];
    const { client } = makeClient([], [first, second]);
    const getLocal = vi.fn(async () => null);
    const { adapter } = makeAdapter({ getLocal });

    await syncTable(client, "t", "u", "", async () => [], adapter);

    expect(getLocal).toHaveBeenCalledTimes(1001);
  });
});
