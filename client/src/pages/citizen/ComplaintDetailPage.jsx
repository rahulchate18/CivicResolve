import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';

export const ComplaintDetailPage = () => {
  const { id } = useParams();
  const { user } = useAuth();

  const [complaint, setComplaint] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Messaging state
  const [messages, setMessages] = useState([]);
  const [newMessageText, setNewMessageText] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);

  // Status transition state (Close / Reopen)
  const [actionLoading, setActionLoading] = useState(false);
  const [reopenNotes, setReopenNotes] = useState('');
  const [showReopenModal, setShowReopenModal] = useState(false);

  // Feedback state
  const [feedback, setFeedback] = useState(null);
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [feedbackComments, setFeedbackComments] = useState('');
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  // 1. Fetch Complaint Details
  const fetchComplaint = useCallback(async () => {
    try {
      const res = await api.get(`/complaints/${id}`);
      setComplaint(res.data.complaint);
    } catch (err) {
      setErrorMsg(err.message || 'Unable to load complaint details');
    } finally {
      setLoading(false);
    }
  }, [id]);

  // 2. Fetch Messages
  const fetchMessages = useCallback(async () => {
    try {
      const res = await api.get(`/complaints/${id}/messages`);
      const thread = res.data.messages || [];
      setMessages(thread);

      // Mark unread messages sent to the current user as read
      for (const msg of thread) {
        if (!msg.isRead && msg.sender?._id !== user?.id && msg.sender?._id !== user?._id) {
          api.patch(`/complaints/${id}/messages/${msg._id}/read`).catch(() => {});
        }
      }
    } catch (err) {
      // Thread might not be initialized or accessible yet
      console.warn('Messages load:', err.message);
    }
  }, [id, user]);

  // 3. Fetch Feedback
  const fetchFeedback = useCallback(async () => {
    try {
      const res = await api.get(`/feedback/complaint/${id}`);
      setFeedback(res.data.feedback || null);
    } catch {
      // 404 or no feedback yet is standard
      setFeedback(null);
    }
  }, [id]);

  useEffect(() => {
    fetchComplaint();
    fetchMessages();
    fetchFeedback();
  }, [fetchComplaint, fetchMessages, fetchFeedback]);

  // Handle Send Message
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessageText.trim()) return;

    setSendingMessage(true);
    setErrorMsg('');
    try {
      const res = await api.post(`/complaints/${id}/messages`, {
        message: newMessageText.trim(),
      });
      setMessages((prev) => [...prev, res.data.data]);
      setNewMessageText('');
    } catch (err) {
      setErrorMsg(err.message || 'Failed to send message');
    } finally {
      setSendingMessage(false);
    }
  };

  // Handle Citizen Close Complaint
  const handleConfirmClose = async () => {
    if (!window.confirm('Are you sure you want to mark this complaint as permanently CLOSED?')) {
      return;
    }
    setActionLoading(true);
    setErrorMsg('');
    try {
      const res = await api.patch(`/complaints/${id}/status`, {
        status: 'CLOSED',
        notes: 'Citizen confirmed resolution and closed complaint.',
      });
      setComplaint(res.data.complaint);
      setSuccessMsg('Complaint status has been updated to CLOSED.');
    } catch (err) {
      setErrorMsg(err.message || 'Failed to close complaint');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Citizen Reopen Complaint
  const handleReopenComplaint = async (e) => {
    e.preventDefault();
    if (!reopenNotes.trim()) {
      setErrorMsg('Please state why the grievance requires reopening.');
      return;
    }
    setActionLoading(true);
    setErrorMsg('');
    try {
      const res = await api.patch(`/complaints/${id}/status`, {
        status: 'IN_PROGRESS',
        notes: `Citizen reopened grievance: ${reopenNotes.trim()}`,
      });
      setComplaint(res.data.complaint);
      setShowReopenModal(false);
      setReopenNotes('');
      setSuccessMsg('Grievance reopened. Assigned officers have been notified.');
    } catch (err) {
      setErrorMsg(err.message || 'Failed to reopen complaint');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Feedback Submission
  const handleSubmitFeedback = async (e) => {
    e.preventDefault();
    setSubmittingFeedback(true);
    setErrorMsg('');
    try {
      const res = await api.post('/feedback', {
        complaintId: id,
        rating: Number(feedbackRating),
        comments: feedbackComments.trim(),
      });
      setFeedback(res.data.feedback);
      setSuccessMsg('Thank you! Your feedback has been recorded.');
    } catch (err) {
      setErrorMsg(err.message || 'Failed to submit feedback');
    } finally {
      setSubmittingFeedback(false);
    }
  };

  if (loading) {
    return (
      <div className="container py-5 text-center">
        <div className="spinner-border text-primary my-5" role="status">
          <span className="visually-hidden">Loading complaint...</span>
        </div>
      </div>
    );
  }

  if (!complaint) {
    return (
      <div className="container py-5 text-center">
        <div className="alert alert-warning my-4">
          <h5>Complaint Not Found</h5>
          <p className="mb-3">The complaint record could not be found or you lack permission to view it.</p>
          <Link to="/citizen/complaints" className="btn btn-primary">
            Back to Complaints
          </Link>
        </div>
      </div>
    );
  }

  const isEligibleForFeedback = ['RESOLVED', 'CLOSED'].includes(complaint.status);

  const isOwner =
    user?.role === 'USER' &&
    (complaint.createdBy?._id === user?.id ||
      complaint.createdBy?._id === user?._id ||
      complaint.createdBy === user?.id ||
      complaint.createdBy === user?._id);

  const getDashboardBreadcrumb = () => {
    if (user?.role === 'ADMIN') return { label: 'Admin Center', link: '/admin/dashboard' };
    if (user?.role === 'AGENT') return { label: 'Officer Console', link: '/officer/dashboard' };
    return { label: 'Citizen Dashboard', link: '/citizen/dashboard' };
  };

  const navCrumb = getDashboardBreadcrumb();

  return (
    <div className="container py-4">
      {/* Navigation Breadcrumb */}
      <nav aria-label="breadcrumb" className="mb-3">
        <ol className="breadcrumb">
          <li className="breadcrumb-item">
            <Link to={navCrumb.link}>{navCrumb.label}</Link>
          </li>
          {user?.role === 'USER' && (
            <li className="breadcrumb-item">
              <Link to="/citizen/complaints">Grievances</Link>
            </li>
          )}
          <li className="breadcrumb-item active" aria-current="page">
            {complaint.trackingId}
          </li>
        </ol>
      </nav>

      {/* Notifications */}
      {errorMsg && (
        <div className="alert alert-danger alert-dismissible fade show" role="alert">
          <i className="bi bi-exclamation-triangle-fill me-2"></i> {errorMsg}
          <button type="button" className="btn-close" onClick={() => setErrorMsg('')}></button>
        </div>
      )}
      {successMsg && (
        <div className="alert alert-success alert-dismissible fade show" role="alert">
          <i className="bi bi-check-circle-fill me-2"></i> {successMsg}
          <button type="button" className="btn-close" onClick={() => setSuccessMsg('')}></button>
        </div>
      )}

      {/* Header Bar */}
      <div className="portal-card p-4 mb-4">
        <div className="d-flex flex-wrap justify-content-between align-items-start gap-3">
          <div>
            <div className="d-flex align-items-center gap-2 mb-2">
              <span className="badge bg-secondary font-monospace fs-6 px-3 py-2">
                {complaint.trackingId}
              </span>
              <span className={`badge badge-status-${complaint.status} fs-6 px-3 py-2`}>
                {complaint.status.replace('_', ' ')}
              </span>
              <span className={`badge badge-priority-${complaint.priority} fs-6 px-3 py-2`}>
                {complaint.priority} Priority
              </span>
            </div>
            <h3 className="fw-bold text-dark mb-1">{complaint.title}</h3>
            <p className="text-muted small mb-0">
              Category: <strong>{complaint.category}</strong> &bull; Filed on{' '}
              {new Date(complaint.createdAt).toLocaleString()}
            </p>
          </div>

          {/* Citizen Lifecycle Action Buttons */}
          {isOwner && (
            <div className="d-flex gap-2">
              {complaint.status === 'RESOLVED' && (
                <>
                  <button
                    type="button"
                    className="btn btn-success fw-semibold"
                    onClick={handleConfirmClose}
                    disabled={actionLoading}
                  >
                    <i className="bi bi-check2-all me-1"></i> Confirm & Close
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline-warning fw-semibold"
                    onClick={() => setShowReopenModal(true)}
                    disabled={actionLoading}
                  >
                    <i className="bi bi-arrow-counterclockwise me-1"></i> Reopen
                  </button>
                </>
              )}
              {complaint.status === 'CLOSED' && (
                <button
                  type="button"
                  className="btn btn-outline-warning btn-sm fw-semibold"
                  onClick={() => setShowReopenModal(true)}
                  disabled={actionLoading}
                >
                  <i className="bi bi-arrow-counterclockwise me-1"></i> Reopen Grievance
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="row g-4">
        {/* Left Column: Complaint Details & Timeline */}
        <div className="col-12 col-lg-7">
          {/* Detailed Description */}
          <div className="portal-card p-4 mb-4">
            <h5 className="fw-bold mb-3 border-bottom pb-2">
              <i className="bi bi-file-text me-2 text-primary"></i> Grievance Description
            </h5>
            <p className="text-dark" style={{ whiteSpace: 'pre-line', lineHeight: '1.7' }}>
              {complaint.description}
            </p>

            {/* Resolution Section if present */}
            {complaint.resolution && (
              <div className="alert alert-success mt-4">
                <h6 className="fw-bold mb-1">
                  <i className="bi bi-check-circle me-1"></i> Official Resolution
                </h6>
                <p className="small mb-1">{complaint.resolution}</p>
                {complaint.resolvedAt && (
                  <div className="text-muted small">
                    Resolved at: {new Date(complaint.resolvedAt).toLocaleString()}
                  </div>
                )}
              </div>
            )}

            {/* Contact & Location Info */}
            {complaint.citizenContact && (
              <div className="mt-4 pt-3 border-top">
                <h6 className="fw-bold text-muted small text-uppercase mb-2">Location & Contact Details</h6>
                <div className="row g-2 small">
                  {complaint.citizenContact.phone && (
                    <div className="col-sm-6">
                      <span className="text-muted">Contact Phone:</span>{' '}
                      <strong>{complaint.citizenContact.phone}</strong>
                    </div>
                  )}
                  {complaint.citizenContact.address && (
                    <div className="col-sm-6">
                      <span className="text-muted">Address:</span>{' '}
                      <strong>{complaint.citizenContact.address}</strong>
                    </div>
                  )}
                  {(complaint.citizenContact.city || complaint.citizenContact.state) && (
                    <div className="col-sm-6">
                      <span className="text-muted">City / State:</span>{' '}
                      <strong>
                        {[complaint.citizenContact.city, complaint.citizenContact.state]
                          .filter(Boolean)
                          .join(', ')}
                      </strong>
                    </div>
                  )}
                  {complaint.citizenContact.postalCode && (
                    <div className="col-sm-6">
                      <span className="text-muted">Postal Code:</span>{' '}
                      <strong>{complaint.citizenContact.postalCode}</strong>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Attachments */}
            {complaint.attachments && complaint.attachments.length > 0 && (
              <div className="mt-4 pt-3 border-top">
                <h6 className="fw-bold text-muted small text-uppercase mb-2">Attachments</h6>
                <ul className="list-group list-group-flush small">
                  {complaint.attachments.map((att, idx) => (
                    <li key={idx} className="list-group-item d-flex justify-content-between align-items-center px-0">
                      <div>
                        <i className="bi bi-paperclip me-2 text-primary"></i>
                        <span>{att.originalName || att.filename}</span>
                        <span className="text-muted ms-2">
                          ({att.size ? `${(att.size / 1024).toFixed(1)} KB` : att.mimeType})
                        </span>
                      </div>
                      {att.url && (
                        <a href={att.url} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-outline-secondary">
                          View
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Audit Timeline */}
          <div className="portal-card p-4 mb-4">
            <h5 className="fw-bold mb-4 border-bottom pb-2">
              <i className="bi bi-clock-history me-2 text-primary"></i> Lifecycle Timeline
            </h5>
            <div className="timeline">
              {/* Origin node */}
              <div className="timeline-item">
                <div className="small fw-bold text-primary">Grievance Registered</div>
                <div className="text-muted small">
                  Initial submission by citizen on {new Date(complaint.createdAt).toLocaleString()}
                </div>
              </div>

              {/* Status history entries */}
              {complaint.statusHistory &&
                complaint.statusHistory.map((item, idx) => (
                  <div key={idx} className="timeline-item">
                    <div className="d-flex align-items-center gap-2">
                      <span className={`badge badge-status-${item.status} small`}>
                        {item.status.replace('_', ' ')}
                      </span>
                      <span className="text-muted small">
                        {new Date(item.changedAt).toLocaleString()}
                      </span>
                    </div>
                    {item.notes && <div className="text-dark small mt-1">{item.notes}</div>}
                    {item.changedBy?.name && (
                      <div className="text-muted small">
                        Updated by: {item.changedBy.name} ({item.changedBy.role})
                      </div>
                    )}
                  </div>
                ))}
            </div>
          </div>
        </div>

        {/* Right Column: Assigned Officer, Messaging & Feedback */}
        <div className="col-12 col-lg-5">
          {/* Assigned Officer Card */}
          <div className="portal-card p-3 mb-4">
            <h6 className="fw-bold text-muted small text-uppercase mb-3">
              <i className="bi bi-person-badge me-2 text-primary"></i> Officer Assignment
            </h6>
            {complaint.assignedAgent ? (
              <div className="d-flex align-items-center gap-3">
                <div className="rounded-circle bg-primary-subtle text-primary p-3 fw-bold fs-5">
                  <i className="bi bi-person-check-fill"></i>
                </div>
                <div>
                  <div className="fw-bold text-dark">{complaint.assignedAgent.name}</div>
                  <div className="text-muted small">{complaint.assignedAgent.email}</div>
                  <span className="badge bg-success-subtle text-success mt-1">Assigned Case Officer</span>
                </div>
              </div>
            ) : (
              <div className="text-muted small p-2 bg-light rounded text-center">
                <i className="bi bi-hourglass-split me-1 text-warning"></i>
                Awaiting administrative officer assignment.
              </div>
            )}
          </div>

          {/* Messaging Thread */}
          <div className="portal-card p-3 mb-4">
            <h6 className="fw-bold text-muted small text-uppercase mb-3">
              <i className="bi bi-chat-dots me-2 text-primary"></i> Inquiry & Updates Thread
            </h6>

            {/* Chat Box */}
            <div className="chat-container mb-3 d-flex flex-column gap-2" style={{ minHeight: '260px' }}>
              {messages.length === 0 ? (
                <div className="text-center text-muted my-auto py-4">
                  <i className="bi bi-chat-square-text fs-2 d-block mb-1 text-muted"></i>
                  <span className="small">No messages yet. Send an update or question below.</span>
                </div>
              ) : (
                messages.map((msg) => {
                  const isMe = msg.sender?._id === user?.id || msg.sender?._id === user?._id;
                  return (
                    <div
                      key={msg._id}
                      className={`d-flex flex-column ${isMe ? 'align-items-end' : 'align-items-start'}`}
                    >
                      <div className="small text-muted mb-1" style={{ fontSize: '0.75rem' }}>
                        {isMe ? 'You' : `${msg.sender?.name || 'Officer'} (${msg.senderRole || ''})`} &bull;{' '}
                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <div className={isMe ? 'chat-bubble-sent' : 'chat-bubble-received'}>
                        <div className="text-dark small" style={{ whiteSpace: 'pre-line' }}>
                          {msg.message}
                        </div>
                      </div>
                      {isMe && (
                        <span className="text-muted" style={{ fontSize: '0.65rem' }}>
                          {msg.isRead ? (
                            <span className="text-success">
                              <i className="bi bi-check2-all"></i> Read
                            </span>
                          ) : (
                            <span>Sent</span>
                          )}
                        </span>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Send Message Input */}
            <form onSubmit={handleSendMessage} className="d-flex gap-2">
              <input
                type="text"
                className="form-control form-control-sm"
                placeholder="Type your message to the officer..."
                value={newMessageText}
                onChange={(e) => setNewMessageText(e.target.value)}
                disabled={sendingMessage}
                maxLength={2000}
              />
              <button
                type="submit"
                className="btn btn-primary btn-sm px-3"
                disabled={sendingMessage || !newMessageText.trim()}
              >
                {sendingMessage ? (
                  <span className="spinner-border spinner-border-sm"></span>
                ) : (
                  <i className="bi bi-send"></i>
                )}
              </button>
            </form>
          </div>

          {/* Feedback & Rating Card (Only shown if complaint is RESOLVED or CLOSED) */}
          {isEligibleForFeedback && (
            <div className="portal-card p-4">
              <h6 className="fw-bold text-muted small text-uppercase mb-3">
                <i className="bi bi-star me-2 text-warning"></i> Citizen Service Feedback
              </h6>

              {feedback ? (
                <div>
                  <div className="d-flex align-items-center gap-1 mb-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <i
                        key={star}
                        className={`bi bi-star-fill ${
                          star <= feedback.rating ? 'text-warning' : 'text-secondary-subtle'
                        } fs-5`}
                      ></i>
                    ))}
                    <span className="ms-2 fw-bold">{feedback.rating} / 5</span>
                  </div>
                  {feedback.comments && (
                    <p className="text-dark small fst-italic mb-2">&ldquo;{feedback.comments}&rdquo;</p>
                  )}
                  <div className="text-muted small">
                    Submitted on {new Date(feedback.createdAt).toLocaleDateString()}
                  </div>
                </div>
              ) : isOwner ? (
                <form onSubmit={handleSubmitFeedback}>
                  <p className="text-muted small mb-3">
                    Your complaint has reached resolution. Please rate the quality of service received:
                  </p>
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Satisfaction Rating</label>
                    <div className="d-flex gap-3 align-items-center">
                      {[1, 2, 3, 4, 5].map((num) => (
                        <div key={num} className="form-check form-check-inline">
                          <input
                            className="form-check-input"
                            type="radio"
                            name="ratingRadio"
                            id={`rating-${num}`}
                            value={num}
                            checked={feedbackRating === num}
                            onChange={() => setFeedbackRating(num)}
                          />
                          <label className="form-check-label fw-bold" htmlFor={`rating-${num}`}>
                            {num} ★
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mb-3">
                    <label htmlFor="feedbackComments" className="form-label small fw-semibold">
                      Comments / Suggestions (Optional)
                    </label>
                    <textarea
                      id="feedbackComments"
                      className="form-control form-control-sm"
                      rows="3"
                      placeholder="Share details regarding your resolution experience..."
                      value={feedbackComments}
                      onChange={(e) => setFeedbackComments(e.target.value)}
                      maxLength={1000}
                    ></textarea>
                  </div>

                  <button
                    type="submit"
                    className="btn btn-warning btn-sm w-100 fw-semibold"
                    disabled={submittingFeedback}
                  >
                    {submittingFeedback ? 'Submitting...' : 'Submit Grievance Feedback'}
                  </button>
                </form>
              ) : (
                <p className="text-muted small fst-italic mb-0">
                  <i className="bi bi-info-circle me-1"></i> No citizen feedback has been submitted yet for this grievance.
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal for Reopening Complaint */}
      {showReopenModal && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} tabIndex="-1">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <form onSubmit={handleReopenComplaint}>
                <div className="modal-header">
                  <h5 className="modal-title fw-bold">Reopen Grievance</h5>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={() => setShowReopenModal(false)}
                    disabled={actionLoading}
                  ></button>
                </div>
                <div className="modal-body">
                  <p className="text-muted small">
                    Please explain why this grievance has not been satisfactorily resolved. The case will be set
                    back to <strong>IN_PROGRESS</strong>.
                  </p>
                  <div className="mb-3">
                    <label htmlFor="reopenReason" className="form-label small fw-bold">
                      Reason for Reopening *
                    </label>
                    <textarea
                      id="reopenReason"
                      className="form-control"
                      rows="3"
                      required
                      placeholder="e.g. Issue recurred, partial resolution, need further inspection..."
                      value={reopenNotes}
                      onChange={(e) => setReopenNotes(e.target.value)}
                      maxLength={1000}
                    ></textarea>
                  </div>
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={() => setShowReopenModal(false)}
                    disabled={actionLoading}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-warning fw-semibold"
                    disabled={actionLoading || !reopenNotes.trim()}
                  >
                    {actionLoading ? 'Updating...' : 'Reopen Grievance'}
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

export default ComplaintDetailPage;
