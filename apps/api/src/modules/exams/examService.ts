import crypto from 'crypto';
import { prisma } from '../../utils/prisma.js';
import { recordAuditEvent } from '../audit/auditService.js';
import { ExamStatus, OutputComparisonMode } from '@pyassess/shared';

export interface CreateExamDTO {
  title: string;
  description?: string | null;
  instructions?: string | null;
  durationMinutes: number;
  availableFrom?: Date | string | null;
  availableUntil?: Date | string | null;
  maxAttempts?: number;
  rules?: any;
  antiCheatingConfig?: any;
}

export interface CreateQuestionDTO {
  title: string;
  statement: string;
  inputDescription: string;
  outputDescription: string;
  constraints?: string | null;
  maxMarks: number;
  position: number;
  manualReviewRequired?: boolean;
}

export interface CreateTestCaseDTO {
  stdin: string;
  expectedOutput: string;
  marks: number;
  isHidden?: boolean;
  comparisonMode?: OutputComparisonMode;
  position: number;
}

export interface CreateQuestionWithTestCasesDTO extends CreateQuestionDTO {
  testCases: Array<{
    stdin: string;
    expectedOutput: string;
    marks: number;
    isHidden?: boolean;
    comparisonMode?: OutputComparisonMode;
  }>;
}

/**
 * Creates SHA-256 hash of raw exam access key
 */
export function hashExamKey(key: string): string {
  return crypto.createHash('sha256').update(key.trim().toUpperCase()).digest('hex');
}

/**
 * Generates a secure, cryptographically random assessment token (e.g. PY204-7A9B)
 */
export function generateSecureExamKey(prefix = 'PY'): string {
  const bytes = crypto.randomBytes(4);
  const code = bytes.toString('hex').toUpperCase();
  return `${prefix}-${code}`;
}

export class ExamService {
  /**
   * Create new draft exam
   */
  static async createExam(ownerId: string, dto: CreateExamDTO) {
    const exam = await prisma.$transaction(async (tx) => {
      const created = await tx.exam.create({
        data: {
          ownerId,
          title: dto.title,
          description: dto.description,
          instructions: dto.instructions,
          durationMinutes: dto.durationMinutes,
          availableFrom: dto.availableFrom ? new Date(dto.availableFrom) : null,
          availableUntil: dto.availableUntil ? new Date(dto.availableUntil) : null,
          maxAttempts: dto.maxAttempts ?? 1,
          status: 'draft',
          rules: dto.rules ? JSON.stringify(dto.rules) : null,
          antiCheatingConfig: dto.antiCheatingConfig ? JSON.stringify(dto.antiCheatingConfig) : null,
          currentVersion: 1,
        },
      });

      // Initial draft version
      await tx.examVersion.create({
        data: {
          examId: created.id,
          versionNumber: 1,
        },
      });

      return created;
    });

    await recordAuditEvent({
      actorId: ownerId,
      action: 'EXAM_CREATED',
      targetType: 'Exam',
      targetId: exam.id,
      metadata: { title: exam.title, durationMinutes: exam.durationMinutes },
    });

    return exam;
  }

  /**
   * Update draft exam details
   */
  static async updateExam(examId: string, instructorId: string, dto: Partial<CreateExamDTO>) {
    const exam = await prisma.exam.findUnique({ where: { id: examId } });
    if (!exam) throw new Error('Exam not found');
    if (exam.ownerId !== instructorId) throw new Error('Forbidden: You do not own this exam');
    if (exam.status !== 'draft') throw new Error('Cannot edit a published or closed exam');

    return await prisma.exam.update({
      where: { id: examId },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.instructions !== undefined && { instructions: dto.instructions }),
        ...(dto.durationMinutes !== undefined && { durationMinutes: dto.durationMinutes }),
        ...(dto.availableFrom !== undefined && { availableFrom: dto.availableFrom ? new Date(dto.availableFrom) : null }),
        ...(dto.availableUntil !== undefined && { availableUntil: dto.availableUntil ? new Date(dto.availableUntil) : null }),
        ...(dto.maxAttempts !== undefined && { maxAttempts: dto.maxAttempts }),
      },
    });
  }

  /**
   * Add question with test cases atomically in a single transaction
   */
  static async addQuestionWithTestCases(examId: string, instructorId: string, dto: CreateQuestionWithTestCasesDTO) {
    const exam = await prisma.exam.findUnique({
      where: { id: examId },
      include: { versions: { orderBy: { versionNumber: 'desc' }, take: 1 } },
    });

    if (!exam) throw new Error('Exam not found');
    if (exam.ownerId !== instructorId) throw new Error('Forbidden: You do not own this exam');
    if (exam.status !== 'draft') throw new Error('Cannot add questions to a published or closed exam');

    const currentVersion = exam.versions[0];
    if (!currentVersion) throw new Error('Exam version not found');

    return await prisma.$transaction(async (tx) => {
      const question = await tx.question.create({
        data: {
          examVersionId: currentVersion.id,
          title: dto.title,
          statement: dto.statement,
          inputDescription: dto.inputDescription || '',
          outputDescription: dto.outputDescription || '',
          constraints: dto.constraints || null,
          maxMarks: dto.maxMarks,
          position: dto.position,
          manualReviewRequired: dto.manualReviewRequired ?? false,
        },
      });

      if (dto.testCases && dto.testCases.length > 0) {
        for (let i = 0; i < dto.testCases.length; i++) {
          const tc = dto.testCases[i];
          await tx.testCase.create({
            data: {
              questionId: question.id,
              stdin: tc.stdin || '',
              expectedOutput: tc.expectedOutput,
              marks: tc.marks,
              isHidden: tc.isHidden ?? false,
              comparisonMode: (tc.comparisonMode as any) || 'TRIMMED_TEXT',
              position: i + 1,
              isEnabled: true,
            },
          });
        }
      }

      return await tx.question.findUnique({
        where: { id: question.id },
        include: { testCases: { orderBy: { position: 'asc' } } },
      });
    });
  }

  /**
   * Delete question and associated test cases from draft exam
   */
  static async deleteQuestion(questionId: string, instructorId: string) {
    const question = await prisma.question.findUnique({
      where: { id: questionId },
      include: { examVersion: { include: { exam: true } } },
    });

    if (!question) throw new Error('Question not found');
    if (question.examVersion.exam.ownerId !== instructorId) {
      throw new Error('Forbidden: You do not own this exam');
    }
    if (question.examVersion.exam.status !== 'draft') {
      throw new Error('Cannot delete questions from a published or closed exam');
    }

    await prisma.testCase.deleteMany({ where: { questionId } });
    return await prisma.question.delete({ where: { id: questionId } });
  }

  /**
   * Add question to the current version of the draft exam
   */
  static async addQuestion(examId: string, instructorId: string, dto: CreateQuestionDTO) {
    const exam = await prisma.exam.findUnique({
      where: { id: examId },
      include: { versions: { orderBy: { versionNumber: 'desc' }, take: 1 } },
    });

    if (!exam) throw new Error('Exam not found');
    if (exam.ownerId !== instructorId) throw new Error('Forbidden: You do not own this exam');
    if (exam.status !== 'draft') throw new Error('Cannot add questions to a published or closed exam');

    const currentVersion = exam.versions[0];
    if (!currentVersion) throw new Error('Exam version not found');

    return await prisma.question.create({
      data: {
        examVersionId: currentVersion.id,
        title: dto.title,
        statement: dto.statement,
        inputDescription: dto.inputDescription,
        outputDescription: dto.outputDescription,
        constraints: dto.constraints,
        maxMarks: dto.maxMarks,
        position: dto.position,
        manualReviewRequired: dto.manualReviewRequired ?? false,
      },
    });
  }

  /**
   * Add test case to a question
   */
  static async addTestCase(questionId: string, instructorId: string, dto: CreateTestCaseDTO) {
    const question = await prisma.question.findUnique({
      where: { id: questionId },
      include: { examVersion: { include: { exam: true } } },
    });

    if (!question) throw new Error('Question not found');
    if (question.examVersion.exam.ownerId !== instructorId) {
      throw new Error('Forbidden: You do not own this exam');
    }
    if (question.examVersion.exam.status !== 'draft') {
      throw new Error('Cannot modify test cases for an already published exam');
    }

    return await prisma.testCase.create({
      data: {
        questionId,
        stdin: dto.stdin,
        expectedOutput: dto.expectedOutput,
        marks: dto.marks,
        isHidden: dto.isHidden ?? true,
        comparisonMode: dto.comparisonMode ?? 'TRIMMED_TEXT',
        position: dto.position,
        isEnabled: true,
      },
    });
  }

  /**
   * Publishes an examination:
   * 1. Validates configuration, questions, marks, and test cases.
   * 2. Freezes current version into an immutable snapshot.
   * 3. Generates a cryptographically secure access key.
   * 4. Stores SHA-256 key hash in ExamKey table.
   * 5. Returns key exclusively to the authorized instructor.
   */
  static async publishExam(examId: string, instructorId: string) {
    const exam = await prisma.exam.findUnique({
      where: { id: examId },
      include: {
        versions: {
          orderBy: { versionNumber: 'desc' },
          take: 1,
          include: {
            questions: {
              include: { testCases: true },
            },
          },
        },
      },
    });

    if (!exam) throw new Error('Exam not found');
    if (exam.ownerId !== instructorId) throw new Error('Forbidden: You do not own this exam');
    if (exam.status === 'published') throw new Error('Exam is already published');

    const currentVersion = exam.versions[0];
    if (!currentVersion || currentVersion.questions.length === 0) {
      throw new Error('Cannot publish exam: At least one programming question is required');
    }

    // Validate questions and test cases
    for (const q of currentVersion.questions) {
      if (q.testCases.length === 0) {
        throw new Error(`Cannot publish exam: Question "${q.title}" has no test cases`);
      }
      const testMarksTotal = q.testCases.reduce((acc, tc) => acc + tc.marks, 0);
      if (testMarksTotal <= 0) {
        throw new Error(`Cannot publish exam: Question "${q.title}" test cases must have positive marks`);
      }
    }

    // Generate secure key
    const rawKey = generateSecureExamKey();
    const keyHash = hashExamKey(rawKey);
    const keyPrefix = rawKey.split('-')[0] || 'PY';

    const result = await prisma.$transaction(async (tx) => {
      // 1. Create immutable snapshot of questions and test cases in the version
      const snapshot = {
        title: exam.title,
        description: exam.description,
        instructions: exam.instructions,
        durationMinutes: exam.durationMinutes,
        questions: currentVersion.questions.map((q) => ({
          id: q.id,
          title: q.title,
          statement: q.statement,
          inputDescription: q.inputDescription,
          outputDescription: q.outputDescription,
          constraints: q.constraints,
          maxMarks: q.maxMarks,
          position: q.position,
          testCases: q.testCases.map((tc) => ({
            id: tc.id,
            stdin: tc.stdin,
            expectedOutput: tc.expectedOutput,
            marks: tc.marks,
            isHidden: tc.isHidden,
            comparisonMode: tc.comparisonMode,
          })),
        })),
      };

      await tx.examVersion.update({
        where: { id: currentVersion.id },
        data: { snapshotJson: JSON.stringify(snapshot) },
      });

      // 2. Mark exam published
      const updatedExam = await tx.exam.update({
        where: { id: examId },
        data: { status: 'published' },
      });

      // 3. Create active exam key
      const createdKey = await tx.examKey.create({
        data: {
          examId,
          keyHash,
          keyPrefix,
          createdBy: instructorId,
          expiresAt: exam.availableUntil,
        },
      });

      return { updatedExam, createdKey };
    });

    await recordAuditEvent({
      actorId: instructorId,
      action: 'EXAM_PUBLISHED',
      targetType: 'Exam',
      targetId: examId,
      metadata: { keyPrefix, version: currentVersion.versionNumber },
    });

    return {
      exam: result.updatedExam,
      examKey: rawKey, // Exposed only once upon publication
    };
  }

  /**
   * Close / Unpublish an active exam (stops all new candidate entries)
   */
  static async closeExam(examId: string, instructorId: string) {
    const exam = await prisma.exam.findUnique({ where: { id: examId } });
    if (!exam) throw new Error('Exam not found');

    const profile = await prisma.profile.findUnique({ where: { id: instructorId } });
    const isAdmin = profile?.role === 'admin' || profile?.email?.toLowerCase() === 'yeritti2017@gmail.com';
    if (exam.ownerId !== instructorId && !isAdmin) throw new Error('Forbidden: You do not own this exam');

    const updated = await prisma.exam.update({
      where: { id: examId },
      data: { status: 'closed' },
    });

    await recordAuditEvent({
      actorId: instructorId,
      action: 'EXAM_ENTRY_CLOSED',
      targetType: 'Exam',
      targetId: examId,
      metadata: { previousStatus: exam.status },
    });

    return updated;
  }

  /**
   * Reopen an exam to allow new candidate entries
   */
  static async reopenExam(examId: string, instructorId: string) {
    const exam = await prisma.exam.findUnique({ where: { id: examId } });
    if (!exam) throw new Error('Exam not found');

    const profile = await prisma.profile.findUnique({ where: { id: instructorId } });
    const isAdmin = profile?.role === 'admin' || profile?.email?.toLowerCase() === 'yeritti2017@gmail.com';
    if (exam.ownerId !== instructorId && !isAdmin) throw new Error('Forbidden: You do not own this exam');

    const updated = await prisma.exam.update({
      where: { id: examId },
      data: { status: 'published' },
    });

    await recordAuditEvent({
      actorId: instructorId,
      action: 'EXAM_ENTRY_REOPENED',
      targetType: 'Exam',
      targetId: examId,
      metadata: { previousStatus: exam.status },
    });

    return updated;
  }
}
