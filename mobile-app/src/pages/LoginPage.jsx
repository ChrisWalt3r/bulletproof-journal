import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { IoEye, IoEyeOff } from 'react-icons/io5';
import { useAuth } from '../context/AuthContext.jsx';

export default function LoginPage() {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!form.email || !form.password) {
      window.alert('Please fill in all fields.');
      return;
    }

    setLoading(true);
    const { error } = await signIn(form.email, form.password);
    setLoading(false);

    if (error) {
      window.alert(error.message);
      return;
    }

    navigate('/home', { replace: true });
  };

  return (
    <section className="auth-shell">
      <div className="auth-shell__hero">
        <span className="page-header__eyebrow">Bulletproof Journal</span>
        <h1>Trade with context, not memory.</h1>
        <p>
          Your dashboard, journal, criteria tracker, calendar, and review flows are
          now being rebuilt for the browser.
        </p>
      </div>

      <form className="auth-card" onSubmit={handleSubmit}>
        <h2>Welcome back</h2>
        <p>Sign in to your trading workspace.</p>

        <label className="field">
          <span>Email</span>
          <input
            type="email"
            value={form.email}
            onChange={(event) =>
              setForm((current) => ({ ...current, email: event.target.value }))
            }
            placeholder="name@example.com"
          />
        </label>

        <label className="field">
          <span>Password</span>
          <div className="password-field">
            <input
              type={showPassword ? 'text' : 'password'}
              value={form.password}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  password: event.target.value,
                }))
              }
              placeholder="Enter your password"
            />
            <button
              type="button"
              className="icon-button"
              onClick={() => setShowPassword((value) => !value)}
            >
              {showPassword ? <IoEyeOff size={18} /> : <IoEye size={18} />}
            </button>
          </div>
        </label>

        <div className="auth-card__links">
          <Link to="/forgot-password">Forgot password?</Link>
        </div>

        <button className="primary-button" type="submit" disabled={loading}>
          {loading ? 'Signing in...' : 'Login'}
        </button>

        <p className="auth-card__footer">
          New here? <Link to="/signup">Create an account</Link>
        </p>
      </form>
    </section>
  );
}
