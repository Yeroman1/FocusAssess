import React from 'react';
import { AttemptCandidate } from '../types';

interface TerminateModalProps {
  terminatingAttempt: AttemptCandidate;
  terminateReason: string;
  setTerminateReason: (reason: string) => void;
  isSubmittingTerminate: boolean;
  onConfirm: (e: React.FormEvent) => void;
  onClose: () => void;
}

const PRESETS = [
  'Multiple window blurs with unapproved material',
  'Second monitor or external display usage detected',
  'DevTools inspection & tampering attempt',
  'Refusal to heed proctor verbal warning',
];

export function TerminateModal({
  terminatingAttempt,
  terminateReason,
  setTerminateReason,
  isSubmittingTerminate,
  onConfirm,
  onClose,
}: TerminateModalProps) {
  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <form
        onSubmit={onConfirm}
        className="bg-surface-container-lowest max-w-md w-full rounded-2xl p-6 shadow-2xl border border-surface-container-high space-y-4"
      >
        <div className="flex items-center gap-3 text-error">
          <span className="material-symbols-outlined text-[28px]">gavel</span>
          <div>
            <h3 className="text-base font-bold text-on-surface">Force Terminate Attempt</h3>
            <span className="text-xs font-mono text-on-surface-variant">
              Candidate: {terminatingAttempt.student.fullName || terminatingAttempt.student.email}
            </span>
          </div>
        </div>

        <p className="text-xs text-on-surface-variant leading-relaxed">
          Terminating will immediately lock the student out of their active session, set their trust score to 0%, and
          mark the attempt as <code className="bg-error-container text-error px-1 py-0.5 rounded">terminated_suspicious</code>.
        </p>

        <div>
          <label className="text-xs font-semibold block mb-1">Select or Enter Violation Reason</label>
          <div className="flex gap-1.5 flex-wrap mb-2">
            {PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setTerminateReason(preset)}
                className="text-[10px] font-mono px-2 py-1 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface text-left"
              >
                {preset}
              </button>
            ))}
          </div>
          <textarea
            value={terminateReason}
            onChange={(e) => setTerminateReason(e.target.value)}
            placeholder="Enter detailed reason for immediate termination..."
            rows={3}
            className="w-full p-2.5 bg-surface-container-low rounded-xl text-xs text-on-surface border border-surface-container-high focus:outline-none focus:ring-1 focus:ring-secondary resize-none"
            required
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmittingTerminate}
            className="px-4 py-2 rounded-xl bg-surface-container text-xs font-medium hover:bg-surface-container-high transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmittingTerminate}
            className="px-4 py-2 rounded-xl bg-error text-white text-xs font-semibold hover:bg-rose-700 transition-colors flex items-center gap-1.5"
          >
            {isSubmittingTerminate && (
              <span className="material-symbols-outlined text-[16px] animate-spin">sync</span>
            )}
            <span>Confirm Termination</span>
          </button>
        </div>
      </form>
    </div>
  );
}
