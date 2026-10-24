import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute, RoleRoute } from './components/common/ProtectedRoute';
import { Navbar } from './components/layout/Navbar';
import { Footer } from './components/layout/Footer';

// Public pages
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { NotFoundPage, UnauthorizedPage } from './pages/NotFoundPage';
import { ProfilePage } from './pages/ProfilePage';

// Citizen pages
import { CitizenDashboard } from './pages/citizen/CitizenDashboard';
import { NewComplaintPage } from './pages/citizen/NewComplaintPage';
import { ComplaintListPage } from './pages/citizen/ComplaintListPage';
import { ComplaintDetailPage } from './pages/citizen/ComplaintDetailPage';
import { TrackComplaintPage } from './pages/citizen/TrackComplaintPage';

// Officer pages
import { OfficerDashboard } from './pages/officer/OfficerDashboard';

// Admin pages
import { AdminDashboard } from './pages/admin/AdminDashboard';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <div className="d-flex flex-column min-vh-100 bg-light">
          <Navbar />
          <main className="flex-grow-1">
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<HomePage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/track" element={<TrackComplaintPage />} />
              <Route path="/unauthorized" element={<UnauthorizedPage />} />

              {/* Protected Routes (Any Authenticated User) */}
              <Route element={<ProtectedRoute />}>
                <Route path="/profile" element={<ProfilePage />} />
              </Route>

              {/* Citizen Routes (USER Role) */}
              <Route element={<RoleRoute allowedRoles={['USER']} />}>
                <Route path="/citizen/dashboard" element={<CitizenDashboard />} />
                <Route path="/citizen/complaints" element={<ComplaintListPage />} />
                <Route path="/citizen/complaints/new" element={<NewComplaintPage />} />
                <Route path="/citizen/complaints/:id" element={<ComplaintDetailPage />} />
              </Route>

              {/* Officer Routes (AGENT Role) */}
              <Route element={<RoleRoute allowedRoles={['AGENT']} />}>
                <Route path="/officer/dashboard" element={<OfficerDashboard />} />
                <Route path="/officer/complaints/:id" element={<ComplaintDetailPage />} />
              </Route>

              {/* Admin Routes (ADMIN Role) */}
              <Route element={<RoleRoute allowedRoles={['ADMIN']} />}>
                <Route path="/admin/dashboard" element={<AdminDashboard />} />
                <Route path="/admin/complaints/:id" element={<ComplaintDetailPage />} />
              </Route>

              {/* Fallback 404 Route */}
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </main>
          <Footer />
          <ToastContainer position="top-right" autoClose={4000} hideProgressBar={false} />
        </div>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
