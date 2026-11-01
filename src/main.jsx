import { createRoot } from 'react-dom/client';
import './index.css';

const root = createRoot(document.getElementById('root'), {
  onUncaughtError: (e) => window.showError(e),   // erreurs React
});

// Chargement séparé : si App.jsx ou Trystero plante, on voit l'erreur
import('./App.jsx')
  .then(({ default: App }) => root.render(<App />))
  .catch((e) => window.showError(e));
