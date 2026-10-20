import React from 'react';
import ReactDOM from 'react-dom/client';
// main.jsx
import '@fontsource-variable/nunito';
import App from './App.jsx';
import { ThemeProvider } from './hooks/useTheme.js';
import './index.css';

// Le ThemeProvider enveloppe toute l'application : le thème
// (clair / sombre) est ainsi accessible partout via useTheme().
ReactDOM.createRoot(
  document.getElementById('root')
).render(
  <React.StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </React.StrictMode>
);
