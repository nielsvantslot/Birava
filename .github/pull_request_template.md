## Summary

<!-- What changed and why -->

## Related issue(s)

<!-- Closes #123 -->

## Checklist

- [ ] Typechecked: `docker exec birava-app npx tsc --noEmit`
- [ ] Linted: `npm run lint`
- [ ] Tests added/updated where behavior changed
- [ ] If `prisma/schema.prisma` changed: migration included, and I ran
      `docker exec birava-app npm run prisma:generate` + `docker restart birava-app` locally
- [ ] If this touches day/week/streak logic: it goes through `lib/dates.ts` with a user time zone, not server-local time
- [ ] Checked against Birava 2.0 product invariants where relevant (session-as-hero-unit, variety-over-volume, accent discipline, vocabulary — see CLAUDE.md)
- [ ] Verified the change works in the running app (not just typecheck/tests), for UI-facing changes
