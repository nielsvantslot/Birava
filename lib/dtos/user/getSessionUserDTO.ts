/** The logged-in user's own session data — email is only ever shown to the account owner. */
export class SessionUserDTO {
  declare id: string;
  declare username: string;
  declare avatarUrl: string | null;
  declare createdAt: string;
  declare email: string;
}
