import { Link } from 'react-router-dom';
import { useState } from 'react';
import { IoEye, IoEyeOff } from 'react-icons/io5';
import { useAuth } from '../context/AuthContext.jsx';

export default function SignupPage() {
  const { signUp } = useAuth();
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (
      !form.name ||
      !form.email ||
      !form.password ||
      !form.confirmPassword
    ) {
      window.alert('Please fill in all fields.');
      return;
    }

    if (form.password !== form.confirmPassword) {
      window.alert('Passwords do not match.');
      return;
    }

    if (form.password.length < 6) {
      window.alert('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    const { error } = await signUp(form.email, form.password, form.name);
    setLoading(false);

    if (error) {
      window.alert(error.message);
      return;
    }

    window.alert('Account created. Please check your email for verification.');
  };

  return (
    <section className="auth-shell">
      <div className="auth-shell__hero">
        <span className="page-header__eyebrow">Build your desk</span>
        <h1>Set up a focused web workspace for your trading review.</h1>
        <p>
          Create your account to start tracking trades, plan adherence, and
          execution patterns across every page.
        </p>
      </div>

      <form className="auth-card" onSubmit={handleSubmit}>
        <h2>Create account</h2>
        <p>Use the same Supabase auth flow from the mobile app.</p>

        <label className="field">
          <span>Full name</span>
          <input
            type="text"
            value={form.name}
            onChange={(event) =>
              setForm((current) => ({ ...current, name: event.target.value }))
            }
            placeholder="Your full name"
          />
        </label>

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
              placeholder="Choose a password"
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

        <label className="field">
          <span>Confirm password</span>
          <div className="password-field">
            <input
              type={showConfirmPassword ? 'text' : 'password'}
              value={form.confirmPassword}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  confirmPassword: event.target.value,
                }))
              }
              placeholder="Confirm your password"
            />
            <button
              type="button"
              className="icon-button"
              onClick={() => setShowConfirmPassword((value) => !value)}
            >
              {showConfirmPassword ? <IoEyeOff size={18} /> : <IoEye size={18} />}
            </button>
          </div>
        </label>

        <button className="primary-button" type="submit" disabled={loading}>
          {loading ? 'Creating account...' : 'Sign up'}
        </button>

        <p className="auth-card__footer">
          Already have an account? <Link to="/login">Login</Link>
        </p>
      </form>
    </section>
  );
}
