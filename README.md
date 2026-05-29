# setupBranch Live-Head Repro

Owned-repo live reproduction for a snapshot-binding issue in `claude-code-action`.

Goal:

- Trigger a privileged `pull_request_target` run on PR snapshot A
- Check out `github.event.pull_request.head.sha` into `pr-head/`
- Force-push the PR branch to live head B during a deliberate pre-action sleep
- Show that `claude-code-action` later switches the workspace root to live branch B
  even though `pr-head/` remains pinned at snapshot A

The post-action steps print:

- workspace root `git rev-parse HEAD`
- workspace root `TARGET.txt`
- `pr-head` `git rev-parse HEAD`
- `pr-head/TARGET.txt`
