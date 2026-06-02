import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useConnectModal, useAccountModal, useChainModal } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';

export default function Sidebar() {
  const location = useLocation();
  const activePath = location.pathname;

  const { openConnectModal } = useConnectModal();
  const { openAccountModal } = useAccountModal();
  const { openChainModal } = useChainModal();
  const { isConnected } = useAccount();

  const menuItems = [
    { 
      path: '/', 
      label: 'Trade', 
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m7 21-4-4 4-4" /><path d="M3 17h18" /><path d="m17 3 4 4-4 4" /><path d="M21 7H3" />
        </svg>
      )
    },
    { 
      path: '/portfolio', 
      label: 'Portfolio', 
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect width="20" height="14" x="2" y="7" rx="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
        </svg>
      )
    }
  ];

  const [isLightMode, setIsLightMode] = useState(false);

  const toggleTheme = () => {
    setIsLightMode(!isLightMode);
    document.body.classList.toggle('light-mode');
  };

  return (
    <div className="sidebar" style={{ 
      gridArea: 'sidebar',
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      padding: '0', 
      background: 'transparent', 
      border: 'none',
      height: '100%',
      zIndex: 100
    }}>
      <style>{`
        .sidebar-item {
          width: 38px;
          height: 38px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-grey);
          transition: all 0.2s;
          position: relative;
          text-decoration: none;
          cursor: pointer;
        }
        .sidebar-item:hover {
          color: var(--text-dark);
        }
        .sidebar-item.active {
          color: var(--gold);
        }
        .wallet-btn {
          background: transparent;
          color: var(--text-grey);
          border: none;
          width: 40px;
          height: 40px;
          border-radius: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s;
        }
        .wallet-btn:hover {
          color: var(--text-dark);
        }
        .logo-container {
          width: 40px;
          height: 50px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }
      `}</style>

      <div className="logo-container">
        <img src="/logo.svg" alt="Brokex" style={{ width: '22px' }} />
      </div>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: '3px', width: '100%', alignItems: 'center', marginTop: '10px' }}>
        {menuItems.map((item) => (
          <Link 
            key={item.path}
            to={item.path} 
            className={`sidebar-item ${activePath === item.path ? 'active' : ''}`}
          >
            {item.icon}
          </Link>
        ))}
      </nav>

      {/* Bottom Actions */}
      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
        {/* Theme Toggle */}
        <div className="sidebar-item" onClick={toggleTheme} style={{ marginBottom: '10px' }}>
          {isLightMode ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
          )}
        </div>

        {/* Wallet Button */}
        <button 
          className="wallet-btn" 
          title={isConnected ? "Wallet Details" : "Connect Wallet"}
          onClick={() => {
            if (isConnected) {
              if (openAccountModal) {
                openAccountModal();
              } else if (openChainModal) {
                openChainModal();
              }
            } else {
              if (openConnectModal) openConnectModal();
            }
          }}
          style={{ color: isConnected ? 'var(--gold)' : 'var(--text-grey)' }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="18" height="14" x="3" y="5" rx="3" /><path d="M16 12h3" /><path d="M21 9v6" />
          </svg>
        </button>
      </div>
    </div>
  );
}
