import { createRoot } from 'react-dom/client';
import { App } from './App';
import '@/assets/tailwind.css';

// Dark base so there's no white edge/flash around the glass UI.
document.documentElement.style.colorScheme = 'dark';
document.body.style.margin = '0';
document.body.style.background = '#000';

createRoot(document.getElementById('root')!).render(<App />);
