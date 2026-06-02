import { useState, useEffect, useMemo } from 'react'

const ASSETS = [
  { symbol: 'BTC/USD', name: 'Bitcoin' },
  { symbol: 'ETH/USD', name: 'Ethereum' },
  { symbol: 'SOL/USD', name: 'Solana' },
  { symbol: 'EUR/USD', name: 'Euro / US Dollar' },
  { symbol: 'GBP/USD', name: 'British Pound' },
  { symbol: 'XAU/USD', name: 'Gold' },
  { symbol: 'XAG/USD', name: 'Silver' },
  { symbol: 'WTI/USD', name: 'Oil' },
]

function cleanSymbol(symbol) {
  return symbol
    .replace('Metal.', '')
    .replace('Crypto.', '')
    .replace('Commodities.', '')
    .replace('FX.', '')
    .replace('Equity.US.', '')
    .replace('BTC/USD', 'BTC/USD')
    .replace('ETH/USD', 'ETH/USD')
    .replace('SOL/USD', 'SOL/USD')
    .replace('USOILSPOT', 'WTI/USD');
}

export default function Ticker() {
  const [viewMode, setViewMode] = useState('winners') // 'winners', 'losers'
  const [apiData, setApiData] = useState([]);

  useEffect(() => {
    fetch('https://api.brokex.trade/price-differences')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setApiData(data);
        }
      })
      .catch(err => console.error("Failed to fetch price differences:", err));
  }, []);

  const toggleMode = () => {
    setViewMode(prev => prev === 'winners' ? 'losers' : 'winners')
  }

  // Icons
  const UpArrow = () => (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 19V5M5 12l7-7 7 7" />
    </svg>
  );

  const DownArrow = () => (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M5 12l7 7 7-7" />
    </svg>
  );

  // Map real day differences or fallback to mock data
  const formattedAssets = useMemo(() => {
    if (apiData.length === 0) {
      return ASSETS.map(asset => {
        const variation = parseFloat((Math.random() * 5).toFixed(2));
        const isUp = Math.random() > 0.5;
        const val = isUp ? variation : -variation;
        return {
          symbol: asset.symbol,
          val: val,
          displayVal: `${isUp ? '+' : ''}${val.toFixed(2)}%`,
          isUp
        };
      });
    }

    return apiData.map(item => {
      const val = parseFloat((item.day_price_diff_decimal * 100).toFixed(2));
      const isUp = val >= 0;
      return {
        symbol: cleanSymbol(item.symbol),
        val: val,
        displayVal: `${isUp ? '+' : ''}${val.toFixed(2)}%`,
        isUp
      };
    });
  }, [apiData]);

  // Filter and Sort dynamically based on winners/losers mode
  const displayedAssets = useMemo(() => {
    if (viewMode === 'winners') {
      return formattedAssets
        .filter(a => a.val > 0)
        .sort((a, b) => b.val - a.val);
    } else {
      return formattedAssets
        .filter(a => a.val < 0)
        .sort((a, b) => a.val - b.val);
    }
  }, [formattedAssets, viewMode]);

  const getTheme = () => {
    switch (viewMode) {
      case 'winners': return { color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)', label: 'TOP WINNERS', icon: <UpArrow /> }
      case 'losers': return { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)', label: 'TOP LOSERS', icon: <DownArrow /> }
      default: return { color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)', label: 'TOP WINNERS', icon: <UpArrow /> }
    }
  }

  const theme = getTheme()

  return (
    <div className="ticker panel" style={{ 
      height: '40px', 
      background: 'var(--panel-bg)',
      borderTop: '1px solid var(--border-color)',
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      padding: '0 10px',
      overflow: 'hidden'
    }}>
      {/* Toggle Button */}
      <button 
        onClick={toggleMode}
        style={{
          background: theme.bg,
          border: 'none',
          color: theme.color,
          fontSize: '10px',
          fontWeight: 'bold',
          padding: '6px 12px',
          borderRadius: '6px',
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          marginRight: '20px',
          flexShrink: 0,
          transition: 'all 0.2s'
        }}
      >
        <span style={{ 
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>{theme.icon}</span>
        {theme.label}
      </button>

      {/* Scroller list */}
      <div 
        className="ticker-scroll"
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'flex-start',
          gap: '20px',
          overflowX: 'auto',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none'
        }}
      >
        <style>{`
          .ticker-scroll::-webkit-scrollbar {
            display: none;
          }
        `}</style>
        {displayedAssets.map((asset, index) => {
          const displayColor = asset.isUp ? '#3b82f6' : '#ef4444';

          return (
            <div key={`${asset.symbol}-${index}`} style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap' }}>
              <span style={{ color: 'var(--text-grey)', fontSize: '10px', fontWeight: '600' }}>{asset.symbol}</span>
              <span style={{ 
                color: displayColor, 
                fontSize: '10px', 
                fontWeight: 'bold',
                fontFamily: 'monospace',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                {asset.isUp ? <UpArrow /> : <DownArrow />}
                {asset.displayVal}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  )
}
