import type { Prisma } from "@prisma/client";

export class VenueGeoMapper {
  /** Prisma stores venue coordinates as Decimal — flatten to plain numbers (or null) at the DTO/comparison boundary (see CLAUDE.md's Decimal→number mapper note). */
  static toLatLng(
    lat: Prisma.Decimal | null,
    lng: Prisma.Decimal | null
  ): { lat: number | null; lng: number | null } {
    return {
      lat: lat == null ? null : Number(lat),
      lng: lng == null ? null : Number(lng),
    };
  }
}
