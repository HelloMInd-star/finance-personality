import React from 'react';

const PlaceholderPage = ({ title, description, icon }) => {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '60vh',
      color: 'rgba(255,255,255,0.5)',
    }}>
      <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.5 }}>
        {icon}
      </div>
      <h2 style={{ color: '#a78bfa', marginBottom: 8 }}>{title}</h2>
      <p>{description}</p>
    </div>
  );
};

export default PlaceholderPage;
