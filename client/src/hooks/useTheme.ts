import { useState, useEffect } from 'react';

type Theme = 'light' | 'dark' | 'night';

// Создаем кастомный event для изменения темы
const THEME_CHANGE_EVENT = 'themeChange';

let currentTheme: Theme = (localStorage.getItem('theme') as Theme) || 'light';

// Инициализируем тему при загрузке
const initializeTheme = () => {
  const root = document.documentElement;
  root.classList.remove('light', 'dark', 'night');
  root.classList.add(currentTheme);
};

initializeTheme();

// Функция для изменения темы
export const setTheme = (newTheme: Theme) => {
  currentTheme = newTheme;
  localStorage.setItem('theme', newTheme);

  // Применяем тему к DOM
  const root = document.documentElement;
  root.classList.remove('light', 'dark', 'night');
  root.classList.add(newTheme);

  // Dispatch кастомного события
  window.dispatchEvent(new CustomEvent(THEME_CHANGE_EVENT, { detail: newTheme }));
};

// Хук для получения и отслеживания темы
export const useTheme = () => {
  const [theme, setThemeState] = useState<Theme>(currentTheme);

  useEffect(() => {
    const handleThemeChange = (event: CustomEvent<Theme>) => {
      setThemeState(event.detail);
    };

    // Слушаем кастомное событие
    window.addEventListener(THEME_CHANGE_EVENT, handleThemeChange as EventListener);

    return () => {
      window.removeEventListener(THEME_CHANGE_EVENT, handleThemeChange as EventListener);
    };
  }, []);

  return theme;
};
