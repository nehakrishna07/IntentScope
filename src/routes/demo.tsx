import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Playground } from "@/components/playground";
import { useScope } from "@/components/intentscope-context";
export const Route = createFileRoute("/demo")({
  head: () => ({ meta: [{ title: "IntentScope | Live Demo" }] }), component: Demo,
});
function Demo() {
  const { health } = useScope();
  const [message, setMessage] = useState("");
  async function fullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
      else setMessage("Browser fullscreen is unavailable. Use F11 or your browser’s fullscreen command.");
    } catch { setMessage("Fullscreen was blocked. Try your browser’s fullscreen command."); }
  }
  return <main className="demo-workspace"><header className="flex flex-wrap justify-between gap-3 items-center mb-8"><div><h2 className="text-xl">IntentScope</h2><p className="subtitle">HingRoBERTa-Mixed · 56 intent classes · {health.ready ? "Model connected" : "Model disconnected"}</p></div><div className="flex gap-2"><Button variant="outline" onClick={() => void fullscreen()}>Toggle fullscreen</Button><Button variant="ghost" asChild><Link to="/playground" onClick={() => { if (document.fullscreenElement) void document.exitFullscreen().catch(() => {}); }}>Exit demo</Link></Button></div></header>{message && <p className="subtitle">{message}</p>}{!health.ready && <p className="subtitle mb-4"><Link to="/playground">Open Playground to configure the model connection.</Link></p>}<Playground demo /></main>;
}
