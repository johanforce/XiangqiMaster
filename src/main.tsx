import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { initFetchEnvInterceptor } from './utils/serverEnv';

// Attach global X-Server-Env header to all API requests
initFetchEnvInterceptor();

createRoot(document.getElementById('root')!).render(<App />);
