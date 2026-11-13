const CLE_SYNCHRONISATION = 'jirama:abonnes-modifies';

export function publierChangementAbonnes() {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(
      CLE_SYNCHRONISATION,
      `${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
  } catch {
    // La page ayant déclenché l'opération met déjà son état à jour.
  }
}

export function ecouterChangementAbonnes(callback) {
  if (typeof window === 'undefined' || typeof callback !== 'function') {
    return () => {};
  }

  const gererChangement = (event) => {
    if (event.key === CLE_SYNCHRONISATION && event.newValue) callback();
  };

  window.addEventListener('storage', gererChangement);
  return () => window.removeEventListener('storage', gererChangement);
}
