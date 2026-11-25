import { createFileRoute } from "@tanstack/react-router";
import { ScopeShell } from "@/components/scope-shell";
import { Documentation } from "@/components/documentation";
export const Route = createFileRoute("/documentation")({
  head: () => ({
    meta: [
      { title: "IntentScope | Technical documentation" },
      {
        name: "description",
        content:
          "Set up the saved checkpoint, deploy FastAPI, verify parameters and reproduce the Fold 0 submission.",
      },
      { property: "og:title", content: "IntentScope | Technical documentation" },
      {
        property: "og:description",
        content:
          "Set up the saved checkpoint, deploy FastAPI, verify parameters and reproduce the Fold 0 submission.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <ScopeShell page="Technical Documentation">
      <Documentation />
    </ScopeShell>
  ),
});
