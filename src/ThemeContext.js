import { createContext, useContext } from 'react';

/** true = dark mode (default), false = light mode */
export const ThemeContext = createContext(true);
export const useIsDark = () => useContext(ThemeContext);
