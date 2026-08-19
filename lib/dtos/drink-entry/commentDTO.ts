export class CommentDTO {
  declare id: string;
  declare sessionId: string;
  declare userId: string;
  declare username: string;
  declare avatarUrl: string | null;
  declare isDeveloper: boolean;
  declare body: string;
  declare createdAt: string;
}
