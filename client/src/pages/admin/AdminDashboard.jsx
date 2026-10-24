import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';

export const AdminDashboard = () => {
  const { user: currentAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState('analytics');

  // ==========================================
  // TAB 1: ANALYTICS OVERVIEW STATE
  // ==========================================
  const [analytics, setAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [analyticsError, setAnalyticsError] = useState('');

  // ==========================================
  // TAB 2: COMPLAINTS & ASSIGNMENT STATE
  // ==========================================
  const [complaints, setComplaints] = useState([]);
  const [complaintsLoading, setComplaintsLoading] = useState(false);
  const [complaintStatus, setComplaintStatus] = useState('');
  const [complaintCategory, setComplaintCategory] = useState('');
  const [complaintPriority, setComplaintPriority] = useState('');
  const [complaintPage, setComplaintPage] = useState(1);
  const [complaintTotalPages, setComplaintTotalPages] = useState(1);
  const [complaintTotalCount, setComplaintTotalCount] = useState(0);

  // Assign Officer Modal
  const [assignModalComplaint, setAssignModalComplaint] = useState(null);
  const [approvedOfficers, setApprovedOfficers] = useState([]);
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [assignNotes, setAssignNotes] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState('');

  // ==========================================
  // TAB 3: OFFICER APPLICATIONS STATE
  // ==========================================
  const [agentApps, setAgentApps] = useState([]);
  const [agentAppsLoading, setAgentAppsLoading] = useState(false);
  const [agentStatusFilter, setAgentStatusFilter] = useState('');
  const [agentPage, setAgentPage] = useState(1);
  const [agentTotalPages, setAgentTotalPages] = useState(1);
  const [agentActionError, setAgentActionError] = useState('');
  const [agentSuccessMsg, setAgentSuccessMsg] = useState('');

  // Reject Agent Modal
  const [rejectingAgent, setRejectingAgent] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejectSubmitting, setRejectSubmitting] = useState(false);

  // ==========================================
  // TAB 4: USER ACCOUNTS STATE
  // ==========================================
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('');
  const [userPage, setUserPage] = useState(1);
  const [userTotalPages, setUserTotalPages] = useState(1);
  const [userActionError, setUserActionError] = useState('');
  const [userSuccessMsg, setUserSuccessMsg] = useState('');

  // ------------------------------------------
  // 1. Fetch Analytics Overview
  // ------------------------------------------
  const fetchAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    setAnalyticsError('');
    try {
      const res = await api.get('/admin/analytics/overview');
      setAnalytics(res.data);
    } catch (err) {
      setAnalyticsError(err.message || 'Unable to retrieve administrative analytics');
    } finally {
      setAnalyticsLoading(false);
    }
  }, []);

  // ------------------------------------------
  // 2. Fetch Complaints (for Assignment Tab)
  // ------------------------------------------
  const fetchComplaints = useCallback(async () => {
    setComplaintsLoading(true);
    try {
      const params = new URLSearchParams({
        page: complaintPage.toString(),
        limit: '10',
      });
      if (complaintStatus) params.append('status', complaintStatus);
      if (complaintCategory) params.append('category', complaintCategory);
      if (complaintPriority) params.append('priority', complaintPriority);

      const res = await api.get(`/complaints?${params.toString()}`);
      setComplaints(res.data.complaints || []);
      setComplaintTotalPages(res.data.pagination?.totalPages || res.data.pages || 1);
      setComplaintTotalCount(res.data.pagination?.total || res.data.total || 0);
    } catch (err) {
      console.warn('Complaints fetch error:', err.message);
    } finally {
      setComplaintsLoading(false);
    }
  }, [complaintPage, complaintStatus, complaintCategory, complaintPriority]);

  // Load approved officers for assignment modal
  const loadApprovedOfficers = async () => {
    try {
      const res = await api.get('/admin/agents?status=APPROVED&limit=50');
      setApprovedOfficers(res.data.agents || []);
    } catch (err) {
      console.warn('Unable to load officers for assignment:', err.message);
    }
  };

  const handleOpenAssign = (complaintItem) => {
    setAssignModalComplaint(complaintItem);
    setSelectedAgentId(complaintItem.assignedAgent?._id || '');
    setAssignNotes('');
    setAssignError('');
    loadApprovedOfficers();
  };

  const handleAssignSubmit = async (e) => {
    e.preventDefault();
    if (!selectedAgentId || !assignModalComplaint) return;

    setAssigning(true);
    setAssignError('');
    try {
      const res = await api.patch(`/complaints/${assignModalComplaint._id}/assign`, {
        agentId: selectedAgentId,
        notes: assignNotes.trim() || undefined,
      });

      setComplaints((prev) =>
        prev.map((c) => (c._id === assignModalComplaint._id ? res.data.complaint : c))
      );
      setAssignModalComplaint(null);
    } catch (err) {
      setAssignError(err.message || 'Failed to assign officer');
    } finally {
      setAssigning(false);
    }
  };

  // ------------------------------------------
  // 3. Fetch Officer Applications
  // ------------------------------------------
  const fetchAgentApps = useCallback(async () => {
    setAgentAppsLoading(true);
    setAgentActionError('');
    try {
      const params = new URLSearchParams({
        page: agentPage.toString(),
        limit: '10',
      });
      if (agentStatusFilter) params.append('status', agentStatusFilter);

      const res = await api.get(`/admin/agents?${params.toString()}`);
      setAgentApps(res.data.agents || []);
      setAgentTotalPages(res.data.pagination?.totalPages || 1);
    } catch (err) {
      setAgentActionError(err.message || 'Failed to load officer applications');
    } finally {
      setAgentAppsLoading(false);
    }
  }, [agentPage, agentStatusFilter]);

  const handleApproveAgent = async (agentId) => {
    if (!window.confirm('Approve this officer application? They will be granted case assignment access.')) {
      return;
    }
    setAgentActionError('');
    setAgentSuccessMsg('');
    try {
      await api.patch(`/admin/agents/${agentId}/approve`);
      setAgentSuccessMsg('Officer application approved successfully.');
      fetchAgentApps();
    } catch (err) {
      setAgentActionError(err.message || 'Failed to approve officer');
    }
  };

  const handleRejectAgentSubmit = async (e) => {
    e.preventDefault();
    if (!rejectingAgent || !rejectionReason.trim()) return;

    setRejectSubmitting(true);
    setAgentActionError('');
    try {
      await api.patch(`/admin/agents/${rejectingAgent._id}/reject`, {
        rejectionReason: rejectionReason.trim(),
      });
      setAgentSuccessMsg('Officer application rejected.');
      setRejectingAgent(null);
      setRejectionReason('');
      fetchAgentApps();
    } catch (err) {
      setAgentActionError(err.message || 'Failed to reject officer');
    } finally {
      setRejectSubmitting(false);
    }
  };

  // ------------------------------------------
  // 4. Fetch Users
  // ------------------------------------------
  const fetchUsers = useCallback(async () => {
    setUsersLoading(true);
    setUserActionError('');
    try {
      const params = new URLSearchParams({
        page: userPage.toString(),
        limit: '10',
      });
      if (userRoleFilter) params.append('role', userRoleFilter);
      if (userSearch.trim()) params.append('search', userSearch.trim());

      const res = await api.get(`/admin/users?${params.toString()}`);
      setUsers(res.data.users || []);
      setUserTotalPages(res.data.pagination?.totalPages || 1);
    } catch (err) {
      setUserActionError(err.message || 'Failed to retrieve users');
    } finally {
      setUsersLoading(false);
    }
  }, [userPage, userRoleFilter, userSearch]);

  const handleToggleUserActive = async (targetUser) => {
    const action = targetUser.isActive ? 'deactivate' : 'reactivate';
    if (!window.confirm(`Are you sure you want to ${action} account for ${targetUser.name}?`)) {
      return;
    }

    setUserActionError('');
    setUserSuccessMsg('');
    try {
      await api.patch(`/admin/users/${targetUser._id}/status`, {
        isActive: !targetUser.isActive,
      });
      setUserSuccessMsg(`User ${targetUser.name} successfully ${action}d.`);
      fetchUsers();
    } catch (err) {
      setUserActionError(err.message || `Failed to ${action} user`);
    }
  };

  // Initial tab loading
  useEffect(() => {
    if (activeTab === 'analytics') fetchAnalytics();
    if (activeTab === 'complaints') fetchComplaints();
    if (activeTab === 'agents') fetchAgentApps();
    if (activeTab === 'users') fetchUsers();
  }, [activeTab, fetchAnalytics, fetchComplaints, fetchAgentApps, fetchUsers]);

  return (
    <div className="container py-4">
      {/* Header */}
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-4 pb-2 border-bottom">
        <div>
          <h2 className="fw-bold mb-1">Administrative Center</h2>
          <p className="text-muted small mb-0">
            System administration, grievance assignment oversight, officer verification, and live analytics.
          </p>
        </div>
        <div className="mt-3 mt-md-0">
          <span className="badge bg-danger-subtle text-danger border border-danger-subtle px-3 py-2 fw-semibold">
            <i className="bi bi-shield-lock-fill me-1"></i> Admin: {currentAdmin?.name}
          </span>
        </div>
      </div>

      {/* Navigation Tabs */}
      <ul className="nav nav-pills mb-4 gap-2">
        <li className="nav-item">
          <button
            className={`nav-link fw-semibold ${activeTab === 'analytics' ? 'active' : ''}`}
            onClick={() => setActiveTab('analytics')}
          >
            <i className="bi bi-bar-chart-line me-1"></i> Live Analytics
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link fw-semibold ${activeTab === 'complaints' ? 'active' : ''}`}
            onClick={() => setActiveTab('complaints')}
          >
            <i className="bi bi-folder2-open me-1"></i> All Grievances & Assignment
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link fw-semibold ${activeTab === 'agents' ? 'active' : ''}`}
            onClick={() => setActiveTab('agents')}
          >
            <i className="bi bi-person-check me-1"></i> Officer Applications
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link fw-semibold ${activeTab === 'users' ? 'active' : ''}`}
            onClick={() => setActiveTab('users')}
          >
            <i className="bi bi-people me-1"></i> User Accounts
          </button>
        </li>
      </ul>

      {/* ========================================================== */}
      {/* TAB 1: ANALYTICS OVERVIEW */}
      {/* ========================================================== */}
      {activeTab === 'analytics' && (
        <div>
          {analyticsLoading ? (
            <div className="text-center py-5">
              <div className="spinner-border text-primary my-4"></div>
              <p className="text-muted">Loading live MongoDB analytics...</p>
            </div>
          ) : analyticsError ? (
            <div className="alert alert-danger">
              <i className="bi bi-exclamation-triangle-fill me-2"></i> {analyticsError}
            </div>
          ) : analytics ? (
            <div>
              {/* Summary Metrics */}
              <div className="row g-3 mb-4">
                <div className="col-sm-6 col-lg-2">
                  <div className="portal-card p-3 border-start border-4 border-primary">
                    <div className="text-muted small fw-semibold text-uppercase">Total Filed</div>
                    <div className="h3 fw-bold text-dark mt-1 mb-0">{analytics.summary?.totalComplaints}</div>
                  </div>
                </div>
                <div className="col-sm-6 col-lg-2">
                  <div className="portal-card p-3 border-start border-4 border-warning">
                    <div className="text-muted small fw-semibold text-uppercase">Active Cases</div>
                    <div className="h3 fw-bold text-dark mt-1 mb-0">{analytics.summary?.activeCount}</div>
                  </div>
                </div>
                <div className="col-sm-6 col-lg-2">
                  <div className="portal-card p-3 border-start border-4 border-success">
                    <div className="text-muted small fw-semibold text-uppercase">Resolved</div>
                    <div className="h3 fw-bold text-dark mt-1 mb-0">{analytics.summary?.resolvedCount}</div>
                  </div>
                </div>
                <div className="col-sm-6 col-lg-2">
                  <div className="portal-card p-3 border-start border-4 border-secondary">
                    <div className="text-muted small fw-semibold text-uppercase">Closed</div>
                    <div className="h3 fw-bold text-dark mt-1 mb-0">{analytics.summary?.closedCount}</div>
                  </div>
                </div>
                <div className="col-sm-6 col-lg-2">
                  <div className="portal-card p-3 border-start border-4 border-danger">
                    <div className="text-muted small fw-semibold text-uppercase">Rejected</div>
                    <div className="h3 fw-bold text-dark mt-1 mb-0">{analytics.summary?.rejectedCount}</div>
                  </div>
                </div>
                <div className="col-sm-6 col-lg-2">
                  <div className="portal-card p-3 border-start border-4 border-info">
                    <div className="text-muted small fw-semibold text-uppercase">Avg Resolution</div>
                    <div className="h3 fw-bold text-dark mt-1 mb-0">
                      {analytics.resolutionMetrics?.avgResolutionHours} hrs
                    </div>
                  </div>
                </div>
              </div>

              {/* Breakdowns Row */}
              <div className="row g-4 mb-4">
                {/* Status Breakdown */}
                <div className="col-12 col-md-4">
                  <div className="portal-card p-3 h-100">
                    <h6 className="fw-bold text-muted small text-uppercase mb-3">Status Breakdown</h6>
                    {Object.entries(analytics.breakdowns?.byStatus || {}).map(([key, val]) => (
                      <div key={key} className="d-flex justify-content-between align-items-center mb-2">
                        <span className={`badge badge-status-${key}`}>{key.replace('_', ' ')}</span>
                        <span className="fw-bold">{val}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Category Breakdown */}
                <div className="col-12 col-md-4">
                  <div className="portal-card p-3 h-100">
                    <h6 className="fw-bold text-muted small text-uppercase mb-3">Category Breakdown</h6>
                    {Object.entries(analytics.breakdowns?.byCategory || {}).map(([key, val]) => (
                      <div key={key} className="d-flex justify-content-between align-items-center mb-2">
                        <span className="text-dark small fw-semibold">{key}</span>
                        <span className="badge bg-light text-dark border">{val}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Priority Breakdown */}
                <div className="col-12 col-md-4">
                  <div className="portal-card p-3 h-100">
                    <h6 className="fw-bold text-muted small text-uppercase mb-3">Priority Distribution</h6>
                    {Object.entries(analytics.breakdowns?.byPriority || {}).map(([key, val]) => (
                      <div key={key} className="d-flex justify-content-between align-items-center mb-2">
                        <span className={`badge badge-priority-${key}`}>{key}</span>
                        <span className="fw-bold">{val}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Officer Workload Table */}
              <div className="portal-card">
                <div className="portal-card-header">
                  <span className="fw-bold">Officer Workload & Resolution Performance</span>
                </div>
                <div className="table-responsive">
                  <table className="table table-hover align-middle mb-0">
                    <thead className="table-light text-muted small text-uppercase">
                      <tr>
                        <th>Officer</th>
                        <th>Department</th>
                        <th>Status</th>
                        <th>Active Complaints</th>
                        <th>Capacity</th>
                        <th>Resolved Cases</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analytics.officers?.length === 0 ? (
                        <tr>
                          <td colSpan="6" className="text-center py-4 text-muted">
                            No officer accounts registered yet.
                          </td>
                        </tr>
                      ) : (
                        analytics.officers?.map((o) => (
                          <tr key={o._id}>
                            <td>
                              <div className="fw-bold">{o.officerName || 'Officer'}</div>
                              <div className="text-muted small">{o.officerEmail}</div>
                            </td>
                            <td>{o.department}</td>
                            <td>
                              <span
                                className={`badge ${
                                  o.approvalStatus === 'APPROVED'
                                    ? 'bg-success'
                                    : o.approvalStatus === 'PENDING'
                                    ? 'bg-warning text-dark'
                                    : 'bg-danger'
                                }`}
                              >
                                {o.approvalStatus}
                              </span>
                            </td>
                            <td className="fw-bold">{o.activeComplaintsCount}</td>
                            <td>{o.maxActiveComplaints} max</td>
                            <td className="text-success fw-bold">{o.totalResolved}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* ========================================================== */}
      {/* TAB 2: COMPLAINT MANAGEMENT & ASSIGNMENT */}
      {/* ========================================================== */}
      {activeTab === 'complaints' && (
        <div>
          {/* Filter Bar */}
          <div className="portal-card p-3 mb-4">
            <div className="row g-2 align-items-end">
              <div className="col-12 col-md-3">
                <label className="form-label small fw-bold text-muted mb-1">Status</label>
                <select
                  className="form-select form-select-sm"
                  value={complaintStatus}
                  onChange={(e) => {
                    setComplaintStatus(e.target.value);
                    setComplaintPage(1);
                  }}
                >
                  <option value="">All Statuses</option>
                  {['PENDING', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'REJECTED'].map((s) => (
                    <option key={s} value={s}>
                      {s.replace('_', ' ')}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-12 col-md-3">
                <label className="form-label small fw-bold text-muted mb-1">Category</label>
                <select
                  className="form-select form-select-sm"
                  value={complaintCategory}
                  onChange={(e) => {
                    setComplaintCategory(e.target.value);
                    setComplaintPage(1);
                  }}
                >
                  <option value="">All Categories</option>
                  {['Technical', 'Billing', 'Service', 'Product', 'Other'].map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-12 col-md-3">
                <label className="form-label small fw-bold text-muted mb-1">Priority</label>
                <select
                  className="form-select form-select-sm"
                  value={complaintPriority}
                  onChange={(e) => {
                    setComplaintPriority(e.target.value);
                    setComplaintPage(1);
                  }}
                >
                  <option value="">All Priorities</option>
                  {['LOW', 'MEDIUM', 'HIGH', 'URGENT'].map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-12 col-md-3">
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm w-100"
                  onClick={() => {
                    setComplaintStatus('');
                    setComplaintCategory('');
                    setComplaintPriority('');
                    setComplaintPage(1);
                  }}
                >
                  Reset Filters
                </button>
              </div>
            </div>
          </div>

          {/* Complaints Table */}
          <div className="portal-card">
            <div className="portal-card-header d-flex justify-content-between align-items-center">
              <span className="fw-bold">All Portal Complaints ({complaintTotalCount} total)</span>
            </div>
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light text-muted small text-uppercase">
                  <tr>
                    <th>Tracking ID</th>
                    <th>Title & Category</th>
                    <th>Citizen</th>
                    <th>Assigned Officer</th>
                    <th>Status</th>
                    <th className="text-end">Assignment</th>
                  </tr>
                </thead>
                <tbody>
                  {complaintsLoading ? (
                    <tr>
                      <td colSpan="6" className="text-center py-5 text-muted">
                        <div className="spinner-border spinner-border-sm text-primary me-2"></div>
                        Loading complaints...
                      </td>
                    </tr>
                  ) : complaints.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="text-center py-5 text-muted">
                        No complaints match query.
                      </td>
                    </tr>
                  ) : (
                    complaints.map((item) => (
                      <tr key={item._id}>
                        <td>
                          <span className="font-monospace fw-semibold text-primary">{item.trackingId}</span>
                          <div className="text-muted small">
                            {new Date(item.createdAt).toLocaleDateString()}
                          </div>
                        </td>
                        <td>
                          <div className="fw-semibold text-dark text-truncate" style={{ maxWidth: '240px' }}>
                            {item.title}
                          </div>
                          <span className="badge bg-light text-dark border">{item.category}</span>
                          <span className={`badge badge-priority-${item.priority} ms-1`}>
                            {item.priority}
                          </span>
                        </td>
                        <td>
                          <div className="small fw-semibold">{item.createdBy?.name || 'Citizen'}</div>
                          <div className="text-muted small">{item.createdBy?.email}</div>
                        </td>
                        <td>
                          {item.assignedAgent ? (
                            <div>
                              <div className="small fw-semibold text-success">
                                <i className="bi bi-person-check me-1"></i> {item.assignedAgent.name}
                              </div>
                              <div className="text-muted small">{item.assignedAgent.email}</div>
                            </div>
                          ) : (
                            <span className="badge bg-warning-subtle text-warning border border-warning-subtle">
                              Unassigned
                            </span>
                          )}
                        </td>
                        <td>
                          <span className={`badge badge-status-${item.status}`}>
                            {item.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="text-end">
                          <button
                            type="button"
                            className="btn btn-outline-primary btn-sm fw-semibold"
                            onClick={() => handleOpenAssign(item)}
                          >
                            <i className="bi bi-person-plus me-1"></i>
                            {item.assignedAgent ? 'Reassign' : 'Assign Officer'}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {complaintTotalPages > 1 && (
              <div className="portal-card-header d-flex justify-content-between align-items-center py-2 px-3">
                <span className="small text-muted">
                  Page <strong>{complaintPage}</strong> of <strong>{complaintTotalPages}</strong>
                </span>
                <div className="btn-group btn-group-sm">
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    disabled={complaintPage <= 1 || complaintsLoading}
                    onClick={() => setComplaintPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    disabled={complaintPage >= complaintTotalPages || complaintsLoading}
                    onClick={() => setComplaintPage((p) => Math.min(complaintTotalPages, p + 1))}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================== */}
      {/* TAB 3: OFFICER APPLICATION MANAGEMENT */}
      {/* ========================================================== */}
      {activeTab === 'agents' && (
        <div>
          {/* Notifications */}
          {agentActionError && (
            <div className="alert alert-danger mb-3">
              <i className="bi bi-exclamation-triangle-fill me-2"></i> {agentActionError}
            </div>
          )}
          {agentSuccessMsg && (
            <div className="alert alert-success mb-3">
              <i className="bi bi-check-circle-fill me-2"></i> {agentSuccessMsg}
            </div>
          )}

          {/* Filter Bar */}
          <div className="portal-card p-3 mb-4">
            <div className="d-flex align-items-center gap-3">
              <label className="small fw-bold text-muted mb-0">Status Filter:</label>
              <div className="btn-group btn-group-sm">
                <button
                  type="button"
                  className={`btn ${!agentStatusFilter ? 'btn-primary' : 'btn-outline-secondary'}`}
                  onClick={() => {
                    setAgentStatusFilter('');
                    setAgentPage(1);
                  }}
                >
                  All Applications
                </button>
                <button
                  type="button"
                  className={`btn ${agentStatusFilter === 'PENDING' ? 'btn-primary' : 'btn-outline-secondary'}`}
                  onClick={() => {
                    setAgentStatusFilter('PENDING');
                    setAgentPage(1);
                  }}
                >
                  Pending Only
                </button>
                <button
                  type="button"
                  className={`btn ${agentStatusFilter === 'APPROVED' ? 'btn-primary' : 'btn-outline-secondary'}`}
                  onClick={() => {
                    setAgentStatusFilter('APPROVED');
                    setAgentPage(1);
                  }}
                >
                  Approved
                </button>
                <button
                  type="button"
                  className={`btn ${agentStatusFilter === 'REJECTED' ? 'btn-primary' : 'btn-outline-secondary'}`}
                  onClick={() => {
                    setAgentStatusFilter('REJECTED');
                    setAgentPage(1);
                  }}
                >
                  Rejected
                </button>
              </div>
            </div>
          </div>

          {/* Applications Table */}
          <div className="portal-card">
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light text-muted small text-uppercase">
                  <tr>
                    <th>Applicant</th>
                    <th>Department</th>
                    <th>Specialization</th>
                    <th>Status</th>
                    <th>Applied Date</th>
                    <th className="text-end">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {agentAppsLoading ? (
                    <tr>
                      <td colSpan="6" className="text-center py-5 text-muted">
                        <div className="spinner-border spinner-border-sm text-primary me-2"></div>
                        Loading officer applications...
                      </td>
                    </tr>
                  ) : agentApps.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="text-center py-5 text-muted">
                        No officer applications found.
                      </td>
                    </tr>
                  ) : (
                    agentApps.map((item) => (
                      <tr key={item._id}>
                        <td>
                          <div className="fw-semibold text-dark">{item.user?.name}</div>
                          <div className="text-muted small">{item.user?.email}</div>
                          {item.user?.phone && (
                            <div className="text-muted small">{item.user.phone}</div>
                          )}
                        </td>
                        <td>{item.department}</td>
                        <td>
                          {item.specialization && item.specialization.length > 0 ? (
                            item.specialization.map((spec, i) => (
                              <span key={i} className="badge bg-light text-dark border me-1">
                                {spec}
                              </span>
                            ))
                          ) : (
                            <span className="text-muted small">General</span>
                          )}
                        </td>
                        <td>
                          <span
                            className={`badge ${
                              item.approvalStatus === 'APPROVED'
                                ? 'bg-success'
                                : item.approvalStatus === 'PENDING'
                                ? 'bg-warning text-dark'
                                : 'bg-danger'
                            }`}
                          >
                            {item.approvalStatus}
                          </span>
                          {item.rejectionReason && (
                            <div className="text-danger small mt-1">Reason: {item.rejectionReason}</div>
                          )}
                        </td>
                        <td className="text-muted small">
                          {new Date(item.createdAt).toLocaleDateString()}
                        </td>
                        <td className="text-end">
                          {item.approvalStatus === 'PENDING' ? (
                            <div className="btn-group btn-group-sm">
                              <button
                                type="button"
                                className="btn btn-success fw-semibold"
                                onClick={() => handleApproveAgent(item._id)}
                              >
                                <i className="bi bi-check-lg me-1"></i> Approve
                              </button>
                              <button
                                type="button"
                                className="btn btn-outline-danger fw-semibold"
                                onClick={() => {
                                  setRejectingAgent(item);
                                  setRejectionReason('');
                                }}
                              >
                                <i className="bi bi-x-lg me-1"></i> Reject
                              </button>
                            </div>
                          ) : (
                            <span className="text-muted small">Processed</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {agentTotalPages > 1 && (
              <div className="portal-card-header d-flex justify-content-between align-items-center py-2 px-3">
                <span className="small text-muted">
                  Page <strong>{agentPage}</strong> of <strong>{agentTotalPages}</strong>
                </span>
                <div className="btn-group btn-group-sm">
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    disabled={agentPage <= 1 || agentAppsLoading}
                    onClick={() => setAgentPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    disabled={agentPage >= agentTotalPages || agentAppsLoading}
                    onClick={() => setAgentPage((p) => Math.min(agentTotalPages, p + 1))}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================== */}
      {/* TAB 4: USER ACCOUNTS MANAGEMENT */}
      {/* ========================================================== */}
      {activeTab === 'users' && (
        <div>
          {/* Notifications */}
          {userActionError && (
            <div className="alert alert-danger mb-3">
              <i className="bi bi-exclamation-triangle-fill me-2"></i> {userActionError}
            </div>
          )}
          {userSuccessMsg && (
            <div className="alert alert-success mb-3">
              <i className="bi bi-check-circle-fill me-2"></i> {userSuccessMsg}
            </div>
          )}

          {/* Search & Filter Bar */}
          <div className="portal-card p-3 mb-4">
            <div className="row g-2">
              <div className="col-12 col-md-6">
                <input
                  type="text"
                  className="form-control form-control-sm"
                  placeholder="Search user by name or email address..."
                  value={userSearch}
                  onChange={(e) => {
                    setUserSearch(e.target.value);
                    setUserPage(1);
                  }}
                />
              </div>
              <div className="col-12 col-md-3">
                <select
                  className="form-select form-select-sm"
                  value={userRoleFilter}
                  onChange={(e) => {
                    setUserRoleFilter(e.target.value);
                    setUserPage(1);
                  }}
                >
                  <option value="">All Roles (Citizen, Agent, Admin)</option>
                  <option value="USER">USER (Citizen)</option>
                  <option value="AGENT">AGENT (Officer)</option>
                  <option value="ADMIN">ADMIN (Administrator)</option>
                </select>
              </div>
              <div className="col-12 col-md-3">
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm w-100"
                  onClick={() => {
                    setUserSearch('');
                    setUserRoleFilter('');
                    setUserPage(1);
                  }}
                >
                  Clear Filters
                </button>
              </div>
            </div>
          </div>

          {/* Users Table */}
          <div className="portal-card">
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light text-muted small text-uppercase">
                  <tr>
                    <th>User</th>
                    <th>Role</th>
                    <th>Phone</th>
                    <th>Account Status</th>
                    <th>Joined</th>
                    <th className="text-end">Access Control</th>
                  </tr>
                </thead>
                <tbody>
                  {usersLoading ? (
                    <tr>
                      <td colSpan="6" className="text-center py-5 text-muted">
                        <div className="spinner-border spinner-border-sm text-primary me-2"></div>
                        Loading user accounts...
                      </td>
                    </tr>
                  ) : users.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="text-center py-5 text-muted">
                        No user accounts match criteria.
                      </td>
                    </tr>
                  ) : (
                    users.map((item) => {
                      const isSelf = item._id === currentAdmin?.id || item._id === currentAdmin?._id;
                      return (
                        <tr key={item._id}>
                          <td>
                            <div className="fw-semibold text-dark">
                              {item.name} {isSelf && <span className="badge bg-secondary ms-1">You</span>}
                            </div>
                            <div className="text-muted small">{item.email}</div>
                          </td>
                          <td>
                            <span
                              className={`badge ${
                                item.role === 'ADMIN'
                                  ? 'bg-danger'
                                  : item.role === 'AGENT'
                                  ? 'bg-info text-dark'
                                  : 'bg-primary'
                              }`}
                            >
                              {item.role}
                            </span>
                          </td>
                          <td className="text-muted small">{item.phone || '—'}</td>
                          <td>
                            <span className={`badge ${item.isActive ? 'bg-success' : 'bg-secondary'}`}>
                              {item.isActive ? 'Active' : 'Deactivated'}
                            </span>
                          </td>
                          <td className="text-muted small">
                            {new Date(item.createdAt).toLocaleDateString()}
                          </td>
                          <td className="text-end">
                            <button
                              type="button"
                              className={`btn btn-sm ${item.isActive ? 'btn-outline-danger' : 'btn-outline-success'}`}
                              disabled={isSelf}
                              onClick={() => handleToggleUserActive(item)}
                            >
                              {item.isActive ? (
                                <>
                                  <i className="bi bi-person-x me-1"></i> Deactivate
                                </>
                              ) : (
                                <>
                                  <i className="bi bi-person-check me-1"></i> Activate
                                </>
                              )}
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {userTotalPages > 1 && (
              <div className="portal-card-header d-flex justify-content-between align-items-center py-2 px-3">
                <span className="small text-muted">
                  Page <strong>{userPage}</strong> of <strong>{userTotalPages}</strong>
                </span>
                <div className="btn-group btn-group-sm">
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    disabled={userPage <= 1 || usersLoading}
                    onClick={() => setUserPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    disabled={userPage >= userTotalPages || usersLoading}
                    onClick={() => setUserPage((p) => Math.min(userTotalPages, p + 1))}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================== */}
      {/* MODAL: ASSIGN OFFICER */}
      {/* ========================================================== */}
      {assignModalComplaint && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} tabIndex="-1">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <form onSubmit={handleAssignSubmit}>
                <div className="modal-header">
                  <div>
                    <h5 className="modal-title fw-bold">Assign Case Officer</h5>
                    <span className="font-monospace small text-primary">
                      {assignModalComplaint.trackingId} &bull; {assignModalComplaint.category}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={() => setAssignModalComplaint(null)}
                    disabled={assigning}
                  ></button>
                </div>

                <div className="modal-body">
                  {assignError && (
                    <div className="alert alert-danger small py-2 mb-3">
                      <i className="bi bi-exclamation-circle me-1"></i> {assignError}
                    </div>
                  )}

                  <div className="mb-3">
                    <label className="form-label small fw-bold">Select Approved Officer *</label>
                    <select
                      className="form-select"
                      value={selectedAgentId}
                      onChange={(e) => setSelectedAgentId(e.target.value)}
                      required
                    >
                      <option value="">-- Choose verified officer --</option>
                      {approvedOfficers.map((app) => (
                        <option key={app.user?._id || app._id} value={app.user?._id}>
                          {app.user?.name} ({app.department}) — {app.activeComplaintsCount} active
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="mb-3">
                    <label className="form-label small fw-bold">Assignment Instructions / Notes (Optional)</label>
                    <textarea
                      className="form-control"
                      rows="3"
                      placeholder="Add specific directives or notes for the assigned officer..."
                      value={assignNotes}
                      onChange={(e) => setAssignNotes(e.target.value)}
                      maxLength={1000}
                    ></textarea>
                  </div>
                </div>

                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={() => setAssignModalComplaint(null)}
                    disabled={assigning}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary fw-semibold"
                    disabled={assigning || !selectedAgentId}
                  >
                    {assigning ? 'Assigning...' : 'Confirm Assignment'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================== */}
      {/* MODAL: REJECT OFFICER APPLICATION */}
      {/* ========================================================== */}
      {rejectingAgent && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} tabIndex="-1">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <form onSubmit={handleRejectAgentSubmit}>
                <div className="modal-header">
                  <h5 className="modal-title fw-bold text-danger">Reject Officer Application</h5>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={() => setRejectingAgent(null)}
                    disabled={rejectSubmitting}
                  ></button>
                </div>

                <div className="modal-body">
                  <p className="small text-muted mb-3">
                    You are rejecting the officer credentials for{' '}
                    <strong>{rejectingAgent.user?.name}</strong> ({rejectingAgent.department}). A required
                    explanation will be archived on record.
                  </p>

                  <div className="mb-3">
                    <label className="form-label small fw-bold">Rejection Reason *</label>
                    <textarea
                      className="form-control"
                      rows="4"
                      required
                      placeholder="e.g. Incomplete credentials, department quota reached, failed background verification..."
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      maxLength={500}
                    ></textarea>
                    <div className="form-text small">Maximum 500 characters.</div>
                  </div>
                </div>

                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={() => setRejectingAgent(null)}
                    disabled={rejectSubmitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-danger fw-semibold"
                    disabled={rejectSubmitting || !rejectionReason.trim()}
                  >
                    {rejectSubmitting ? 'Rejecting...' : 'Confirm Rejection'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
