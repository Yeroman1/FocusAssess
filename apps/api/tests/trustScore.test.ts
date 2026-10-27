import { describe, it, expect } from 'vitest';
import { shouldTerminateAttempt, DEFAULT_ANTI_CHEATING_SETTINGS } from '@pyassess/shared';

describe('Anti-Cheating & Trust Score Termination Rules', () => {
  it('should initialize with 100% baseline trust score', () => {
    expect(DEFAULT_ANTI_CHEATING_SETTINGS.initialTrustScore).toBe(100);
  });

  it('should NOT terminate when trust score is above 70%', () => {
    expect(shouldTerminateAttempt(100)).toBe(false);
    expect(shouldTerminateAttempt(90)).toBe(false);
    expect(shouldTerminateAttempt(80)).toBe(false);
    expect(shouldTerminateAttempt(75)).toBe(false);
  });

  it('MANDATORY RULE: Score of exactly 70% must NOT terminate', () => {
    // 70% is the critical threshold floor, not below floor
    expect(shouldTerminateAttempt(70)).toBe(false);
  });

  it('MANDATORY RULE: Score strictly lower than 70% MUST terminate immediately', () => {
    expect(shouldTerminateAttempt(69.9)).toBe(true);
    expect(shouldTerminateAttempt(65)).toBe(true);
    expect(shouldTerminateAttempt(60)).toBe(true);
    expect(shouldTerminateAttempt(0)).toBe(true);
  });

  it('should verify configured penalty magnitudes', () => {
    const { penalties } = DEFAULT_ANTI_CHEATING_SETTINGS;
    expect(penalties.visibilityHidden).toBe(10);
    expect(penalties.windowBlur).toBe(10);
    expect(penalties.fullscreenExit).toBe(10);
    expect(penalties.clipboardCopy).toBe(5);
    expect(penalties.clipboardPaste).toBe(5);
    expect(penalties.contextMenu).toBe(3);
  });
});
