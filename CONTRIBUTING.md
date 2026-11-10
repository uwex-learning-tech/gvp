# Contributing

Nothing is committed directly to `master`. Every change goes through a pull request.

## Changes

1. Branch from an up-to-date `master`, using a prefix that says what it is: `fix/`, `feature/`, `chore/` or `docs/` (e.g. `fix/chapters-empty-youtube`).
2. Make small, logical commits.
3. Push the branch and open a pull request describing what changed and how it was tested.
4. The CI check (`npm ci` and `npm run build`) must pass.
5. Squash-merge. The branch is deleted automatically.

Feature work doesn't change the version number or `CHANGELOG.md`; that happens at release time.

## Releases

1. On a `release/x.y.z` branch, update the version in `package.json`, `package-lock.json`, `README.md` and `starter-kit/index.html`, and add a `**x.y.z**` entry to the top of `CHANGELOG.md`.
2. Open a pull request and merge it.
3. Tag the merge commit on `master` and push the tag:

   ```sh
   git switch master && git pull
   git tag vx.y.z
   git push origin vx.y.z
   ```

The tag starts the Release workflow, which builds `gvp_v4_starter_kit.zip` and publishes the GitHub release with that version's changelog entry as the notes.
