<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## IntentScope architecture
- Keep the React/TanStack frontend in src and the independent Python inference service in backend; workerd cannot run PyTorch.
- Browser requests use a configurable external FastAPI base URL; no server-side proxy or generated fallback predictions, so missing model artifacts remain honestly disconnected.
- Keep model preprocessing and inference in backend/inference.py shared by API and scripts; this prevents deployment and reproduction logic drifting from the notebook.
- Use a single startup-loaded model with one Uvicorn worker and an inference lock; multiple workers duplicate model memory and concurrent requests contaminate benchmarks.
- Source recorded metrics from the unchanged notebook and share the resulting JSON with API and frontend; never synthesize missing evaluation results.
- Mount ScopeProvider once at the root to retain connection and measured benchmark state across content routes; content routes each own their metadata.
- Documentation download copies in public/docs must match README.md, TECHNICAL_SUBMISSION.md and docs/MODEL_SETUP.md; downloads are part of the live application.
- Derive shared backend/frontend dataset_stats.json with scripts/analyze_datasets.py from private owner inputs; export only aggregate counts and artifact hashes so public deployment never includes competition rows.
- Keep strict CSV comparison in backend/reproduction.py shared with the reproduction CLI; reports separate ID alignment, target equality and inference provenance to avoid equating a reference comparison with checkpoint reproduction.
