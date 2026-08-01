export class SetMemberRoleDTO {
  declare groupId: string;
  declare userId: string;
  declare role: "ADMIN" | "MEMBER";
}
