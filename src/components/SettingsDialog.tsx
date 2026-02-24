import { useState, useEffect } from "react";
import { getLLMConfig, saveLLMConfig, fetchModels, LLMConfig } from "@/lib/llm";
import { X, RefreshCw } from "lucide-react";

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
}

export function SettingsDialog({ open, onClose }: SettingsDialogProps) {
  const [config, setConfig] = useState<LLMConfig>(getLLMConfig);
  const [models, setModels] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const loadModels = async () => {
    setLoading(true);
    const m = await fetchModels(config.baseUrl);
    setModels(m);
    setLoading(false);
  };

  useEffect(() => {
    if (open) loadModels();
  }, [open]);

  const handleSave = () => {
    saveLLMConfig(config);
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-foreground">Settings</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Ollama Server URL
            </label>
            <input
              value={config.baseUrl}
              onChange={(e) => setConfig({ ...config, baseUrl: e.target.value })}
              className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              placeholder="http://localhost:11434"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Model
            </label>
            <div className="flex gap-2">
              <input
                value={config.model}
                onChange={(e) => setConfig({ ...config, model: e.target.value })}
                list="model-list"
                className="flex-1 rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                placeholder="llama3.2"
              />
              <button
                onClick={loadModels}
                disabled={loading}
                className="rounded-lg border border-border px-3 py-2 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-50"
                title="Refresh models"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              </button>
            </div>
            <datalist id="model-list">
              {models.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
            {models.length > 0 && (
              <p className="mt-1 text-xs text-muted-foreground">
                {models.length} model(s) available
              </p>
            )}
            {models.length === 0 && !loading && (
              <p className="mt-1 text-xs text-destructive">
                No models found. Is Ollama running?
              </p>
            )}
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
