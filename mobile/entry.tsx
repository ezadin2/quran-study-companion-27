import './polyfills';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from '@tanstack/react-router';
import { getRouter } from '../src/router';
import { initNative } from './native';
import '../src/styles.css';
import { THEME_BOOT_SCRIPT } from '../src/lib/theme';
// Apply the saved light/dark theme before the first paint (web does this from the <head> shell).
new Function(THEME_BOOT_SCRIPT)();
const root = document.getElementById('root');
if (!root) throw new Error('Application root missing');
const router = getRouter();
createRoot(root).render(<RouterProvider router={router} />);
void initNative(router);
