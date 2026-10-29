'use client';

import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { fetchWithAuth } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { ProtectedRoute } from '@/components/ProtectedRoute';

export default function AdminDashboardPage() {
  return (
    <ProtectedRoute allowedRoles={['admin']}>
      <AdminDashboardContent />
    </ProtectedRoute>
  );
}

function AdminDashboardContent() {
  const { user } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [reports, setReports] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [actionNotice, setActionNotice] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Add teacher form state
  const [teacherEmailInput, setTeacherEmailInput] = useState('');
  const [isAddingTeacher, setIsAddingTeacher] = useState(false);
  const [addTeacherError, setAddTeacherError] = useState<string | null>(null);
  const [addTeacherSuccess, setAddTeacherSuccess] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const loadData = () => {
    if (!user?.id) return;
    setIsLoading(true);

    Promise.all([
      fetchWithAuth('/admin/reports').catch((err) => {
        console.error('Failed to load admin reports:', err);
        return { reports: null };
      }),
      fetchWithAuth('/admin/users').catch((err) => {
        console.error('Failed to load admin users:', err);
        return { users: [] };
      }),
      fetchWithAuth('/admin/audit-logs').catch((err) => {
        console.error('Failed to load audit logs:', err);
        return { logs: [] };
      }),
      fetchWithAuth('/admin/teachers').catch((err) => {
        console.error('Failed to load teachers:', err);
        return { teachers: [] };
      }),
    ])
      .then(([repData, usersData, logsData, teachData]) => {
        if (repData?.reports) setReports(repData.reports);
        if (usersData?.users) setUsers(usersData.users);
        if (logsData?.logs) setAuditLogs(logsData.logs);
        if (teachData?.teachers) setTeachers(teachData.teachers);
      })
      .finally(() => {
        setIsLoading(false);
      });
  };

  useEffect(() => {
    loadData();
  }, [user?.id]);

  const handleAddTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = teacherEmailInput.trim().toLowerCase();
    if (!email || !email.includes('@')) {
      setAddTeacherError('Please enter a valid email address.');
      return;
    }

    setIsAddingTeacher(true);
    setAddTeacherError(null);
    setAddTeacherSuccess(null);

    try {
      const res = await fetchWithAuth('/admin/teachers', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });

      setTeacherEmailInput('');
      setAddTeacherSuccess(res.message || `Successfully authorized ${email} as a teacher.`);
      setActionNotice(`Authorized teacher: ${email}. Account will open Teacher Dashboard upon login.`);
      setTimeout(() => setActionNotice(''), 6000);

      // Refresh teachers and aggregate metrics
      const updated = await fetchWithAuth('/admin/teachers').catch(() => null);
      if (updated?.teachers) setTeachers(updated.teachers);

      const rep = await fetchWithAuth('/admin/reports').catch(() => null);
      if (rep?.reports) setReports(rep.reports);

      const usersData = await fetchWithAuth('/admin/users').catch(() => null);
      if (usersData?.users) setUsers(usersData.users);
    } catch (err: any) {
      setAddTeacherError(err.message || 'Failed to authorize teacher');
    } finally {
      setIsAddingTeacher(false);
    }
  };

  const handleRevokeTeacher = async (identifier: string, email: string) => {
    if (!confirm(`Are you sure you want to revoke teacher privileges for "${email}"?`)) {
      return;
    }

    setRevokingId(identifier);
    try {
      await fetchWithAuth(`/admin/teachers/${encodeURIComponent(identifier)}`, {
        method: 'DELETE',
      });
      setTeachers((prev) => prev.filter((t) => t.id !== identifier && t.email.toLowerCase() !== email.toLowerCase()));
      setActionNotice(`Revoked teacher privileges for ${email}.`);
      setTimeout(() => setActionNotice(''), 5000);

      // Refresh user list and metrics
      const usersData = await fetchWithAuth('/admin/users').catch(() => null);
      if (usersData?.users) setUsers(usersData.users);

      const rep = await fetchWithAuth('/admin/reports').catch(() => null);
      if (rep?.reports) setReports(rep.reports);
    } catch (err: any) {
      alert(err.message || 'Failed to revoke teacher privileges');
    } finally {
      setRevokingId(null);
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      await fetchWithAuth(`/admin/users/${userId}/role`, {
        method: 'POST',
        body: JSON.stringify({ role: newRole }),
      });
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u)));
      setActionNotice(`User role updated to ${newRole}`);
      setTimeout(() => setActionNotice(''), 4000);

      // Refresh teachers list if changed
      const teachData = await fetchWithAuth('/admin/teachers').catch(() => null);
      if (teachData?.teachers) setTeachers(teachData.teachers);
    } catch (err: any) {
      alert(err.message || 'Role update failed');
    }
  };

  const handleToggleSuspend = async (userId: string, currentStatus: string) => {
    const action = currentStatus === 'active' ? 'suspend' : 'activate';
    try {
      await fetchWithAuth(`/admin/users/${userId}/${action}`, {
        method: 'POST',
      });
      const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, status: newStatus } : u)));
      setActionNotice(`User account status updated to ${newStatus}`);
      setTimeout(() => setActionNotice(''), 4000);
    } catch (err: any) {
      alert(err.message || 'Operation failed');
    }
  };

  return (
    <DashboardLayout portalRole="admin" title="Platform Administration" subtitle="User directory, teacher authorization & security audits">
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold text-on-surface">Platform Administration</h1>
          <p className="text-xs text-on-surface-variant mt-0.5">
            Authorize teachers, manage user access, inspect security policies, and monitor immutable audit trails.
          </p>
        </div>

        {actionNotice && (
          <div className="p-3 bg-tertiary-container text-on-tertiary text-xs rounded-xl flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-on-tertiary-container">check_circle</span>
            <span>{actionNotice}</span>
          </div>
        )}

        {/* Aggregate Live Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3">
          <div className="p-3 sm:p-4 bg-surface-container-lowest rounded-2xl border border-surface-container-high/60 shadow-sm">
            <span className="text-[10px] uppercase font-mono font-bold text-on-surface-variant block">Total Accounts</span>
            <span className="text-xl sm:text-2xl font-bold text-on-surface mt-1 block">
              {isLoading ? '—' : (reports?.totalUsers ?? users.length)}
            </span>
          </div>

          <div className="p-3 sm:p-4 bg-surface-container-lowest rounded-2xl border border-surface-container-high/60 shadow-sm">
            <span className="text-[10px] uppercase font-mono font-bold text-on-surface-variant block">Instructors</span>
            <span className="text-xl sm:text-2xl font-bold text-primary mt-1 block">
              {isLoading ? '—' : (reports?.instructorCount ?? teachers.length)}
            </span>
          </div>

          <div className="p-3 sm:p-4 bg-surface-container-lowest rounded-2xl border border-surface-container-high/60 shadow-sm">
            <span className="text-[10px] uppercase font-mono font-bold text-on-surface-variant block">Students</span>
            <span className="text-xl sm:text-2xl font-bold text-secondary mt-1 block">
              {isLoading ? '—' : (reports?.studentCount ?? users.filter((u) => u.role === 'student').length)}
            </span>
          </div>

          <div className="p-3 sm:p-4 bg-surface-container-lowest rounded-2xl border border-surface-container-high/60 shadow-sm">
            <span className="text-[10px] uppercase font-mono font-bold text-on-surface-variant block">Authorized Teachers</span>
            <span className="text-xl sm:text-2xl font-bold text-indigo-600 mt-1 block">
              {isLoading ? '—' : teachers.length}
            </span>
          </div>

          <div className="p-3 sm:p-4 bg-surface-container-lowest rounded-2xl border border-surface-container-high/60 shadow-sm col-span-2 sm:col-span-1">
            <span className="text-[10px] uppercase font-mono font-bold text-on-surface-variant block">Flagged Attempts</span>
            <span className="text-xl sm:text-2xl font-bold text-error mt-1 block">
              {isLoading ? '—' : (reports?.flaggedAttempts ?? 0)}
            </span>
          </div>
        </div>

        {/* Teacher Portal & Authorized Teachers Section */}
        <section id="teachers" className="bg-surface-container-lowest p-4 sm:p-5 rounded-2xl border border-surface-container-high/60 shadow-sm space-y-5 scroll-mt-20">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <span className="material-symbols-outlined text-[22px]">school</span>
              </div>
              <div>
                <h2 className="text-xs sm:text-sm font-bold text-on-surface uppercase font-mono tracking-wider">
                  Teacher Portal &amp; Authorized Teachers
                </h2>
                <p className="text-[11px] sm:text-xs text-on-surface-variant">
                  Add teachers by entering their Google email. Authorized accounts automatically receive Instructor privileges and are redirected to the Teacher Dashboard upon login.
                </p>
              </div>
            </div>
            <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-mono font-bold">
              {teachers.length} Authorized
            </span>
          </div>

          {/* Add Teacher Card / Input Form */}
          <div className="p-4 sm:p-5 rounded-xl border border-surface-container-high bg-surface-container-lowest shadow-sm space-y-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[20px]">person_add</span>
              <h3 className="text-xs sm:text-sm font-bold text-on-surface">Add Teacher</h3>
            </div>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              Enter the teacher&apos;s Google account email. If the account already exists, it is upgraded immediately. If they have not logged in yet, they are pre-authorized and will instantly become an Instructor the moment they sign in.
            </p>

            <form onSubmit={handleAddTeacher} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 pt-1">
              <div className="relative flex-1">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px]">
                  mail
                </span>
                <input
                  type="email"
                  value={teacherEmailInput}
                  onChange={(e) => {
                    setTeacherEmailInput(e.target.value);
                    if (addTeacherError) setAddTeacherError(null);
                  }}
                  placeholder="teacher.name@gmail.com or official@astu.edu.et"
                  className="w-full h-11 pl-9 pr-3 rounded-xl bg-white text-on-surface text-xs font-mono border border-surface-container-high focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isAddingTeacher || !teacherEmailInput.trim()}
                className="h-11 px-5 rounded-xl bg-primary text-white text-xs font-semibold hover:bg-slate-800 disabled:opacity-50 transition-colors flex items-center justify-center gap-2 flex-shrink-0 shadow-sm"
              >
                {isAddingTeacher ? (
                  <>
                    <span className="material-symbols-outlined text-[16px] animate-spin">refresh</span>
                    <span>Authorizing...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[18px]">add_circle</span>
                    <span>Add to Teachers</span>
                  </>
                )}
              </button>
            </form>

            {addTeacherSuccess && (
              <div className="p-3 rounded-xl bg-tertiary-container text-on-tertiary text-xs flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">check_circle</span>
                <span>{addTeacherSuccess}</span>
              </div>
            )}

            {addTeacherError && (
              <div className="p-3 rounded-xl bg-error-container text-error text-xs flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">error</span>
                <span>{addTeacherError}</span>
              </div>
            )}
          </div>

          {/* Authorized Teachers Roster */}
          <div className="space-y-2.5">
            <h3 className="text-xs font-bold font-mono uppercase text-on-surface-variant tracking-wider">
              Authorized Teachers Roster ({teachers.length})
            </h3>

            {teachers.length > 0 ? (
              <div className="space-y-2.5">
                {teachers.map((teach) => (
                  <div
                    key={teach.id || teach.email}
                    className="p-3.5 sm:p-4 rounded-xl border border-surface-container-high bg-white flex flex-col md:flex-row md:items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs sm:text-sm flex-shrink-0">
                        {teach.fullName ? teach.fullName.slice(0, 2).toUpperCase() : teach.email.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-xs sm:text-sm text-on-surface">
                            {teach.fullName || 'Authorized Google Account'}
                          </span>
                          <span className="font-mono text-xs text-on-surface-variant font-medium">
                            {teach.email}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase ${
                              teach.isRegistered
                                ? 'bg-emerald-500/10 text-emerald-700'
                                : 'bg-amber-500/15 text-amber-800'
                            }`}
                          >
                            {teach.isRegistered ? 'Active Instructor' : 'Pending First Sign-in'}
                          </span>
                        </div>

                        <div className="text-[11px] text-on-surface-variant flex items-center gap-3 flex-wrap">
                          <span>
                            <strong>Exams Created:</strong> {teach.ownedExamsCount ?? 0}
                          </span>
                          <span>&bull;</span>
                          <span className="font-mono text-[10px]">
                            Authorized: {teach.createdAt ? new Date(teach.createdAt).toLocaleDateString() : 'Active'}
                          </span>
                          {!teach.isRegistered && (
                            <span className="text-amber-700 font-medium">
                              (Will auto-route to /instructor/dashboard upon sign-in)
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-end pt-2 md:pt-0 border-t md:border-0 border-surface-container-high/60">
                      <button
                        onClick={() => handleRevokeTeacher(teach.id || teach.email, teach.email)}
                        disabled={revokingId === teach.id || revokingId === teach.email}
                        className="px-3 py-1.5 rounded-xl border border-error/30 text-error hover:bg-error-container/20 text-xs font-semibold transition-colors flex items-center gap-1.5 disabled:opacity-50"
                      >
                        {revokingId === teach.id || revokingId === teach.email ? (
                          <span className="material-symbols-outlined text-[14px] animate-spin">refresh</span>
                        ) : (
                          <span className="material-symbols-outlined text-[16px]">person_remove</span>
                        )}
                        <span>Revoke Teacher Access</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 rounded-xl border border-dashed border-surface-container-high text-center text-xs text-on-surface-variant space-y-1">
                <span className="material-symbols-outlined text-3xl text-on-surface-variant/50 block mx-auto">school</span>
                <p className="font-semibold text-on-surface">No authorized teachers yet.</p>
                <p>Use the form above to add teacher email addresses.</p>
              </div>
            )}
          </div>
        </section>

        {/* User Management Table */}
        <section id="users" className="bg-surface-container-lowest p-4 sm:p-5 rounded-2xl border border-surface-container-high/60 shadow-sm space-y-4 scroll-mt-20">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-xs sm:text-sm font-bold text-on-surface uppercase font-mono tracking-wider">
              User Directory &amp; RBAC Authorization
            </h2>
            <span className="text-xs font-mono text-on-surface-variant">{users.length} Active Records</span>
          </div>

          {users.length > 0 ? (
            <div className="overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0">
              <table className="w-full text-left text-xs min-w-[540px]">
                <thead>
                  <tr className="border-b border-surface-container-high text-on-surface-variant font-mono uppercase text-[10px]">
                    <th className="pb-2">Name &amp; Email</th>
                    <th className="pb-2">Role</th>
                    <th className="pb-2">Status</th>
                    <th className="pb-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container-high">
                  {users.map((u) => (
                    <tr key={u.id} className="py-2.5">
                      <td className="py-3 pr-2">
                        <span className="font-semibold text-on-surface block">{u.fullName}</span>
                        <span className="font-mono text-on-surface-variant text-[11px]">{u.email}</span>
                      </td>

                      <td className="py-3 px-2">
                        <select
                          value={u.role}
                          onChange={(e) => handleRoleChange(u.id, e.target.value)}
                          className="px-2 py-1 bg-surface-container rounded-lg font-mono text-xs border border-surface-container-high focus:outline-none"
                        >
                          <option value="student">student</option>
                          <option value="instructor">instructor</option>
                          <option value="admin">admin</option>
                        </select>
                      </td>

                      <td className="py-3 px-2">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                            u.status === 'active'
                              ? 'bg-tertiary-fixed text-on-tertiary-fixed'
                              : 'bg-error-container text-error'
                          }`}
                        >
                          {u.status}
                        </span>
                      </td>

                      <td className="py-3 pl-2 text-right">
                        <button
                          onClick={() => handleToggleSuspend(u.id, u.status)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                            u.status === 'active'
                              ? 'bg-error-container text-error hover:bg-error/20'
                              : 'bg-surface-container text-secondary'
                          }`}
                        >
                          {u.status === 'active' ? 'Suspend' : 'Activate'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-on-surface-variant">
              No users found. Users are automatically registered upon first Google OAuth sign-in.
            </div>
          )}
        </section>

        {/* Immutable Security Audit Logs */}
        <section id="audit" className="bg-surface-container-lowest p-4 sm:p-5 rounded-2xl border border-surface-container-high/60 shadow-sm space-y-3 scroll-mt-20">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-xs sm:text-sm font-bold text-on-surface uppercase font-mono tracking-wider">
              Immutable Security Audit Logs
            </h2>
            <span className="text-xs font-mono text-on-surface-variant">{auditLogs.length} Events Logged</span>
          </div>

          {auditLogs.length > 0 ? (
            <div className="space-y-2">
              {auditLogs.map((log: any, idx: number) => (
                <div
                  key={log.id || idx}
                  className="p-2.5 sm:p-3 bg-surface-container-low rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs font-mono"
                >
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-secondary text-[16px]">security</span>
                    <span className="font-bold text-on-surface">{log.action}</span>
                    <span className="text-on-surface-variant">[{log.targetType}]</span>
                  </div>
                  <span className="text-on-surface-variant text-[10px] sm:text-[11px]">
                    {new Date(log.createdAt).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-6 text-center text-xs text-on-surface-variant font-mono">
              No security audit events recorded yet. Platform telemetry is ready.
            </div>
          )}
        </section>
      </div>
    </DashboardLayout>
  );
}
