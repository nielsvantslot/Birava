import { cache } from "react";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { removeBeerPhotoByUrl } from "@/lib/storage/local";

type QueryState = {
  table: string;
  select?: string;
  filters: Array<{ type: "eq" | "neq" | "in" | "not" | "ilike"; field: string; value: unknown; op?: string }>;
  orderBy?: { field: string; ascending: boolean };
  limitCount?: number;
  head?: boolean;
  count?: "exact";
};

const toIso = (d: Date) => d.toISOString();

const mapUser = (user: Awaited<ReturnType<typeof db.user.findUnique>>) => {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    user_metadata: { username: user.username },
    created_at: toIso(user.createdAt),
    recovery_sent_at: user.passwordResetToken ? toIso(user.createdAt) : null,
  };
};

function mapBeerEntry(entry: {
  id: string;
  userId: string;
  groupId: string | null;
  beerName: string | null;
  brewery: string | null;
  style: string | null;
  amount: unknown;
  notes: string | null;
  photoUrl: string | null;
  createdAt: Date;
}) {
  return {
    id: entry.id,
    user_id: entry.userId,
    group_id: entry.groupId,
    beer_name: entry.beerName,
    brewery: entry.brewery,
    style: entry.style,
    amount: Number(entry.amount),
    notes: entry.notes,
    photo_url: entry.photoUrl,
    created_at: toIso(entry.createdAt),
  };
}

export async function createClient() {
  const currentUser = await getCurrentUser();

  const auth = {
    getUser: async () => {
      const user = currentUser
        ? await db.user.findUnique({ where: { id: currentUser.id } })
        : null;
      return { data: { user: mapUser(user) } };
    },
  };

  const runSelect = async (state: QueryState) => {
    if (state.table === "profiles") {
      const where: Record<string, unknown> = {};
      for (const f of state.filters) {
        if (f.type === "eq") {
          if (f.field === "id") where.id = f.value;
          if (f.field === "username") where.username = f.value;
        }
        if (f.type === "neq" && f.field === "id") {
          where.id = { not: f.value };
        }
        if (f.type === "in" && f.field === "id") {
          where.id = { in: f.value as string[] };
        }
        if (f.type === "ilike" && f.field === "username") {
          const raw = String(f.value).replaceAll("%", "").trim();
          where.username = { contains: raw, mode: "insensitive" };
        }
      }

      const many = await db.user.findMany({
        where,
        take: state.limitCount,
      });

      const rows = many.map((u) => ({
        id: u.id,
        username: u.username,
        avatar_url: u.avatarUrl,
        created_at: toIso(u.createdAt),
      }));

      if (state.head && state.count === "exact") {
        return { data: null, count: rows.length, error: null };
      }

      return { data: rows, error: null };
    }

    if (state.table === "follows") {
      const where: Record<string, unknown> = {};
      for (const f of state.filters) {
        if (f.type === "eq" && f.field === "follower_id") where.followerId = f.value;
        if (f.type === "eq" && f.field === "following_id") where.followingId = f.value;
      }

      const data = await db.follow.findMany({ where });
      return {
        data: data.map((f) => ({
          follower_id: f.followerId,
          following_id: f.followingId,
          created_at: toIso(f.createdAt),
        })),
        error: null,
      };
    }

    if (state.table === "group_members") {
      const where: Record<string, unknown> = {};
      for (const f of state.filters) {
        if (f.type === "eq" && f.field === "user_id") where.userId = f.value;
        if (f.type === "eq" && f.field === "group_id") where.groupId = f.value;
      }

      const members = await db.groupMember.findMany({
        where,
        include: { group: true },
      });

      return {
        data: members.map((m) => ({
          group_id: m.groupId,
          user_id: m.userId,
          joined_at: toIso(m.joinedAt),
          groups: m.group
            ? {
                id: m.group.id,
                name: m.group.name,
                invite_code: m.group.inviteCode,
                owner_id: m.group.ownerId,
              }
            : null,
        })),
        error: null,
      };
    }

    if (state.table === "beer_entries") {
      const where: Record<string, unknown> = {};
      for (const f of state.filters) {
        if (f.type === "eq" && f.field === "user_id") where.userId = f.value;
        if (f.type === "eq" && f.field === "id") where.id = f.value;
        if (f.type === "in" && f.field === "user_id") where.userId = { in: f.value as string[] };
        if (f.type === "not" && f.field === "photo_url" && f.op === "is") where.photoUrl = { not: null };
      }

      if (state.head && state.count === "exact") {
        const count = await db.beerEntry.count({ where });
        return { data: null, count, error: null };
      }

      const entries = await db.beerEntry.findMany({
        where,
        orderBy: state.orderBy
          ? { [state.orderBy.field === "created_at" ? "createdAt" : state.orderBy.field]: state.orderBy.ascending ? "asc" : "desc" }
          : undefined,
        take: state.limitCount,
        include: state.select?.includes("profiles(")
          ? {
              user: {
                select: {
                  username: true,
                  avatarUrl: true,
                },
              },
            }
          : undefined,
      });

      return {
        data: entries.map((e) => {
          const base = mapBeerEntry(e);
          if (state.select?.includes("profiles(")) {
            return {
              ...base,
              profiles: e.user
                ? {
                    username: e.user.username,
                    avatar_url: e.user.avatarUrl,
                  }
                : null,
            };
          }
          return base;
        }),
        error: null,
      };
    }

    if (state.table === "groups") {
      const data = await db.group.findMany({
        where: {
          id: state.filters.find((f) => f.type === "eq" && f.field === "id")?.value as string | undefined,
        },
      });
      return {
        data: data.map((g) => ({
          id: g.id,
          name: g.name,
          invite_code: g.inviteCode,
          owner_id: g.ownerId,
          created_at: toIso(g.createdAt),
        })),
        error: null,
      };
    }

    return { data: [], error: null };
  };

  const runInsert = async (table: string, payload: Record<string, unknown>) => {
    try {
      if (table === "profiles") {
        await db.user.update({
          where: { id: String(payload.id) },
          data: { username: String(payload.username) },
        });
        return { error: null };
      }

      if (table === "beer_entries") {
        await db.beerEntry.create({
          data: {
            userId: String(payload.user_id),
            groupId: (payload.group_id as string | null) ?? null,
            beerName: (payload.beer_name as string | null) ?? null,
            brewery: (payload.brewery as string | null) ?? null,
            style: (payload.style as string | null) ?? null,
            amount: Number(payload.amount ?? 1),
            notes: (payload.notes as string | null) ?? null,
            photoUrl: (payload.photo_url as string | null) ?? null,
            createdAt: payload.created_at ? new Date(String(payload.created_at)) : new Date(),
          },
        });
        return { error: null };
      }

      if (table === "groups") {
        await db.group.create({
          data: {
            id: String(payload.id),
            name: String(payload.name),
            inviteCode: String(payload.invite_code),
            ownerId: String(payload.owner_id),
          },
        });
        return { error: null };
      }

      if (table === "group_members") {
        await db.groupMember.create({
          data: {
            groupId: String(payload.group_id),
            userId: String(payload.user_id),
          },
        });
        return { error: null };
      }

      if (table === "follows") {
        await db.follow.create({
          data: {
            followerId: String(payload.follower_id),
            followingId: String(payload.following_id),
          },
        });
        return { error: null };
      }
    } catch (error) {
      return { error: { message: error instanceof Error ? error.message : "Database error" } };
    }

    return { error: null };
  };

  const runUpdate = async (table: string, payload: Record<string, unknown>, filters: QueryState["filters"]) => {
    try {
      if (table === "beer_entries") {
        const id = filters.find((f) => f.type === "eq" && f.field === "id")?.value as string;
        const userId = filters.find((f) => f.type === "eq" && f.field === "user_id")?.value as string;
        await db.beerEntry.updateMany({
          where: { id, userId },
          data: {
            beerName: (payload.beer_name as string | null) ?? null,
            brewery: (payload.brewery as string | null) ?? null,
            style: (payload.style as string | null) ?? null,
            amount: Number(payload.amount ?? 1),
            notes: (payload.notes as string | null) ?? null,
            photoUrl: (payload.photo_url as string | null) ?? null,
            createdAt: payload.created_at ? new Date(String(payload.created_at)) : undefined,
          },
        });
        return { error: null };
      }

      if (table === "profiles") {
        const id = filters.find((f) => f.type === "eq" && f.field === "id")?.value as string;
        await db.user.update({
          where: { id },
          data: {
            username: payload.username ? String(payload.username) : undefined,
            avatarUrl: payload.avatar_url === undefined ? undefined : (payload.avatar_url as string | null),
          },
        });
        return { error: null };
      }
    } catch (error) {
      return { error: { message: error instanceof Error ? error.message : "Database error" } };
    }

    return { error: null };
  };

  const runDelete = async (table: string, filters: QueryState["filters"]) => {
    try {
      if (table === "beer_entries") {
        const id = filters.find((f) => f.type === "eq" && f.field === "id")?.value as string;
        const userId = filters.find((f) => f.type === "eq" && f.field === "user_id")?.value as string;
        await db.beerEntry.deleteMany({ where: { id, userId } });
        return { error: null };
      }

      if (table === "follows") {
        const followerId = filters.find((f) => f.type === "eq" && f.field === "follower_id")?.value as string;
        const followingId = filters.find((f) => f.type === "eq" && f.field === "following_id")?.value as string;
        await db.follow.deleteMany({ where: { followerId, followingId } });
        return { error: null };
      }
    } catch (error) {
      return { error: { message: error instanceof Error ? error.message : "Database error" } };
    }

    return { error: null };
  };

  const from = (table: string) => {
    const state: QueryState = {
      table,
      filters: [],
    };

    const chain = {
      select: (select: string, options?: { count?: "exact"; head?: boolean }) => {
        state.select = select;
        state.count = options?.count;
        state.head = options?.head;
        return chain;
      },
      insert: async (payload: Record<string, unknown>) => runInsert(table, payload),
      update: (payload: Record<string, unknown>) => {
        return {
          eq: (field: string, value: unknown) => {
            state.filters.push({ type: "eq", field, value });
            return {
              eq: async (field2: string, value2: unknown) => {
                state.filters.push({ type: "eq", field: field2, value: value2 });
                return runUpdate(table, payload, state.filters);
              },
              then: undefined,
              catch: undefined,
              finally: undefined,
              [Symbol.toStringTag]: "Promise",
            };
          },
        };
      },
      delete: () => ({
        eq: (field: string, value: unknown) => {
          state.filters.push({ type: "eq", field, value });
          return {
            eq: async (field2: string, value2: unknown) => {
              state.filters.push({ type: "eq", field: field2, value: value2 });
              return runDelete(table, state.filters);
            },
          };
        },
      }),
      eq: (field: string, value: unknown) => {
        state.filters.push({ type: "eq", field, value });
        return chain;
      },
      neq: (field: string, value: unknown) => {
        state.filters.push({ type: "neq", field, value });
        return chain;
      },
      ilike: (field: string, value: unknown) => {
        state.filters.push({ type: "ilike", field, value });
        return chain;
      },
      in: (field: string, value: unknown) => {
        state.filters.push({ type: "in", field, value });
        return chain;
      },
      not: (field: string, op: string, value: unknown) => {
        state.filters.push({ type: "not", field, op, value });
        return chain;
      },
      order: (field: string, opts?: { ascending?: boolean }) => {
        state.orderBy = { field, ascending: opts?.ascending ?? true };
        return chain;
      },
      limit: (count: number) => {
        state.limitCount = count;
        return chain;
      },
      single: async () => {
        const res = await runSelect(state);
        return { data: res.data?.[0] ?? null, error: null };
      },
      maybeSingle: async () => {
        const res = await runSelect(state);
        return { data: res.data?.[0] ?? null, error: null };
      },
      then: async (
        resolve: (value: { data: unknown[] | null; error: null; count?: number }) => unknown,
        reject?: (reason?: unknown) => unknown
      ) => {
        try {
          const res = await runSelect(state);
          return Promise.resolve(resolve(res));
        } catch (e) {
          if (reject) return Promise.resolve(reject(e));
          throw e;
        }
      },
    };

    return chain;
  };

  const rpc = async (name: string, params: Record<string, unknown>) => {
    if (!currentUser) return { data: null, error: { message: "Not authenticated" } };

    if (name === "get_follow_counts") {
      const profileId = String(params.profile_id);
      const [followers, following] = await Promise.all([
        db.follow.count({ where: { followingId: profileId } }),
        db.follow.count({ where: { followerId: profileId } }),
      ]);
      return { data: [{ followers, following }], error: null };
    }

    if (name === "get_social_feed") {
      const lim = Number(params.lim ?? 20);
      const off = Number(params.off ?? 0);
      const following = await db.follow.findMany({
        where: { followerId: currentUser.id },
        select: { followingId: true },
      });
      const ids = following.map((f) => f.followingId);
      if (ids.length === 0) return { data: [], error: null };
      const entries = await db.beerEntry.findMany({
        where: { userId: { in: ids } },
        include: { user: true },
        orderBy: { createdAt: "desc" },
        skip: off,
        take: lim,
      });
      return {
        data: entries.map((e) => ({
          ...mapBeerEntry(e),
          username: e.user.username,
          avatar_url: e.user.avatarUrl,
        })),
        error: null,
      };
    }

    if (name === "get_public_profile") {
      const username = String(params.target_username);
      const user = await db.user.findUnique({ where: { username } });
      if (!user) return { data: [], error: null };
      const total = await db.beerEntry.aggregate({
        where: { userId: user.id },
        _sum: { amount: true },
      });
      return {
        data: [
          {
            id: user.id,
            username: user.username,
            avatar_url: user.avatarUrl,
            member_since: toIso(user.createdAt),
            total_beers: Number(total._sum.amount ?? 0),
            streak_days: 0,
          },
        ],
        error: null,
      };
    }

    if (name === "join_group_by_invite_code") {
      const invite = String(params.invite).toUpperCase();
      const group = await db.group.findUnique({ where: { inviteCode: invite } });
      if (!group) return { data: null, error: { message: "Group not found" } };

      await db.groupMember.upsert({
        where: { groupId_userId: { groupId: group.id, userId: currentUser.id } },
        update: {},
        create: { groupId: group.id, userId: currentUser.id },
      });

      return { data: group.id, error: null };
    }

    if (name === "leave_group") {
      const targetGroupId = String(params.target_group_id);
      const group = await db.group.findUnique({ where: { id: targetGroupId } });
      if (!group) return { data: null, error: { message: "Group not found" } };
      if (group.ownerId === currentUser.id) {
        return { data: null, error: { message: "Group owners cannot leave their own group" } };
      }
      await db.groupMember.deleteMany({ where: { groupId: targetGroupId, userId: currentUser.id } });
      return { data: targetGroupId, error: null };
    }

    if (name === "delete_owned_group") {
      const targetGroupId = String(params.target_group_id);
      const deleted = await db.group.deleteMany({
        where: { id: targetGroupId, ownerId: currentUser.id },
      });
      if (deleted.count === 0) {
        return { data: null, error: { message: "Only the group owner can delete this group" } };
      }
      return { data: targetGroupId, error: null };
    }

    return { data: null, error: null };
  };

  const storage = {
    from: () => ({
      remove: async (paths: string[]) => {
        await Promise.all(paths.map((p) => removeBeerPhotoByUrl(`/uploads/beer-photos/${p}`)));
        return { error: null };
      },
    }),
  };

  return { auth, from, rpc, storage };
}

/**
 * Returns the authenticated user for the current request.
 * Wrapped with React `cache()` so that multiple server components
 * (e.g. layout + page) share a single network call per request.
 */
export const getUser = cache(async () => {
  return await getCurrentUser();
});
