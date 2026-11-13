import './JiramaLoading.css';

/**
 * Indicateur de chargement commun à l'application JIRAMA.
 * variant="overlay" : chargement de navigation couvrant la page.
 * variant="inline"  : chargement intégré dans une section (tableau, panneau…).
 */
export default function JiramaLoading({
  variant = 'inline',
  message = 'Chargement en cours',
  detail = '',
  className = '',
}) {
  const overlay = variant === 'overlay';

  return (
    <div
      className={`jr-loading ${overlay ? 'jr-loading--overlay' : 'jr-loading--inline'} ${className}`.trim()}
      role="status"
      aria-live="polite"
      aria-label={message}
    >
      <div className="jr-loading__content">
        <div className="jr-loading__brand" aria-hidden="true">
          <span className="jr-loading__orbit jr-loading__orbit--blue" />
          <span className="jr-loading__orbit jr-loading__orbit--orange" />
          <img src="/images/Jirama.png" alt="" className="jr-loading__logo" />
        </div>
        <p className="jr-loading__message">{message}</p>
        {detail ? <p className="jr-loading__detail">{detail}</p> : null}
        <div className="jr-loading__track" aria-hidden="true">
          <span className="jr-loading__track-progress" />
        </div>
        <span className="jr-loading__sr-only">Veuillez patienter.</span>
      </div>
    </div>
  );
}
