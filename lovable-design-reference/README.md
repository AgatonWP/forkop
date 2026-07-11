# Lovable Design Reference

This folder is a curated snapshot of the Lovable web app design from `forkop/Program`.
It is included only so collaborators with access to `forkop` can inspect the web
design and compare it with the Expo mobile app.

It is not wired into the mobile app build.

## Good Starting Points

- `src/index.css` - Lovable theme tokens, colors, fonts, background treatment
- `tailwind.config.ts` - Tailwind color/font/radius mapping
- `src/pages/Index.tsx` - main marketplace/feed layout
- `src/pages/Profile.tsx` - profile page layout
- `src/components/Header.tsx` - sticky top header and logo treatment
- `src/components/CategoryTabs.tsx` - category pills
- `src/components/SearchFilters.tsx` - search/filter controls
- `src/components/ListingCard.tsx` - listing card styling
- `src/components/ListingDetailDialog.tsx` - detail modal styling
- `src/components/NationEmblem.tsx` - nation/event emblem rendering

## Included Assets

- Forkop logos
- Nation emblems used by `NationEmblem`
- A small set of event images referenced by the design

## Not Included

- `.env` or secrets
- Supabase client configuration
- Full auth, chat, migrations, tests, or deployment config
- `node_modules`
- The full Lovable web repository history

If a copied component imports something outside this folder, treat it as context from
the original web app rather than mobile app code that should compile here.
