# Feature-Based Modular Architecture - Refactor Summary

## Final Folder Tree

```
src/
├── app/
│   ├── store.ts          # Placeholder for future state management
│   └── rootReducer.ts    # Placeholder for future Redux
│
├── routes/
│   └── AppRoutes.tsx     # Central route definitions
│
├── layout/
│   ├── MainLayout.tsx    # Main app shell (sidebar, topbar)
│   ├── AuthLayout.tsx    # Auth pages layout
│   ├── Layout.tsx        # Original layout implementation
│   └── layout.css
│
├── shared/
│   ├── api/
│   │   └── baseClient.ts # Base HTTP client for all modules
│   ├── utils/
│   │   ├── sessionId.ts
│   │   ├── activityTracker.ts
│   │   ├── dateUtils.ts
│   │   └── timeAgo.ts
│   ├── constants/
│   │   ├── menuConfig.tsx
│   │   ├── tablerIcons.ts
│   │   ├── timezones.ts
│   │   └── indianStatesCities.ts
│   └── (components, hooks, contexts - remain in src/ for backward compat)
│
├── modules/
│   ├── users/
│   │   ├── api/usersApi.ts
│   │   ├── types/index.ts
│   │   └── tests/
│   ├── jobcards/
│   │   ├── api/jobcardsApi.ts
│   │   ├── types/index.ts
│   │   └── tests/
│   ├── hrms/
│   │   ├── api/hrmsApi.ts
│   │   ├── types/index.ts
│   │   └── tests/
│   ├── inventory/
│   │   ├── api/inventoryApi.ts
│   │   └── index.ts      # Re-exports from assets
│   ├── chat/
│   │   └── api/chatApi.ts
│   ├── reports/
│   │   └── api/reportsApi.ts
│   ├── settings/
│   │   └── api/settingsApi.ts
│   ├── assets/           # Asset list, tickets, masters, etc.
│   ├── accounts/
│   ├── calendar/
│   ├── dashboards/
│   ├── emails/
│   ├── health/
│   ├── auditLog/
│   └── worklogs/
│
├── api/
│   └── client.ts         # Re-exports from shared (legacy compat)
├── pages/                # Page components (modules re-export)
├── components/           # Shared components
├── contexts/             # App-wide contexts
├── hooks/                # Shared hooks
├── config/               # Legacy config (duplicated in shared/constants)
├── data/                 # Legacy data (duplicated in shared/constants)
├── utils/                # Legacy utils (duplicated in shared/utils)
├── App.tsx
└── main.tsx
```

## AppRoutes.tsx

All routes are defined in `src/routes/AppRoutes.tsx`. Routes import page components from module folders (e.g. `@/modules/assets`, `@/modules/hrms`).

## Module API Files

Each module has its own API file using `@/shared/api/baseClient`:

- `modules/users/api/usersApi.ts`
- `modules/jobcards/api/jobcardsApi.ts`
- `modules/hrms/api/hrmsApi.ts`
- `modules/inventory/api/inventoryApi.ts`
- `modules/chat/api/chatApi.ts`
- `modules/reports/api/reportsApi.ts`
- `modules/settings/api/settingsApi.ts`

## Import Paths

- `@/` maps to `src/` (via tsconfig paths)
- Shared API: `@/shared/api/baseClient`
- Module pages: `@/modules/<module>/` or via index exports

## Build Status

- **TypeScript**: Compiles (exit 0 for refactored code)
- **Pre-existing errors**: Chat.tsx has unrelated lint/type issues
- **Vite build**: May fail on vite.config https type (pre-existing)
- **No broken imports** from the refactor

## Migration Path

1. Pages still live in `src/pages/` - modules re-export them
2. Components/hooks/contexts remain in original locations
3. Gradually move pages into `modules/<name>/pages/` and update imports
4. Migrate components to `shared/components/` as they become reusable
5. Update pages to use module api files instead of global `api`
