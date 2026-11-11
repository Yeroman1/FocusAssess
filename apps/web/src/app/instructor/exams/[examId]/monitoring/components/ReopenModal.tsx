import React from 'react';
import { AttemptCandidate } from '../types';

interface ReopenModalProps {
  reopeningAttempt: AttemptCandidate;
  reopenReason: string;
  setReopenReason: (reason: string) => void;
  reopenTrustScore: number;
  setReopenTrustScore: (score: number) => void;
  isSubmittingReopen: boolean;
  onConfirm: (e: React.FormEvent) => void;
  onClose: () => void;
}

export function ReopenModal({
  reopeningAttempt,
  reopenReason,
  setReopenReason,
  reopenTrustScore,
  setReopenTrustScore,
  isSubmittingReopen,
  onConfirm,
  onClose,
}: ReopenModalProps) {
  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <form
        onSubmit={onConfirm}
        className="bg-surface-container-lowest max-w-md w-full rounded-2xl p-6 shadow-2xl border border-surface-container-high space-y-4"
      >
        <div className="flex items-center gap-3 text-secondary">
          <span className="material-symbols-outlined text-[28px]">restart_alt</span>
          <div>
            <h3 className="text-base font-bold text-on-surface">Reopen Examination Attempt</h3>
            <span className="text-xs font-mono text-on-surface-variant">
              Candidate: {reopeningAttempt.student.fullName || reopeningAttempt.student.email}
            </span>
          </div>
        </div>

        <p className="text-xs text-on-surface-variant leading-relaxed">
          Reopening will restore the attempt to <code className="bg-surface-container px-1 py-0.5 rounded">in_progress</code>, allowing the student to continue writing with their saved work preserved.
        </p>

        <div>
          <label className="text-xs font-semibold block mb-1">Restored Trust Score Index (70 - 100%)</label>
          <input
            type="number"
            min={70}
            max={100}
            value={reopenTrustScore}
            onChange={(e) => setReopenTrustScore(Number(e.target.value))}
            className="w-full h-10 px-3 bg-surface-container-low rounded-xl text-xs font-mono border border-surface-container-high"
            required
          />
        </div>

        <div>
          <label className="text-xs font-semibold block mb-1">Mandatory Justification Reason</label>
          <textarea
            value={reopenReason}
            onChange={(e) => setReopenReason(e.target.value)}
            placeholder="e.g. Verified harmless OS system popup triggered window blur..."
            rows={3}
            className="w-full p-2.5 bg-surface-container-low rounded-xl text-xs text-on-surface border border-surface-container-high focus:outline-none focus:ring-1 focus:ring-secondary resize-none"
            required
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmittingReopen}
            className="px-4 py-2 rounded-xl bg-surface-container text-xs font-medium hover:bg-surface-container-high transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmittingReopen}
            className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition-colors flex items-center gap-1.5"
          >
            {isSubmittingReopen && (
              <span className="material-symbols-outlined text-[16px] animate-spin">sync</span>
            )}
            <span>Confirm Reopen</span>
          </button>
        </div>
      </form>
    </div>
  );
}
