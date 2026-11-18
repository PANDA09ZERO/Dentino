import './numeric-input';
import React from 'react';
import {createRoot} from 'react-dom/client';
import {App} from './App';
import './tokens.css';
import './style.css';
import './install';
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
