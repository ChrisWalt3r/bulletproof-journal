import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!email) {
      window.alert('Please enter your email address.');
      return;
    }

    setLoading(true);
    const { error } = await resetPassword(email);
    setLoading(false);

    if (error) {
      window.alert(error.message);
      return;
    }

    window.alert('Password reset instructions have been sent to your email.');
    navigate('/login', { replace: true });
  };

  return (
    <section className="auth-shell auth-shell--single">
      <form className="auth-card" onSubmit={handleSubmit}>
        <h2>Reset password</h2>
        <p>
          Enter the email tied to your account and we will send you a reset link.
        </p>

        <label className="field">
          <span>Email</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@example.com"
          />
        </label>

        <button className="primary-button" type="submit" disabled={loading}>
          {loading ? 'Sending...' : 'Send reset link'}
        </button>

        <p className="auth-card__footer">
          <Link to="/login">Back to login</Link>
        </p>
      </form>
    </section>
  );
}
