import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  IoAdd,
  IoCalendarOutline,
  IoCheckmarkCircle,
  IoColorPaletteOutline,
  IoLogOutOutline,
  IoRefresh,
  IoStatsChartOutline,
  IoTrashOutline,
  IoWalletOutline,
} from 'react-icons/io5';
import PageHeader from '../components/PageHeader.jsx';
import Modal from '../components/Modal.jsx';
import EmptyState from '../components/EmptyState.jsx';
import LoadingScreen from '../components/LoadingScreen.jsx';
import { APP_VERSION } from '../config/env.js';
import { useAccount } from '../context/AccountContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const ACCOUNT_COLORS = [
  '#4A90E2',
  '#50C878',
  '#FF6B6B',
  '#FFB347',
  '#9370DB',
  '#20B2AA',
];

export default function SettingsPage() {
  const navigate = useNavigate();
  const {
    currentAccount,
    accounts,
    switchAccount,
    deactivateAccount,
    createAccount,
    deleteAccount,
    fetchAccounts,
    isLoading,
  } = useAccount();
  const { signOut, user } = useAuth();

  const [showAddAccount, setShowAddAccount] = useState(false);
  const [newAccount, setNewAccount] = useState({
    name: '',
    description: '',
    color: '#4A90E2',
    starting_balance: '',
  });
  const [savingAccount, setSavingAccount] = useState(false);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const quickAccess = [
    {
      title: 'Trading Calendar',
      description: 'Track daily outcomes and plan adherence.',
      icon: <IoCalendarOutline size={20} />,
      to: '/calendar',
    },
    {
      title: 'Equity Curve',
      description: 'Review growth and filter trades by timeframe.',
      icon: <IoStatsChartOutline size={20} />,
      to: '/account-growth',
    },
    {
      title: 'Execution Review',
      description: 'Browse execution timeframe images by date.',
      icon: <IoRefresh size={20} />,
      to: '/execution-review',
    },
  ];

  const handleAddAccount = async () => {
    if (!newAccount.name.trim()) {
      window.alert('Please enter an account name.');
      return;
    }

    setSavingAccount(true);
    const result = await createAccount(newAccount);
    setSavingAccount(false);

    if (!result.success) {
      window.alert(result.error || 'Failed to create account.');
      return;
    }

    setNewAccount({
      name: '',
      description: '',
      color: '#4A90E2',
      starting_balance: '',
    });
    setShowAddAccount(false);
  };

  const handleToggleActiveAccount = async (account) => {
    if (currentAccount?.id === account.id) {
      await deactivateAccount();
      return;
    }

    await switchAccount(account);
  };

  const handleDeleteAccount = async (account) => {
    const confirmed = window.confirm(
      `Delete "${account.name}" and all ${account.entryCount || 0} journal entries?`
    );

    if (!confirmed) {
      return;
    }

    const result = await deleteAccount(account.id);
    if (!result.success) {
      window.alert(result.error || 'Failed to delete account.');
    }
  };

  const handleLogout = async () => {
    if (!window.confirm('Log out of Bulletproof Journal?')) {
      return;
    }

    const { error } = await signOut();
    if (error) {
      window.alert('Failed to log out. Please try again.');
      return;
    }

    navigate('/login', { replace: true });
  };

  return (
    <div className="page page--settings">
      <PageHeader
        eyebrow="Settings"
        title="Settings"
        subtitle="Manage your trading accounts and preferences"
        variant="hero"
        actions={
          <button
            type="button"
            className="primary-button"
            onClick={() => setShowAddAccount(true)}
          >
            <IoAdd size={18} />
            Add Account
          </button>
        }
      />

      <section className="dashboard-grid">
        <article className="surface-card">
          <div className="section-heading">
            <div>
              <span className="section-heading__eyebrow">Quick Access</span>
              <h2>Quick access</h2>
            </div>
          </div>

          <div className="quick-actions">
            {quickAccess.map((item) => (
              <button
                key={item.title}
                type="button"
                className="quick-action-card"
                onClick={() => navigate(item.to)}
              >
                <span className="quick-action-card__icon">{item.icon}</span>
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.description}</p>
                </div>
              </button>
            ))}
          </div>
        </article>

        <article className="surface-card">
          <div className="section-heading">
            <div>
              <span className="section-heading__eyebrow">App Information</span>
              <h2>Bulletproof Journal</h2>
            </div>
          </div>

          <div className="info-panel">
            <strong>Bulletproof Journal</strong>
            <span>Version {APP_VERSION}</span>
            <p>
              This responsive web build mirrors the original mobile workflow while
              keeping the same accounts, journal entries, and MT5 automation pipeline.
            </p>
            <button
              type="button"
              className="secondary-button"
              onClick={() => window.location.reload()}
            >
              <IoRefresh size={18} />
              Refresh Application
            </button>
          </div>
        </article>
      </section>

      <section className="surface-card">
        <div className="section-heading">
          <div>
            <span className="section-heading__eyebrow">Trading Accounts</span>
            <h2>Manage accounts</h2>
          </div>
        </div>

        {isLoading ? (
          <LoadingScreen message="Loading accounts..." compact />
        ) : accounts.length > 0 ? (
          <div className="account-card-list">
            {accounts.map((account) => (
              <article
                key={account.id}
                className={`account-card ${
                  currentAccount?.id === account.id ? 'is-active' : ''
                }`}
              >
                <button
                  type="button"
                  className="account-card__main"
                  onClick={() => navigate(`/accounts/${account.id}/journal`)}
                >
                  <span
                    className="account-card__dot"
                    style={{ background: account.color || '#4A90E2' }}
                  />
                  <div>
                    <strong>{account.name}</strong>
                    <p>{account.description || 'Trading account'}</p>
                    <span>
                      {account.entryCount || 0} journal entries
                      {currentAccount?.id === account.id ? ' | Active' : ''}
                    </span>
                  </div>
                </button>

                <div className="button-row">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => handleToggleActiveAccount(account)}
                  >
                    <IoCheckmarkCircle size={18} />
                    {currentAccount?.id === account.id ? 'Deactivate' : 'Set Active'}
                  </button>
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => handleDeleteAccount(account)}
                  >
                    <IoTrashOutline size={18} />
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<IoWalletOutline size={34} />}
            title="No trading accounts yet"
            description="Add your first account to start journaling and tracking performance."
            action={
              <button
                type="button"
                className="primary-button"
                onClick={() => setShowAddAccount(true)}
              >
                <IoAdd size={18} />
                Add Account
              </button>
            }
          />
        )}
      </section>

      <section className="surface-card settings-account-panel">
        <div>
          <span className="section-heading__eyebrow">Account</span>
          <h2>Signed in as</h2>
          <p>{user?.email || 'Unknown user'}</p>
        </div>
        <button type="button" className="ghost-button" onClick={handleLogout}>
          <IoLogOutOutline size={18} />
          Log Out
        </button>
      </section>

      <Modal
        open={showAddAccount}
        title="Add New Account"
        onClose={() => setShowAddAccount(false)}
        actions={
          <>
            <button
              type="button"
              className="ghost-button"
              onClick={() => setShowAddAccount(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="primary-button"
              disabled={savingAccount}
              onClick={handleAddAccount}
            >
              {savingAccount ? 'Saving...' : 'Add Account'}
            </button>
          </>
        }
      >
        <div className="modal-form">
          <label className="field">
            <span>Account Name</span>
            <input
              type="text"
              value={newAccount.name}
              onChange={(event) =>
                setNewAccount((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
              placeholder="ICT Live Account"
            />
          </label>

          <label className="field">
            <span>Description</span>
            <input
              type="text"
              value={newAccount.description}
              onChange={(event) =>
                setNewAccount((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
              placeholder="Exness MT5 account"
            />
          </label>

          <label className="field">
            <span>Starting Balance</span>
            <input
              type="text"
              inputMode="decimal"
              value={newAccount.starting_balance}
              onChange={(event) =>
                setNewAccount((current) => ({
                  ...current,
                  starting_balance: event.target.value,
                }))
              }
              placeholder="3000"
            />
          </label>

          <div className="field">
            <span>Account Color</span>
            <div className="color-palette">
              {ACCOUNT_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={`color-swatch ${
                    newAccount.color === color ? 'is-selected' : ''
                  }`}
                  style={{ background: color }}
                  onClick={() =>
                    setNewAccount((current) => ({
                      ...current,
                      color,
                    }))
                  }
                >
                  <span className="sr-only">Choose {color}</span>
                </button>
              ))}
            </div>
            <span className="helper-copy">
              <IoColorPaletteOutline size={16} />
              Used in the sidebar and account badges across the app.
            </span>
          </div>
        </div>
      </Modal>
    </div>
  );
}
