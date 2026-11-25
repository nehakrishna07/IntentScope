import { createFileRoute } from "@tanstack/react-router";
import { ScopeShell } from "@/components/scope-shell";
import { Performance } from "@/components/performance";
export const Route = createFileRoute("/performance")({
  head: () => ({
    meta: [
      { title: "IntentScope | Model performance" },
      {
        name: "description",
        content:
          "Review real Fold 0 evaluation metrics and measure inference latency on actual hardware.",
      },
      { property: "og:title", content: "IntentScope | Model performance" },
      {
        property: "og:description",
        content:
          "Review real Fold 0 evaluation metrics and measure inference latency on actual hardware.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <ScopeShell page="Model Performance">
      <Performance />
    </ScopeShell>
  ),
});
