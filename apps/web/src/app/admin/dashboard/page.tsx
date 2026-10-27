'use client';

import React, { useState, useEffect } from 'react';
import { Navbar } from '@/components/Navbar';
import { fetchWithAuth } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

export default function AdminDashboardPage() {
  const { user, profile } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [reports, setReports] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [actionNotice, setActionNotice] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
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
    ])
      .then(([repData, usersData, logsData]) => {
        if (!mounted) return;
        if (repData?.reports) setReports(repData.reports);
        if (usersData?.users) setUsers(usersData.users);
        if (logsData?.logs) setAuditLogs(logsData.logs);
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [user]);

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      await fetchWithAuth(`/admin/users/${userId}/role`, {
        method: 'POST',
        body: JSON.stringify({ role: newRole }),
      });
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u)));
      setActionNotice(`User role updated to ${newRole}`);
      setTimeout(() => setActionNotice(''), 4000);
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
    <>
      <Navbar />

      <main className="flex-1 pt-20 pb-16 px-4 md:px-8 max-w-6xl mx-auto w-full">
        <div className="flex flex-col gap-6">
          <div>
            <h1 className="text-2xl font-bold text-on-surface">Platform Administration</h1>
            <p className="text-xs text-on-surface-variant mt-0.5">
              Live user directory, role-based access control, security policies, and immutable audit trails.
            </p>
          </div>

          {actionNotice && (
            <div className="p-3 bg-tertiary-container text-on-tertiary text-xs rounded-xl flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-on-tertiary-container">check_circle</span>
              <span>{actionNotice}</span>
            </div>
          )}

          {/* Aggregate Live Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-4 bg-surface-container-lowest rounded-2xl border border-surface-container-high/60 shadow-sm">
              <span className="text-[10px] uppercase font-mono font-bold text-on-surface-variant block">Total Accounts</span>
              <span className="text-2xl font-bold text-on-surface mt-1 block">
                {isLoading ? '—' : (reports?.totalUsers ?? users.length)}
              </span>
            </div>

            <div className="p-4 bg-surface-container-lowest rounded-2xl border border-surface-container-high/60 shadow-sm">
              <span className="text-[10px] uppercase font-mono font-bold text-on-surface-variant block">Instructors</span>
              <span className="text-2xl font-bold text-primary mt-1 block">
                {isLoading ? '—' : (reports?.instructorCount ?? users.filter((u) => u.role === 'instructor').length)}
              </span>
            </div>

            <div className="p-4 bg-surface-container-lowest rounded-2xl border border-surface-container-high/60 shadow-sm">
              <span className="text-[10px] uppercase font-mono font-bold text-on-surface-variant block">Students</span>
              <span className="text-2xl font-bold text-secondary mt-1 block">
                {isLoading ? '—' : (reports?.studentCount ?? users.filter((u) => u.role === 'student').length)}
              </span>
            </div>

            <div className="p-4 bg-surface-container-lowest rounded-2xl border border-surface-container-high/60 shadow-sm">
              <span className="text-[10px] uppercase font-mono font-bold text-on-surface-variant block">Flagged Attempts</span>
              <span className="text-2xl font-bold text-error mt-1 block">
                {isLoading ? '—' : (reports?.flaggedAttempts ?? 0)}
              </span>
            </div>
          </div>

          {/* User Management Table */}
          <section className="bg-surface-container-lowest p-5 rounded-2xl border border-surface-container-high/60 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-on-surface uppercase font-mono tracking-wider">
                User Directory &amp; RBAC Authorization
              </h2>
              <span className="text-xs font-mono text-on-surface-variant">{users.length} Active Records</span>
            </div>

            {users.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
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
                        <td className="py-3">
                          <span className="font-semibold text-on-surface block">{u.fullName}</span>
                          <span className="font-mono text-on-surface-variant text-[11px]">{u.email}</span>
                        </td>

                        <td className="py-3">
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

                        <td className="py-3">
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

                        <td className="py-3 text-right">
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
          <section className="bg-surface-container-lowest p-5 rounded-2xl border border-surface-container-high/60 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-on-surface uppercase font-mono tracking-wider">
                Immutable Security Audit Logs
              </h2>
              <span className="text-xs font-mono text-on-surface-variant">{auditLogs.length} Events Logged</span>
            </div>

            {auditLogs.length > 0 ? (
              <div className="space-y-2">
                {auditLogs.map((log: any, idx: number) => (
                  <div
                    key={log.id || idx}
                    className="p-3 bg-surface-container-low rounded-xl flex items-center justify-between text-xs font-mono"
                  >
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-secondary text-[16px]">security</span>
                      <span className="font-bold text-on-surface">{log.action}</span>
                      <span className="text-on-surface-variant">[{log.targetType}]</span>
                    </div>
                    <span className="text-on-surface-variant text-[11px]">
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
      </main>
    </>
  );
}
