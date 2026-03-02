import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface ThemeColors {
  primary: string;
  secondary: string;
  warning: string;
  success: string;
  danger: string;
}

interface ThemeContextType {
  colors: ThemeColors;
  updateColor: (colorKey: keyof ThemeColors, value: string) => void;
  resetColors: () => void;
}

const defaultColors: ThemeColors = {
  primary: '#21A68D',    // Teal/Green
  secondary: '#0F4C75',  // Ocean Blue
  warning: '#D4E268',    // Warning Yellow
  success: '#22c55e',    // Green
  danger: '#ef4444',     // Red
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [colors, setColors] = useState<ThemeColors>(() => {
    // Load from localStorage if available
    const saved = localStorage.getItem('theme-colors');
    return saved ? JSON.parse(saved) : defaultColors;
  });

  useEffect(() => {
    // Save to localStorage whenever colors change
    localStorage.setItem('theme-colors', JSON.stringify(colors));
  }, [colors]);

  const updateColor = (colorKey: keyof ThemeColors, value: string) => {
    setColors(prev => ({ ...prev, [colorKey]: value }));
  };

  const resetColors = () => {
    setColors(defaultColors);
    localStorage.removeItem('theme-colors');
  };

  return (
    <ThemeContext.Provider value={{ colors, updateColor, resetColors }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}
