import React from 'react';

export default function MobileTradeHeader({ activeMarketInfo, setIsMarketSelectorOpen }) {
  const isPositive = activeMarketInfo.change.startsWith('+');

  return (
    <div style={{ display: 'flex', alignItems: 'center', padding: '12px 12px 8px 12px', background: 'transparent', width: '100%' }}>
      <div 
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '10px', 
          cursor: setIsMarketSelectorOpen ? 'pointer' : 'default', 
          flexGrow: 1 
        }} 
        onClick={setIsMarketSelectorOpen ? () => setIsMarketSelectorOpen(true) : undefined}
      >
        {/* Logo box */}
        <div style={{
          width: '36px',
          height: '36px',
          backgroundColor: 'rgba(200, 169, 126, 0.08)',
          border: '1px solid rgba(200, 169, 126, 0.2)',
          borderRadius: '8px',
          color: 'var(--gold)',
          fontWeight: '900',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '11px',
          flexShrink: 0
        }}>
          {activeMarketInfo.logo}
        </div>
        
        {/* Name and Tags */}
        <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
          {/* Row 1: Symbol & Leverage + Price on right */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '14px', fontWeight: '900', color: 'var(--text-dark)' }}>
                {activeMarketInfo.symbol}
              </span>
              <span style={{ fontSize: '8px', backgroundColor: 'rgba(188, 137, 97, 0.1)', color: 'var(--gold)', padding: '1px 5px', borderRadius: '4px', fontWeight: 'bold' }}>
                {activeMarketInfo.leverage}
              </span>
            </div>
            
            {/* Price aligned to the right */}
            <span style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--text-dark)', fontFamily: 'Source Code Pro, monospace' }}>
              ${activeMarketInfo.price}
            </span>
          </div>

          {/* Row 2: Company + Variation on right */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginTop: '2px' }}>
            <span style={{ fontSize: '10px', color: 'var(--text-grey)' }}>
              {activeMarketInfo.company}
            </span>
            
            {/* Variation aligned to the right */}
            <span style={{ 
              fontSize: '10.5px', 
              fontWeight: 'bold', 
              color: isPositive ? '#3b82f6' : '#ef4444', 
              fontFamily: 'Source Code Pro, monospace' 
            }}>
              {activeMarketInfo.change}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
