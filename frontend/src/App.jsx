import { useEffect, useState } from 'react';
import axios from 'axios';

function App() {
  const [health, setHealth] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    axios
      .get('/api/health')
      .then((response) => setHealth(response.data))
      .catch(() => setError('Cannot reach the backend. Is it running?'));
  }, []);

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
      <div className="bg-white rounded-xl shadow-md p-8 w-full max-w-md">
        <h1 className="text-3xl font-bold text-indigo-600">SubTrack</h1>
        <p className="text-slate-500 mt-1">Subscription Management System</p>

        <div className="mt-6 text-sm">
          {error && <p className="text-red-600">{error}</p>}
          {!error && !health && <p className="text-slate-500">Checking backend...</p>}
          {health && (
            <p className="text-green-700">
              Backend: {health.status} | Database: {health.database}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;