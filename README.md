# CI-Sight media

Generated images for [CI-Sight](https://github.com/Anthonyy232/CI-Sight), kept off `master` so it stays light: the README hero and feature panels, and the social preview. Every script takes the path of a CI-Sight checkout of `master` and reads the logo from its `client/public/logo.svg`. The build needs no network.

| Path | What |
| --- | --- |
| `lib.cjs` | Fonts and rendering shared by the scripts |
| `fonts/` | Instrument Serif, under the SIL Open Font License (`OFL.txt`) |
| `readme/demo-data.json` | The invented user, repositories, builds, failure and log the screenshots show |
| `readme/capture.cjs` | Builds and serves the real dashboard and answers its API from the demo data, then captures the dashboard, a project page and a failed build into `readme/inputs/` |
| `readme/build.cjs` | Writes `.github/readme/*.png` in the checkout from `readme/inputs/`, and `social-preview.png` here |
| `social-preview.png` | The 1280x640 GitHub social preview |

## Setup

```bash
git clone https://github.com/Anthonyy232/CI-Sight.git
git clone --branch media https://github.com/Anthonyy232/CI-Sight.git ci-sight-media
cd ci-sight-media
npm ci && npx playwright install chromium
```

Or, from a checkout of `master`: `git worktree add ../ci-sight-media media`.

## README images

```bash
npm ci --prefix ../CI-Sight/client        # capture builds and serves the client with its own Vite
node readme/capture.cjs ../CI-Sight       # only when the UI or the demo data changed
node readme/build.cjs ../CI-Sight
```

The capture builds the client (into its ignored `client/dist`) and serves it with `vite preview` on port 5179, with no server, database or GitHub needed. It answers every `/api/*` request from `readme/demo-data.json`, and starts the page clock at the demo time in UTC, so dates and "minutes ago" come out the same each run. It captures at 1440x1000 and 2x, in light and dark, and stops on any API request the demo data doesn't cover.

The build also copies the social preview to `~/Downloads/CI-Sight-social-preview.png` when that folder exists.

Commit the new inputs and `social-preview.png` here, and the changed images on `master`. GitHub has no API for the social preview: upload `social-preview.png` in the repository settings under Social preview.

CI-Sight has no releases yet. When it does, add a banner script under `releases/` that reuses `lib.cjs`.
