
export const EVENEMENT_NOTIFICATIONS_AGENT = 'jirama:notifications-agent';

export function signalerChangementNotifications(detail = {}) {
  window.dispatchEvent(
    new CustomEvent(EVENEMENT_NOTIFICATIONS_AGENT, { detail })
  );
}
