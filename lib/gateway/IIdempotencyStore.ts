/** Identifies one remembered request: the same user, key and endpoint. */
export type IdempotencyScope = {
  userId: string;
  key: string;
  /** The endpoint's gateway name, so one key can't collide across endpoints. */
  route: string;
};

/** What is kept of a first response so it can be sent again. */
export type StoredResponse = {
  status: number;
  contentType: string | null;
  body: string;
};

export type IdempotencyBegin =
  /** First time this key is seen: run the handler, then `complete` or `abandon` with this claim. */
  | { state: "started"; claim: string }
  /** The first request already finished: send its response again. */
  | { state: "replay"; response: StoredResponse }
  /** The key is in use and cannot be answered: reused for a different request, or the first is still running. */
  | { state: "conflict"; reason: "different-request" | "in-progress" };

/** Remembers a mutation's first response briefly, so a retry with the same `Idempotency-Key` has no second effect. */
export interface IIdempotencyStore {
  begin(scope: IdempotencyScope, requestHash: string): Promise<IdempotencyBegin>;
  /** Stores the response for the claim returned by `begin`. A claim that was taken over meanwhile is ignored. */
  complete(claim: string, response: StoredResponse): Promise<void>;
  /** Forgets a started key whose request failed, so a retry runs again. Only affects the given claim. */
  abandon(claim: string): Promise<void>;
}
