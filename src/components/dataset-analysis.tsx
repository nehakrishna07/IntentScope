import { useState } from "react";
import { Database, Files, Download, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadFile } from "@/lib/intentscope";
import { Metric, DistributionChart } from "./scope-widgets";
import stats from "@/data/dataset_stats.json";

export function DatasetAnalysis() {
  const [source, setSource] = useState<"training" | "reference">("training");
  const selected = stats[source];
  return (
    <section className="section-gap" aria-labelledby="dataset-heading">
      <div className="page-heading">
        <div>
          <h2 id="dataset-heading" className="text-lg">Competition dataset analysis</h2>
          <p className="subtitle mt-1">Original uploaded artifacts · Aggregate counts only</p>
        </div>
        <Button variant="outline" size="sm" onClick={() =>
          downloadFile("dataset_statistics.json", JSON.stringify(stats, null, 2), "application/json")
        }>
          <Download />Export statistics
        </Button>
      </div>
      <div className="metrics-grid">
        <Metric label="Training queries" value={stats.training.rows.toLocaleString()}
          foot={`${stats.training.class_count} labeled classes · ${stats.training.oos_count} Class 55 queries`}
          icon={Database} />
        <Metric label="Test queries" value={stats.test.rows.toLocaleString()}
          foot="Unlabeled competition test set" icon={Files} />
        <Metric label="Original submission OOS" value={stats.reference.oos_count.toLocaleString()}
          foot={`${(stats.reference.oos_count / stats.reference.rows * 100).toFixed(2)}% of reference predictions · Not test ground truth`}
          icon={ShieldCheck} />
      </div>
      <div className="panel-header flex-wrap gap-3">
        <h3>{source === "training" ? "Training class distribution" : "Original submission class distribution"}</h3>
        <div className="flex gap-1 flex-wrap" role="group" aria-label="Distribution source">
          {(["training", "reference"] as const).map((value) => (
            <Button key={value} size="sm" variant={source === value ? "secondary" : "ghost"}
              aria-pressed={source === value} onClick={() => setSource(value)}>
              {value === "training" ? "Training labels" : "Original submission"}
            </Button>
          ))}
        </div>
      </div>
      <DistributionChart data={selected.classes} />
      <p className="subtitle mb-5">
        {source === "training"
          ? "Full training labels, not Fold 0 validation support. Class 55 is Out-of-Scope."
          : "Recorded original predictions, not live inference or test accuracy. Recreated checkpoint comparison is pending."}
      </p>
      <div className="grid md:grid-cols-2 gap-5">
        {(["training", "test"] as const).map((key) => (
          <div key={key}>
            <h3 className="mb-3">{key === "training" ? "Training" : "Test"} script composition</h3>
            {stats[key].scripts.map((item) => (
              <div className="detail-row" key={item.script}>
                <span>{item.script}</span>
                <strong>{item.count.toLocaleString()} · {(item.count / stats[key].rows * 100).toFixed(1)}%</strong>
              </div>
            ))}
            <div className="detail-row"><span>Duplicate normalized queries</span>
              <strong>{stats[key].duplicate_normalized_queries}</strong></div>
            <div className="detail-row"><span>Empty after normalization</span>
              <strong>{stats[key].empty_after_normalization}</strong></div>
          </div>
        ))}
      </div>
      <div className="notice mt-5">
        <ShieldCheck />
        <span>
          {stats.reference.ids_and_order_match_test
            ? `All ${stats.reference.rows.toLocaleString()} original submission IDs match test IDs and order.`
            : "Original submission IDs do not match the test dataset order."}
          {" "}Prediction reproduction still requires the recreated Fold 0 checkpoint.
          Script counts describe characters, not inferred language. Raw competition rows are not published.
        </span>
      </div>
    </section>
  );
}