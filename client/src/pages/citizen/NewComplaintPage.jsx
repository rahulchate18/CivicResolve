import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';

export const NewComplaintPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'Service',
    priority: 'MEDIUM',
    phone: user?.phone || '',
    address: user?.address || '',
    city: user?.city || '',
    state: user?.state || '',
    postalCode: user?.postalCode || '',
  });

  const [attachments, setAttachments] = useState([]);
  const [newAttachment, setNewAttachment] = useState({
    filename: '',
    originalName: '',
    url: '',
    mimeType: 'image/jpeg',
    size: 500000,
  });
  const [showAttachInput, setShowAttachInput] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleAddAttachment = (e) => {
    e.preventDefault();
    if (!newAttachment.originalName.trim() || !newAttachment.url.trim()) return;

    setAttachments((prev) => [
      ...prev,
      {
        filename: `attach_${Date.now()}_${newAttachment.originalName.trim()}`,
        originalName: newAttachment.originalName.trim(),
        url: newAttachment.url.trim(),
        mimeType: newAttachment.mimeType,
        size: Number(newAttachment.size) || 102400,
      },
    ]);

    setNewAttachment({
      filename: '',
      originalName: '',
      url: '',
      mimeType: 'image/jpeg',
      size: 500000,
    });
    setShowAttachInput(false);
  };

  const handleRemoveAttachment = (index) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (formData.title.trim().length < 5) {
      setErrorMsg('Title must be at least 5 characters long.');
      return;
    }

    if (formData.description.trim().length < 10) {
      setErrorMsg('Description must be at least 10 characters long.');
      return;
    }

    setLoading(true);

    try {
      const payload = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        category: formData.category,
        priority: formData.priority,
        citizenContact: {
          phone: formData.phone.trim(),
          address: formData.address.trim(),
          city: formData.city.trim(),
          state: formData.state.trim(),
          postalCode: formData.postalCode.trim(),
        },
        attachments,
      };

      const res = await api.post('/complaints', payload);
      const createdComplaint = res.data.complaint;
      navigate(`/citizen/complaints/${createdComplaint._id}`, {
        state: { message: `Complaint registered successfully with Tracking ID: ${createdComplaint.trackingId}` },
      });
    } catch (err) {
      setErrorMsg(err.message || 'Failed to file complaint.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container py-4">
      <div className="row justify-content-center">
        <div className="col-lg-9">
          <nav aria-label="breadcrumb" className="mb-3">
            <ol className="breadcrumb small">
              <li className="breadcrumb-item"><Link to="/citizen/dashboard">Dashboard</Link></li>
              <li className="breadcrumb-item active" aria-current="page">File Complaint</li>
            </ol>
          </nav>

          <div className="portal-card p-4 p-md-5 bg-white shadow-sm">
            <div className="d-flex align-items-center mb-4 pb-3 border-bottom">
              <div className="badge bg-primary rounded-circle p-3 me-3">
                <i className="bi bi-pencil-square fs-3 text-white"></i>
              </div>
              <div>
                <h3 className="fw-bold mb-1">Register a Public Grievance</h3>
                <p className="text-muted small mb-0">Fill in the details below. A unique tracking identifier will be generated upon submission.</p>
              </div>
            </div>

            {errorMsg && (
              <div className="alert alert-danger d-flex align-items-center small" role="alert">
                <i className="bi bi-exclamation-triangle-fill me-2 flex-shrink-0"></i>
                <div>{errorMsg}</div>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <h5 className="fw-bold text-dark mb-3">1. Complaint Overview</h5>
              <div className="row g-3 mb-4">
                <div className="col-12">
                  <label className="form-label small fw-semibold">Complaint Title * (5–150 chars)</label>
                  <input
                    type="text"
                    name="title"
                    className="form-control"
                    placeholder="Brief summary of the issue (e.g., Streetlight out on 5th Ave)"
                    value={formData.title}
                    onChange={handleChange}
                    required
                    minLength={5}
                    maxLength={150}
                  />
                </div>

                <div className="col-md-6">
                  <label className="form-label small fw-semibold">Category *</label>
                  <select
                    name="category"
                    className="form-select"
                    value={formData.category}
                    onChange={handleChange}
                    required
                  >
                    <option value="Service">Municipal Service</option>
                    <option value="Technical">Technical Infrastructure</option>
                    <option value="Billing">Billing & Assessment</option>
                    <option value="Product">Public Utilities / Product</option>
                    <option value="Other">Other Issues</option>
                  </select>
                </div>

                <div className="col-md-6">
                  <label className="form-label small fw-semibold">Priority Level</label>
                  <select
                    name="priority"
                    className="form-select"
                    value={formData.priority}
                    onChange={handleChange}
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium (Default)</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent (Safety hazard)</option>
                  </select>
                </div>

                <div className="col-12">
                  <label className="form-label small fw-semibold">Detailed Description * (min 10 chars)</label>
                  <textarea
                    name="description"
                    rows="4"
                    className="form-control"
                    placeholder="Provide detailed information regarding the location, timeline, and impact of the grievance."
                    value={formData.description}
                    onChange={handleChange}
                    required
                    minLength={10}
                    maxLength={5000}
                  ></textarea>
                </div>
              </div>

              <h5 className="fw-bold text-dark mb-3">2. Incident Location & Contact</h5>
              <div className="row g-3 mb-4">
                <div className="col-md-6">
                  <label className="form-label small fw-semibold">Contact Phone</label>
                  <input
                    type="tel"
                    name="phone"
                    className="form-control"
                    placeholder="Mobile number for officer updates"
                    value={formData.phone}
                    onChange={handleChange}
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label small fw-semibold">Postal Code / PIN</label>
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
                  <label className="form-label small fw-semibold">Incident Address / Landmark</label>
                  <input
                    type="text"
                    name="address"
                    className="form-control"
                    placeholder="Specific location or nearest landmark"
                    value={formData.address}
                    onChange={handleChange}
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label small fw-semibold">City</label>
                  <input
                    type="text"
                    name="city"
                    className="form-control"
                    placeholder="City / Municipality"
                    value={formData.city}
                    onChange={handleChange}
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label small fw-semibold">State / Province</label>
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

              <h5 className="fw-bold text-dark mb-3 d-flex justify-content-between align-items-center">
                <span>3. Supporting Documentation (Optional)</span>
                {!showAttachInput && (
                  <button
                    type="button"
                    className="btn btn-outline-primary btn-sm"
                    onClick={() => setShowAttachInput(true)}
                  >
                    <i className="bi bi-paperclip me-1"></i> Add Document Link
                  </button>
                )}
              </h5>

              {showAttachInput && (
                <div className="p-3 bg-light rounded mb-3 border">
                  <h6 className="fw-bold small mb-2">Document Metadata</h6>
                  <div className="row g-2">
                    <div className="col-md-6">
                      <input
                        type="text"
                        placeholder="File Label / Original Name"
                        className="form-control form-control-sm"
                        value={newAttachment.originalName}
                        onChange={(e) => setNewAttachment({ ...newAttachment, originalName: e.target.value })}
                      />
                    </div>
                    <div className="col-md-6">
                      <input
                        type="url"
                        placeholder="Document URL / Cloud link"
                        className="form-control form-control-sm"
                        value={newAttachment.url}
                        onChange={(e) => setNewAttachment({ ...newAttachment, url: e.target.value })}
                      />
                    </div>
                    <div className="col-12 d-flex gap-2 justify-content-end mt-2">
                      <button
                        type="button"
                        className="btn btn-sm btn-secondary"
                        onClick={() => setShowAttachInput(false)}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-primary"
                        onClick={handleAddAttachment}
                      >
                        Attach
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {attachments.length > 0 && (
                <ul className="list-group mb-4">
                  {attachments.map((att, idx) => (
                    <li key={idx} className="list-group-item d-flex justify-content-between align-items-center small">
                      <div>
                        <i className="bi bi-file-earmark-text text-primary me-2"></i>
                        <span className="fw-semibold">{att.originalName}</span>
                        <span className="text-muted ms-2">({Math.round(att.size / 1024)} KB)</span>
                      </div>
                      <button
                        type="button"
                        className="btn btn-sm text-danger"
                        onClick={() => handleRemoveAttachment(idx)}
                      >
                        <i className="bi bi-trash"></i>
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <div className="d-flex justify-content-end gap-2 pt-3 border-top">
                <Link to="/citizen/dashboard" className="btn btn-outline-secondary px-4">
                  Cancel
                </Link>
                <button
                  type="submit"
                  className="btn btn-primary px-4 fw-semibold"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                      Registering Complaint...
                    </>
                  ) : (
                    'Submit Complaint'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NewComplaintPage;
