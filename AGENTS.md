# Project instructions

- GitHub is source control; Netlify hosts and deploys this application.
- Codex works from this WSL repository and handles `git add`, commit, and push.
- Use feature branches for substantive development. Test before pushing, use a preview before production, and never merge major feature work into `main` without user approval.
- Preserve the curriculum, calendar, smart rebalancing, existing tracker behaviour, and existing user data. Never delete or reset tracker data without explicit approval.
- Do not use an OpenAI API.
- Minimise dependencies, context, and token usage. Do not use subagents unless explicitly requested.
- Do not refactor unrelated working code.

## Planned V2

- Private authentication, cross-device persistence, Netlify Functions, and Netlify Blobs.
- localStorage is cache and migration fallback only.
- Preserve smart schedule rebalancing. No AI API belongs in the website.
