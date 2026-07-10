import { requireUser } from "@/lib/auth/requireUser";
import { getViewableDrinkPhoto } from "@/lib/queries/drinkEntryQueries";

export const GET = requireUser<RouteContext<"/api/photos/[entryId]">>(
  async (request, user, { params }) => {
    const { entryId } = await params;
    const photo = await getViewableDrinkPhoto(user.id, entryId);
    if (!photo) return new Response("Not found", { status: 404 });

    return new Response(photo.stream, {
      headers: {
        "Content-Type": photo.contentType,
        "Cache-Control": "private, max-age=86400",
      },
    });
  }
);
