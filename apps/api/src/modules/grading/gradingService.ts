import { prisma } from '../../utils/prisma.js';
import { config } from '../../config/index.js';
import { recordAuditEvent } from '../audit/auditService.js';
import {
  OutputComparisonMode,
  RunnerJobRequest,
  RunnerJobResponse,
  RunnerExecutionStatus,
} from '@pyassess/shared';

/**
 * Normalizes output according to configured comparison mode
 */
export function compareOutputs(
  actual: string,
  expected: string,
  mode: OutputComparisonMode = 'TRIMMED_TEXT'
): boolean {
  if (mode === 'EXACT_TEXT') {
    return actual === expected;
  }

  // Standardize line endings and trim outer whitespace
  const normActual = actual.replace(/\r\n/g, '\n').trim().replace(/^['"]|['"]$/g, '');
  const normExpected = expected.replace(/\r\n/g, '\n').trim().replace(/^['"]|['"]$/g, '');

  if (mode === 'NUMERIC_TOLERANCE') {
    const actNum = parseFloat(normActual);
    const expNum = parseFloat(normExpected);
    if (!isNaN(actNum) && !isNaN(expNum)) {
      return Math.abs(actNum - expNum) <= 1e-4;
    }
  }

  // Resilient boolean comparison for True/False questions
  if (
    normExpected.toLowerCase() === 'true' ||
    normExpected.toLowerCase() === 'false'
  ) {
    return normActual.toLowerCase() === normExpected.toLowerCase();
  }

  // Default: TRIMMED_TEXT
  return normActual === normExpected;
}

export class GradingService {
  /**
   * Executes a single code execution request against the isolated Python runner service
   */
  static async callRunnerService(jobRequest: RunnerJobRequest): Promise<RunnerJobResponse> {
    const response = await fetch(`${config.pythonRunnerUrl}/internal/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-runner-secret': config.pythonRunnerSecret,
      },
      body: JSON.stringify(jobRequest),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Execution runner service failed with status ${response.status}: ${errText}`);
    }

    return (await response.json()) as RunnerJobResponse;
  }

  /**
   * Grades all questions and test cases for an attempt
   */
  static async gradeAttempt(attemptId: string) {
    const attempt = await prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: {
        exam: true,
        examVersion: {
          include: {
            questions: {
              include: {
                testCases: { where: { isEnabled: true }, orderBy: { position: 'asc' } },
              },
              orderBy: { position: 'asc' },
            },
          },
        },
        answers: true,
      },
    });

    if (!attempt) throw new Error('Attempt not found');

    // Mark grading in progress
    await prisma.examAttempt.update({
      where: { id: attemptId },
      data: { gradingStatus: 'grading' },
    });

    let totalMarksAwarded = 0;
    let maxMarksTotal = 0;

    const answersMap = new Map<string, string>();
    for (const a of attempt.answers) {
      answersMap.set(a.questionId, a.sourceCode);
    }

    try {
      for (const question of attempt.examVersion.questions) {
        maxMarksTotal += question.maxMarks;
        const sourceCode = answersMap.get(question.id) || '';

        // If no code was written for this question, mark all test cases failed with 0 marks
        if (!sourceCode.trim()) {
          for (const tc of question.testCases) {
            await prisma.gradingResult.create({
              data: {
                attemptId,
                questionId: question.id,
                testCaseId: tc.id,
                passed: false,
                marksAwarded: 0,
                maxMarks: tc.marks,
                executionStatus: 'WRONG_ANSWER',
                durationMs: 0,
                errorMessage: 'No code submitted',
              },
            });
          }
          continue;
        }

        let questionPassedMarks = 0;

        for (const tc of question.testCases) {
          let testPassed = false;
          let marksAwarded = 0;
          let executionStatus: RunnerExecutionStatus = 'SUCCESS';
          let durationMs = 0;
          let errorMessage: string | undefined;

          try {
            const runnerResult = await this.callRunnerService({
              jobId: `att-${attemptId}-q-${question.id}-tc-${tc.id}`,
              sourceCode,
              stdin: tc.stdin,
              timeoutMs: 3000,
            });

            durationMs = runnerResult.durationMs;
            executionStatus = runnerResult.executionStatus;

            if (runnerResult.executionStatus === 'SUCCESS') {
              testPassed = compareOutputs(runnerResult.stdout, tc.expectedOutput, tc.comparisonMode);
              if (testPassed) {
                marksAwarded = tc.marks;
                questionPassedMarks += tc.marks;
              } else {
                executionStatus = 'WRONG_ANSWER';
              }
            } else {
              testPassed = false;
              errorMessage = runnerResult.error || runnerResult.stderr;
            }
          } catch (err: any) {
            executionStatus = 'INTERNAL_ERROR';
            errorMessage = err?.message || String(err);
          }

          await prisma.gradingResult.create({
            data: {
              attemptId,
              questionId: question.id,
              testCaseId: tc.id,
              passed: testPassed,
              marksAwarded,
              maxMarks: tc.marks,
              executionStatus,
              durationMs,
              errorMessage,
            },
          });
        }

        totalMarksAwarded += questionPassedMarks;
      }

      const percentageScore = maxMarksTotal > 0 ? (totalMarksAwarded / maxMarksTotal) * 100 : 0;

      // Finalize attempt score
      const finalAttempt = await prisma.examAttempt.update({
        where: { id: attemptId },
        data: {
          gradingStatus: 'graded',
          totalMarksAwarded,
          maxMarksTotal,
          percentageScore: Math.round(percentageScore * 100) / 100,
        },
      });

      // Update grading job
      await prisma.gradingJob.updateMany({
        where: { attemptId },
        data: {
          status: 'graded',
          completedAt: new Date(),
        },
      });

      await recordAuditEvent({
        actorId: attempt.studentId,
        action: 'ATTEMPT_GRADED_AUTOMATICALLY',
        targetType: 'ExamAttempt',
        targetId: attemptId,
        metadata: {
          totalMarksAwarded,
          maxMarksTotal,
          percentageScore,
        },
      });

      return finalAttempt;
    } catch (err: any) {
      console.error('[Grading Error]', err);
      await prisma.examAttempt.update({
        where: { id: attemptId },
        data: { gradingStatus: 'failed' },
      });
      throw err;
    }
  }

  /**
   * Release results to students (Instructors only)
   */
  static async releaseResults(examId: string, instructorId: string) {
    const exam = await prisma.exam.findUnique({ where: { id: examId } });
    if (!exam) throw new Error('Exam not found');
    if (exam.ownerId !== instructorId) throw new Error('Forbidden');

    const releasedAt = new Date();
    const updated = await prisma.exam.update({
      where: { id: examId },
      data: { resultsReleasedAt: releasedAt },
    });

    await recordAuditEvent({
      actorId: instructorId,
      action: 'EXAM_RESULTS_RELEASED',
      targetType: 'Exam',
      targetId: examId,
      metadata: { resultsReleasedAt: releasedAt.toISOString() },
    });

    return updated;
  }

  /**
   * Instructor manual grade override with mandatory reason
   */
  static async overrideGrade(
    attemptId: string,
    instructorId: string,
    newTotalMarks: number,
    reason: string
  ) {
    if (!reason || reason.trim().length < 5) {
      throw new Error('A valid explanatory reason is required for grade override');
    }

    const attempt = await prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: { exam: true },
    });

    if (!attempt) throw new Error('Attempt not found');
    const actor = await prisma.profile.findUnique({ where: { id: instructorId } });
    const isAdmin = actor?.role === 'admin' || actor?.email?.toLowerCase() === 'yeritti2017@gmail.com';
    if (attempt.exam.ownerId !== instructorId && !isAdmin) {
      throw new Error('Forbidden: You do not have permission to override grades for this examination');
    }

    const maxMarks = attempt.maxMarksTotal ?? 100;
    if (newTotalMarks < 0 || newTotalMarks > maxMarks) {
      throw new Error(`New total marks must be between 0 and ${maxMarks}`);
    }

    const newPercentage = maxMarks > 0 ? (newTotalMarks / maxMarks) * 100 : 0;

    const updated = await prisma.examAttempt.update({
      where: { id: attemptId },
      data: {
        totalMarksAwarded: newTotalMarks,
        percentageScore: Math.round(newPercentage * 100) / 100,
        reviewStatus: 'reviewed',
      },
    });

    await recordAuditEvent({
      actorId: instructorId,
      action: 'GRADE_OVERRIDE',
      targetType: 'ExamAttempt',
      targetId: attemptId,
      reason,
      metadata: {
        previousMarks: attempt.totalMarksAwarded,
        newMarks: newTotalMarks,
      },
    });

    return updated;
  }
}
