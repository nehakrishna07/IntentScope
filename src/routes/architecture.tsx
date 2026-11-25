import { createFileRoute } from "@tanstack/react-router";
import { ScopeShell } from "@/components/scope-shell";
import { Architecture } from "@/components/architecture";
export const Route = createFileRoute("/architecture")({
  head: () => ({
    meta: [
      { title: "IntentScope | Model architecture" },
      {
        name: "description",
        content:
          "Explore notebook-faithful normalization, tokenization, transformer and argmax classification.",
      },
      { property: "og:title", content: "IntentScope | Model architecture" },
      {
        property: "og:description",
        content:
          "Explore notebook-faithful normalization, tokenization, transformer and argmax classification.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <ScopeShell page="Model Architecture">
      <Architecture />
    </ScopeShell>
  ),
});
