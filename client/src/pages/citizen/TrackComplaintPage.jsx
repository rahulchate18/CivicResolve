import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';

export const TrackComplaintPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialId = searchParams.get('id') || '';

  const [trackingIdInput, setTrackingIdInput] = useState(initialId);
  const [complaint, setComplaint] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const { isAuthenticated } = useAuth();

  const handleTrack = useCallback(async (searchId) => {
    const queryId = (searchId || trackingIdInput).trim().toUpperCase();
    if (!queryId) return;

    setLoading(true);
    setErrorMsg('');
    setComplaint(null);

    try {
      const res = await api.get(`/complaints/track/${queryId}`);
      setComplaint(res.data.complaint);
      setSearchParams({ id: queryId });
    } catch (err) {
      setErrorMsg(err.message || 'Unable to find a complaint matching that tracking identifier');
    } finally {
      setLoading(false);
    }
  }, [trackingIdInput, setSearchParams]);

  useEffect(() => {
    if (initialId && isAuthenticated) {
      handleTrack(initialId);
    }
  }, [initialId, isAuthenticated, handleTrack]);

  const handleSubmit = (e) => {
    e.preventDefault();
    handleTrack();
  };

  return (
    <div className="container py-5">
      <div className="row justify-content-center">
        <div className="col-12 col-md-10 col-lg-8">
          <div className="text-center mb-4">
            <h2 className="fw-bold">Track Your Grievance</h2>
            <p className="text-muted">
              Enter the unique Tracking ID assigned to your complaint to view its current live lifecycle progress.
            </p>
          </div>

          {/* Search Input Box */}
          <div className="portal-card p-4 mb-4">
            <form onSubmit={handleSubmit} className="d-flex gap-2">
              <div className="input-group">
                <span className="input-group-text bg-white">
                  <i className="bi bi-search text-muted"></i>
                </span>
                <input
                  type="text"
                  className="form-control form-control-lg font-monospace text-uppercase"
                  placeholder="e.g. CMP-20261023-A1B2"
                  value={trackingIdInput}
                  onChange={(e) => setTrackingIdInput(e.target.value)}
                  required
                />
              </div>
              <button
                type="submit"
                className="btn btn-primary px-4 fw-semibold"
                disabled={loading || !trackingIdInput.trim()}
              >
                {loading ? (
                  <span className="spinner-border spinner-border-sm"></span>
                ) : (
                  <span>Track Status</span>
                )}
              </button>
            </form>
          </div>

          {/* Error Feedback */}
          {errorMsg && (
            <div className="alert alert-danger d-flex align-items-center" role="alert">
              <i className="bi bi-exclamation-triangle-fill me-2 fs-5"></i>
              <div>{errorMsg}</div>
            </div>
          )}

          {/* Unauthenticated notice */}
          {!isAuthenticated && (
            <div className="alert alert-info">
              <i className="bi bi-info-circle me-2"></i>
              <strong>Authentication Required:</strong> To view secure tracking history and details, please{' '}
              <Link to="/login" className="alert-link">
                log in to your citizen account
              </Link>.
            </div>
          )}

          {/* Result Card */}
          {complaint && (
            <div className="portal-card p-4">
              <div className="d-flex flex-wrap justify-content-between align-items-start border-bottom pb-3 mb-3 gap-2">
                <div>
                  <span className="font-monospace fw-bold fs-5 text-primary">
                    {complaint.trackingId}
                  </span>
                  <h4 className="fw-bold mt-1 mb-1">{complaint.title}</h4>
                  <div className="text-muted small">
                    Filed on {new Date(complaint.createdAt).toLocaleString()} &bull; Category:{' '}
                    <strong>{complaint.category}</strong>
                  </div>
                </div>
                <div>
                  <span className={`badge badge-status-${complaint.status} fs-6 px-3 py-2`}>
                    {complaint.status.replace('_', ' ')}
                  </span>
                </div>
              </div>

              {/* Progress Steps */}
              <div className="mb-4">
                <h6 className="fw-bold text-muted small text-uppercase mb-3">Lifecycle Progress</h6>
                <div className="d-flex justify-content-between position-relative px-3 py-2">
                  {['PENDING', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED'].map((step, idx) => {
                    const statusOrder = ['PENDING', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
                    const currentIdx = statusOrder.indexOf(complaint.status);
                    const isPassed = currentIdx >= idx;
                    const isCurrent = complaint.status === step;

                    return (
                      <div key={step} className="text-center" style={{ zIndex: 1 }}>
                        <div
                          className={`rounded-circle d-inline-flex justify-content-center align-items-center mb-1 ${
                            isCurrent
                              ? 'bg-primary text-white shadow'
                              : isPassed
                              ? 'bg-success text-white'
                              : 'bg-light text-muted border'
                          }`}
                          style={{ width: '36px', height: '36px' }}
                        >
                          {isPassed ? (
                            <i className="bi bi-check-lg"></i>
                          ) : (
                            <span className="small">{idx + 1}</span>
                          )}
                        </div>
                        <div
                          className={`small ${
                            isCurrent ? 'fw-bold text-primary' : isPassed ? 'text-dark' : 'text-muted'
                          }`}
                          style={{ fontSize: '0.75rem' }}
                        >
                          {step.replace('_', ' ')}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Status History Audit Trail */}
              <div className="mt-4 pt-3 border-top">
                <h6 className="fw-bold text-muted small text-uppercase mb-3">Audit Trail & Updates</h6>
                <div className="timeline">
                  <div className="timeline-item">
                    <div className="small fw-bold text-primary">Grievance Registered</div>
                    <div className="text-muted small">
                      {new Date(complaint.createdAt).toLocaleString()}
                    </div>
                  </div>
                  {complaint.statusHistory?.map((hist, idx) => (
                    <div key={idx} className="timeline-item">
                      <div className="d-flex align-items-center gap-2">
                        <span className={`badge badge-status-${hist.status} small`}>
                          {hist.status.replace('_', ' ')}
                        </span>
                        <span className="text-muted small">
                          {new Date(hist.changedAt).toLocaleString()}
                        </span>
                      </div>
                      {hist.notes && <div className="text-dark small mt-1">{hist.notes}</div>}
                    </div>
                  ))}
                </div>
              </div>

              {/* View Full Complaint Link */}
              <div className="text-end mt-4 pt-2 border-top">
                <Link
                  to={`/citizen/complaints/${complaint._id}`}
                  className="btn btn-outline-primary btn-sm fw-semibold"
                >
                  Open Full Grievance Workspace <i className="bi bi-arrow-right ms-1"></i>
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TrackComplaintPage;
