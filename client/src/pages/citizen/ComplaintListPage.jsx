import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';

const CATEGORIES = ['Technical', 'Billing', 'Service', 'Product', 'Other'];
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
const STATUSES = ['PENDING', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'REJECTED'];

export const ComplaintListPage = () => {
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  // Filtering and pagination state
  const [status, setStatus] = useState('');
  const [category, setCategory] = useState('');
  const [priority, setPriority] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const fetchComplaints = useCallback(async () => {
    setLoading(true);
    setErrorMsg('');
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
      setErrorMsg(err.message || 'Failed to load complaints');
    } finally {
      setLoading(false);
    }
  }, [page, status, category, priority]);

  useEffect(() => {
    fetchComplaints();
  }, [fetchComplaints]);

  const handleFilterReset = () => {
    setStatus('');
    setCategory('');
    setPriority('');
    setPage(1);
  };

  return (
    <div className="container py-4">
      {/* Page Header */}
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-4 pb-2 border-bottom">
        <div>
          <h2 className="fw-bold mb-1">My Grievances</h2>
          <p className="text-muted small mb-0">
            View, track, and manage all your registered public service complaints ({totalCount} total)
          </p>
        </div>
        <div className="mt-3 mt-md-0">
          <Link to="/citizen/complaints/new" className="btn btn-primary fw-semibold shadow-sm">
            <i className="bi bi-plus-circle me-2"></i> Register New Complaint
          </Link>
        </div>
      </div>

      {errorMsg && (
        <div className="alert alert-danger d-flex align-items-center" role="alert">
          <i className="bi bi-exclamation-triangle-fill me-2 fs-5"></i>
          <div>{errorMsg}</div>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="portal-card p-3 mb-4">
        <div className="row g-2 align-items-end">
          <div className="col-12 col-md-3">
            <label htmlFor="filterStatus" className="form-label small fw-bold text-muted mb-1">
              Status
            </label>
            <select
              id="filterStatus"
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
            <label htmlFor="filterCategory" className="form-label small fw-bold text-muted mb-1">
              Category
            </label>
            <select
              id="filterCategory"
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
            <label htmlFor="filterPriority" className="form-label small fw-bold text-muted mb-1">
              Priority
            </label>
            <select
              id="filterPriority"
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

          <div className="col-12 col-md-3 d-flex gap-2">
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm w-100"
              onClick={handleFilterReset}
              disabled={!status && !category && !priority}
            >
              <i className="bi bi-arrow-counterclockwise me-1"></i> Reset Filters
            </button>
          </div>
        </div>
      </div>

      {/* Complaints List Table */}
      <div className="portal-card">
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead className="table-light text-muted small text-uppercase">
              <tr>
                <th scope="col" style={{ width: '15%' }}>Tracking ID</th>
                <th scope="col" style={{ width: '30%' }}>Title</th>
                <th scope="col" style={{ width: '13%' }}>Category</th>
                <th scope="col" style={{ width: '12%' }}>Priority</th>
                <th scope="col" style={{ width: '15%' }}>Status</th>
                <th scope="col" style={{ width: '15%' }} className="text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" className="text-center py-5 text-muted">
                    <div className="spinner-border spinner-border-sm text-primary me-2" role="status"></div>
                    Loading your grievances...
                  </td>
                </tr>
              ) : complaints.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center py-5">
                    <i className="bi bi-folder2-open text-muted fs-1 d-block mb-2"></i>
                    <h6 className="fw-bold text-muted mb-1">No complaints found</h6>
                    <p className="text-muted small mb-3">
                      {status || category || priority
                        ? 'No complaints match the selected filter criteria.'
                        : 'You have not registered any complaints yet.'}
                    </p>
                    <Link to="/citizen/complaints/new" className="btn btn-primary btn-sm">
                      Register a Complaint
                    </Link>
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
                      <div className="fw-semibold text-dark text-truncate" style={{ maxWidth: '320px' }}>
                        {item.title}
                      </div>
                      <div className="text-muted small text-truncate" style={{ maxWidth: '320px' }}>
                        {item.description}
                      </div>
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
                      <Link
                        to={`/citizen/complaints/${item._id}`}
                        className="btn btn-sm btn-outline-primary"
                      >
                        View & Track <i className="bi bi-chevron-right ms-1"></i>
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination controls */}
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
                <i className="bi bi-chevron-left me-1"></i> Previous
              </button>
              <button
                type="button"
                className="btn btn-outline-secondary"
                disabled={page >= totalPages || loading}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next <i className="bi bi-chevron-right ms-1"></i>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ComplaintListPage;
