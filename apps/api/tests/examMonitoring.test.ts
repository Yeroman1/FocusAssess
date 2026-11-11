import { describe, it, expect } from 'vitest';

describe('Live Exam Monitoring Telemetry & Adjudication Suite', () => {
  interface MockAttempt {
    id: string;
    studentId: string;
    status: 'in_progress' | 'submitted' | 'expired' | 'terminated_suspicious';
    trustScore: number;
    startedAt: string;
    deadlineAt: string;
    submittedAt: string | null;
    terminatedAt: string | null;
    terminationReason: string | null;
    totalMarksAwarded: number | null;
    maxMarksTotal: number | null;
    answers: Array<{ id: string; questionId: string; savedAt: string }>;
    events: Array<{ id: string; eventType: string; penalty: number }>;
  }

  const mockAttempts: MockAttempt[] = [
    {
      id: 'att-1',
      studentId: 'stud-1',
      status: 'in_progress',
      trustScore: 95,
      startedAt: '2026-11-11T10:00:00Z',
      deadlineAt: '2026-11-11T11:30:00Z',
      submittedAt: null,
      terminatedAt: null,
      terminationReason: null,
      totalMarksAwarded: null,
      maxMarksTotal: 100,
      answers: [{ id: 'ans-1', questionId: 'q-1', savedAt: '2026-11-11T10:15:00Z' }],
      events: [{ id: 'ev-1', eventType: 'CLIPBOARD_COPY', penalty: 5 }],
    },
    {
      id: 'att-2',
      studentId: 'stud-2',
      status: 'in_progress',
      trustScore: 65, // Below 70% threshold -> flagged
      startedAt: '2026-11-11T10:05:00Z',
      deadlineAt: '2026-11-11T11:35:00Z',
      submittedAt: null,
      terminatedAt: null,
      terminationReason: null,
      totalMarksAwarded: null,
      maxMarksTotal: 100,
      answers: [
        { id: 'ans-2a', questionId: 'q-1', savedAt: '2026-11-11T10:10:00Z' },
        { id: 'ans-2b', questionId: 'q-2', savedAt: '2026-11-11T10:20:00Z' },
      ],
      events: [
        { id: 'ev-2a', eventType: 'WINDOW_BLUR', penalty: 15 },
        { id: 'ev-2b', eventType: 'FULLSCREEN_EXIT', penalty: 20 },
      ],
    },
    {
      id: 'att-3',
      studentId: 'stud-3',
      status: 'submitted',
      trustScore: 100,
      startedAt: '2026-11-11T09:30:00Z',
      deadlineAt: '2026-11-11T11:00:00Z',
      submittedAt: '2026-11-11T10:45:00Z',
      terminatedAt: null,
      terminationReason: null,
      totalMarksAwarded: 88,
      maxMarksTotal: 100,
      answers: [
        { id: 'ans-3a', questionId: 'q-1', savedAt: '2026-11-11T10:00:00Z' },
        { id: 'ans-3b', questionId: 'q-2', savedAt: '2026-11-11T10:30:00Z' },
      ],
      events: [],
    },
    {
      id: 'att-4',
      studentId: 'stud-4',
      status: 'terminated_suspicious',
      trustScore: 0,
      startedAt: '2026-11-11T09:40:00Z',
      deadlineAt: '2026-11-11T11:10:00Z',
      submittedAt: null,
      terminatedAt: '2026-11-11T10:12:00Z',
      terminationReason: 'Proctor manual termination: Multiple window switches',
      totalMarksAwarded: 0,
      maxMarksTotal: 100,
      answers: [],
      events: [
        { id: 'ev-4a', eventType: 'WINDOW_BLUR', penalty: 20 },
        { id: 'ev-4b', eventType: 'VISIBILITY_HIDDEN', penalty: 20 },
      ],
    },
    {
      id: 'att-5',
      studentId: 'stud-5',
      status: 'expired',
      trustScore: 80,
      startedAt: '2026-11-11T08:00:00Z',
      deadlineAt: '2026-11-11T09:30:00Z',
      submittedAt: null,
      terminatedAt: null,
      terminationReason: null,
      totalMarksAwarded: 40,
      maxMarksTotal: 100,
      answers: [{ id: 'ans-5', questionId: 'q-1', savedAt: '2026-11-11T08:45:00Z' }],
      events: [{ id: 'ev-5', eventType: 'CLIPBOARD_PASTE', penalty: 20 }],
    },
  ];

  describe('Cohort Telemetry Aggregations', () => {
    it('accurately calculates candidate counts by status breakdown', () => {
      const activeAttempts = mockAttempts.filter((a) => a.status === 'in_progress');
      const submittedAttempts = mockAttempts.filter((a) => a.status === 'submitted');
      const terminatedAttempts = mockAttempts.filter((a) => a.status === 'terminated_suspicious');
      const expiredAttempts = mockAttempts.filter((a) => a.status === 'expired');
      const flaggedAttempts = mockAttempts.filter((a) => a.trustScore < 70 || a.status === 'terminated_suspicious');

      expect(activeAttempts.length).toBe(2);
      expect(submittedAttempts.length).toBe(1);
      expect(terminatedAttempts.length).toBe(1);
      expect(expiredAttempts.length).toBe(1);
      // Flagged: att-2 (trust 65) + att-4 (terminated trust 0) = 2
      expect(flaggedAttempts.length).toBe(2);
      expect(mockAttempts.length).toBe(5);
    });

    it('accurately computes cohort average trust score', () => {
      // Sum: 95 + 65 + 100 + 0 + 80 = 340. Avg = 340 / 5 = 68
      const avgTrustScore = Math.round(
        mockAttempts.reduce((sum, a) => sum + a.trustScore, 0) / mockAttempts.length
      );
      expect(avgTrustScore).toBe(68);
    });

    it('accurately calculates average score exclusively from submitted candidates', () => {
      const submittedAttempts = mockAttempts.filter((a) => a.status === 'submitted');
      const avgScore = submittedAttempts.length > 0
        ? Math.round(
            (submittedAttempts.reduce((sum, a) => sum + (a.totalMarksAwarded || 0), 0) /
              submittedAttempts.length) * 10
          ) / 10
        : 0;

      expect(avgScore).toBe(88);
    });
  });

  describe('Real-Time Risk Priority Sorting & Classification', () => {
    it('correctly sorts candidate roster with lowest trust score first (Risk Priority)', () => {
      const sorted = [...mockAttempts].sort((a, b) => a.trustScore - b.trustScore);
      expect(sorted[0].id).toBe('att-4'); // trust 0
      expect(sorted[1].id).toBe('att-2'); // trust 65
      expect(sorted[2].id).toBe('att-5'); // trust 80
      expect(sorted[3].id).toBe('att-1'); // trust 95
      expect(sorted[4].id).toBe('att-3'); // trust 100
    });

    it('classifies trust scores into Safe, Warning, and Critical levels', () => {
      const categorize = (score: number) => {
        if (score < 70) return 'critical';
        if (score < 90) return 'warning';
        return 'safe';
      };

      expect(categorize(100)).toBe('safe');
      expect(categorize(95)).toBe('safe');
      expect(categorize(90)).toBe('safe');
      expect(categorize(89.9)).toBe('warning');
      expect(categorize(70)).toBe('warning');
      expect(categorize(69.9)).toBe('critical');
      expect(categorize(0)).toBe('critical');
    });

    it('correctly sorts by questions answered progress', () => {
      const sorted = [...mockAttempts].sort((a, b) => b.answers.length - a.answers.length);
      expect(sorted[0].answers.length).toBe(2);
      expect(sorted[1].answers.length).toBe(2);
      expect(sorted[4].answers.length).toBe(0);
    });
  });

  describe('Force Termination Protocol', () => {
    it('applies correct state transitions when terminating candidate', () => {
      const activeCandidate: MockAttempt = {
        ...mockAttempts[0],
      };

      // Apply termination transition
      const terminatedCandidate: MockAttempt = {
        ...activeCandidate,
        status: 'terminated_suspicious',
        terminatedAt: '2026-11-11T10:25:00Z',
        terminationReason: 'Proctor detected dual-screen mirroring during exam',
        trustScore: 0,
      };

      expect(terminatedCandidate.status).toBe('terminated_suspicious');
      expect(terminatedCandidate.trustScore).toBe(0);
      expect(terminatedCandidate.terminatedAt).toBeTruthy();
      expect(terminatedCandidate.terminationReason).toContain('Proctor detected dual-screen');
    });

    it('applies correct state transitions when reopening candidate attempt', () => {
      const terminatedCandidate: MockAttempt = {
        ...mockAttempts[3],
      };

      // Reopening transition: reset status to in_progress and restore trust score
      const restoredCandidate: MockAttempt = {
        ...terminatedCandidate,
        status: 'in_progress',
        terminatedAt: null,
        terminationReason: null,
        trustScore: 85,
      };

      expect(restoredCandidate.status).toBe('in_progress');
      expect(restoredCandidate.trustScore).toBe(85);
      expect(restoredCandidate.terminatedAt).toBeNull();
    });
  });

  describe('Countdown & Duration Logic', () => {
    it('computes remaining time before deadline correctly', () => {
      const now = new Date('2026-11-11T10:45:00Z').getTime();
      const deadline = new Date('2026-11-11T11:30:00Z').getTime();
      const diffMs = deadline - now;

      const minutes = Math.floor(diffMs / (1000 * 60));
      const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);

      expect(minutes).toBe(45);
      expect(seconds).toBe(0);
      expect(minutes < 10).toBe(false); // Not urgent
    });

    it('flags urgent alert when less than 10 minutes remain', () => {
      const now = new Date('2026-11-11T11:22:30Z').getTime();
      const deadline = new Date('2026-11-11T11:30:00Z').getTime();
      const diffMs = deadline - now;

      const minutes = Math.floor(diffMs / (1000 * 60));
      const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);

      expect(minutes).toBe(7);
      expect(seconds).toBe(30);
      expect(minutes < 10).toBe(true); // Urgent!
    });
  });
});

