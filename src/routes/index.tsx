import { createFileRoute } from "@tanstack/react-router";
import { ScopeShell } from "@/components/scope-shell";
import { Overview } from "@/components/overview";
export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "IntentScope | Overview" },
      {
        name: "description",
        content:
          "Recorded Hindi and Hinglish intent classification results, notebook training performance, and model connection status.",
      },
      { property: "og:title", content: "IntentScope | Overview" },
      {
        property: "og:description",
        content:
          "Recorded Hindi and Hinglish intent classification results, notebook training performance, and model connection status.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <ScopeShell page="Overview">
      <Overview />
    </ScopeShell>
  ),
});
