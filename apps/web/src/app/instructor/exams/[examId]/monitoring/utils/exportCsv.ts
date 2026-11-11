import { AttemptCandidate, ExamInfo } from '../types';

export function exportCohortCSV(exam: ExamInfo | null, attempts: AttemptCandidate[]) {
  if (!exam || attempts.length === 0) {
    alert('No candidate records available to export.');
    return;
  }

  const headers = [
    'Candidate Name',
    'Candidate Email',
    'Status',
    'Trust Score',
    'Questions Answered',
    'Total Questions',
    'Marks Awarded',
    'Max Marks',
    'Score %',
    'Started At',
    'Submitted At',
    'Infraction Count',
    'Termination Reason',
  ];

  const rows = attempts.map((a) => {
    const answeredCount = a.answers.length;
    const totalQ = exam.totalQuestions || 0;
    return [
      `"${(a.student.fullName || 'Unnamed Student').replace(/"/g, '""')}"`,
      `"${a.student.email}"`,
      `"${a.status}"`,
      a.trustScore,
      answeredCount,
      totalQ,
      a.totalMarksAwarded ?? '',
      a.maxMarksTotal ?? exam.totalMaxMarks ?? '',
      a.percentageScore ? `${a.percentageScore}%` : '',
      `"${new Date(a.startedAt).toLocaleString()}"`,
      a.submittedAt ? `"${new Date(a.submittedAt).toLocaleString()}"` : '',
      a.events.length,
      `"${(a.terminationReason || '').replace(/"/g, '""')}"`,
    ].join(',');
  });

  const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute(
    'download',
    `monitoring-${exam.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`
  );
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
