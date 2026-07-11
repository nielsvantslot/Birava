export class CommentDTO {
  declare id: string;
  declare entryId: string;
  declare userId: string;
  declare username: string;
  declare avatarUrl: string | null;
  declare body: string;
  declare createdAt: string;
}
