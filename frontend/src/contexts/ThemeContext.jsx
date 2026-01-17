import { createContext, useContext } from 'react';

const ThemeContext = createContext({ theme: 'light' });

export const useTheme = () => useContext(ThemeContext);

export default ThemeContext;
