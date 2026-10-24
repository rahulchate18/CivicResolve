import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';

export const CitizenDashboard = () => {
  const { user } = useAuth();
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const fetchComplaints = async () => {
      try {
        const res = await api.get('/complaints?limit=10');
        setComplaints(res.data.complaints || []);
      } catch (err) {
        setErrorMsg(err.message || 'Unable to load dashboard data');
      } finally {
        setLoading(false);
      }
    };

    fetchComplaints();
  }, []);

  // Compute metrics from actual citizen complaints
  const totalCount = complaints.length;
  const pendingCount = complaints.filter((c) => c.status === 'PENDING').length;
  const inProgressCount = complaints.filter((c) => ['ASSIGNED', 'IN_PROGRESS'].includes(c.status)).length;
  const resolvedCount = complaints.filter((c) => ['RESOLVED', 'CLOSED'].includes(c.status)).length;

  return (
    <div className="container py-4">
      {/* Welcome Banner */}
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-4 pb-2 border-bottom">
        <div>
          <h2 className="fw-bold mb-1">Citizen Dashboard</h2>
          <p className="text-muted small mb-0">Welcome back, {user?.name}. Here is an overview of your filed grievances.</p>
        </div>
        <div className="mt-3 mt-md-0">
          <Link to="/citizen/complaints/new" className="btn btn-primary fw-semibold shadow-sm">
            <i className="bi bi-plus-circle me-2"></i> File New Complaint
          </Link>
        </div>
      </div>

      {errorMsg && (
        <div className="alert alert-danger" role="alert">
          <i className="bi bi-exclamation-circle me-2"></i> {errorMsg}
        </div>
      )}

      {/* Metrics Row */}
      <div className="row g-3 mb-4">
        <div className="col-sm-6 col-lg-3">
          <div className="portal-card p-3 border-start border-4 border-primary">
            <div className="text-muted small fw-semibold text-uppercase">Total Filed</div>
            <div className="h3 fw-bold text-dark mt-1 mb-0">{loading ? '...' : totalCount}</div>
          </div>
        </div>
        <div className="col-sm-6 col-lg-3">
          <div className="portal-card p-3 border-start border-4 border-warning">
            <div className="text-muted small fw-semibold text-uppercase">Pending Review</div>
            <div className="h3 fw-bold text-dark mt-1 mb-0">{loading ? '...' : pendingCount}</div>
          </div>
        </div>
        <div className="col-sm-6 col-lg-3">
          <div className="portal-card p-3 border-start border-4 border-info">
            <div className="text-muted small fw-semibold text-uppercase">In Progress</div>
            <div className="h3 fw-bold text-dark mt-1 mb-0">{loading ? '...' : inProgressCount}</div>
          </div>
        </div>
        <div className="col-sm-6 col-lg-3">
          <div className="portal-card p-3 border-start border-4 border-success">
            <div className="text-muted small fw-semibold text-uppercase">Resolved / Closed</div>
            <div className="h3 fw-bold text-dark mt-1 mb-0">{loading ? '...' : resolvedCount}</div>
          </div>
        </div>
      </div>

      {/* Recent Complaints Table */}
      <div className="portal-card">
        <div className="portal-card-header d-flex justify-content-between align-items-center">
          <span className="fw-bold">Recent Complaints</span>
          <Link to="/citizen/complaints" className="btn btn-outline-primary btn-sm">
            View All Complaints <i className="bi bi-arrow-right ms-1"></i>
          </Link>
        </div>
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead className="table-light text-muted small text-uppercase">
              <tr>
                <th scope="col">Tracking ID</th>
                <th scope="col">Title</th>
                <th scope="col">Category</th>
                <th scope="col">Priority</th>
                <th scope="col">Status</th>
                <th scope="col">Filed Date</th>
                <th scope="col" className="text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" className="text-center py-4 text-muted">
                    <div className="spinner-border spinner-border-sm text-primary me-2"></div>
                    Loading your complaints...
                  </td>
                </tr>
              ) : complaints.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center py-5">
                    <i className="bi bi-inbox text-muted fs-1 d-block mb-2"></i>
                    <h6 className="fw-bold text-muted mb-1">No complaints filed yet</h6>
                    <p className="text-muted small mb-3">You have not registered any public grievances yet.</p>
                    <Link to="/citizen/complaints/new" className="btn btn-primary btn-sm">
                      Submit Your First Complaint
                    </Link>
                  </td>
                </tr>
              ) : (
                complaints.map((item) => (
                  <tr key={item._id}>
                    <td>
                      <span className="font-monospace fw-semibold text-primary">{item.trackingId}</span>
                    </td>
                    <td className="fw-semibold text-truncate" style={{ maxWidth: '240px' }}>
                      {item.title}
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
                    <td className="text-muted small">
                      {new Date(item.createdAt).toLocaleDateString()}
                    </td>
                    <td className="text-end">
                      <Link
                        to={`/citizen/complaints/${item._id}`}
                        className="btn btn-sm btn-outline-secondary"
                      >
                        Details <i className="bi bi-chevron-right ms-1"></i>
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default CitizenDashboard;
