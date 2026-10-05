import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  User,
  Lock,
  Eye,
  EyeOff,
  LogIn,
  Droplets,
  Zap,
  Activity,
  ShieldCheck,
  AlertCircle,
  UserPlus,
} from 'lucide-react';

import axiosClient from '../api/axiosClient';

function Login() {
  const navigate = useNavigate();

  const [identifiant, setIdentifiant] = useState('');
  const [motDePasse, setMotDePasse] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const [erreur, setErreur] = useState('');
  const [succes, setSucces] = useState('');

  // ==========================================
  // Connexion
  // ==========================================
  const handleSubmit = async (e) => {
    e.preventDefault();

    setErreur('');
    setSucces('');

    const identifiantNettoye = identifiant.trim();
    const motDePasseNettoye = motDePasse;

    // ------------------------------------------
    // Validation
    // ------------------------------------------
    if (!identifiantNettoye) {
      setErreur('Veuillez saisir votre identifiant ou votre e-mail.');
      return;
    }

    if (!motDePasseNettoye) {
      setErreur('Veuillez saisir votre mot de passe.');
      return;
    }

    // ------------------------------------------
    // Empêcher les anciennes données de session
    // ------------------------------------------
    localStorage.removeItem('token');
    localStorage.removeItem('user');

    setLoading(true);

    try {
      // ----------------------------------------
      // Appel API
      // ----------------------------------------
      const response = await axiosClient.post('/auth/login', {
        identifiant: identifiantNettoye,
        mot_de_passe: motDePasseNettoye,
      });

      // ----------------------------------------
      // Vérification réponse serveur
      // ----------------------------------------
      const token = response.data?.token;
      const user = response.data?.user;

      if (!token || !user) {
        throw new Error(
          'La réponse du serveur est invalide.'
        );
      }

      // ----------------------------------------
      // Vérification du rôle
      // ----------------------------------------
      const role = String(user.role || '')
        .trim()
        .toUpperCase();

      const rolesAutorises = [
        'ADMINISTRATEUR',
        'AGENT',
        'RESPONSABLE',
      ];

      if (!rolesAutorises.includes(role)) {
        setErreur(
          `Rôle utilisateur non reconnu : ${user.role || 'inconnu'}.`
        );
        return;
      }

      // ----------------------------------------
      // Vérification des informations utilisateur
      // ----------------------------------------
      const userConnecte = {
        ...user,
        role,
      };

      // ----------------------------------------
      // Sauvegarde de la session
      // ----------------------------------------
      localStorage.setItem('token', token);
      localStorage.setItem(
        'user',
        JSON.stringify(userConnecte)
      );

      setSucces(
        `Connexion réussie. Bienvenue ${user.prenom || ''} !`
      );

      // ----------------------------------------
      // Redirection selon le rôle
      // ----------------------------------------
      switch (role) {
        case 'ADMINISTRATEUR':
          navigate('/dashboard/admin', {
            replace: true,
          });
          break;

        case 'AGENT':
          navigate('/dashboard/agent', {
            replace: true,
          });
          break;

        case 'RESPONSABLE':
          navigate('/dashboard/responsable', {
            replace: true,
          });
          break;

        default:
          localStorage.removeItem('token');
          localStorage.removeItem('user');

          setSucces('');
          setErreur('Rôle utilisateur non reconnu.');
      }

    } catch (error) {
      console.error(
        'Erreur de connexion :',
        error
      );

      // ----------------------------------------
      // Erreur 400
      // ----------------------------------------
      if (error.response?.status === 400) {
        setErreur(
          error.response?.data?.message ||
            'Les données envoyées sont invalides.'
        );
      }

      // ----------------------------------------
      // Erreur 401
      // ----------------------------------------
      else if (error.response?.status === 401) {
        setErreur(
          error.response?.data?.message ||
            'Identifiant ou mot de passe incorrect.'
        );
      }

      // ----------------------------------------
      // Erreur 403
      // ----------------------------------------
      else if (error.response?.status === 403) {
        setErreur(
          error.response?.data?.message ||
            'Votre compte est désactivé ou l’accès est refusé.'
        );
      }

      // ----------------------------------------
      // Erreur 404
      // ----------------------------------------
      else if (error.response?.status === 404) {
        setErreur(
          'Service de connexion introuvable. Vérifiez la route /api/auth/login.'
        );
      }

      // ----------------------------------------
      // Erreur 500
      // ----------------------------------------
      else if (error.response?.status >= 500) {
        setErreur(
          'Erreur interne du serveur. Vérifiez le backend et PostgreSQL.'
        );
      }

      // ----------------------------------------
      // Backend inaccessible
      // ----------------------------------------
      else if (
        error.code === 'ERR_NETWORK' ||
        !error.response
      ) {
        setErreur(
          'Impossible de contacter le serveur. Vérifiez que Node.js est démarré sur le port 5000.'
        );
      }

      // ----------------------------------------
      // Autre erreur
      // ----------------------------------------
      else {
        setErreur(
          error.response?.data?.message ||
            'Une erreur est survenue pendant la connexion.'
        );
      }

    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-100">

      {/* ======================================
          ARRIÈRE-PLAN
      ======================================= */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-blue-200/40 blur-3xl" />

        <div className="absolute -right-32 top-20 h-96 w-96 rounded-full bg-cyan-200/40 blur-3xl" />

        <div className="absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-blue-100/50 blur-3xl" />
      </div>

      {/* ======================================
          CONTENU PRINCIPAL
      ======================================= */}
      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-8">

        <div className="w-full max-w-6xl">

          <div className="grid overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl lg:grid-cols-2">

            {/* ==================================
                PANNEAU GAUCHE
            =================================== */}
            <div className="relative hidden min-h-[680px] overflow-hidden bg-gradient-to-br from-blue-900 via-blue-700 to-cyan-600 p-10 text-white lg:flex lg:flex-col lg:justify-between">

              {/* Décoration */}
              <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-white/10" />

              <div className="absolute -bottom-28 -left-24 h-96 w-96 rounded-full bg-white/10" />

              <div className="relative z-10">

                {/* Logo */}
                <div className="mb-12">
                  <img
                    src="/images/Jirama.png"
                    alt="Logo JIRAMA"
                    className="h-20 w-auto object-contain"
                  />
                </div>

                {/* Badge */}
                <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-blue-50">
                  <ShieldCheck size={15} />
                  Application web
                </span>

                {/* Titre */}
                <h1 className="mt-6 max-w-lg text-4xl font-bold leading-tight xl:text-5xl">
                  Gestion des consommations
                </h1>

                <p className="mt-6 max-w-lg text-base leading-7 text-blue-100">
                  Suivi et analyse des consommations d'eau
                  et d'électricité à travers une interface
                  moderne, simple et sécurisée.
                </p>
              </div>

              {/* Fonctionnalités */}
              <div className="relative z-10 space-y-3">

                {/* Eau */}
                <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur-sm">

                  <div className="rounded-xl bg-white/10 p-3">
                    <Droplets size={21} />
                  </div>

                  <div>
                    <h3 className="font-semibold">
                      Suivi de l'eau
                    </h3>

                    <p className="text-sm text-blue-100">
                      Relevés et historique des consommations
                    </p>
                  </div>

                </div>

                {/* Électricité */}
                <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur-sm">

                  <div className="rounded-xl bg-white/10 p-3">
                    <Zap size={21} />
                  </div>

                  <div>
                    <h3 className="font-semibold">
                      Suivi de l'électricité
                    </h3>

                    <p className="text-sm text-blue-100">
                      Analyse et évolution des consommations
                    </p>
                  </div>

                </div>

                {/* Analyse */}
                <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur-sm">

                  <div className="rounded-xl bg-white/10 p-3">
                    <Activity size={21} />
                  </div>

                  <div>
                    <h3 className="font-semibold">
                      Analyse et anomalies
                    </h3>

                    <p className="text-sm text-blue-100">
                      Statistiques, graphiques et alertes
                    </p>
                  </div>

                </div>

              </div>
            </div>

            {/* ==================================
                PANNEAU DROIT
            =================================== */}
            <div className="flex items-center justify-center p-6 sm:p-10 lg:p-14">

              <div className="w-full max-w-md">

                {/* Logo mobile */}
                <div className="mb-8 flex justify-center lg:hidden">
                  <img
                    src="/images/jirama-logo.png"
                    alt="Logo JIRAMA"
                    className="h-20 w-auto object-contain"
                  />
                </div>

                {/* En-tête */}
                <div className="mb-8">

                  <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700">
                    <ShieldCheck size={15} />
                    Accès sécurisé
                  </div>

                  <h2 className="text-3xl font-bold tracking-tight text-slate-900">
                    Bienvenue
                  </h2>

                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    Connectez-vous à votre espace de travail
                    JIRAMA.
                  </p>

                </div>

                {/* ===============================
                    MESSAGE ERREUR
                ================================ */}
                {erreur && (
                  <div
                    className="mb-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3"
                    role="alert"
                  >
                    <AlertCircle
                      size={19}
                      className="mt-0.5 shrink-0 text-red-600"
                    />

                    <p className="text-sm leading-5 text-red-700">
                      {erreur}
                    </p>
                  </div>
                )}

                {/* ===============================
                    MESSAGE SUCCÈS
                ================================ */}
                {succes && (
                  <div
                    className="mb-5 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3"
                    role="status"
                  >
                    <ShieldCheck
                      size={19}
                      className="mt-0.5 shrink-0 text-emerald-600"
                    />

                    <p className="text-sm leading-5 text-emerald-700">
                      {succes}
                    </p>
                  </div>
                )}

                {/* ===============================
                    FORMULAIRE
                ================================ */}
                <form
                  onSubmit={handleSubmit}
                  className="space-y-5"
                >

                  {/* Identifiant */}
                  <div>

                    <label
                      htmlFor="identifiant"
                      className="mb-2 block text-sm font-semibold text-slate-700"
                    >
                      Identifiant ou e-mail
                    </label>

                    <div className="group relative">

                      <User
                        size={19}
                        className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 transition group-focus-within:text-blue-600"
                      />

                      <input
                        id="identifiant"
                        name="identifiant"
                        type="text"
                        value={identifiant}
                        onChange={(e) => {
                          setIdentifiant(e.target.value);
                          setErreur('');
                          setSucces('');
                        }}
                        placeholder="Ex. admin ou admin@jirama.mg"
                        autoComplete="username"
                        disabled={loading}
                        required
                        className="w-full rounded-xl border border-slate-300 bg-slate-50 py-3.5 pl-11 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                      />

                    </div>
                  </div>

                  {/* Mot de passe */}
                  <div>

                    <label
                      htmlFor="motDePasse"
                      className="mb-2 block text-sm font-semibold text-slate-700"
                    >
                      Mot de passe
                    </label>

                    <div className="group relative">

                      <Lock
                        size={19}
                        className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 transition group-focus-within:text-blue-600"
                      />

                      <input
                        id="motDePasse"
                        name="motDePasse"
                        type={
                          showPassword
                            ? 'text'
                            : 'password'
                        }
                        value={motDePasse}
                        onChange={(e) => {
                          setMotDePasse(e.target.value);
                          setErreur('');
                          setSucces('');
                        }}
                        placeholder="Votre mot de passe"
                        autoComplete="current-password"
                        disabled={loading}
                        required
                        className="w-full rounded-xl border border-slate-300 bg-slate-50 py-3.5 pl-11 pr-12 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                      />

                      <button
                        type="button"
                        onClick={() =>
                          setShowPassword(
                            (current) => !current
                          )
                        }
                        disabled={loading}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 transition hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                        aria-label={
                          showPassword
                            ? 'Masquer le mot de passe'
                            : 'Afficher le mot de passe'
                        }
                      >
                        {showPassword ? (
                          <EyeOff size={19} />
                        ) : (
                          <Eye size={19} />
                        )}
                      </button>

                    </div>
                  </div>

                  {/* Bouton */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-blue-600/30 focus:outline-none focus:ring-4 focus:ring-blue-200 disabled:cursor-not-allowed disabled:translate-y-0 disabled:opacity-60"
                  >

                    {loading ? (
                      <>
                        <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                        Connexion en cours...
                      </>
                    ) : (
                      <>
                        <LogIn size={19} />
                        Se connecter
                      </>
                    )}

                  </button>

                </form>

                {/* ===============================
                    CRÉATION DE COMPTE
                ================================ */}
                <div className="mt-7 border-t border-slate-100 pt-6 text-center">

                  <p className="text-sm text-slate-500">
                    Vous n'avez pas de compte ?{' '}

                    <button
                      type="button"
                      onClick={() => navigate('/register')}
                      disabled={loading}
                      className="inline-flex items-center gap-1 font-semibold text-blue-600 transition hover:text-blue-700 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <UserPlus size={15} />
                      Créer un compte
                    </button>
                  </p>

                </div>

                {/* Informations */}
                <div className="mt-7 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 border-t border-slate-100 pt-5 text-xs text-slate-400">

                  <span className="flex items-center gap-1.5">
                    <Droplets size={14} />
                    Eau
                  </span>

                  <span className="flex items-center gap-1.5">
                    <Zap size={14} />
                    Électricité
                  </span>

                  <span className="flex items-center gap-1.5">
                    <Activity size={14} />
                    Analyse
                  </span>

                </div>

              </div>
            </div>

          </div>

          {/* Pied de page */}
          <p className="mt-5 text-center text-xs text-slate-400">
            Application web JIRAMA — Suivi et analyse des consommations
          </p>

        </div>
      </div>
    </div>
  );
}

export default Login;