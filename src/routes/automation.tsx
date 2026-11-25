import { createFileRoute } from "@tanstack/react-router";
import { ScopeShell } from "@/components/scope-shell";
import { AutomationPanel } from "@/components/automation-panel";
export const Route = createFileRoute("/automation")({
  head: () => ({ meta: [{ title: "IntentScope | Workflows" }] }),
  component: () => <ScopeShell page="Workflows"><AutomationPanel /></ScopeShell>,
});
