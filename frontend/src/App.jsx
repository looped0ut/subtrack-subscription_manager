import { Navigate, Route, Routes } from 'react-router-dom';
import Login from './pages/Login.jsx';
import Subscriptions from './pages/Subscriptions.jsx';

// Shows a page only if someone is logged in. The backend still checks every request.
function RequireAuth({ children }) {
  return localStorage.getItem('token') ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/subscriptions"
        element={
          <RequireAuth>
            <Subscriptions />
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/subscriptions" replace />} />
    </Routes>
  );
}