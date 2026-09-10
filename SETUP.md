# Set up your personal Sketchbook

The source is prepared, but dependencies have not been installed and the production build has not been verified. Download permission was declined during development. The four dependency-free data-model tests pass. No accounts, database, or live deployment have been created.

You can build on GitHub’s servers instead of installing dependencies on your laptop. The source files are small. Your drawings are stored in Supabase; the app does not create an IndexedDB or localStorage drawing library. Supabase may store a small login token in the browser. The browser also maintains its usual asset cache.

## 1. Create a Supabase project

1. Create a free account at https://supabase.com and create a project. Keep the database password in your password manager.
2. Open the SQL Editor, paste `supabase/schema.sql`, and run it once. It creates the drawings table, a private image bucket, owner-only access policies, and a save function that prevents accidental overwrites between devices.
3. Under Authentication → Users, manually add your one user using your email address and chosen password. Mark the email confirmed. The app uses the username `shivaji`; it maps to this email internally.
4. Copy that user’s UUID and run this SQL, replacing the placeholder:

```sql
insert into public.app_owner (singleton, user_id)
values (true, 'PASTE-YOUR-AUTH-USER-UUID');
```

5. Disable new user signups in Authentication settings. Keep email/password sign-in enabled. No signup or password is embedded in the app.
6. Find the project URL and public publishable key (or legacy anon key) under the project’s API settings. Never put a service-role or secret key in this app.

The SQL deliberately allows exactly one owner record. A user who is not that owner cannot read or save drawings, even if someone accidentally enables signups later.

## 2. Create the GitHub repository

1. Create a free GitHub account if needed, then a public repository named `sketchbook`. A public repository supports GitHub Pages on GitHub Free. Its code is public; drawings remain private in Supabase.
2. Upload this project’s source files, including the `.github/workflows/deploy.yml` workflow. Do not upload `.env`, passwords, `node_modules`, or drawing backups. GitHub’s web interface can create the workflow file by its full path if hidden folders are awkward to upload.
3. Open Settings → Secrets and variables → Actions → Variables. Add these three repository variables:

| Name | Value |
| --- | --- |
| `VITE_SUPABASE_URL` | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Your PUBLIC publishable or anon key |
| `VITE_OWNER_EMAIL` | The email of the Auth user you created |

These are public frontend configuration, not secrets. Row-level security protects your drawings. Your email is present in the built app; your password is not.

4. Under Settings → Pages, choose GitHub Actions as the deployment source.
5. Under Actions, run “Deploy sketchbook to GitHub Pages.” It downloads the dependencies, runs tests, builds the app, and publishes it. No dependency installation on your laptop is required.
6. The workflow displays the Pages URL after a successful run. Add that URL to Supabase Authentication’s Site URL setting.
7. Open the site, sign in with `shivaji` and the password you set, and create a drawing. Wait for “All changes synced” before closing.

The first full build is still unverified. If GitHub reports a build error, share the error text for correction. Once the first installation succeeds, commit the generated `package-lock.json` and change the workflow install step from `npm install` to `npm ci` for reproducible deployments.

## 3. Verify your cloud setup

- Create a drawing with a rectangle, an arrow, text, and an image. Wait for the synced status.
- Open the app in another browser or device, sign in, and open that drawing. Check the image and text.
- Rename and duplicate it; verify they remain separate.
- Move a drawing to Trash, then restore it.
- Export an Excalidraw file and a full backup, then import them. Imported drawings receive new IDs.
- Turn off internet while editing. The app should show unsaved/offline status. Keep the tab open, reconnect, and wait for sync before closing.
- Edit the same drawing on two devices before either syncs. The second stale save should create a conflict copy instead of overwriting the first.
- In Supabase, verify that an unauthenticated request cannot access `drawings` or the private image bucket. A second test account must also have no access.

## How saving works

Each canvas is an independent record. Changes are sent after a short pause; sync also checks every eight seconds while the app is open. Images go into a private Storage bucket. Scene data and thumbnails go into the database. This is cross-device sync, not live multiplayer editing.

Drawings stay in temporary memory while the tab is open. There is no permanent offline copy. If your connection fails, do not close or reload the page before sync completes. Export a file if needed. Closing a tab with unsaved work requests the browser’s standard warning, but browsers cannot guarantee that warning on forced closes or mobile app termination.

Trash preserves drawings and their images so you can restore them. It still counts toward storage usage. This version does not automatically purge trash or orphaned image uploads. Export backups if you want independent copies; downloads only happen when you choose Export.

The free Supabase plan has usage limits and may pause inactive projects. Resume a paused project in the Supabase dashboard. If cloud configuration is missing, the app offers an explicitly temporary preview, with no fake password check or cloud-save claim.

## Optional local development

Only if you want local development and permit dependency downloads:

```sh
npm install
cp .env.example .env.local
# Fill in the three public configuration values.
npm run dev
```

`npm test` runs data-model tests without third-party dependencies. `npm run build` checks types and creates the static site in `dist`. GitHub Pages uses a relative asset base, so repository subpaths work without server-side routing.
