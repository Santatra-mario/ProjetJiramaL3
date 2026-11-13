import { Home } from 'lucide-react';

/* =========================================================
   ADRESSE DE L'ABONNÉ (fiche Administrateur)
   ---------------------------------------------------------
   Le formulaire ne gère plus la géolocalisation : la position
   GPS réelle est sélectionnée par le Responsable dans le
   Planning des contrôles, puis enregistrée en PostgreSQL.

   Seuls les champs d'adresse administrative restent ici :
   région, ville/commune, quartier et fokontany. Ils servent à
   l'Agent pour retrouver l'abonné sur le terrain.
========================================================= */

const CHAMPS = [
  { name: 'region', label: 'Région', placeholder: 'Ex. Vakinankaratra', maxLength: 120, autoComplete: 'address-level1' },
  { name: 'commune', label: 'Ville / commune', placeholder: 'Ex. Antsirabe II', maxLength: 120, autoComplete: 'address-level2' },
  { name: 'quartier', label: 'Quartier', placeholder: 'Quartier réel du domicile', maxLength: 160, autoComplete: 'address-level3' },
  { name: 'fokontany', label: 'Fokontany', placeholder: 'Ex. Ambohimena', maxLength: 160, autoComplete: 'address-level4' },
];

export default function AdresseAbonne({ form, onChange, disabled = false }) {
  return (
    <section className="sm:col-span-2 space-y-3 rounded-lg border border-jr-bordure bg-jr-eau-pale/30 p-4">
      <div>
        <h3 className="flex items-center gap-2 text-sm font-semibold text-jr-titre">
          <Home size={16} aria-hidden="true" />
          Adresse et quartier
        </h3>
        <p className="mt-1 max-w-2xl text-xs text-jr-doux">
          Le quartier et le fokontany permettent à l’Agent de retrouver l’abonné sur le terrain.
          La position GPS se définit dans le Planning des contrôles du Responsable.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {CHAMPS.map((champ) => (
          <div key={champ.name}>
            <label htmlFor={`champ-${champ.name}`} className="mb-1.5 block text-xs font-medium text-jr-doux">
              {champ.label}
            </label>
            <input
              id={`champ-${champ.name}`}
              name={champ.name}
              value={form[champ.name] || ''}
              onChange={onChange}
              disabled={disabled}
              maxLength={champ.maxLength}
              autoComplete={champ.autoComplete}
              placeholder={champ.placeholder}
              className="jr-field w-full rounded-md border px-3 py-2.5 text-sm"
            />
          </div>
        ))}
      </div>
    </section>
  );
}
