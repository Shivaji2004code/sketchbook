# Shivaji’s Sketchbook

A single-user Excalidraw workspace with separate drawings, a thumbnail gallery, renaming, duplication, trash/restore, imports/exports, and Supabase sync.

Start with [SETUP.md](SETUP.md). GitHub Actions can install and build the app remotely, without installing dependencies on your laptop.

- Official Excalidraw editor, loaded only when opening a canvas.
- Supabase email/password authentication behind the username `shivaji`.
- One owner enforced by database and private image-storage policies.
- No password in source and no persistent local drawing library.
- Version-checked cloud saves preserve conflicts as separate copies.
- Static output for GitHub Pages.

## Current verification

Four data-model tests pass. Dependency installation, TypeScript compilation, editor runtime, deployed authentication, database policies, and cross-device integration have **not** been tested yet. Dependency download approval was declined and no cloud project has been configured.

Excalidraw’s embedded editor is included; hosted Excalidraw collaboration, cloud-share links, and paid services are not part of this app. Custom shape-library cloud persistence is not implemented; use the editor’s library file import/export.

Excalidraw is MIT licensed. Keep its attribution and dependency license notices when distributing the build.
