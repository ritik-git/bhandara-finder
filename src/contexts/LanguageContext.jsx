import { createContext, useContext, useState, useEffect } from 'react';
import { t as translate } from '../i18n';

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem('bf_lang') || 'en');

  useEffect(() => {
    localStorage.setItem('bf_lang', lang);
    document.documentElement.lang = lang === 'hi' ? 'hi' : 'en';
  }, [lang]);

  const toggleLang = () => setLang(l => l === 'en' ? 'hi' : 'en');
  const t = (key) => translate(key, lang);

  return (
    <LanguageContext.Provider value={{ lang, setLang, toggleLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLang() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLang must be used inside LanguageProvider');
  return ctx;
}
