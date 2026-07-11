import type { CommentDTO } from "./commentDTO";

export class CreateCommentResultDTO {
  declare error?: string;
  declare comment?: CommentDTO;
}
