import FondJirama from '../FondJirama.jsx';

/* =========================================================
   COQUE ADMIN
   Fond Jirama (fixe, ne défile pas) + conteneur « jr-admin »
   qui active le thème clair/sombre sur toute la page.
   intensite : « vivant » (défaut) ou « calme » pour les pages de données.
   À réutiliser dans les autres pages /dashboard/admin/*.
========================================================= */
function AdminShell({ children, className = '', intensite = 'vivant' }) {
  return (
    <FondJirama fixe intensite={intensite}>
      <div className={`jr-admin min-h-screen antialiased ${className}`}>
        {children}
      </div>
    </FondJirama>
  );
}

export default AdminShell;