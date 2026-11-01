# Codex Milestone Workflow

This workflow governs implementation work in the AROMAN Frontend and Backend repositories. The project owner and ChatGPT technical architect coordinate decisions and review; Codex implements the explicitly authorized scope.

## Planning

1. ChatGPT defines the technical scope, repository, starting baseline, and acceptance criteria.
2. The project owner approves important product, architecture, security, provider, infrastructure, and commercial decisions.
3. Codex executes the authorized implementation work and records assumptions or evidence gaps.
4. The task must identify allowed files and repositories, required checks, and Git operations that are explicitly authorized. If scope is limited, Codex keeps changes within it.

## Implementation

1. Use a dedicated branch and Git worktree for each milestone.
2. Before editing, verify the repository root, branch, clean/expected Git state, and full starting commit SHA. Compare it with the requested baseline. Stop and report a blocker if the baseline does not match.
3. Respect repository and scope boundaries. Check applicable repository instructions. Preserve unique local files and relevant Codex instructions.
4. Use repository evidence as the technical source of truth. Label uncertain claims as unverified or proposed.
5. Make the smallest complete change that meets acceptance criteria. Do not silently expand the task.
6. Run the requested and appropriate local checks, then report exact commands and outcomes. Do not describe CI as passed unless the relevant GitHub run was independently checked.

## Git operations

Codex must not commit, push, create a pull request, merge, delete branches, or delete worktrees unless the project owner explicitly authorizes that operation for the task. The project owner normally performs Git submission and cleanup with ChatGPT review.

- Open milestone pull requests against `develop`, not the legacy default `main`.
- Before merge, independently verify the PR base, reviewed diff, required GitHub CI checks, and any branch protection requirements.
- After every merge, record the PR number and final merge commit SHA in the milestone handoff/status record.
- Do not infer authorization for one Git operation from authorization for another.

## Cleanup

- Preserve unique local files, untracked work, and relevant Codex instructions.
- Verify that the intended commit is present in the target branch before removing a worktree.
- Never force-delete uncertain work. Resolve ownership and inspect status before cleanup.
- Delete branches or worktrees only when explicitly authorized.

## Handoff

Every Codex task finishes with a full Git audit report that includes:

- Repository name, absolute worktree path, branch, starting SHA, and current HEAD SHA.
- Exact `git status -sb`, `git diff --stat`, and `git diff --name-status` results.
- Untracked files, since they do not appear in ordinary `git diff` output.
- Complete changed-file list and concise implementation summary.
- Validation commands and exact results.
- Security/privacy review findings and unresolved questions or conflicting evidence.
- Confirmation of which Git operations did or did not occur.
- Recommended commit message, PR title, and PR base branch when submission is in scope.
- Any conditions that must be resolved before submission.

The handoff ends with one explicit review status: `READY FOR REVIEW` or `BLOCKED — explanation`.
