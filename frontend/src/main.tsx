import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { initSentry } from './lib/sentry';
import './styles/globals.css';
import { captureReferral } from './lib/referral';

// A visitor landing on ?ref=CODE has it stored before any navigation clears it.
captureReferral();

initSentry();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
