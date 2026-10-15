export type StoredPushSubscription = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

export interface IPushSubscriptionRepository {
  forUser(userId: string): Promise<StoredPushSubscription[]>;
  /** Drops a subscription the push service says is gone. */
  removeByEndpoint(endpoint: string): Promise<void>;
}
