import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export const RegisterPage = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    postalCode: '',
  });

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const { register } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (formData.password.length < 8) {
      setErrorMsg('Password must be at least 8 characters long.');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      const payload = {
        name: formData.name.trim(),
        email: formData.email.trim(),
        password: formData.password,
        phone: formData.phone.trim(),
        address: formData.address.trim(),
        city: formData.city.trim(),
        state: formData.state.trim(),
        postalCode: formData.postalCode.trim(),
      };

      await register(payload);
      navigate('/citizen/dashboard', { replace: true });
    } catch (err) {
      setErrorMsg(err.message || 'Registration failed. Please check your information.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container py-5 my-auto">
      <div className="row justify-content-center">
        <div className="col-md-8 col-lg-7">
          <div className="portal-card p-4 p-sm-5 bg-white shadow-sm">
            <div className="text-center mb-4">
              <div className="badge bg-primary rounded-circle p-3 mb-2">
                <i className="bi bi-person-plus fs-3 text-white"></i>
              </div>
              <h3 className="fw-bold">Citizen Registration</h3>
              <p className="text-muted small">Create an account to submit and track municipal grievances</p>
            </div>

            {errorMsg && (
              <div className="alert alert-danger d-flex align-items-center small" role="alert">
                <i className="bi bi-exclamation-triangle-fill me-2 flex-shrink-0"></i>
                <div>{errorMsg}</div>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <h6 className="fw-bold text-primary mb-3">Account Information</h6>
              <div className="row g-3 mb-4">
                <div className="col-sm-6">
                  <label className="form-label small fw-semibold">Full Name *</label>
                  <input
                    type="text"
                    name="name"
                    className="form-control"
                    placeholder="e.g. Rahul Sharma"
                    value={formData.name}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="col-sm-6">
                  <label className="form-label small fw-semibold">Email Address *</label>
                  <input
                    type="email"
                    name="email"
                    className="form-control"
                    placeholder="name@example.com"
                    value={formData.email}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="col-sm-6">
                  <label className="form-label small fw-semibold">Password * (min 8 chars)</label>
                  <input
                    type="password"
                    name="password"
                    className="form-control"
                    placeholder="At least 8 characters"
                    value={formData.password}
                    onChange={handleChange}
                    required
                    minLength={8}
                  />
                </div>
                <div className="col-sm-6">
                  <label className="form-label small fw-semibold">Confirm Password *</label>
                  <input
                    type="password"
                    name="confirmPassword"
                    className="form-control"
                    placeholder="Re-enter password"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>

              <h6 className="fw-bold text-primary mb-3">Contact & Address Details (Optional)</h6>
              <div className="row g-3 mb-4">
                <div className="col-sm-6">
                  <label className="form-label small fw-semibold">Phone Number</label>
                  <input
                    type="tel"
                    name="phone"
                    className="form-control"
                    placeholder="+91-9876543210"
                    value={formData.phone}
                    onChange={handleChange}
                  />
                </div>
                <div className="col-sm-6">
                  <label className="form-label small fw-semibold">Postal Code</label>
                  <input
                    type="text"
                    name="postalCode"
                    className="form-control"
                    placeholder="e.g. 110001"
                    value={formData.postalCode}
                    onChange={handleChange}
                  />
                </div>
                <div className="col-12">
                  <label className="form-label small fw-semibold">Street Address</label>
                  <input
                    type="text"
                    name="address"
                    className="form-control"
                    placeholder="House/Apartment number, street name"
                    value={formData.address}
                    onChange={handleChange}
                  />
                </div>
                <div className="col-sm-6">
                  <label className="form-label small fw-semibold">City</label>
                  <input
                    type="text"
                    name="city"
                    className="form-control"
                    placeholder="City"
                    value={formData.city}
                    onChange={handleChange}
                  />
                </div>
                <div className="col-sm-6">
                  <label className="form-label small fw-semibold">State</label>
                  <input
                    type="text"
                    name="state"
                    className="form-control"
                    placeholder="State"
                    value={formData.state}
                    onChange={handleChange}
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
                    Creating Account...
                  </>
                ) : (
                  'Complete Registration'
                )}
              </button>
            </form>

            <div className="text-center mt-4 pt-3 border-top">
              <p className="text-muted small mb-0">
                Already registered?{' '}
                <Link to="/login" className="fw-semibold text-primary text-decoration-none">
                  Sign in here
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
