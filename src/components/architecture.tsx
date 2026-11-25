import { useState, Fragment } from "react";
import {
  MessageSquare,
  TextCursorInput,
  ScanText,
  BrainCircuit,
  Layers,
  ChartNoAxesCombined,
  Target,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
const stages = [
  {
    title: "User Query",
    caption: "Hindi / Hinglish",
    icon: MessageSquare,
    detail:
      "Hindi in Devanagari, Romanized Hindi, or Hindi–English code-mixed text enters the same pipeline. No translation or script-specific routing is introduced.",
  },
  {
    title: "Normalization",
    caption: "Notebook preprocessing",
    icon: TextCursorInput,
    detail:
      "Apply NFKC normalization, lowercase, remove nukta, replace chandrabindu with anusvara, reduce Latin character repeats of three or more to two, replace punctuation with spaces, and collapse whitespace.",
  },
  {
    title: "Tokenizer",
    caption: "Up to 64 tokens",
    icon: ScanText,
    detail:
      "The original saved Hugging Face fast tokenizer produces token IDs and attention masks. Truncation is fixed at 64 tokens; dynamic batch padding rounds to a multiple of eight.",
  },
  {
    title: "HingRoBERTa",
    caption: "XLM-R encoder",
    icon: BrainCircuit,
    detail:
      "The fine-tuned l3cube-pune/hing-roberta-mixed encoder models context. Hindi–English code-mixed pretraining supports both scripts, but equivalent inputs are not guaranteed to produce identical predictions.",
  },
  {
    title: "Classifier",
    caption: "56 output logits",
    icon: Layers,
    detail:
      "The saved fine-tuned classification head maps encoder representations into 56 logits, corresponding to the original class IDs 0–55. It is never initialized from scratch at deployment.",
  },
  {
    title: "Softmax",
    caption: "Probability estimates",
    icon: ChartNoAxesCombined,
    detail:
      "Softmax produces model probability estimates for display. These are not calibrated guarantees of correctness and no extra confidence threshold changes prediction.",
  },
  {
    title: "Predicted Intent",
    caption: "Argmax · Classes 0–55",
    icon: Target,
    detail:
      "Argmax over the original logits chooses the class. Class 55 represents Out-of-Scope through normal multiclass prediction; there are no hand-coded OOS rules or bias tuning.",
  },
];
export function Architecture() {
  const [selected, setSelected] = useState(3);
  const stage = stages[selected];
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Model Architecture</h1>
          <p className="subtitle">
            One saved transformer. A transparent, notebook-faithful inference pipeline.
          </p>
        </div>
        <span className="tag cyan">278.09M parameters · approximate</span>
      </div>
      <div className="architecture-flow">
        {stages.map((s, i) => (
          <Fragment key={s.title}>
            <Button
              variant="ghost"
              className={`stage h-auto whitespace-normal ${selected === i ? "selected" : ""}`}
              onClick={() => setSelected(i)}
              aria-pressed={selected === i}
            >
              <s.icon />
              <h3>{s.title}</h3>
              <span>{s.caption}</span>
            </Button>
            {i < stages.length - 1 && <ArrowRight size={14} className="architecture-arrow" />}
          </Fragment>
        ))}
      </div>
      {stage && (
        <section className="panel">
          <div className="panel-header">
            <div className="flex gap-3 items-center">
              <stage.icon size={20} className="text-cyan" />
              <h2>{stage.title}</h2>
            </div>
            <span className="tag">Stage {selected + 1} / 7</span>
          </div>
          <div className="panel-body">
            <p className="subtitle">{stage.detail}</p>
          </div>
        </section>
      )}
      <div className="grid md:grid-cols-2 gap-5 section-gap">
        <section className="panel">
          <div className="panel-header">
            <h2>Why Macro-F1?</h2>
            <ChartNoAxesCombined className="text-primary" size={18} />
          </div>
          <div className="panel-body">
            <p className="subtitle">
              Intent frequencies are imbalanced. Macro-F1 computes the F1 score for each class and
              gives every intent equal weight. A strong overall accuracy can hide weak performance
              on less frequent intents; Macro-F1 makes that weakness visible.
            </p>
            <div className="detail-row mt-4">
              <span>Best Fold 0 Macro-F1</span>
              <strong>0.85716</strong>
            </div>
            <div className="detail-row">
              <span>Competition leaderboard Macro-F1</span>
              <strong>0.8196</strong>
            </div>
          </div>
        </section>
        <section className="panel">
          <div className="panel-header">
            <h2>Class 55 · Out-of-Scope</h2>
            <span className="tag warning">Ordinary argmax</span>
          </div>
          <div className="panel-body">
            <p className="subtitle">
              Class 55 is learned alongside the other 55 intent categories. When it has the largest
              logit, the model predicts an Out-of-Scope Query. The application highlights this
              result without overriding the model.
            </p>
            <pre>prediction = logits.argmax(axis=1)</pre>
            <p className="subtitle">
              No threshold optimization · No ensemble · No manually assigned predictions
            </p>
          </div>
        </section>
      </div>
      <section className="panel section-gap">
        <div className="panel-header">
          <h2>Original training configuration</h2>
        </div>
        <div className="panel-body grid md:grid-cols-2 gap-x-10">
          {[
            ["Epochs", "8 · best checkpoint at epoch 8"],
            ["Validation", "5 stratified splits, only Fold 0 trained"],
            ["Batch size", "8 · accumulation 2 · effective 16"],
            ["Encoder learning rate", "3e-5"],
            ["Classification head learning rate", "1e-3"],
            ["Label smoothing", "0.05"],
            ["Weight decay", "0.01"],
            ["Warm-up ratio", "0.10"],
          ].map(([k, v]) => (
            <div className="detail-row" key={k}>
              <span>{k}</span>
              <strong>{v}</strong>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
