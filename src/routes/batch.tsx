import { createFileRoute } from "@tanstack/react-router";
import { ScopeShell } from "@/components/scope-shell";
import { Batch } from "@/components/batch";
export const Route = createFileRoute("/batch")({
  head: () => ({
    meta: [
      { title: "IntentScope | Batch prediction" },
      {
        name: "description",
        content: "Upload queries and export original class IDs in competition submission format.",
      },
      { property: "og:title", content: "IntentScope | Batch prediction" },
      {
        property: "og:description",
        content: "Upload queries and export original class IDs in competition submission format.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <ScopeShell page="Batch Prediction">
      <Batch />
    </ScopeShell>
  ),
});
