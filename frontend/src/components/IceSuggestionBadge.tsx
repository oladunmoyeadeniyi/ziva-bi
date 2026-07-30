"use client";

/**
 * IceSuggestionBadge — ICE AI suggestion display component.
 *
 * Renders a compact AI suggestion panel below a form field. Shows the
 * predicted value, confidence badge (HIGH/MEDIUM/LOW), and one-click
 * Accept / Dismiss controls.
 *
 * Usage (expense form GL field):
 *   <IceSuggestionBadge
 *     predictionId={prediction?.prediction_id}
 *     suggestedLabel={prediction?.predicted_gl_number + ' — ' + prediction?.predicted_gl_name}
 *     confidence={prediction?.confidence}
 *     confidenceBand={prediction?.confidence_band}
 *     reason={prediction?.reason}
 *     onAccept={() => handleIceAccept(prediction)}
 *     onDismiss={() => setIcePrediction(null)}
 *   />
 *
 * The parent is responsible for:
 * - Calling POST /api/ai/ice/predict and storing the result.
 * - Calling POST /api/ai/ice/feedback after the user accepts or corrects.
 * - Hiding this badge after the user acts.
 */

import { useState } from "react";

interface Props {
  predictionId?: string;
  suggestedLabel: string;
  confidence: number;
  confidenceBand: "HIGH" | "MEDIUM" | "LOW";
  reason?: string | null;
  onAccept: () => void;
  onDismiss: () => void;
}

const BAND_STYLES: Record<string, { badge: string; border: string; icon: string }> = {
  HIGH:   { badge: "bg-green-100 text-green-700", border: "border-green-200 bg-green-50", icon: "✦" },
  MEDIUM: { badge: "bg-amber-100 text-amber-700", border: "border-amber-200 bg-amber-50", icon: "◈" },
  LOW:    { badge: "bg-red-100 text-red-600",     border: "border-red-200 bg-red-50",     icon: "⚠" },
};

const BAND_LABEL: Record<string, string> = {
  HIGH:   "High confidence",
  MEDIUM: "Medium confidence",
  LOW:    "Low confidence",
};

export default function IceSuggestionBadge({
  suggestedLabel,
  confidence,
  confidenceBand,
  reason,
  onAccept,
  onDismiss,
}: Props) {
  const [showReason, setShowReason] = useState(false);
  const styles = BAND_STYLES[confidenceBand] ?? BAND_STYLES.LOW;

  return (
    <div className={`mt-1.5 rounded-lg border px-3 py-2 ${styles.border}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs text-gray-500">AI suggests:</span>
            <span className="text-xs font-medium text-gray-800 truncate">{suggestedLabel}</span>
            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${styles.badge}`}>
              {styles.icon} {BAND_LABEL[confidenceBand]} {confidence}%
            </span>
          </div>
          {showReason && reason && (
            <p className="text-xs text-gray-500 mt-1 italic">{reason}</p>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {reason && (
            <button
              type="button"
              onClick={() => setShowReason((v) => !v)}
              className="text-xs text-gray-400 hover:text-gray-600 px-1"
              title="Why this suggestion?"
            >
              {showReason ? "▲" : "?"}
            </button>
          )}
          <button
            type="button"
            onClick={onAccept}
            className="text-xs px-2 py-0.5 rounded bg-white border border-green-400 text-green-700 hover:bg-green-50 font-medium"
          >
            Use
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="text-xs px-2 py-0.5 rounded bg-white border border-gray-300 text-gray-500 hover:bg-gray-50"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}
