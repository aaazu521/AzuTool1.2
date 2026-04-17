import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './src/App';
import { SettingsProvider } from './src/contexts/SettingsContext';
import { UIProvider } from './src/contexts/UIContext';
import { DataProvider } from './src/contexts/DataContext';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <SettingsProvider>
      <UIProvider>
        <DataProvider>
          <App />
        </DataProvider>
      </UIProvider>
    </SettingsProvider>
  </React.StrictMode>
);
