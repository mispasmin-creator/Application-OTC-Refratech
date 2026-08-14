import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogIn, Loader2, Eye, EyeOff } from 'lucide-react';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!username || !password) {
      setError('Please enter both username and password');
      return;
    }

    setLoading(true);

    try {
      const scriptUrl = import.meta.env.VITE_APPSCRIPT_URL;
      // Fetching the login sheet
      const response = await fetch(`${scriptUrl}?sheet=login`);
      if (!response.ok) {
        throw new Error(`Authentication fetch failed: ${response.status} ${response.statusText}`);
      }
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Authentication server error');
      }
      if (!Array.isArray(result.data) || result.data.length === 0) {
        throw new Error('Authentication sheet is empty or header row not found. Verify login sheet row 6 is the header.');
      }
      if (!Array.isArray(result.data[0])) {
        throw new Error('Authentication sheet header row is not in the expected format');
      }

      // Find user by matching username and password
      // Assuming headers are: Name, Firm Name, User Name, Password, Role
      const headers = result.data[0].map(h => h && h.toString().trim());
      
      const usernameIndex = headers.findIndex(h => h === 'User Name' || h === 'Username' || h === 'username');
      const passwordIndex = headers.findIndex(h => h === 'Password' || h === 'password');
      
      if (usernameIndex === -1 || passwordIndex === -1) {
          throw new Error("Invalid sheet format: Username or Password column not found");
      }

        const userRow = result.data.slice(1).find(row => 
          row[usernameIndex] === username && 
          row[passwordIndex] === password
        );

        if (userRow) {
          // Find indices for other data
          const nameIdx = headers.indexOf('Name');
          const firmIdx = headers.indexOf('Firm Name');
          const roleIdx = headers.indexOf('Role');

          const userData = {
            username,
            name: nameIdx !== -1 ? userRow[nameIdx] : username,
            firmName: firmIdx !== -1 ? userRow[firmIdx] : 'Unknown Firm',
            role: roleIdx !== -1 ? userRow[roleIdx] : 'User'
          };
          
          localStorage.setItem('botivate_user', JSON.stringify(userData));
          navigate('/');
        } else {
          setError('Invalid username or password');
        }
    } catch (err) {
      console.error(err);
      setError('An error occurred during login. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card glass-panel animate-fade-in">
        <div className="auth-header">
          <img src="/logo.png" alt="Refratech logo" className="auth-logo" />
          <h2 className="auth-title">Welcome Back</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>Sign in to access your operations dashboard</p>
        </div>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label className="form-label">Username</label>
            <input 
              type="text" 
              className="form-input" 
              placeholder="Enter your username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={loading}
            />
          </div>
          
          <div className="form-group" style={{ marginBottom: '2rem' }}>
            <label className="form-label">Password</label>
            <div style={{ position: 'relative' }}>
              <input 
                type={showPassword ? 'text' : 'password'} 
                className="form-input" 
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                style={{ width: '100%', paddingRight: '2.5rem' }}
              />
              <button 
                type="button" 
                onClick={() => setShowPassword(!showPassword)} 
                style={{ 
                  position: 'absolute', 
                  right: '0.75rem', 
                  top: '50%', 
                  transform: 'translateY(-50%)',
                  border: 'none', 
                  background: 'transparent', 
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                {showPassword ? <EyeOff size={20} color="var(--text-muted)" /> : <Eye size={20} color="var(--text-muted)" />}
              </button>
            </div>
          </div>

          <button 
            type="submit" 
            className="btn btn-primary" 
            style={{ width: '100%' }}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 size={20} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />
                Signing in...
              </>
            ) : (
              'Sign In'
            )}
          </button>
        </form>
      </div>
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default Login;
