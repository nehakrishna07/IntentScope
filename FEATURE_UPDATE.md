# IntentScope — feature update

This is a source-only overlay for your working project. It does not replace model weights, tokenizer, Python packages, node_modules, training notebook, submission CSV or existing datasets. The original model is unchanged. The displayed historical metrics belong to the original run; recreated checkpoint agreement must be verified separately.

## Install on Windows

1. Stop the running app with Ctrl+C. Open the actual project root containing `src`, `backend`, `scripts` and `model` in VS Code.
2. Make a backup of your existing source folders and workflow (not the model weights). Extract `IntentScope_Feature_Update.zip` directly into the existing project root. Allow replacement of the listed existing source files. Do not create a nested update folder. New route files go in `src/routes`; Vite/TanStack regenerates the route tree when starting. No dependencies were added.
3. Run `python scripts/start_local.py` in your activated Python environment, or use `.\.venv\Scripts\python.exe scripts/start_local.py` if your virtual environment is in this root. Open http://localhost:8080. If the new routes do not appear, stop and restart Vite, then refresh the browser.
4. Verify the original model connection, classify a known query, then test the additional pages. If any startup errors occur, restore the backup or send the terminal output.

## Test the five features

- Playground: select Hindi or Indian English/Hinglish, click Speak query, allow microphone access, review the transcript, then classify. Browser speech support/network access may be required. Use typed input if unavailable. Audio may be processed by the browser's speech provider; use non-sensitive demo text.
- Compare: run an equivalent Hindi/Romanized pair and the multiple-pair test. Agreement is not accuracy. Missing chart bars mean unknown probabilities outside the returned top three.
- Explain: classify a query, click Why this prediction?, inspect the signed word-occlusion scores. Explanations measure probability sensitivity, not causal reasoning. This is extra model computation and is not part of single-prediction latency.
- Live Demo: open from navigation or http://localhost:8080/demo; toggle fullscreen and use Exit demo to return.
- Workflows: see optional setup below. Default predictions do not send events unless you explicitly select the metadata checkbox. Compare and explain never dispatch automation.

## n8n (optional, requires an n8n instance)

Import `n8n/intentscope-workflow.json` into n8n. The updated demo workflow validates the payload, routes manual review candidates (class 55 or low probability if enabled), accepts class-specific routing metadata, and returns one HTTP response. It does not send email, create tickets, or write to Google Sheets. Its execution history is the demo record; external actions would need separately configured nodes and credentials. Replace/deactivate any existing workflow with the same webhook path before activating this one.

1. In the webhook node choose Header Auth, create a credential with header name `X-IntentScope-Secret` and a strong secret of your choosing. Save the credential and workflow, then publish/activate it. Copy the **production** webhook URL from the node. For local n8n, typically this is `http://localhost:5678/webhook/intentscope-intent` (use the actual URL shown in your instance).
2. Stop the local application. In the same PowerShell terminal used to start Python, set the server-only environment variables (replace the placeholders):

```powershell
$env:N8N_WEBHOOK_URL = 'YOUR_PRODUCTION_WEBHOOK_URL'
$env:N8N_WEBHOOK_SECRET = 'YOUR_HEADER_AUTH_SECRET'
$env:N8N_AUTH_HEADER = 'X-IntentScope-Secret'
$env:N8N_ENABLED = 'true'
python scripts/start_local.py
```

Never put the secret into a VITE_ variable, screenshot, GitHub commit, or upload. Keep the service local/trusted; its configuration endpoints do not implement user authentication. Use only data you are permitted to send. The raw query is omitted by default and when settings are saved through the new UI.

3. Open Workflows and click Test connection. A successful HTTP acknowledgment does not imply that any external action happened. Check the n8n execution for routing output. Save desired settings, then go to Playground and select Send prediction metadata before classifying a demo query. Check the recorded route and refresh Workflows. Settings/history reset when the Python service restarts. Optional webhook calls are synchronous, bounded by the configured timeout; reported model inference latency excludes webhook time. Failure does not alter the model's class or probability.

## Verification and limitations

Existing backend tests and additional automation tests run against a missing/mocked checkpoint, not your live model. The TypeScript/TSX files were syntax-transpiled; full dependency-based build and browser tests were not available in the authoring environment. The n8n Code node logic was checked separately in Node; actual imported workflow execution and browser speech must be tested locally. Intent IDs 0–54 remain numeric because no authoritative class-name mapping was provided; class 55 remains Out-of-Scope. Do not claim the original competition submission was reproduced without comparing predictions.
