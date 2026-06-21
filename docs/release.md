# Release checklist

Official desktop releases are created only from version tags. A manual workflow run builds `main` for verification and uploads an Actions artifact, but it never creates or replaces a GitHub Release.

## Prepare the version

1. Make sure `main` is up to date.
2. Bump the version in both `package.json` and `package-lock.json`.
3. Commit the version bump.
4. Run the required checks locally.

For `0.1.1`, the version bump is part of the release PR. If preparing it from `0.1.0`, use:

```bash
git checkout main
git pull

npm version patch --no-git-tag-version
git add package.json package-lock.json
git commit -m "chore: bump version to 0.1.1"
```

Do not run `npm version patch` again after `package.json` already reports `0.1.1`, or it will prepare `0.1.2`.

## Publish v0.1.1

1. Confirm `node -p "require('./package.json').version"` prints `0.1.1`.
2. Create the matching tag `v0.1.1`.
3. Push `main` and the tag.
4. Wait for the GitHub Actions **Release** workflow to finish.
5. Verify the GitHub Release contains `Project-Graveyard-0.1.1-x64.exe`.
6. Download and smoke test the installer.

```bash
git checkout main
git pull

node -p "require('./package.json').version"
git tag v0.1.1
git push origin main
git push origin v0.1.1
```

The workflow rejects a tag that does not match `package.json`, so a `v0.1.1` tag must point to code whose package version is `0.1.1`.

## Manual verification build

Open **Actions > Release > Run workflow**, select `main`, and start the run. The workflow uploads a versioned Windows installer under the run's **Artifacts** section for 14 days.

Manual runs intentionally do not create a Release. This keeps official downloads tied to reviewed, immutable version tags and avoids overwriting an existing release.
