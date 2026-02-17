import React from 'react';
import ReactDOM from 'react-dom/client';
/* Inspinia theme (index.html) loads vendors.min.css + app.min.css. Run scripts/copy-inspinia-assets.ps1 to copy theme. */
import './layout/layout.css';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
