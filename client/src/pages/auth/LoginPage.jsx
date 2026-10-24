import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const redirectAfterLogin = (userRole) => {
    const from = location.state?.from?.pathname;
    if (from && from !== '/login') {
      navigate(from, { replace: true });
      return;
    }

    if (userRole === 'ADMIN') {
      navigate('/admin/dashboard', { replace: true });
    } else if (userRole === 'AGENT') {
      navigate('/officer/dashboard', { replace: true });
    } else {
      navigate('/citizen/dashboard', { replace: true });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    try {
      const loggedUser = await login(email.trim(), password);
      redirectAfterLogin(loggedUser.role);
    } catch (err) {
      setErrorMsg(err.message || 'Login failed. Please verify your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container py-5 my-auto">
      <div className="row justify-content-center">
        <div className="col-md-6 col-lg-5">
          <div className="portal-card p-4 p-sm-5 bg-white shadow-sm">
            <div className="text-center mb-4">
              <div className="badge bg-primary rounded-circle p-3 mb-2">
                <i className="bi bi-box-arrow-in-right fs-3 text-white"></i>
              </div>
              <h3 className="fw-bold">Sign In</h3>
              <p className="text-muted small">Access your public complaint dashboard</p>
            </div>

            {errorMsg && (
              <div className="alert alert-danger d-flex align-items-center small" role="alert">
                <i className="bi bi-exclamation-triangle-fill me-2 flex-shrink-0"></i>
                <div>{errorMsg}</div>
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate>
              <div className="mb-3">
                <label className="form-label fw-semibold small">Email Address</label>
                <div className="input-group">
                  <span className="input-group-text bg-light"><i className="bi bi-envelope"></i></span>
                  <input
                    type="email"
                    className="form-control"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
              </div>

              <div className="mb-4">
                <label className="form-label fw-semibold small">Password</label>
                <div className="input-group">
                  <span className="input-group-text bg-light"><i className="bi bi-lock"></i></span>
                  <input
                    type="password"
                    className="form-control"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                className="btn btn-primary w-100 py-2 fw-semibold"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                    Authenticating...
                  </>
                ) : (
                  'Sign In'
                )}
              </button>
            </form>

            <div className="text-center mt-4 pt-3 border-top">
              <p className="text-muted small mb-0">
                Don't have a citizen account?{' '}
                <Link to="/register" className="fw-semibold text-primary text-decoration-none">
                  Register here
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
