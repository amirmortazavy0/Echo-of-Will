import { IdentityProvider } from './Identity';
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <IdentityProvider><App /></IdentityProvider>
  </StrictMode>,
);
