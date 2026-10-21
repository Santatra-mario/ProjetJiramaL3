import React from 'react';

function cle(value) {
  return String(value ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[\s-]+/g, '_');
}

function valeurNumerique(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function formaterNombre(value) {
  return Number(value).toLocaleString('fr-FR', {
    maximumFractionDigits: 2,
  });
}

function obtenirUnite(notification) {
  return cle(notification?.type_compteur) === 'EAU' ? 'm³' : 'kWh';
}

function obtenirNiveau(notification, variation) {
  const niveauDeclare = cle(notification?.niveau_gravite ?? notification?.niveau);
  if (['ATTENTION', 'SUSPECTE', 'CRITIQUE'].includes(niveauDeclare)) {
    return niveauDeclare;
  }
  if (variation === null) return null;
  const absolue = Math.abs(variation);
  if (absolue >= 100) return 'CRITIQUE';
  if (absolue >= 75) return 'SUSPECTE';
  if (absolue >= 50) return 'ATTENTION';
  return null;
}

function obtenirIndication(notification) {
  const type = cle(notification?.type);
  const classification = cle(
    notification?.classification ?? notification?.type_anomalie
  );
  const variation = valeurNumerique(
    notification?.variation ?? notification?.variation_pourcentage
  );
  const niveau = obtenirNiveau(notification, variation);
  const message = String(notification?.message ?? '');
  const compteurHistorique = message.match(/(?:seuls?\s+)?(\d+)\s+relev[eé]/i);

  if (
    type.includes('ESTIME') ||
    classification === 'RELEVE_ESTIME'
  ) {
    return {
      key: 'estime',
      titre: 'RELEVÉ ESTIMÉ',
      condition: 'Aucun relevé réel exploitable n’est disponible pour cette période ; la consommation est estimée à partir de l’historique.',
      exemple: 'Méthode indicative : moyenne des consommations des trois derniers mois.',
      couleur: 'blue',
    };
  }

  if (
    type.includes('HISTORIQUE_INSUFFISANT') ||
    classification === 'HISTORIQUE_INSUFFISANT'
  ) {
    const nombreDisponible = compteurHistorique ? Number(compteurHistorique[1]) : null;
    return {
      key: 'historique',
      titre: 'HISTORIQUE INSUFFISANT',
      condition: 'Moins de 3 consommations historiques valides sont disponibles. Le statut de consommation ne peut pas encore être classé de manière fiable.',
      exemple: nombreDisponible !== null
        ? `Historique disponible : ${nombreDisponible}/3 relevé(s) valide(s).`
        : 'Historique nécessaire : 3 consommations précédentes valides.',
      couleur: 'slate',
    };
  }

  if (
    type.includes('A_VERIFIER') ||
    type.includes('COMPTEUR_OU_INDEX') ||
    classification === 'A_VERIFIER'
  ) {
    return {
      key: 'verifier',
      titre: 'COMPTEUR OU INDEX À VÉRIFIER',
      condition: 'Index incohérents, période invalide, écart entre les index et la consommation calculée, ou référence historique nulle/invalide.',
      exemple: 'Ce statut demande un contrôle ; il ne confirme pas à lui seul une fraude ni un défaut de compteur.',
      couleur: 'orange',
    };
  }

  if (
    type.includes('CONSOMMATION_NORMALE') ||
    classification === 'NORMALE'
  ) {
    return {
      key: 'normal',
      titre: 'CONSOMMATION NORMALE',
      condition: 'Variation strictement supérieure à −50 % et strictement inférieure à +50 % par rapport à la référence.',
      exemple: 'Avec une référence de 100 unités : consommation supérieure à 50 et inférieure à 150 unités.',
      couleur: 'green',
    };
  }

  const estSousConsommation =
    type.includes('SOUS_CONSOMMATION') || classification === 'SOUS_CONSOMMATION';
  const estSurconsommation =
    type.includes('SURCONSOMMATION') || classification === 'SURCONSOMMATION';
  const typeCritique = type.includes('CONSOMMATION_CRITIQUE');

  if (estSousConsommation || estSurconsommation) {
    const sens = estSousConsommation ? 'SOUS_CONSOMMATION' : 'SURCONSOMMATION';
    const niveauAffiche = niveau || (typeCritique ? 'CRITIQUE' : null);
    let condition;
    let exemple;

    if (sens === 'SOUS_CONSOMMATION') {
      if (niveauAffiche === 'ATTENTION') {
        condition = 'Variation de −50 % inclus à plus de −75 % par rapport à la référence.';
        exemple = 'Avec une référence de 100 unités : consommation supérieure à 25 et inférieure ou égale à 50 unités.';
      } else if (niveauAffiche === 'SUSPECTE') {
        condition = 'Variation de −75 % inclus à plus de −100 % par rapport à la référence.';
        exemple = 'Avec une référence de 100 unités : consommation supérieure à 0 et inférieure ou égale à 25 unités.';
      } else if (niveauAffiche === 'CRITIQUE') {
        condition = 'Variation de −100 % : consommation actuelle nulle avec une référence historique positive.';
        exemple = 'Avec une référence de 100 unités : consommation actuelle égale à 0.';
      } else {
        condition = 'Baisse d’au moins 50 % par rapport à la référence historique.';
        exemple = 'Le niveau de gravité détaillé n’est pas fourni dans cette notification.';
      }
    } else if (niveauAffiche === 'ATTENTION') {
      condition = 'Variation de +50 % inclus à moins de +75 % par rapport à la référence.';
      exemple = 'Avec une référence de 100 unités : consommation de 150 à moins de 175 unités.';
    } else if (niveauAffiche === 'SUSPECTE') {
      condition = 'Variation de +75 % inclus à moins de +100 % par rapport à la référence.';
      exemple = 'Avec une référence de 100 unités : consommation de 175 à moins de 200 unités.';
    } else if (niveauAffiche === 'CRITIQUE') {
      condition = 'Variation supérieure ou égale à +100 % par rapport à la référence.';
      exemple = 'Avec une référence de 100 unités : consommation supérieure ou égale à 200 unités.';
    } else {
      condition = 'Hausse d’au moins 50 % par rapport à la référence historique.';
      exemple = 'Le niveau de gravité détaillé n’est pas fourni dans cette notification.';
    }

    const labelSens = sens === 'SOUS_CONSOMMATION' ? 'SOUS-CONSOMMATION' : 'SURCONSOMMATION';
    return {
      key: sens === 'SOUS_CONSOMMATION' ? 'sous' : 'sur',
      titre: `${labelSens}${niveauAffiche ? ` — ${niveauAffiche}` : ''}`,
      condition,
      exemple,
      couleur: niveauAffiche === 'CRITIQUE' ? 'red' : niveauAffiche === 'SUSPECTE' ? 'orange' : 'amber',
    };
  }

  if (typeCritique) {
    return {
      key: 'critique',
      titre: 'CONSOMMATION CRITIQUE',
      condition: 'Variation absolue supérieure ou égale à 100 % selon le seuil de suivi configuré.',
      exemple: 'Vérification prioritaire recommandée ; cette variation n’est pas une preuve automatique de fraude.',
      couleur: 'red',
    };
  }

  return null;
}

const couleurs = {
  green: 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100',
  amber: 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100',
  orange: 'border-orange-200 bg-orange-50 text-orange-900 dark:border-orange-900 dark:bg-orange-950/40 dark:text-orange-100',
  red: 'border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100',
  blue: 'border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-100',
  slate: 'border-slate-200 bg-slate-50 text-slate-800 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-100',
};

export default function SuiviConsommationIndication({ notification }) {
  const indication = obtenirIndication(notification);
  if (!indication) return null;

  const unite = obtenirUnite(notification);
  const consommation = valeurNumerique(
    notification?.valeur_detectee ?? notification?.valeur ?? notification?.consommation
  );
  const reference = valeurNumerique(
    notification?.valeur_reference ?? notification?.reference_consommation
  );
  const variation = valeurNumerique(
    notification?.variation ?? notification?.variation_pourcentage
  );
  const ancienIndex = valeurNumerique(notification?.ancien_index);
  const nouvelIndex = valeurNumerique(notification?.nouvel_index);
  const afficherIndex = indication.key === 'verifier' && (ancienIndex !== null || nouvelIndex !== null);

  return (
    <section
      className={`mt-3 rounded-xl border px-3 py-3 text-xs ${couleurs[indication.couleur] || couleurs.slate}`}
      aria-label={`Indicateur : ${indication.titre}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-extrabold uppercase tracking-wide">Indicateur de suivi</span>
        <span className="rounded-full border border-current/20 px-2 py-1 font-bold">{indication.titre}</span>
      </div>

      <p className="mt-2 leading-5">
        <strong>Condition :</strong> {indication.condition}
      </p>
      <p className="mt-1 leading-5 opacity-90">
        <strong>Repère :</strong> {indication.exemple}
      </p>

      {(consommation !== null || reference !== null || variation !== null) && (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 border-t border-current/15 pt-2">
          {consommation !== null && (
            <span><strong>Consommation :</strong> {formaterNombre(consommation)} {unite}</span>
          )}
          {reference !== null && (
            <span><strong>Référence :</strong> {formaterNombre(reference)} {unite}</span>
          )}
          {variation !== null && (
            <span><strong>Variation :</strong> {variation > 0 ? '+' : ''}{formaterNombre(variation)} %</span>
          )}
        </div>
      )}

      {afficherIndex && (
        <p className="mt-2 border-t border-current/15 pt-2">
          <strong>Index :</strong> {ancienIndex !== null ? formaterNombre(ancienIndex) : '—'} → {nouvelIndex !== null ? formaterNombre(nouvelIndex) : '—'}
        </p>
      )}

      <p className="mt-2 text-[10px] leading-4 opacity-75">
        Les seuils de variation affichés sont des repères configurés dans l’application ; ils ne constituent pas, à eux seuls, une preuve de fraude ou un barème officiel de la JIRAMA.
      </p>
    </section>
  );
}
