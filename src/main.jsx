import { createRoot } from 'react-dom/client';
import './index.css';

const root = createRoot(document.getElementById('root'), {
  onUncaughtError: (e) => window.showError(e),   // erreurs React
});

// Chargement séparé : si App.jsx ou Trystero plante, on voit l'erreur
import('./App.jsx')
  .then(({ default: App }) => root.render(<App />))
  .catch((e) => window.showError(e));

// Couche « Ruche » : appels, sonnerie, soundboard (séparée de l'appli)
import('./live/Live.jsx').then(({ default: Live }) => {
  const box = document.createElement('div')
  box.id = 'live'
  document.body.appendChild(box)
  createRoot(box).render(<Live />)
}).catch(e => window.showError?.('Appels : ' + e.message))
  
