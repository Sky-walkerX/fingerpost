# Contributing to Fingerpost

Start with [AGENTS.md](AGENTS.md), then read [the progress board](docs/progress.md)
and the current day's implementation plan. These instructions apply to people
and coding agents alike. Product decisions in [design §1](docs/design.md#1-decisions-locked-with-the-user)
are locked; guidance behavior and numbers come from [the guidance spec](docs/guidance-spec.md).

Follow [AGENTS.md §3](AGENTS.md#3-how-to-pick-up-and-finish-a-task) to choose an
unblocked task, claim it in a separate commit, run its failing tests, implement
it, verify completion, update the plan and progress board, and commit and push.
Copy the documented plan assets with `docs/superpowers/plans/assets/apply.sh`;
preserve existing work and implement only the assigned skeletons and new files.

Before marking a task done, meet [the definition of done in §4](AGENTS.md#4-definition-of-done-all-must-hold).
Do not weaken tests or bypass type checks. Run the task's checks, recursive
TypeScript typechecking for TS work, and the required Gradle tests and app build
for Android work.

Keep [the hard rules in §5](AGENTS.md#5-hard-rules), use
[the pinned toolchain in §6](AGENTS.md#6-toolchain-pinned-dont-upgrade), and follow
[the commands in §7](AGENTS.md#7-commands) and
[coding conventions in §8](AGENTS.md#8-code-conventions). Protocol changes must
keep the TypeScript schemas, golden fixtures, and Kotlin models in agreement.
Use synthetic fixtures; never commit secrets or user content.

Use short-lived branches and Conventional Commits, keep each task reviewable,
and require a review and green CI before merging a pull request. Document
blockers and necessary deviations in the progress board rather than silently
changing the plan or pinned dependencies.

All participants follow the [Code of Conduct](CODE_OF_CONDUCT.md). Report
vulnerabilities through the private process in [SECURITY.md](SECURITY.md).
Contributions are covered by the repository's [Apache-2.0 license](LICENSE).
