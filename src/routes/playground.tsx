import { createFileRoute } from "@tanstack/react-router";
import { ScopeShell } from "@/components/scope-shell";
import { Playground } from "@/components/playground";
export const Route = createFileRoute("/playground")({
  head: () => ({
    meta: [
      { title: "IntentScope | Playground" },
      {
        name: "description",
        content:
          "Classify Hindi and Hinglish queries with the original saved HingRoBERTa-Mixed Fold 0 checkpoint.",
      },
      { property: "og:title", content: "IntentScope | Playground" },
      {
        property: "og:description",
        content:
          "Classify Hindi and Hinglish queries with the original saved HingRoBERTa-Mixed Fold 0 checkpoint.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <ScopeShell page="Intent Playground">
      <Playground />
    </ScopeShell>
  ),
});
