import { Router, Response } from 'express';
import { requireAuth, requireRole, AuthenticatedRequest } from '../../middleware/auth.js';
import { ExamService } from './examService.js';
import { GradingService } from '../grading/gradingService.js';
import { prisma } from '../../utils/prisma.js';
import { z } from 'zod';

const router = Router();

const CreateExamSchema = z.object({
  title: z.string().min(3),
  description: z.string().optional().nullable(),
  instructions: z.string().optional().nullable(),
  durationMinutes: z.number().int().min(5).max(300),
  availableFrom: z.string().optional().nullable().transform((val) => (val && val.trim() !== '' ? new Date(val).toISOString() : undefined)),
  availableUntil: z.string().optional().nullable().transform((val) => (val && val.trim() !== '' ? new Date(val).toISOString() : undefined)),
  maxAttempts: z.number().int().min(1).default(1),
  rules: z.any().optional(),
});

const UpdateExamSchema = z.object({
  title: z.string().min(3).optional(),
  description: z.string().optional().nullable(),
  instructions: z.string().optional().nullable(),
  durationMinutes: z.number().int().min(5).max(300).optional(),
  availableFrom: z.string().optional().nullable().transform((val) => (val && val.trim() !== '' ? new Date(val).toISOString() : undefined)),
  availableUntil: z.string().optional().nullable().transform((val) => (val && val.trim() !== '' ? new Date(val).toISOString() : undefined)),
  maxAttempts: z.number().int().min(1).optional(),
});

const CreateQuestionSchema = z.object({
  title: z.string().min(2),
  statement: z.string().min(3),
  inputDescription: z.string().default(''),
  outputDescription: z.string().default(''),
  constraints: z.string().optional().nullable(),
  maxMarks: z.number().positive(),
  position: z.number().int().default(1),
  manualReviewRequired: z.boolean().default(false),
});

const CreateTestCaseSchema = z.object({
  stdin: z.string().default(''),
  expectedOutput: z.string(),
  marks: z.number().min(0),
  isHidden: z.boolean().default(true),
  comparisonMode: z.enum(['TRIMMED_TEXT', 'EXACT_TEXT', 'NUMERIC_TOLERANCE']).default('TRIMMED_TEXT'),
  position: z.number().int().default(1),
});

const CreateQuestionWithTestCasesSchema = z.object({
  title: z.string().min(2),
  statement: z.string().min(3),
  inputDescription: z.string().default(''),
  outputDescription: z.string().default(''),
  constraints: z.string().optional().nullable(),
  maxMarks: z.number().positive(),
  position: z.number().int().default(1),
  manualReviewRequired: z.boolean().default(false),
  testCases: z.array(z.object({
    stdin: z.string().default(''),
    expectedOutput: z.string(),
    marks: z.number().min(0),
    isHidden: z.boolean().default(false),
    comparisonMode: z.enum(['TRIMMED_TEXT', 'EXACT_TEXT', 'NUMERIC_TOLERANCE']).default('TRIMMED_TEXT'),
  })).min(1, 'At least one testcase is required'),
});

// List exams
router.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;

  if (user.role === 'student') {
    const exams = await prisma.exam.findMany({
      where: { status: 'published' },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        description: true,
        durationMinutes: true,
        availableFrom: true,
        availableUntil: true,
        status: true,
        maxAttempts: true,
        currentVersion: true,
      },
    });
    return res.json({ exams });
  }

  // Instructor or Admin
  const whereClause = user.role === 'admin' ? {} : { ownerId: user.id };
  const exams = await prisma.exam.findMany({
    where: whereClause,
    orderBy: { createdAt: 'desc' },
    include: {
      keys: { where: { revokedAt: null } },
      _count: { select: { attempts: true } },
    },
  });

  return res.json({ exams });
});

// Create exam
router.post('/', requireAuth, requireRole(['instructor', 'admin']), async (req: AuthenticatedRequest, res: Response) => {
  const parseResult = CreateExamSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: 'Validation failed', details: parseResult.error.flatten() });
  }

  const exam = await ExamService.createExam(req.user!.id, parseResult.data);
  return res.status(201).json({ exam });
});

// Get exam details
router.get('/:examId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { examId } = req.params;
  const user = req.user!;

  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    include: {
      owner: { select: { fullName: true, email: true } },
      versions: {
        orderBy: { versionNumber: 'desc' },
        take: 1,
        include: {
          questions: {
            orderBy: { position: 'asc' },
            include: {
              testCases: {
                orderBy: { position: 'asc' },
              },
            },
          },
        },
      },
    },
  });

  if (!exam) return res.status(404).json({ error: 'Exam not found' });

  const currentVersion = exam.versions[0];

  // For students: Sanitize question data, strictly omit hidden test cases!
  if (user.role === 'student') {
    const sanitizedQuestions = currentVersion?.questions.map((q) => ({
      id: q.id,
      title: q.title,
      statement: q.statement,
      inputDescription: q.inputDescription,
      outputDescription: q.outputDescription,
      constraints: q.constraints,
      maxMarks: q.maxMarks,
      position: q.position,
      publicExamples: q.testCases
        .filter((tc) => !tc.isHidden)
        .map((tc) => ({
          stdin: tc.stdin,
          expectedOutput: tc.expectedOutput,
        })),
    })) ?? [];

    return res.json({
      exam: {
        id: exam.id,
        title: exam.title,
        description: exam.description,
        instructions: exam.instructions,
        durationMinutes: exam.durationMinutes,
        availableFrom: exam.availableFrom,
        availableUntil: exam.availableUntil,
        status: exam.status,
        rules: exam.rules ? JSON.parse(exam.rules) : null,
        owner: exam.owner,
        questions: sanitizedQuestions,
      },
    });
  }

  // Instructor / Admin view (includes full test cases)
  return res.json({ exam });
});

// Update draft exam
router.patch('/:examId', requireAuth, requireRole(['instructor', 'admin']), async (req: AuthenticatedRequest, res: Response) => {
  const parseResult = UpdateExamSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: 'Validation failed', details: parseResult.error.flatten() });
  }

  const exam = await ExamService.updateExam(req.params.examId, req.user!.id, parseResult.data);
  return res.json({ exam });
});

// Add question with test cases atomically
router.post('/:examId/questions-with-testcases', requireAuth, requireRole(['instructor', 'admin']), async (req: AuthenticatedRequest, res: Response) => {
  const parseResult = CreateQuestionWithTestCasesSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: 'Validation failed', details: parseResult.error.flatten() });
  }

  const question = await ExamService.addQuestionWithTestCases(req.params.examId, req.user!.id, parseResult.data);
  return res.status(201).json({ question });
});

// Add question to exam
router.post('/:examId/questions', requireAuth, requireRole(['instructor', 'admin']), async (req: AuthenticatedRequest, res: Response) => {
  const parseResult = CreateQuestionSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: 'Validation failed', details: parseResult.error.flatten() });
  }

  const question = await ExamService.addQuestion(req.params.examId, req.user!.id, parseResult.data);
  return res.status(201).json({ question });
});

// Delete question from exam
router.delete('/:examId/questions/:questionId', requireAuth, requireRole(['instructor', 'admin']), async (req: AuthenticatedRequest, res: Response) => {
  await ExamService.deleteQuestion(req.params.questionId, req.user!.id);
  return res.json({ success: true, message: 'Question deleted' });
});

// Also allow delete question via /questions/:questionId
router.delete('/questions/:questionId', requireAuth, requireRole(['instructor', 'admin']), async (req: AuthenticatedRequest, res: Response) => {
  await ExamService.deleteQuestion(req.params.questionId, req.user!.id);
  return res.json({ success: true, message: 'Question deleted' });
});

// Add test case to question
router.post('/questions/:questionId/test-cases', requireAuth, requireRole(['instructor', 'admin']), async (req: AuthenticatedRequest, res: Response) => {
  const parseResult = CreateTestCaseSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: 'Validation failed', details: parseResult.error.flatten() });
  }

  const testCase = await ExamService.addTestCase(req.params.questionId, req.user!.id, parseResult.data);
  return res.status(201).json({ testCase });
});

router.post('/:examId/questions/:questionId/test-cases', requireAuth, requireRole(['instructor', 'admin']), async (req: AuthenticatedRequest, res: Response) => {
  const parseResult = CreateTestCaseSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: 'Validation failed', details: parseResult.error.flatten() });
  }

  const testCase = await ExamService.addTestCase(req.params.questionId, req.user!.id, parseResult.data);
  return res.status(201).json({ testCase });
});

// Publish exam
router.post('/:examId/publish', requireAuth, requireRole(['instructor', 'admin']), async (req: AuthenticatedRequest, res: Response) => {
  const result = await ExamService.publishExam(req.params.examId, req.user!.id);
  return res.json(result);
});

// Close exam
router.post('/:examId/close', requireAuth, requireRole(['instructor', 'admin']), async (req: AuthenticatedRequest, res: Response) => {
  const updated = await ExamService.closeExam(req.params.examId, req.user!.id);
  return res.json({ exam: updated });
});

// Release exam results
router.post('/:examId/release-results', requireAuth, requireRole(['instructor', 'admin']), async (req: AuthenticatedRequest, res: Response) => {
  const updated = await GradingService.releaseResults(req.params.examId, req.user!.id);
  return res.json({ exam: updated });
});

export { router as examRoutes };
