# Inspinia Admin Theme – Full Integration

This project is wired to use the **Inspinia Admin Theme**. The layout, markup, and assets follow Inspinia’s structure so the theme applies correctly.

## 1. Copy theme assets (required)

From the **repository root** run:

```powershell
.\scripts\copy-inspinia-assets.ps1
```

This copies from `ReferenceTheme\Inspinia\Seed\public` into `client\public`:

| What | Purpose |
|------|--------|
| **css/** | `vendors.min.css` (Tabler Icons, etc.), `app.min.css` (theme + Bootstrap), **fonts/** (Tabler Icons webfont) |
| **js/** | `config.js` (skin/theme), `vendors.min.js` (Bootstrap, jQuery, Simplebar), `app.js` (optional; sidebar/topbar behavior) |
| **plugins/bootstrap**, **plugins/simplebar** | Bootstrap bundle and Simplebar (used by vendors or directly) |
| **images/** | Logos and placeholders |

Without this step, the app will load but the theme CSS/JS will 404 and the UI will look unstyled.

## 2. What the app does

- **index.html**
  - Sets default theme attributes on `<html>`: `data-skin="classic"`, `data-bs-theme="light"`, `data-menu-color="dark"`, `data-topbar-color="light"`, `data-sidenav-size="default"`, `data-layout-position="fixed"`.
  - Loads `config.js` (so theme options apply), then `vendors.min.css` and `app.min.css`.
  - At end of body: `vendors.min.js` (Bootstrap, Simplebar, etc.), then the React app.

- **Layout (React)**
  - **Sidenav**: Inspinia structure – `.sidenav-menu`, `.logo` (light/dark, logo-lg/logo-sm with img + text fallback), `.button-close-offcanvas`, `.scrollbar` with `data-simplebar`, `.side-nav` with `.side-nav-item`, `.side-nav-link`, `.menu-icon`, `.menu-text`, `.menu-arrow`, `.collapse`, `.sub-menu`.
  - **Icons**: Tabler Icons via `ti ti-*` classes; mapping in `client/src/config/tablerIcons.ts`.
  - **Collapsible groups**: Bootstrap collapse with React state; active route opens the right parent and sets `.active` on current link/parents.
  - **Simplebar**: Initialized in React on the sidebar scroll area after mount (from `vendors.min.js`).
  - **Topbar**: `.app-topbar`, `.topbar-menu`, `.sidenav-toggle-button` (toggles `.sidebar-enable` on `<html>`), user dropdown with `data-bs-toggle="dropdown"`; Bootstrap dropdowns are initialized for the topbar after mount.
  - **Footer**: `.footer` inside `.content-page` (Inspinia-style).
  - **Backdrop**: When sidebar is open on small screens, a backdrop is shown and closing it or clicking outside removes `.sidebar-enable`.

- **layout.css**
  - Only base (html/body/#root height), auth page, avatar, table, kanban activity dot, and print rules. It does **not** override Inspinia’s `.wrapper`, `.sidenav-menu`, `.app-topbar`, `.content-page`, `.card`, `.footer`.

- **main.tsx**
  - Imports only `layout.css`. Bootstrap comes from the theme’s `app.min.css` (and optionally from `vendors.min.css` depending on the theme build).

## 3. Theme options (skins, sidebar, light/dark)

- **config.js** (from the theme) applies settings from `sessionStorage` and sets attributes on `<html>`.
- Defaults are set in `index.html`; config can override them (e.g. light/dark, sidebar size).
- The React app does not change theme/skin; it only drives sidebar open/close and menu expand/collapse.

## 4. Using another Inspinia package (e.g. Full)

- Edit `scripts/copy-inspinia-assets.ps1` and point `$src` at that package’s `public` folder (e.g. `ReferenceTheme\Inspinia\Full\public`), **or**
- Manually copy the same set of folders (css, js, plugins, images) from that package into `client\public`.

The React layout uses Inspinia’s standard class names and structure, so any build that provides `vendors.min.css`, `app.min.css`, and the same JS structure should work.

## 5. Optional: theme’s app.js

The theme’s `app.js` runs on `DOMContentLoaded` and sets up sidebar/topbar behavior (e.g. link activation, sidebar toggle). In this app:

- **vendors.min.js** is loaded so Bootstrap (dropdown/collapse) and Simplebar are available.
- **app.js** is **not** loaded by default (it would run before React mounts). Sidebar toggle, active link, and Simplebar are implemented in React.
- If you want the theme’s own behavior (e.g. LayoutCustomizer), you can load `app.js` **after** the React app has mounted and then trigger the theme’s init (e.g. by exposing a global that calls `new App().init()` after mount). That requires adapting the theme’s bootstrap or using a custom build.

## 6. Summary

1. Run **`.\scripts\copy-inspinia-assets.ps1`** so `client\public` has the theme’s css, js, plugins, and images.
2. Start the app (`npm run dev`). The layout uses Inspinia’s structure and classes; theme styles and scripts apply.
3. To change skin/theme, use the theme’s config (or add a custom control that updates `sessionStorage` and reloads or that sets `data-*` on `<html>` and re-runs config logic).
