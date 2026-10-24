import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';

const STATUSES = ['ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'REJECTED'];
const CATEGORIES = ['Technical', 'Billing', 'Service', 'Product', 'Other'];
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

export const OfficerDashboard = () => {
  const { user } = useAuth();

  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [approvalWarning, setApprovalWarning] = useState('');

  // Filtering & Pagination
  const [status, setStatus] = useState('');
  const [category, setCategory] = useState('');
  const [priority, setPriority] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Status Update Modal State
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [newStatus, setNewStatus] = useState('IN_PROGRESS');
  const [statusNotes, setStatusNotes] = useState('');
  const [resolutionText, setResolutionText] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [statusModalError, setStatusModalError] = useState('');

  // Messaging Drawer/Modal State
  const [activeMessageComplaint, setActiveMessageComplaint] = useState(null);
  const [threadMessages, setThreadMessages] = useState([]);
  const [newMessageText, setNewMessageText] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);

  // Fetch assigned complaints
  const fetchAssignedComplaints = useCallback(async () => {
    setLoading(true);
    setErrorMsg('');
    setApprovalWarning('');

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '10',
      });
      if (status) params.append('status', status);
      if (category) params.append('category', category);
      if (priority) params.append('priority', priority);

      const res = await api.get(`/complaints?${params.toString()}`);
      setComplaints(res.data.complaints || []);
      setTotalPages(res.data.pagination?.totalPages || res.data.pages || 1);
      setTotalCount(res.data.pagination?.total || res.data.total || 0);
    } catch (err) {
      if (err.message && err.message.toLowerCase().includes('pending administrator approval')) {
        setApprovalWarning(
          'Your Officer account is currently pending administrator verification and approval. You will receive assignments once an administrator approves your application.'
        );
      } else {
        setErrorMsg(err.message || 'Unable to retrieve assigned complaints');
      }
    } finally {
      setLoading(false);
    }
  }, [page, status, category, priority]);

  useEffect(() => {
    fetchAssignedComplaints();
  }, [fetchAssignedComplaints]);

  // Handle status update submission
  const handleStatusSubmit = async (e) => {
    e.preventDefault();
    if (!selectedComplaint) return;

    if (newStatus === 'RESOLVED' && !resolutionText.trim()) {
      setStatusModalError('Resolution text is mandatory when marking a grievance as RESOLVED.');
      return;
    }

    if (newStatus === 'REJECTED' && !statusNotes.trim()) {
      setStatusModalError('Explanatory notes are mandatory when REJECTING a grievance.');
      return;
    }

    setUpdatingStatus(true);
    setStatusModalError('');

    try {
      const payload = {
        status: newStatus,
        notes: statusNotes.trim() || undefined,
        resolution: newStatus === 'RESOLVED' ? resolutionText.trim() : undefined,
      };

      const res = await api.patch(`/complaints/${selectedComplaint._id}/status`, payload);

      // Update in local state
      setComplaints((prev) =>
        prev.map((c) => (c._id === selectedComplaint._id ? res.data.complaint : c))
      );

      setSelectedComplaint(null);
      setStatusNotes('');
      setResolutionText('');
    } catch (err) {
      setStatusModalError(err.message || 'Failed to update complaint status');
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Open Messaging modal for complaint
  const handleOpenMessaging = async (complaintItem) => {
    setActiveMessageComplaint(complaintItem);
    setThreadMessages([]);
    setMessagesLoading(true);

    try {
      const res = await api.get(`/complaints/${complaintItem._id}/messages`);
      const msgs = res.data.messages || [];
      setThreadMessages(msgs);

      // Mark unread citizen messages as read
      for (const m of msgs) {
        if (!m.isRead && m.sender?._id !== user?.id && m.sender?._id !== user?._id) {
          api.patch(`/complaints/${complaintItem._id}/messages/${m._id}/read`).catch(() => {});
        }
      }
    } catch (err) {
      console.warn('Error fetching messages:', err.message);
    } finally {
      setMessagesLoading(false);
    }
  };

  // Send message from Officer
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessageText.trim() || !activeMessageComplaint) return;

    setSendingMessage(true);
    try {
      const res = await api.post(`/complaints/${activeMessageComplaint._id}/messages`, {
        message: newMessageText.trim(),
      });
      setThreadMessages((prev) => [...prev, res.data.data]);
      setNewMessageText('');
    } catch (err) {
      alert(err.message || 'Failed to send message');
    } finally {
      setSendingMessage(false);
    }
  };

  // Workload summary metrics
  const activeCount = complaints.filter((c) => ['ASSIGNED', 'IN_PROGRESS'].includes(c.status)).length;
  const inProgressCount = complaints.filter((c) => c.status === 'IN_PROGRESS').length;
  const resolvedCount = complaints.filter((c) => ['RESOLVED', 'CLOSED'].includes(c.status)).length;

  return (
    <div className="container py-4">
      {/* Officer Header */}
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-4 pb-2 border-bottom">
        <div>
          <h2 className="fw-bold mb-1">Officer Duty Console</h2>
          <p className="text-muted small mb-0">
            Welcome, Officer {user?.name}. Manage your assigned grievances and communicate with citizens.
          </p>
        </div>
        <div className="mt-3 mt-md-0">
          <button
            type="button"
            className="btn btn-outline-primary btn-sm fw-semibold"
            onClick={fetchAssignedComplaints}
            disabled={loading}
          >
            <i className="bi bi-arrow-clockwise me-1"></i> Refresh Queue
          </button>
        </div>
      </div>

      {/* Account Approval Warning if Pending */}
      {approvalWarning && (
        <div className="alert alert-warning d-flex align-items-center mb-4" role="alert">
          <i className="bi bi-shield-exclamation fs-3 me-3 text-warning"></i>
          <div>
            <h6 className="fw-bold mb-1">Account Awaiting Administrator Verification</h6>
            <p className="small mb-0">{approvalWarning}</p>
          </div>
        </div>
      )}

      {/* Error alert */}
      {errorMsg && (
        <div className="alert alert-danger" role="alert">
          <i className="bi bi-exclamation-triangle-fill me-2"></i> {errorMsg}
        </div>
      )}

      {/* Workload Metric Cards */}
      <div className="row g-3 mb-4">
        <div className="col-sm-6 col-lg-3">
          <div className="portal-card p-3 border-start border-4 border-primary">
            <div className="text-muted small fw-semibold text-uppercase">Assigned Queue</div>
            <div className="h3 fw-bold text-dark mt-1 mb-0">{loading ? '...' : totalCount}</div>
          </div>
        </div>
        <div className="col-sm-6 col-lg-3">
          <div className="portal-card p-3 border-start border-4 border-warning">
            <div className="text-muted small fw-semibold text-uppercase">Under Investigation</div>
            <div className="h3 fw-bold text-dark mt-1 mb-0">{loading ? '...' : inProgressCount}</div>
          </div>
        </div>
        <div className="col-sm-6 col-lg-3">
          <div className="portal-card p-3 border-start border-4 border-info">
            <div className="text-muted small fw-semibold text-uppercase">Total Active Workload</div>
            <div className="h3 fw-bold text-dark mt-1 mb-0">{loading ? '...' : activeCount}</div>
          </div>
        </div>
        <div className="col-sm-6 col-lg-3">
          <div className="portal-card p-3 border-start border-4 border-success">
            <div className="text-muted small fw-semibold text-uppercase">Cases Resolved</div>
            <div className="h3 fw-bold text-dark mt-1 mb-0">{loading ? '...' : resolvedCount}</div>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="portal-card p-3 mb-4">
        <div className="row g-2 align-items-end">
          <div className="col-12 col-md-3">
            <label htmlFor="officerStatusFilter" className="form-label small fw-bold text-muted mb-1">
              Status
            </label>
            <select
              id="officerStatusFilter"
              className="form-select form-select-sm"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All Statuses</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.replace('_', ' ')}
                </option>
              ))}
            </select>
          </div>

          <div className="col-12 col-md-3">
            <label htmlFor="officerCategoryFilter" className="form-label small fw-bold text-muted mb-1">
              Category
            </label>
            <select
              id="officerCategoryFilter"
              className="form-select form-select-sm"
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All Categories</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="col-12 col-md-3">
            <label htmlFor="officerPriorityFilter" className="form-label small fw-bold text-muted mb-1">
              Priority
            </label>
            <select
              id="officerPriorityFilter"
              className="form-select form-select-sm"
              value={priority}
              onChange={(e) => {
                setPriority(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All Priorities</option>
              {PRIORITIES.map((p) => (
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
                setStatus('');
                setCategory('');
                setPriority('');
                setPage(1);
              }}
              disabled={!status && !category && !priority}
            >
              Reset Filters
            </button>
          </div>
        </div>
      </div>

      {/* Assigned Complaints Table */}
      <div className="portal-card">
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead className="table-light text-muted small text-uppercase">
              <tr>
                <th scope="col">Tracking ID</th>
                <th scope="col">Grievance Title</th>
                <th scope="col">Citizen</th>
                <th scope="col">Category</th>
                <th scope="col">Priority</th>
                <th scope="col">Status</th>
                <th scope="col" className="text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" className="text-center py-5 text-muted">
                    <div className="spinner-border spinner-border-sm text-primary me-2"></div>
                    Loading assigned grievances...
                  </td>
                </tr>
              ) : complaints.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center py-5">
                    <i className="bi bi-clipboard2-check text-muted fs-1 d-block mb-2"></i>
                    <h6 className="fw-bold text-muted mb-1">No grievances assigned</h6>
                    <p className="text-muted small mb-0">
                      {status || category || priority
                        ? 'No assigned complaints match the selected filter.'
                        : 'Your case queue is currently clear.'}
                    </p>
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
                      <div className="text-muted small text-truncate" style={{ maxWidth: '240px' }}>
                        {item.description}
                      </div>
                    </td>
                    <td>
                      <div className="small fw-semibold">{item.createdBy?.name || 'Citizen'}</div>
                      <div className="text-muted small">{item.createdBy?.email || ''}</div>
                    </td>
                    <td>
                      <span className="badge bg-light text-dark border">{item.category}</span>
                    </td>
                    <td>
                      <span className={`badge badge-priority-${item.priority}`}>
                        {item.priority}
                      </span>
                    </td>
                    <td>
                      <span className={`badge badge-status-${item.status}`}>
                        {item.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="text-end">
                      <div className="btn-group btn-group-sm">
                        <button
                          type="button"
                          className="btn btn-outline-primary"
                          onClick={() => {
                            setSelectedComplaint(item);
                            setNewStatus(item.status === 'ASSIGNED' ? 'IN_PROGRESS' : item.status);
                            setStatusNotes('');
                            setResolutionText(item.resolution || '');
                            setStatusModalError('');
                          }}
                        >
                          <i className="bi bi-pencil-square me-1"></i> Update Status
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline-secondary"
                          onClick={() => handleOpenMessaging(item)}
                          title="Open Message Thread"
                        >
                          <i className="bi bi-chat-dots"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="portal-card-header d-flex justify-content-between align-items-center py-2 px-3">
            <span className="small text-muted">
              Showing page <strong>{page}</strong> of <strong>{totalPages}</strong>
            </span>
            <div className="btn-group btn-group-sm">
              <button
                type="button"
                className="btn btn-outline-secondary"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </button>
              <button
                type="button"
                className="btn btn-outline-secondary"
                disabled={page >= totalPages || loading}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Status Update Modal */}
      {selectedComplaint && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} tabIndex="-1">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <form onSubmit={handleStatusSubmit}>
                <div className="modal-header">
                  <div>
                    <h5 className="modal-title fw-bold">Update Complaint Status</h5>
                    <span className="font-monospace small text-primary">{selectedComplaint.trackingId}</span>
                  </div>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={() => setSelectedComplaint(null)}
                    disabled={updatingStatus}
                  ></button>
                </div>

                <div className="modal-body">
                  {statusModalError && (
                    <div className="alert alert-danger small py-2 mb-3">
                      <i className="bi bi-exclamation-circle me-1"></i> {statusModalError}
                    </div>
                  )}

                  <div className="mb-3">
                    <label htmlFor="newStatusSelect" className="form-label small fw-bold">
                      Target Lifecycle Status *
                    </label>
                    <select
                      id="newStatusSelect"
                      className="form-select"
                      value={newStatus}
                      onChange={(e) => setNewStatus(e.target.value)}
                      required
                    >
                      <option value="IN_PROGRESS">IN_PROGRESS (Under Investigation)</option>
                      <option value="RESOLVED">RESOLVED (Solution Provided)</option>
                      <option value="REJECTED">REJECTED (Declined / Out of Scope)</option>
                    </select>
                  </div>

                  {newStatus === 'RESOLVED' && (
                    <div className="mb-3">
                      <label htmlFor="resolutionInput" className="form-label small fw-bold">
                        Official Resolution Summary *
                      </label>
                      <textarea
                        id="resolutionInput"
                        className="form-control"
                        rows="4"
                        placeholder="Detail the remedial actions taken to address the citizen's complaint..."
                        value={resolutionText}
                        onChange={(e) => setResolutionText(e.target.value)}
                        required
                        maxLength={3000}
                      ></textarea>
                      <div className="form-text small">This resolution text will be visible to the citizen.</div>
                    </div>
                  )}

                  <div className="mb-3">
                    <label htmlFor="statusNotesInput" className="form-label small fw-bold">
                      Audit Notes {newStatus === 'REJECTED' ? '*' : '(Optional)'}
                    </label>
                    <textarea
                      id="statusNotesInput"
                      className="form-control"
                      rows="3"
                      placeholder={
                        newStatus === 'REJECTED'
                          ? 'Provide clear reason why this grievance is rejected...'
                          : 'Internal notes recorded in the lifecycle timeline...'
                      }
                      value={statusNotes}
                      onChange={(e) => setStatusNotes(e.target.value)}
                      required={newStatus === 'REJECTED'}
                      maxLength={1000}
                    ></textarea>
                  </div>
                </div>

                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={() => setSelectedComplaint(null)}
                    disabled={updatingStatus}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary fw-semibold" disabled={updatingStatus}>
                    {updatingStatus ? 'Updating...' : 'Save Lifecycle Transition'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Messaging Modal */}
      {activeMessageComplaint && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} tabIndex="-1">
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <div>
                  <h5 className="modal-title fw-bold">Citizen Communication Thread</h5>
                  <span className="font-monospace small text-primary">
                    {activeMessageComplaint.trackingId} &bull; {activeMessageComplaint.title}
                  </span>
                </div>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setActiveMessageComplaint(null)}
                ></button>
              </div>

              <div className="modal-body p-3">
                <div className="chat-container mb-3" style={{ maxHeight: '350px' }}>
                  {messagesLoading ? (
                    <div className="text-center py-4 text-muted">
                      <div className="spinner-border spinner-border-sm me-2"></div>
                      Loading messages...
                    </div>
                  ) : threadMessages.length === 0 ? (
                    <div className="text-center text-muted py-5">
                      <i className="bi bi-chat-left-dots fs-2 d-block mb-1"></i>
                      <span>No messages in this inquiry thread yet.</span>
                    </div>
                  ) : (
                    threadMessages.map((m) => {
                      const isMe = m.sender?._id === user?.id || m.sender?._id === user?._id;
                      return (
                        <div
                          key={m._id}
                          className={`d-flex flex-column mb-2 ${isMe ? 'align-items-end' : 'align-items-start'}`}
                        >
                          <div className="small text-muted mb-1" style={{ fontSize: '0.75rem' }}>
                            {isMe ? 'You (Officer)' : `${m.sender?.name || 'Citizen'} (USER)`} &bull;{' '}
                            {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                          <div className={isMe ? 'chat-bubble-sent' : 'chat-bubble-received'}>
                            <div className="small" style={{ whiteSpace: 'pre-line' }}>
                              {m.message}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                <form onSubmit={handleSendMessage} className="d-flex gap-2">
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Type official reply to citizen..."
                    value={newMessageText}
                    onChange={(e) => setNewMessageText(e.target.value)}
                    disabled={sendingMessage}
                  />
                  <button
                    type="submit"
                    className="btn btn-primary px-3 fw-semibold"
                    disabled={sendingMessage || !newMessageText.trim()}
                  >
                    {sendingMessage ? 'Sending...' : 'Send'}
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OfficerDashboard;
