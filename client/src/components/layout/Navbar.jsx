import React from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export const Navbar = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="navbar navbar-expand-lg navbar-dark bg-primary shadow-sm sticky-top">
      <div className="container">
        <Link className="navbar-brand fw-bold d-flex align-items-center" to="/">
          <i className="bi bi-shield-check me-2 fs-4"></i>
          <span>CivicResolve Portal</span>
        </Link>

        <button
          className="navbar-toggler"
          type="button"
          data-bs-toggle="collapse"
          data-bs-target="#navbarContent"
          aria-controls="navbarContent"
          aria-expanded="false"
          aria-label="Toggle navigation"
        >
          <span className="navbar-toggler-icon"></span>
        </button>

        <div className="collapse navbar-collapse" id="navbarContent">
          <ul className="navbar-nav me-auto mb-2 mb-lg-0">
            <li className="nav-item">
              <NavLink className="nav-link" to="/" end>
                <i className="bi bi-house me-1"></i> Home
              </NavLink>
            </li>
            <li className="nav-item">
              <NavLink className="nav-link" to="/track">
                <i className="bi bi-search me-1"></i> Track Complaint
              </NavLink>
            </li>

            {isAuthenticated && user?.role === 'USER' && (
              <>
                <li className="nav-item">
                  <NavLink className="nav-link" to="/citizen/dashboard">
                    <i className="bi bi-speedometer2 me-1"></i> Dashboard
                  </NavLink>
                </li>
                <li className="nav-item">
                  <NavLink className="nav-link" to="/citizen/complaints/new">
                    <i className="bi bi-plus-circle me-1"></i> File Complaint
                  </NavLink>
                </li>
                <li className="nav-item">
                  <NavLink className="nav-link" to="/citizen/complaints">
                    <i className="bi bi-card-list me-1"></i> My Complaints
                  </NavLink>
                </li>
              </>
            )}

            {isAuthenticated && user?.role === 'AGENT' && (
              <li className="nav-item">
                <NavLink className="nav-link" to="/officer/dashboard">
                  <i className="bi bi-briefcase me-1"></i> Assigned Workload
                </NavLink>
              </li>
            )}

            {isAuthenticated && user?.role === 'ADMIN' && (
              <li className="nav-item">
                <NavLink className="nav-link" to="/admin/dashboard">
                  <i className="bi bi-shield-lock me-1"></i> Administration
                </NavLink>
              </li>
            )}
          </ul>

          <ul className="navbar-nav ms-auto align-items-lg-center">
            {isAuthenticated ? (
              <li className="nav-item dropdown">
                <a
                  className="nav-link dropdown-toggle d-flex align-items-center text-white"
                  href="#"
                  role="button"
                  data-bs-toggle="dropdown"
                  aria-expanded="false"
                >
                  <i className="bi bi-person-circle fs-5 me-2"></i>
                  <span>{user.name}</span>
                  <span className="badge bg-light text-primary ms-2 rounded-pill px-2">
                    {user.role}
                  </span>
                </a>
                <ul className="dropdown-menu dropdown-menu-end shadow">
                  <li>
                    <h6 className="dropdown-header text-truncate" style={{ maxWidth: '200px' }}>
                      {user.email}
                    </h6>
                  </li>
                  <li>
                    <Link className="dropdown-item" to="/profile">
                      <i className="bi bi-person-gear me-2"></i> Profile Settings
                    </Link>
                  </li>
                  <li><hr className="dropdown-divider" /></li>
                  <li>
                    <button
                      className="dropdown-item text-danger d-flex align-items-center"
                      onClick={handleLogout}
                    >
                      <i className="bi bi-box-arrow-right me-2"></i> Log Out
                    </button>
                  </li>
                </ul>
              </li>
            ) : (
              <div className="d-flex gap-2">
                <Link to="/login" className="btn btn-outline-light btn-sm px-3">
                  Log In
                </Link>
                <Link to="/register" className="btn btn-light text-primary btn-sm px-3 fw-semibold">
                  Register
                </Link>
              </div>
            )}
          </ul>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
