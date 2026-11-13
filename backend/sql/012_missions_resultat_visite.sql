/* =========================================================
   012 — RÉSULTAT DE LA VISITE DE CONTRÔLE
   =========================================================

   Un contrôle sur le terrain ne se termine pas toujours par
   un index exploitable :
     - l'abonné peut être absent ;
     - le compteur peut être inaccessible ;
     - l'index peut être illisible ;
     - le compteur peut nécessiter une intervention technique.

   Ces cas doivent rester distincts d'une consommation vérifiée.
   La colonne est facultative : les missions créées avant cette
   migration ne sont pas modifiées.

   Valeurs applicatives :
     RELEVE_ENREGISTRE       index réel enregistré (releve_id renseigné)
     ABONNE_ABSENT
     COMPTEUR_INACCESSIBLE
     INDEX_ILLISIBLE
     COMPTEUR_A_INTERVENIR
     AUTRE
========================================================= */

ALTER TABLE missions_controle
  ADD COLUMN IF NOT EXISTS resultat_visite varchar(40);

/* Les relevés déjà rattachés à une mission sont des consommations
   réellement vérifiées : on renseigne le résultat sans toucher aux
   statuts ni aux dates existantes. */
UPDATE missions_controle
SET resultat_visite = 'RELEVE_ENREGISTRE'
WHERE releve_id IS NOT NULL
  AND resultat_visite IS NULL;

CREATE INDEX IF NOT EXISTS idx_missions_controle_resultat
  ON missions_controle(resultat_visite);
