import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
  tr: {
    translation: {
      'vote.receipt.title': 'Oy Makbuzu',
      'vote.success': 'Oyunuz basariyla kaydedildi!',
      'vote.failure': 'Oy islemi başarısız oldu',
      'wallet.reset.confirm': 'Cüzdan sıfırlanırsa mevcut burner cüzdan erişimi kaybolur. Devam etmek istiyor musunuz?'
    }
  },
  en: {
    translation: {
      'vote.receipt.title': 'Vote Receipt',
      'vote.success': 'Your vote was recorded successfully!',
      'vote.failure': 'Vote failed'
    }
  }
};

i18n.use(initReactI18next).init({
  resources,
  lng: 'tr',
  fallbackLng: 'en',
  interpolation: { escapeValue: false }
});

export default i18n;
