/* =========================================================
   SESSION RESPONSABLE
   La logique est maintenant partagée avec l'espace Agent :
   voir ../sessionUtilisateur.js. Ce fichier ne fait que
   re-exporter pour ne rien casser.
========================================================= */

export {
  estErreurSession,
  estAnnulation,
  traiterErreurSession,
} from '../sessionUtilisateur.js';
