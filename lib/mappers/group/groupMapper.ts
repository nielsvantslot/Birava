import type { Group as GroupRow } from "@prisma/client";
import type { GroupDTO } from "@/lib/dtos";

export class GroupMapper {
  static toDTO(group: GroupRow): GroupDTO {
    return {
      id: group.id,
      name: group.name,
      inviteCode: group.inviteCode,
      ownerId: group.ownerId,
    };
  }
}
