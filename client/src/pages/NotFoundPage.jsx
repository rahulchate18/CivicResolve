import React from 'react';
import { Link } from 'react-router-dom';

export const NotFoundPage = () => {
  return (
    <div className="container py-5 my-auto text-center">
      <div className="py-5">
        <h1 className="display-1 fw-bold text-primary">404</h1>
        <h3 className="fw-bold mb-3">Page Not Found</h3>
        <p className="text-muted mb-4 mx-auto" style={{ maxWidth: '450px' }}>
          The page or resource you requested could not be found. Please check the URL or navigate back to the home page.
        </p>
        <Link to="/" className="btn btn-primary px-4 py-2 fw-semibold">
          <i className="bi bi-house me-2"></i> Return Home
        </Link>
      </div>
    </div>
  );
};

export const UnauthorizedPage = () => {
  return (
    <div className="container py-5 my-auto text-center">
      <div className="py-5">
        <div className="badge bg-danger rounded-circle p-4 mb-3">
          <i className="bi bi-shield-x fs-1 text-white"></i>
        </div>
        <h2 className="fw-bold mb-2">403 — Access Denied</h2>
        <p className="text-muted mb-4 mx-auto" style={{ maxWidth: '450px' }}>
          You do not have the required administrative or officer privileges to access this area of the portal.
        </p>
        <Link to="/" className="btn btn-primary px-4 py-2 fw-semibold">
          <i className="bi bi-arrow-left me-2"></i> Back to Safety
        </Link>
      </div>
    </div>
  );
};
