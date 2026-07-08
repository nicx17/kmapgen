import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
import '@fontsource/jetbrains-mono/600.css';

import './styles/reset.css';
import './styles/tokens.css';
import './styles/layout.css';
import './styles/components.css';
import { initThemeToggle } from './ui/theme-toggle';
import { initApp } from './ui/app';

document.addEventListener('DOMContentLoaded', () => {
  initThemeToggle();
  initApp();
});
