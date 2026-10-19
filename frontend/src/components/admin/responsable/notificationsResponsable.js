export const EVENEMENT_NOTIFICATIONS_RESPONSABLE = 'jirama:notifications-responsable';

export function signalerChangementNotificationsResponsable(detail = {}) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(EVENEMENT_NOTIFICATIONS_RESPONSABLE, { detail })
  );
}
