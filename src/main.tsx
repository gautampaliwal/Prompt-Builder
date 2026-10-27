import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { App } from './app/App';
import { ServicesProvider } from './app/services-context';
import { createServices } from './services';
import './styles/index.css';

const root = document.getElementById('root');
if (!root) throw new Error('Root element #root not found');

const services = createServices();

createRoot(root).render(
  <StrictMode>
    <ServicesProvider services={services}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ServicesProvider>
  </StrictMode>,
);
