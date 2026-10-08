/** @type {import('tailwindcss').Config} */
export default {
  // Mode sombre piloté par la classe "dark" posée sur <html> (voir useTheme)
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        jirama: {
          50: '#eff6ff',
          100: '#dbeafe',
          500: '#2563eb',
          600: '#1d4ed8',
          700: '#1e40af',
          800: '#1e3a8a',
          900: '#172554',
        },

        // Couleurs du thème JIRAMA : elles suivent les variables CSS de
        // index.css, donc changent automatiquement en mode sombre.
        // Exemples : bg-jr-surface, text-jr-doux, border-jr-bordure
        jr: {
          fond: 'var(--jr-fond)',
          surface: 'var(--jr-surface)',
          champ: 'var(--jr-champ)',
          texte: 'var(--jr-texte)',
          doux: 'var(--jr-texte-doux)',
          faible: 'var(--jr-texte-faible)',
          bordure: 'var(--jr-bordure)',
          'bordure-forte': 'var(--jr-bordure-forte)',
          titre: 'var(--jr-titre)',
          lien: 'var(--jr-lien)',
          eau: 'var(--jr-eau)',
          elec: 'var(--jr-elec)',
          ok: 'var(--jr-ok)',
          'ok-pale': 'var(--jr-ok-pale)',
          err: 'var(--jr-err)',
          'err-pale': 'var(--jr-err-pale)',
          'err-bordure': 'var(--jr-err-bordure)',
                    // Variantes ajoutées : suivent les variables CSS de index.css
          'eau-fonce': 'var(--jr-eau-fonce)',
          'eau-clair': 'var(--jr-eau-clair)',
          'eau-pale': 'var(--jr-eau-pale)',
          'elec-fonce': 'var(--jr-elec-fonce)',
          'elec-pale': 'var(--jr-elec-pale)',
          attention: 'var(--jr-attention)',
          focus: 'var(--jr-focus)',
          'focus-anneau': 'var(--jr-focus-anneau)',
        },
      },
    },
  },
  plugins: [],
};
