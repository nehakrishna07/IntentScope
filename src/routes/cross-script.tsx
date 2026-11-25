import { createFileRoute } from "@tanstack/react-router";
import { ScopeShell } from "@/components/scope-shell";
import { CrossScript } from "@/components/cross-script";
export const Route = createFileRoute("/cross-script")({
  head: () => ({
    meta: [
      { title: "IntentScope | Cross-script comparison" },
      {
        name: "description",
        content: "Compare independent Hindi Devanagari and Romanized Hinglish predictions.",
      },
      { property: "og:title", content: "IntentScope | Cross-script comparison" },
      {
        property: "og:description",
        content: "Compare independent Hindi Devanagari and Romanized Hinglish predictions.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <ScopeShell page="Cross-Script Analysis">
      <CrossScript />
    </ScopeShell>
  ),
});
