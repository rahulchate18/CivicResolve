import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const HomePage = () => {
  const [trackingInput, setTrackingInput] = useState('');
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();

  const handleTrackSubmit = (e) => {
    e.preventDefault();
    if (trackingInput.trim()) {
      navigate(`/track?id=${encodeURIComponent(trackingInput.trim().toUpperCase())}`);
    }
  };

  const getDashboardLink = () => {
    if (!user) return '/login';
    if (user.role === 'ADMIN') return '/admin/dashboard';
    if (user.role === 'AGENT') return '/officer/dashboard';
    return '/citizen/dashboard';
  };

  return (
    <div>
      {/* Hero Section */}
      <section className="bg-primary text-white py-5">
        <div className="container py-4">
          <div className="row align-items-center g-5">
            <div className="col-lg-7">
              <span className="badge bg-light text-primary px-3 py-2 rounded-pill fw-semibold mb-3">
                <i className="bi bi-shield-check me-1"></i> Transparent Public Grievance Portal
              </span>
              <h1 className="display-5 fw-bold mb-3">
                Voice Your Concerns. We Resolve Them Efficiently.
              </h1>
              <p className="lead mb-4 text-white-50">
                Register public complaints, track resolution progress in real-time, communicate directly with assigned departmental officers, and rate your resolution experience.
              </p>

              {/* Quick Tracking Search Form */}
              <div className="portal-card bg-white p-3 shadow-lg">
                <form onSubmit={handleTrackSubmit} className="row g-2 align-items-center">
                  <div className="col-sm-8">
                    <div className="input-group">
                      <span className="input-group-text bg-light border-end-0">
                        <i className="bi bi-search text-muted"></i>
                      </span>
                      <input
                        type="text"
                        className="form-control border-start-0 ps-0"
                        placeholder="Enter Tracking ID (e.g., CMP-20261023-XXXXX)"
                        aria-label="Enter Complaint Tracking ID"
                        value={trackingInput}
                        onChange={(e) => setTrackingInput(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <div className="col-sm-4">
                    <button type="submit" className="btn btn-primary w-100 fw-semibold">
                      Track Complaint
                    </button>
                  </div>
                </form>
              </div>
            </div>

            <div className="col-lg-5 text-center">
              <div className="p-4 bg-white text-dark rounded-4 shadow-lg border">
                <i className="bi bi-person-badge text-primary" style={{ fontSize: '3rem' }}></i>
                <h4 className="fw-bold mt-3">Welcome to CivicResolve</h4>
                <p className="text-muted small">
                  {isAuthenticated
                    ? `Logged in as ${user.name} (${user.role})`
                    : 'Log in to your account or register to report an issue'}
                </p>

                <div className="d-grid gap-2 mt-4">
                  {isAuthenticated ? (
                    <Link to={getDashboardLink()} className="btn btn-primary py-2 fw-semibold">
                      <i className="bi bi-speedometer2 me-2"></i> Open Dashboard
                    </Link>
                  ) : (
                    <>
                      <Link to="/citizen/complaints/new" className="btn btn-primary py-2 fw-semibold">
                        <i className="bi bi-pencil-square me-2"></i> Register a Complaint
                      </Link>
                      <Link to="/login" className="btn btn-outline-secondary py-2">
                        Sign In to Your Account
                      </Link>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section className="py-5 bg-white border-bottom">
        <div className="container py-4">
          <div className="text-center mb-5">
            <h6 className="text-primary text-uppercase fw-bold letter-spacing-1">Streamlined Workflow</h6>
            <h2 className="fw-bold">How Complaint Resolution Works</h2>
            <p className="text-muted mx-auto" style={{ maxWidth: '600px' }}>
              Every submitted grievance is assigned, investigated, resolved, and documented with complete transparency.
            </p>
          </div>

          <div className="row g-4">
            <div className="col-md-3 text-center">
              <div className="p-4 rounded-3 h-100 bg-light border">
                <div className="badge bg-primary rounded-circle p-3 mb-3 fs-4">1</div>
                <h5 className="fw-bold">Submit Complaint</h5>
                <p className="text-muted small mb-0">
                  Provide issue details, category, location, and attach supporting documentation.
                </p>
              </div>
            </div>

            <div className="col-md-3 text-center">
              <div className="p-4 rounded-3 h-100 bg-light border">
                <div className="badge bg-info text-dark rounded-circle p-3 mb-3 fs-4">2</div>
                <h5 className="fw-bold">Officer Assignment</h5>
                <p className="text-muted small mb-0">
                  Administrators assign an approved departmental officer with available workload capacity.
                </p>
              </div>
            </div>

            <div className="col-md-3 text-center">
              <div className="p-4 rounded-3 h-100 bg-light border">
                <div className="badge bg-warning text-dark rounded-circle p-3 mb-3 fs-4">3</div>
                <h5 className="fw-bold">Investigation & Chat</h5>
                <p className="text-muted small mb-0">
                  The officer investigates on-site and communicates directly through the complaint thread.
                </p>
              </div>
            </div>

            <div className="col-md-3 text-center">
              <div className="p-4 rounded-3 h-100 bg-light border">
                <div className="badge bg-success rounded-circle p-3 mb-3 fs-4">4</div>
                <h5 className="fw-bold">Resolution & Feedback</h5>
                <p className="text-muted small mb-0">
                  Officer records resolution notes; citizen reviews outcomes and submits a 1–5 star rating.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default HomePage;
