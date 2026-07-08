export function createClient() {
  return {
    auth: {
      signOut: async () => ({ error: null }),
    },
  };
}
