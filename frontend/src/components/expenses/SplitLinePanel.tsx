"use client";

/**
 * SplitLinePanel — inline split allocation panel inside an expanded expense line card.
 *
 * Allows a single invoice amount to be distributed across multiple GL accounts.
 * Each split can have its own GL (via the parent's picker) and dimension values.
 * The parent component disables submission when split totals don't equal the parent amount.
 *
 * Summary bar turns green when fully allocated, amber when under, red when over.
 */

export interface SplitLineState {
  localId: string;
  backendId: string | null;
  gl_id: string | null;
  gl_number: string;
  gl_name: string;
  amount: string;
  dimension_values: Record<string, string>;
  dimension_requirements: Array<{ dimension_id: string; requirement: string }>;
}

export interface DimensionForForm {
  id: string;
  name: string;
  code: string;
  is_required: boolean;
  sort_order: number;
  values: Array<{ id: string; code: string; name: string; sort_order: number }>;
}

interface Props {
  parentAmount: number;
  splitLines: SplitLineState[];
  onAddSplit: () => void;
  onUpdateSplit: (localId: string, updates: Partial<SplitLineState>) => void;
  onRemoveSplit: (localId: string) => void;
  dimensions: DimensionForForm[];
  onPickGL: (splitLocalId: string) => void;
}

function fmt(n: number): string {
  return "₦" + Math.abs(n).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function SplitLinePanel({ parentAmount, splitLines, onAddSplit, onUpdateSplit, onRemoveSplit, dimensions, onPickGL }: Props) {
  const allocated = splitLines.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0);
  const remaining = parentAmount - allocated;
  const isExact = Math.abs(remaining) < 0.005;
  const isOver = remaining < -0.005;
  const pct = parentAmount > 0 ? Math.min(100, (allocated / parentAmount) * 100) : 0;

  return (
    <div className="mt-3 rounded-lg border border-dashed border-gray-300 bg-gray-50 p-3">
      {/* Header + status */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Split Lines</span>
        {isExact ? (
          <span className="text-xs text-green-600 font-medium">Fully allocated ✓</span>
        ) : isOver ? (
          <span className="text-xs text-red-500 font-medium">Over by {fmt(remaining)}</span>
        ) : (
          <span className="text-xs text-amber-600 font-medium">{fmt(remaining)} remaining</span>
        )}
      </div>

      {/* Progress bar */}
      <div className="w-full h-1.5 bg-gray-200 rounded-full mb-3 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${isOver ? "bg-red-500" : isExact ? "bg-green-500" : "bg-amber-400"}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Split rows */}
      <div className="space-y-2">
        {splitLines.map((split) => {
          const activeDims = split.dimension_requirements.filter((r) => r.requirement !== "na");
          return (
            <div key={split.localId} className="bg-white rounded-lg border border-gray-200 p-2.5">
              <div className="flex flex-wrap items-center gap-2">
                {/* GL chip */}
                <button type="button" onClick={() => onPickGL(split.localId)}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-blue-50 border border-blue-200 text-xs font-medium text-blue-700 hover:bg-blue-100 transition-colors max-w-48 truncate">
                  {split.gl_number ? (
                    <><span className="font-mono shrink-0">{split.gl_number}</span><span className="text-blue-500 truncate">{split.gl_name}</span></>
                  ) : (
                    <span>Select GL…</span>
                  )}
                </button>

                {/* Amount */}
                <input type="number" min="0.01" step="0.01" value={split.amount}
                  onChange={(e) => onUpdateSplit(split.localId, { amount: e.target.value })}
                  placeholder="0.00"
                  className="w-28 px-2 py-1 border border-gray-300 rounded text-xs text-right focus:outline-none focus:ring-1 focus:ring-blue-500" />

                {/* Remove */}
                <button type="button" onClick={() => onRemoveSplit(split.localId)}
                  className="ml-auto text-xs text-red-400 hover:text-red-600 font-medium">
                  Remove
                </button>
              </div>

              {/* Dimension fields */}
              {activeDims.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {activeDims.map((req) => {
                    const dim = dimensions.find((d) => d.id === req.dimension_id);
                    if (!dim) return null;
                    return (
                      <div key={req.dimension_id} className="flex-1 min-w-28">
                        <label className="block text-xs text-gray-500 mb-0.5">
                          {dim.name}{req.requirement === "required" && <span className="text-red-500"> *</span>}
                        </label>
                        <select value={split.dimension_values[req.dimension_id] ?? ""}
                          onChange={(e) => onUpdateSplit(split.localId, {
                            dimension_values: { ...split.dimension_values, [req.dimension_id]: e.target.value },
                          })}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500">
                          <option value="">Select…</option>
                          {dim.values.map((v) => (
                            <option key={v.id} value={v.id}>{v.code} — {v.name}</option>
                          ))}
                        </select>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <button type="button" onClick={onAddSplit}
        className="mt-2 text-xs text-blue-600 hover:text-blue-800 font-medium">
        + Add Split
      </button>
    </div>
  );
}
