import React from 'react';
import { Link } from 'react-router-dom';

export const Footer = () => {
  return (
    <footer className="bg-white border-top mt-auto py-4">
      <div className="container">
        <div className="row g-4 align-items-center">
          <div className="col-md-6 text-center text-md-start">
            <div className="d-flex align-items-center justify-content-center justify-content-md-start mb-2">
              <i className="bi bi-shield-check text-primary fs-5 me-2"></i>
              <span className="fw-bold text-dark">CivicResolve Online Complaint Registration</span>
            </div>
            <p className="text-muted small mb-0">
              A transparent, accountable public grievance redressal and resolution portal.
            </p>
          </div>
          <div className="col-md-6 text-center text-md-end">
            <div className="d-flex justify-content-center justify-content-md-end gap-3 small text-muted">
              <Link to="/track" className="text-decoration-none text-muted">Track Status</Link>
              <span>•</span>
              <Link to="/login" className="text-decoration-none text-muted">Officer Login</Link>
              <span>•</span>
              <span>Accessibility Support</span>
            </div>
            <p className="text-muted small mb-0 mt-2">
              &copy; {new Date().getFullYear()} Municipal Public Grievance Portal. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
