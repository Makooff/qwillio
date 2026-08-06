import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { initSentry } from './lib/sentry';
import './styles/globals.css';
import './styles/v2.css';
import { captureReferral } from './lib/referral';
import { bootTheme } from './stores/themeStore';

// A visitor landing on ?ref=CODE has it stored before any navigation clears it.
captureReferral();

// Avant le premier rendu: sinon la page claire s'affiche une frame avant de
// basculer, et ce flash blanc est exactement ce qu'un thème sombre doit éviter.
bootTheme();

initSentry();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
