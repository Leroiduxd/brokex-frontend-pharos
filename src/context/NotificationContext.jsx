import React, { createContext, useContext, useState, useCallback } from 'react';
import { CONFIG } from '../config';

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState([]);

  const showNotification = useCallback((message, type = 'info', txHash = null, duration = 5000) => {
    const id = Date.now() + Math.random().toString(36).substr(2, 9);
    setNotifications((prev) => [...prev, { id, message, type, txHash }]);

    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, duration);
  }, []);

  const removeNotification = useCallback((id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  return (
    <NotificationContext.Provider value={{ showNotification }}>
      {children}
      
      {/* Premium Bottom-Right Notification Stack Container */}
      <div 
        className="notification-container"
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          zIndex: 9999999,
          display: 'flex',
          flexDirection: 'column-reverse', // Stack upward from bottom
          gap: '10px',
          maxWidth: '350px',
          width: 'calc(100% - 40px)',
          pointerEvents: 'none'
        }}
      >
        {notifications.map((n) => {
          const goldColor = '#BC8961'; 

          // Elegant Title based on type
          let cardTitle = 'Notification';
          if (n.type === 'success') cardTitle = 'Transaction Success';
          else if (n.type === 'error') cardTitle = 'Transaction Failed';
          else if (n.type === 'info') cardTitle = 'Initiating Action';

          return (
            <div
              key={n.id}
              onClick={() => removeNotification(n.id)}
              className="notification-toast"
              style={{
                pointerEvents: 'auto',
                borderRadius: '8px',
                padding: '14px 16px',
                fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                cursor: 'pointer',
                animation: 'notificationSlideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards',
                transition: 'all 0.2s ease',
                backdropFilter: 'blur(16px)',
                boxSizing: 'border-box',
                position: 'relative'
              }}
            >
              {/* Header with Title and Close X */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                <span className="notification-toast-title" style={{ 
                  fontSize: '11px', 
                  fontWeight: '700', 
                  fontFamily: 'Source Code Pro, monospace',
                  letterSpacing: '0.03em'
                }}>
                  {cardTitle}
                </span>
                <span style={{ 
                  fontSize: '14px', 
                  color: 'var(--text-grey)', 
                  opacity: 0.6,
                  fontWeight: 'bold',
                  lineHeight: '1',
                  cursor: 'pointer'
                }}>&times;</span>
              </div>

              {/* Body Content Row */}
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                {/* Left: Square Gold [XAU] Badge */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '36px',
                  height: '36px',
                  background: 'rgba(188, 137, 97, 0.08)',
                  border: `1px solid ${goldColor}`,
                  borderRadius: '4px',
                  color: goldColor,
                  fontFamily: 'Source Code Pro, monospace',
                  fontSize: '9px',
                  fontWeight: 'bold',
                  letterSpacing: '0.05em',
                  flexShrink: 0
                }}>
                  [XAU]
                </div>

                {/* Right: Message Details */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', flex: 1 }}>
                  {/* Pair Name */}
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <span className="notification-toast-pair" style={{ fontSize: '11px', fontWeight: 'bold', fontFamily: 'Source Code Pro, monospace' }}>
                      XAU/USD
                    </span>
                  </div>

                  {/* Dynamic Message Content */}
                  <div style={{ 
                    fontSize: '10px',
                    fontWeight: '500', 
                    lineHeight: '1.4', 
                    color: 'var(--text-grey)',
                    fontFamily: 'Inter, sans-serif'
                  }}>
                    {n.message}
                  </div>
                </div>
              </div>

              {/* Transaction Hash Explorer Link */}
              {n.txHash && (
                <a
                  href={`${CONFIG.explorerUrl}/tx/${n.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    color: goldColor,
                    fontFamily: 'Source Code Pro, monospace',
                    fontSize: '9px',
                    textDecoration: 'none',
                    marginTop: '4px',
                    fontWeight: '600',
                    borderTop: '1px solid var(--border-color)',
                    paddingTop: '6px',
                    width: '100%'
                  }}
                >
                  Transaction: {n.txHash.slice(0, 6)}...{n.txHash.slice(-4)} ↗
                </a>
              )}
            </div>
          );
        })}
      </div>

      <style>{`
        .notification-toast {
          background: rgba(26, 26, 26, 0.95);
          border: 1px solid rgba(255, 255, 255, 0.06);
          color: #ffffff;
          box-shadow: 0 12px 30px rgba(0, 0, 0, 0.5);
        }
        .notification-toast-title {
          color: #ffffff;
        }
        .notification-toast-pair {
          color: #ffffff;
        }
        
        body.light-mode .notification-toast {
          background: rgba(255, 255, 255, 0.96);
          border: 1px solid rgba(0, 0, 0, 0.08);
          color: #000000;
          box-shadow: 0 12px 30px rgba(0, 0, 0, 0.12);
        }
        body.light-mode .notification-toast-title {
          color: #000000;
        }
        body.light-mode .notification-toast-pair {
          color: #000000;
        }

        @keyframes notificationSlideUp {
          from {
            transform: translateY(50px) scale(0.95);
            opacity: 0;
          }
          to {
            transform: translateY(0) scale(1);
            opacity: 1;
          }
        }
        @media (max-width: 480px) {
          .notification-container {
            right: 20px !important;
            left: 20px !important;
            bottom: 20px !important;
            width: auto !important;
            max-width: none !important;
          }
        }
      `}</style>
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}
