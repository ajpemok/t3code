# Maintaining AJPEMOK

AJPEMOK follows official T3 Code nightlies with a small set of local repairs and interface changes.
[upstream.json](upstream.json) records the official source base; [Changes](CHANGES.md) lists every fork change, its files and the behaviour to preserve during conflicts.
Update both when refreshing the fork or changing its scope.
Git records previous bases and patch revisions.

## Refresh From a Published Nightly

Use the existing T3 tools and package scripts.
The examples below use PowerShell from the checkout root.
Run each command in order and stop on any failure; PowerShell does not reliably throw for a native command's nonzero exit code.
The mutation steps below check exit codes explicitly.

### 1. Check the Checkout and Select the Release

```powershell
git status --short
git branch --show-current
git remote -v
$base = Get-Content .ajpemok/upstream.json -Raw | ConvertFrom-Json
gh release list --repo pingdotgg/t3code --limit 10
```

Continue with a clean checkout and the intended fork branch.
Preserve unrelated work in its existing branch or an explicit commit before refreshing.
Confirm that `upstream` and `origin` match the repository and fork in the manifest.
Select an exact published nightly tag; `upstream/main` and an unpublished tag are different update targets.
An update request authorises source work; installation or restart follows the user's existing authority separately.

### 2. Fetch and Inspect the Target

Set `$targetTag` to the selected release tag, then run:

```powershell
git fetch upstream tag $targetTag
if ($LASTEXITCODE -ne 0) { throw 'Fetching the target failed.' }
$targetCommit = git rev-parse "$targetTag^{commit}"
if ($LASTEXITCODE -ne 0) { throw 'The target tag does not resolve.' }
$storedBaseCommit = git rev-parse "$($base.tag)^{commit}"
if ($LASTEXITCODE -ne 0 -or $storedBaseCommit -ne $base.commit) { throw 'The stored base tag and commit disagree.' }
git merge-base --is-ancestor $base.commit HEAD
if ($LASTEXITCODE -ne 0) { throw 'The stored base is not an ancestor of this fork.' }
git merge-base --is-ancestor $base.commit $targetCommit
if ($LASTEXITCODE -ne 0) { throw 'The target does not descend from the stored base.' }
git log --oneline "$($base.commit)..$targetCommit"
git diff --name-only $base.commit $targetCommit
```

Both ancestry commands must exit zero, and the stored base tag must resolve to the manifest's commit.
If the target equals the base, the source is already at that nightly.
For a missing old base tag, fetch it explicitly from `upstream` before continuing.
If upstream rewrote history, resolve that change before choosing a different replay boundary.
Compare the upstream paths with [Changes](CHANGES.md), then inspect overlapping implementation and tests.
Similar issue titles alone do not establish that upstream replaced a local fix.

### 3. Replay the Fork on a Candidate Branch

```powershell
$originalBranch = git branch --show-current
$backup = "backup/ajpemok-before-$targetTag"
$candidate = "ajpemok/nightly-$targetTag"
git branch $backup HEAD
if ($LASTEXITCODE -ne 0) { throw 'Creating the backup failed.' }
git switch -c $candidate
if ($LASTEXITCODE -ne 0) { throw 'Creating the candidate branch failed.' }
git rebase --onto $targetCommit $base.commit
if ($LASTEXITCODE -ne 0) { throw 'Rebase stopped; inspect its state before continuing.' }
```

Use unique names if either ref already exists, or inspect an existing attempt before resuming it.
The backup retains the old fork and the original published branch stays unchanged.
Replay only the commits after the recorded official base.
Use the [conflict procedure](#resolve-conflicts) if Git stops.

### 4. Record the New Base and Check the Patch Set

After the rebase finishes, edit `upstream.json` to the selected tag and resolved commit.
Update [Changes](CHANGES.md) for replaced fixes, moved files and new behaviour.
Keep removed patch details in Git history rather than accumulating obsolete instructions.

```powershell
git range-diff "$($base.commit)..$backup" "$targetCommit..HEAD"
git diff --stat $targetCommit
git diff --check
```

Every changed or dropped patch needs an explanation from the upstream implementation or conflict resolution.
Every file in `git diff --name-only $targetCommit` must appear in the inventory, including tests, assets and maintenance files.
For this comparison, `HEAD` covers the replayed commits; review the uncommitted manifest and inventory changes separately.

### 5. Run Focused Checks

Compare dependency inputs between the backup and the candidate, including package manifests, workspace configuration, lockfile and patches.
Reuse the installed dependencies when those inputs and the required toolchain are unchanged.
Otherwise use `vp install --frozen-lockfile`, after checking T3's setup markers as described in [AGENTS.md](../AGENTS.md#dev-servers).
Use the Node version pinned by the current checkout.

```powershell
vp run check:changed $targetTag
```

Pass the official base explicitly: `origin/main` can point to a different history from this fork branch.
The command selects formatting, lint, unused-code checks, affected-package type checks and neighbouring tests.
Use the [patch checks](CHANGES.md#focused-checks) for conflicts it cannot qualify.
Avoid repo-wide checks and repeat successful checks only after a relevant change or failure.

On this Windows checkout, the wrapper has stalled while calculating its ignored-file cache key.
If that repeats without progress, interrupt that invocation and retain its output outside Git.
Read the current [check runner](../scripts/check-changed.ts) and run its applicable tasks directly against the changed paths and affected packages.
Record each result and the wrapper limitation; an interrupted wrapper has not passed.
CI still owns the full suites.

### 6. Build Once When a Package Is Needed

Follow the current [desktop build guide](../docs/operations/development.md#desktop-artifacts) for prerequisites and the [release runbook](../docs/operations/release.md) for packaging details.
Build after source checks, with the official nightly version so the existing nightly update channel remains available:

```powershell
$buildVersion = $targetTag -replace '^v', ''
vp run dist:desktop:win --build-version $buildVersion
```

The package version must retain the exact `-nightly.YYYYMMDD.BUILD` suffix.
The build script uses that suffix to choose the update channel; a custom suffix can select the stable channel instead.
Check `vp run dist:desktop:artifact --help` if upstream changes the flags.
Rebuild from the candidate source; `--skip-build` can reuse bundles from the previous checkout.
Use the version-matched Linux CLI archive through `--wsl-runtime` when the Windows package needs WSL support.
Keep generated packages and validation media outside tracked source.

macOS already has upstream DMG targets for arm64, x64 and universal builds.
Use a Mac with the documented Xcode/Rust prerequisites and qualify the fork there; Windows checks do not establish macOS acceptance.
Signing, passkeys and notarisation have additional requirements in the build guide.

### 7. Publish and Hand Over

Review the final diff and update the existing private handoff with checks and remaining limits before committing the base/inventory changes.
Before pushing, verify the destination and its visibility:

```powershell
gh repo view ajpemok/t3code --json url,visibility
git remote get-url origin
git push -u origin $candidate
```

Push the candidate normally and verify its remote SHA.
A new branch avoids rewriting the published branch; keep the backup until the update is accepted.
Tell the user which branch to select when cloning through T3 on another machine, because the fork's default branch can differ.
Source publication does not install or restart the application.
An official updater installation can replace local customisations; refresh and rebuild the fork when retaining them.

## Resolve Conflicts

1. Run `git status`, `git rebase --show-current-patch` and `git diff --name-only --diff-filter=U` to identify the patch and unresolved files.
2. Read the corresponding [patch group](CHANGES.md), then compare the incoming upstream implementation with the local behaviour and tests.
3. Resolve the smallest relevant hunks, stage only the resolved files with `git add <path>`, then run `git rebase --continue`.
4. After the replay completes, check the combined behaviour and use `range-diff` to find accidental omissions.

- During a rebase, **ours** is the new base plus patches already replayed; **theirs** is the fork commit being replayed.
  Avoid whole-file `--ours` or `--theirs` resolutions unless every discarded hunk has been reviewed.
- Use `git show :2:<path>` and `git show :3:<path>` to inspect both sides of an unresolved file.
  Check the current upstream symbol and callers when a file moved or disappeared.
- Preserve useful tests from both sides.
  A clean textual merge can still break lifecycle order, defaults or UI state.
- Drop a local repair when upstream covers the same behaviour and focused evidence agrees.
  Use `git rebase --skip` only when the entire current commit is redundant; mixed commits still need their remaining changes.
- Keep upstream dependency and generated-file tooling authoritative.
  Regenerate with the current tools if required; do not restore old lockfile or generated output wholesale.
- To abandon an unresolved attempt, run `git rebase --abort`, then `git switch $originalBranch`.
  The backup ref also preserves the pre-rebase commit.
  After publication or installation, rollback needs the appropriate source or installer path; `rebase --abort` only handles an active rebase.
- Keep uncertain resolutions and diagnostic output in the existing private handoff.
  Preserve live `~/.t3/userdata` and other running tasks throughout the update.

## Keep the Fork Small

Prefer existing T3 services, schemas, settings and package scripts.
Keep new code in small fork-owned helpers and minimise edits to large upstream components.
Retire upstreamed repairs and unused assets after checking callers.
Keep the independent Stream Deck project outside this fork.
This directory holds source maintenance instructions, not credentials, profiles, runtime exports or test recordings.
