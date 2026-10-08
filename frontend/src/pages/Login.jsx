import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  Activity,
  AlertCircle,
  Droplets,
  Eye,
  EyeOff,
  Lock,
  LogIn,
  ShieldCheck,
  User,
  UserPlus,
  Zap,
} from 'lucide-react';

import axiosClient from '../api/axiosClient';
import BoutonTheme from '../components/BoutonTheme.jsx';
import FondJirama from '../components/FondJirama.jsx';
import { COULEURS } from '../theme/couleurs.js';

// Un seul chemin de logo pour tout le fichier (adaptez au besoin)
const LOGO = '/images/Jirama.png';

// Rôles autorisés et page d'arrivée correspondante
const REDIRECTIONS = {
  ADMINISTRATEUR: '/dashboard/admin',
  AGENT: '/dashboard/agent',
  RESPONSABLE: '/dashboard/responsable',
};

/* =========================================================
   COMPOSANTS INTERNES
========================================================= */

// Message d'erreur sous un champ
function MessageChamp({ id, erreur }) {
  if (!erreur) return null;
  return (
    <p
      id={`${id}-err`}
      role="alert"
      className="mt-1.5 flex items-start gap-1.5 text-xs font-medium text-jr-err"
    >
      <AlertCircle size={14} className="mt-px shrink-0" aria-hidden="true" />
      {erreur}
    </p>
  );
}

// Ligne d'avantage du panneau gauche
function Avantage({ Icone, titre, texte, couleur }) {
  return (
    <div className="flex items-center gap-4 rounded-md border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
      <div
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md"
        style={{ backgroundColor: couleur, color: COULEURS.surElec }}
      >
        <Icone size={22} aria-hidden="true" />
      </div>
      <div>
        <p className="font-semibold text-white">{titre}</p>
        <p className="text-sm text-blue-100">{texte}</p>
      </div>
    </div>
  );
}

/* =========================================================
   PAGE DE CONNEXION
========================================================= */
function Login() {
  const navigate = useNavigate();

  // --- Champs ---
  const [identifiant, setIdentifiant] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [touche, setTouche] = useState({});
  const [soumis, setSoumis] = useState(false);

  // --- Affichage / état ---
  const [afficherMdp, setAfficherMdp] = useState(false);
  const [majActive, setMajActive] = useState(false);
  const [chargement, setChargement] = useState(false);
  const [erreurGlobale, setErreurGlobale] = useState('');
  const [secousse, setSecousse] = useState(false);

  // --- Références ---
  const refIdentifiant = useRef(null);
  const refMotDePasse = useRef(null);
  const montee = useRef(true);
  const controleur = useRef(null);
  const verrou = useRef(false); // empêche le double envoi (Entrée comprise)

  // Nettoyage au démontage : annule la requête en cours
  useEffect(() => {
    montee.current = true;
    return () => {
      montee.current = false;
      controleur.current?.abort();
    };
  }, []);

  // --- Validation locale ---
  const erreurs = {};
  if (!identifiant.trim())
    erreurs.identifiant = 'Saisissez votre identifiant ou votre e-mail.';
  if (!motDePasse) erreurs.motDePasse = 'Saisissez votre mot de passe.';

  const formulaireValide = Object.keys(erreurs).length === 0;
  const erreurDe = (champ) =>
    touche[champ] || soumis ? erreurs[champ] || '' : '';

  const handleBlur = (champ) => () =>
    setTouche((courant) => ({ ...courant, [champ]: true }));

  const detecterMaj = (e) => {
    if (typeof e.getModifierState === 'function') {
      setMajActive(e.getModifierState('CapsLock'));
    }
  };

  const declencherSecousse = () => {
    setSecousse(false);
    // Redémarre l'animation même si elle vient de jouer
    requestAnimationFrame(() => {
      if (montee.current) setSecousse(true);
    });
  };

  // --- Traduction des erreurs serveur ---
  const messageServeur = (error) => {
    const status = error.response?.status;
    const message = error.response?.data?.message;

    if (status === 400) return message || 'Les données envoyées sont invalides.';
    if (status === 401) return message || 'Identifiant ou mot de passe incorrect.';
    if (status === 403)
      return message || 'Votre compte est désactivé ou l’accès est refusé.';
    if (status === 404)
      return 'Le service de connexion est introuvable. Contactez l’administrateur.';
    if (status >= 500)
      return 'Une erreur est survenue sur le serveur. Réessayez dans quelques instants ou contactez l’administrateur.';
    if (error.code === 'ERR_NETWORK' || !error.response)
      return 'Impossible de contacter le serveur. Vérifiez votre connexion ou que le service est bien démarré.';

    return message || 'Une erreur est survenue pendant la connexion.';
  };

  // --- Soumission ---
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Anti double envoi
    if (verrou.current || chargement) return;

    setSoumis(true);
    setErreurGlobale('');

    // Validation : affiche les erreurs et place le focus sur le 1er champ fautif
    if (!formulaireValide) {
      if (erreurs.identifiant) refIdentifiant.current?.focus();
      else refMotDePasse.current?.focus();
      return;
    }

    // Évite de conserver une ancienne session
    localStorage.removeItem('token');
    localStorage.removeItem('user');

    verrou.current = true;
    setChargement(true);

    controleur.current?.abort();
    controleur.current = new AbortController();

    try {
      const response = await axiosClient.post(
        '/auth/login',
        {
          identifiant: identifiant.trim(),
          mot_de_passe: motDePasse,
        },
        { signal: controleur.current.signal }
      );

      if (!montee.current) return;

      const token = response.data?.token;
      const user = response.data?.user;

      if (!token || !user) {
        throw new Error('La réponse du serveur est invalide.');
      }

      // Vérification du rôle
      const role = String(user.role || '').trim().toUpperCase();

      if (!REDIRECTIONS[role]) {
        setErreurGlobale(
          'Votre rôle n’est pas reconnu par l’application. Contactez l’administrateur.'
        );
        declencherSecousse();
        return;
      }

      // Sauvegarde de la session
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify({ ...user, role }));

      // Redirection selon le rôle
      navigate(REDIRECTIONS[role], { replace: true });
    } catch (error) {
      // Requête annulée volontairement (démontage) : on ne fait rien
      if (error.code === 'ERR_CANCELED' || error.name === 'CanceledError') return;
      if (!montee.current) return;

      // Détail technique réservé au développeur
      console.error('Erreur de connexion :', error);

      setErreurGlobale(messageServeur(error));
      declencherSecousse();

      // Identifiants incorrects : on garde l'identifiant, on vide le mot de passe
      if (error.response?.status === 401) {
        setMotDePasse('');
        setTouche((courant) => ({ ...courant, motDePasse: false }));
        setSoumis(false);
        refMotDePasse.current?.focus();
      }
    } finally {
      verrou.current = false;
      if (montee.current) setChargement(false);
    }
  };

  const classeChamp = (champ) =>
    erreurDe(champ) ? 'jr-field--err' : '';

  /* -------------------------------------------------------
     RENDU
  ------------------------------------------------------- */
  return (
    <FondJirama>
      <BoutonTheme />

      <div className="flex min-h-screen items-center justify-center px-4 pb-8 pt-20">
        <div className="jr-entree w-full max-w-6xl">
          <div className="grid overflow-hidden rounded-lg border border-jr-bordure bg-jr-surface shadow-2xl shadow-black/10 lg:grid-cols-[5fr_6fr]">
            {/* ==================== PANNEAU GAUCHE ==================== */}
            <aside
              className="relative hidden overflow-hidden p-10 text-white lg:flex lg:flex-col lg:justify-between xl:p-12"
              style={{
                background: 'linear-gradient(155deg, var(--jr-panneau-1) 0%, var(--jr-panneau-2) 60%, var(--jr-panneau-3) 100%)',
              }}
            >
              {/* Décors */}
              <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-white/10" aria-hidden="true" />
              <div className="pointer-events-none absolute -bottom-32 -left-28 h-96 w-96 rounded-full bg-white/10" aria-hidden="true" />
              <div
                className="pointer-events-none absolute right-10 top-1/2 h-40 w-40 rounded-full opacity-25 blur-2xl"
                style={{ backgroundColor: COULEURS.elec }}
                aria-hidden="true"
              />
              <Droplets
                size={120}
                strokeWidth={1}
                className="pointer-events-none absolute -bottom-4 right-6 text-white/10"
                aria-hidden="true"
              />

              <div className="relative">
                {/* Logo sur pastille blanche pour rester lisible sur le bleu */}
                <div className="mb-10 inline-flex rounded-md bg-white px-4 py-3 shadow-lg shadow-black/10">
                  <img
                    src={LOGO}
                    alt="Logo JIRAMA"
                    className="h-14 w-auto object-contain"
                  />
                </div>

                <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-blue-50">
                  <ShieldCheck size={16} aria-hidden="true" />
                  Application web sécurisée
                </div>

                <h1 className="mt-6 text-4xl font-bold leading-tight xl:text-[2.6rem]">
                  Gérez les consommations d’eau et d’électricité
                </h1>

                <p className="mt-5 max-w-md text-base leading-7 text-blue-100">
                  Relevés, historique, statistiques et alertes : tout votre suivi
                  JIRAMA dans une seule interface.
                </p>
              </div>

              <div className="relative mt-10 space-y-3">
                <Avantage
                  Icone={Droplets}
                  titre="Suivi de l’eau"
                  texte="Relevés en m³ et historique mensuel"
                  couleur="var(--jr-av-eau)"
                />
                <Avantage
                  Icone={Zap}
                  titre="Suivi de l’électricité"
                  texte="Relevés en kWh et comparaisons"
                  couleur={COULEURS.elec}
                />
                <Avantage
                  Icone={Activity}
                  titre="Analyse et anomalies"
                  texte="Statistiques, graphiques et alertes"
                  couleur="var(--jr-av-analyse)"
                />
              </div>
            </aside>

            {/* ==================== COLONNE FORMULAIRE ==================== */}
            <main className="flex items-center justify-center p-6 sm:p-10 xl:p-14">
              <div
                className={`w-full max-w-md ${secousse ? 'jr-secousse' : ''}`}
                onAnimationEnd={() => setSecousse(false)}
              >
                {/* Logo mobile */}
                <div className="mb-8 flex justify-center lg:hidden">
                  <span className="rounded-md bg-white px-3 py-2 shadow-sm ring-1 ring-black/5">
                      <img
                        src={LOGO}
                        alt="Logo JIRAMA"
                        className="h-14 w-auto object-contain"
                      />
                    </span>
                </div>

                <div className="mb-7">
                  <h2 className="text-3xl font-bold" style={{ color: COULEURS.titre }}>
                    Bienvenue
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-jr-doux">
                    Connectez-vous à votre espace de travail JIRAMA.
                  </p>
                </div>

                {/* Erreur globale */}
                {erreurGlobale && (
                  <div
                    role="alert"
                    className="mb-5 flex items-start gap-3 rounded-md border border-jr-err-bordure bg-jr-err-pale px-4 py-3"
                  >
                    <AlertCircle size={19} className="mt-0.5 shrink-0 text-jr-err" aria-hidden="true" />
                    <p className="text-sm leading-5 text-jr-err">{erreurGlobale}</p>
                  </div>
                )}

                <form onSubmit={handleSubmit} noValidate className="space-y-5">
                  {/* Identifiant */}
                  <div>
                    <label
                      htmlFor="identifiant"
                      className="mb-1.5 block text-sm font-semibold text-jr-texte"
                    >
                      Identifiant ou e-mail
                    </label>

                    <div className="relative">
                      <User
                        size={19}
                        aria-hidden="true"
                        className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-jr-faible"
                      />

                      <input
                        id="identifiant"
                        name="identifiant"
                        ref={refIdentifiant}
                        type="text"
                        value={identifiant}
                        onChange={(e) => {
                          setIdentifiant(e.target.value);
                          setErreurGlobale('');
                        }}
                        onBlur={handleBlur('identifiant')}
                        placeholder="Ex. admin ou admin@jirama.mg"
                        autoComplete="username"
                        autoCapitalize="none"
                        spellCheck={false}
                        disabled={chargement}
                        required
                        aria-invalid={erreurDe('identifiant') ? 'true' : 'false'}
                        aria-describedby={erreurDe('identifiant') ? 'identifiant-err' : undefined}
                        className={`jr-field w-full rounded-md border py-3.5 pl-11 pr-4 text-sm text-jr-texte placeholder:text-jr-faible disabled:cursor-not-allowed disabled:opacity-60 ${classeChamp('identifiant')}`}
                      />
                    </div>

                    <MessageChamp id="identifiant" erreur={erreurDe('identifiant')} />
                  </div>

                  {/* Mot de passe */}
                  <div>
                    <label
                      htmlFor="motDePasse"
                      className="mb-1.5 block text-sm font-semibold text-jr-texte"
                    >
                      Mot de passe
                    </label>

                    <div className="relative">
                      <Lock
                        size={19}
                        aria-hidden="true"
                        className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-jr-faible"
                      />

                      <input
                        id="motDePasse"
                        name="motDePasse"
                        ref={refMotDePasse}
                        type={afficherMdp ? 'text' : 'password'}
                        value={motDePasse}
                        onChange={(e) => {
                          setMotDePasse(e.target.value);
                          setErreurGlobale('');
                        }}
                        onBlur={(e) => {
                          setMajActive(false);
                          handleBlur('motDePasse')(e);
                        }}
                        onKeyDown={detecterMaj}
                        onKeyUp={detecterMaj}
                        placeholder="Votre mot de passe"
                        autoComplete="current-password"
                        disabled={chargement}
                        required
                        aria-invalid={erreurDe('motDePasse') ? 'true' : 'false'}
                        aria-describedby={erreurDe('motDePasse') ? 'motDePasse-err' : undefined}
                        className={`jr-field w-full rounded-md border py-3.5 pl-11 pr-12 text-sm text-jr-texte placeholder:text-jr-faible disabled:cursor-not-allowed disabled:opacity-60 ${classeChamp('motDePasse')}`}
                      />

                      <button
                        type="button"
                        onClick={() => setAfficherMdp((v) => !v)}
                        disabled={chargement}
                        aria-label={afficherMdp ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                        aria-pressed={afficherMdp}
                        className="jr-lien absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-jr-faible transition hover:text-jr-texte disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {afficherMdp ? <EyeOff size={19} /> : <Eye size={19} />}
                      </button>
                    </div>

                    {majActive && (
                      <p
                        role="status"
                        className="mt-1.5 flex items-center gap-1.5 text-xs font-medium"
                        style={{ color: COULEURS.attention }}
                      >
                        <AlertCircle size={14} aria-hidden="true" />
                        Verr. Maj activée
                      </p>
                    )}

                    <MessageChamp id="motDePasse" erreur={erreurDe('motDePasse')} />
                  </div>

                  {/* Bouton principal */}
                  <button
                    type="submit"
                    disabled={chargement}
                    className="jr-btn flex w-full items-center justify-center gap-2 rounded-md px-4 py-3.5 text-sm font-bold transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:translate-y-0"
                    style={{
                      backgroundColor: COULEURS.elec,
                      color: COULEURS.surElec,
                      boxShadow: `0 12px 24px -12px ${COULEURS.elec}`,
                      opacity: chargement ? 0.85 : 1,
                    }}
                    onMouseEnter={(e) => {
                      if (!chargement) e.currentTarget.style.backgroundColor = COULEURS.elecFonce;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = COULEURS.elec;
                    }}
                  >
                    {chargement ? (
                      <>
                        <span
                          className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent"
                          style={{ color: COULEURS.surElec }}
                          aria-hidden="true"
                        />
                        Connexion en cours…
                      </>
                    ) : (
                      <>
                        <LogIn size={19} aria-hidden="true" />
                        Se connecter
                      </>
                    )}
                  </button>
                </form>

                {/* Création de compte */}
                <div className="mt-7 border-t border-jr-bordure pt-6 text-center">
                  <p className="text-sm text-jr-doux">
                    Vous n’avez pas de compte ?{' '}
                    <button
                      type="button"
                      onClick={() => navigate('/register')}
                      disabled={chargement}
                      className="jr-lien inline-flex items-center gap-1 font-semibold underline-offset-4 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                      style={{ color: COULEURS.lien }}
                    >
                      <UserPlus size={15} aria-hidden="true" />
                      Créer un compte
                    </button>
                  </p>
                </div>
              </div>
            </main>
          </div>

          <p className="mt-5 text-center text-xs text-jr-doux">
            Application web JIRAMA — Suivi et analyse des consommations
          </p>
        </div>
      </div>
    </FondJirama>
  );
}

export default Login;
