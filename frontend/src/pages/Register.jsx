import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  UserPlus,
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Droplets,
  Zap,
  ArrowLeft,
  ShieldCheck,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';

import axiosClient from '../api/axiosClient';

function Register() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    nom: '',
    prenom: '',
    identifiant: '',
    email: '',
    mot_de_passe: '',
    role: 'AGENT',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const [erreur, setErreur] = useState('');
  const [succes, setSucces] = useState('');

  // ==============================
  // Gestion des champs
  // ==============================
  const handleChange = (e) => {
    const { name, value } = e.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));

    setErreur('');
    setSucces('');
  };

  // ==============================
  // Validation e-mail
  // ==============================
  const isValidEmail = (email) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  // ==============================
  // Soumission du formulaire
  // ==============================
  const handleSubmit = async (e) => {
    e.preventDefault();

    setErreur('');
    setSucces('');

    const nom = form.nom.trim();
    const prenom = form.prenom.trim();
    const identifiant = form.identifiant.trim();
    const email = form.email.trim().toLowerCase();
    const mot_de_passe = form.mot_de_passe;
    const role = form.role;

    // Vérification des champs
    if (
      !nom ||
      !prenom ||
      !identifiant ||
      !email ||
      !mot_de_passe ||
      !role
    ) {
      setErreur('Veuillez remplir tous les champs obligatoires.');
      return;
    }

    // Vérification du nom
    if (nom.length < 2) {
      setErreur('Le nom doit contenir au moins 2 caractères.');
      return;
    }

    // Vérification du prénom
    if (prenom.length < 2) {
      setErreur('Le prénom doit contenir au moins 2 caractères.');
      return;
    }

    // Vérification de l'identifiant
    if (identifiant.length < 3) {
      setErreur('L’identifiant doit contenir au moins 3 caractères.');
      return;
    }

    // Vérification de l'e-mail
    if (!isValidEmail(email)) {
      setErreur('Veuillez saisir une adresse e-mail valide.');
      return;
    }

    // Vérification du mot de passe
    if (mot_de_passe.length < 8) {
      setErreur(
        'Le mot de passe doit contenir au moins 8 caractères.'
      );
      return;
    }

    // Vérification du rôle
    if (!['AGENT', 'RESPONSABLE'].includes(role)) {
      setErreur('Le rôle sélectionné est invalide.');
      return;
    }

    setLoading(true);

    try {
      const response = await axiosClient.post('/auth/register', {
        nom,
        prenom,
        identifiant,
        email,
        mot_de_passe,
        role,
      });

      setSucces(
        response.data?.message ||
          'Compte créé avec succès.'
      );

      // Réinitialisation du formulaire
      setForm({
        nom: '',
        prenom: '',
        identifiant: '',
        email: '',
        mot_de_passe: '',
        role: 'AGENT',
      });

      setShowPassword(false);

      // Retour automatique vers connexion après 1,5 seconde
      setTimeout(() => {
        navigate('/');
      }, 1500);

    } catch (error) {
      console.error(
        'Erreur création compte :',
        error
      );

      const status = error.response?.status;
      const message = error.response?.data?.message;

      if (status === 400) {
        setErreur(
          message ||
            'Les informations saisies sont invalides.'
        );
      } else if (status === 409) {
        setErreur(
          message ||
            'Cet identifiant ou cette adresse e-mail existe déjà.'
        );
      } else if (status === 500) {
        setErreur(
          message ||
            'Erreur interne du serveur. Vérifiez le backend et PostgreSQL.'
        );
      } else if (
        error.code === 'ERR_NETWORK' ||
        !error.response
      ) {
        setErreur(
          'Impossible de contacter le serveur. Vérifiez que le backend est démarré sur le port 5000.'
        );
      } else {
        setErreur(
          message ||
            'Une erreur est survenue lors de la création du compte.'
        );
      }

    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-100">

      {/* ==============================
          ARRIÈRE-PLAN
      =============================== */}
      <div className="absolute inset-0">
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-blue-200/40 blur-3xl" />

        <div className="absolute -right-32 top-20 h-96 w-96 rounded-full bg-cyan-200/40 blur-3xl" />

        <div className="absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-blue-100/50 blur-3xl" />
      </div>

      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-8">

        <div className="w-full max-w-5xl">

          <div className="grid overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl lg:grid-cols-2">

            {/* ==============================
                PANNEAU GAUCHE
            =============================== */}
            <div className="relative hidden min-h-[700px] overflow-hidden bg-gradient-to-br from-blue-900 via-blue-700 to-cyan-600 p-10 text-white lg:flex lg:flex-col lg:justify-between">

              <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-white/10" />

              <div className="absolute -bottom-28 -left-24 h-96 w-96 rounded-full bg-white/10" />

              <div className="relative z-10">

                {/* Logo */}
                <div className="mb-12">
                  <img
                    src="/images/jirama-logo.png"
                    alt="Logo JIRAMA"
                    className="h-20 w-auto object-contain"
                  />
                </div>

                <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-blue-50">
                  <ShieldCheck size={15} />
                  Création de compte
                </div>

                <h1 className="mt-6 text-4xl font-bold leading-tight xl:text-5xl">
                  Rejoindre l'application
                </h1>

                <p className="mt-6 max-w-lg text-base leading-7 text-blue-100">
                  Créez votre compte pour accéder à l'espace
                  de suivi et d'analyse des consommations
                  d'eau et d'électricité.
                </p>
              </div>

              {/* Informations */}
              <div className="relative z-10 space-y-3">

                <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur-sm">

                  <div className="rounded-xl bg-white/10 p-3">
                    <Droplets size={21} />
                  </div>

                  <div>
                    <p className="font-semibold">
                      Suivi de l'eau
                    </p>

                    <p className="text-sm text-blue-100">
                      Relevés et historique
                    </p>
                  </div>

                </div>

                <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur-sm">

                  <div className="rounded-xl bg-white/10 p-3">
                    <Zap size={21} />
                  </div>

                  <div>
                    <p className="font-semibold">
                      Suivi de l'électricité
                    </p>

                    <p className="text-sm text-blue-100">
                      Analyse des consommations
                    </p>
                  </div>

                </div>

              </div>
            </div>

            {/* ==============================
                FORMULAIRE
            =============================== */}
            <div className="flex items-center justify-center p-6 sm:p-10 lg:p-12">

              <div className="w-full max-w-md">

                {/* Retour */}
                <button
                  type="button"
                  onClick={() => navigate('/')}
                  disabled={loading}
                  className="mb-7 flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ArrowLeft size={17} />
                  Retour à la connexion
                </button>

                {/* Logo mobile */}
                <div className="mb-7 flex justify-center lg:hidden">
                  <img
                    src="/images/jirama-logo.png"
                    alt="Logo JIRAMA"
                    className="h-20 w-auto object-contain"
                  />
                </div>

                {/* Titre */}
                <div className="mb-7">

                  <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700">
                    <UserPlus size={15} />
                    Nouveau compte
                  </div>

                  <h2 className="text-3xl font-bold text-slate-900">
                    Créer un compte
                  </h2>

                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    Remplissez le formulaire pour créer votre
                    compte utilisateur.
                  </p>

                </div>

                {/* Message succès */}
                {succes && (
                  <div className="mb-5 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                    <CheckCircle
                      size={19}
                      className="mt-0.5 shrink-0 text-emerald-600"
                    />

                    <p className="text-sm leading-5 text-emerald-700">
                      {succes}
                    </p>
                  </div>
                )}

                {/* Message erreur */}
                {erreur && (
                  <div className="mb-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                    <AlertCircle
                      size={19}
                      className="mt-0.5 shrink-0 text-red-600"
                    />

                    <p className="text-sm leading-5 text-red-700">
                      {erreur}
                    </p>
                  </div>
                )}

                {/* Formulaire */}
                <form
                  onSubmit={handleSubmit}
                  className="space-y-5"
                >

                  {/* Nom + prénom */}
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">

                    {/* Nom */}
                    <div>
                      <label
                        htmlFor="nom"
                        className="mb-2 block text-sm font-semibold text-slate-700"
                      >
                        Nom
                      </label>

                      <div className="relative">
                        <User
                          size={18}
                          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                        />

                        <input
                          id="nom"
                          name="nom"
                          type="text"
                          value={form.nom}
                          onChange={handleChange}
                          placeholder="Nom"
                          autoComplete="family-name"
                          disabled={loading}
                          required
                          className="w-full rounded-xl border border-slate-300 bg-slate-50 py-3.5 pl-10 pr-3 text-sm outline-none transition focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-100"
                        />
                      </div>
                    </div>

                    {/* Prénom */}
                    <div>
                      <label
                        htmlFor="prenom"
                        className="mb-2 block text-sm font-semibold text-slate-700"
                      >
                        Prénom
                      </label>

                      <input
                        id="prenom"
                        name="prenom"
                        type="text"
                        value={form.prenom}
                        onChange={handleChange}
                        placeholder="Prénom"
                        autoComplete="given-name"
                        disabled={loading}
                        required
                        className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3.5 text-sm outline-none transition focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-100"
                      />
                    </div>

                  </div>

                  {/* Identifiant */}
                  <div>
                    <label
                      htmlFor="identifiant"
                      className="mb-2 block text-sm font-semibold text-slate-700"
                    >
                      Identifiant
                    </label>

                    <div className="relative">
                      <User
                        size={18}
                        className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                      />

                      <input
                        id="identifiant"
                        name="identifiant"
                        type="text"
                        value={form.identifiant}
                        onChange={handleChange}
                        placeholder="Ex. agent01"
                        autoComplete="username"
                        disabled={loading}
                        required
                        className="w-full rounded-xl border border-slate-300 bg-slate-50 py-3.5 pl-10 pr-4 text-sm outline-none transition focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-100"
                      />
                    </div>
                  </div>

                  {/* Email */}
                  <div>
                    <label
                      htmlFor="email"
                      className="mb-2 block text-sm font-semibold text-slate-700"
                    >
                      Adresse e-mail
                    </label>

                    <div className="relative">
                      <Mail
                        size={18}
                        className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                      />

                      <input
                        id="email"
                        name="email"
                        type="email"
                        value={form.email}
                        onChange={handleChange}
                        placeholder="exemple@jirama.mg"
                        autoComplete="email"
                        disabled={loading}
                        required
                        className="w-full rounded-xl border border-slate-300 bg-slate-50 py-3.5 pl-10 pr-4 text-sm outline-none transition focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-100"
                      />
                    </div>
                  </div>

                  {/* Mot de passe */}
                  <div>
                    <label
                      htmlFor="mot_de_passe"
                      className="mb-2 block text-sm font-semibold text-slate-700"
                    >
                      Mot de passe
                    </label>

                    <div className="relative">
                      <Lock
                        size={18}
                        className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                      />

                      <input
                        id="mot_de_passe"
                        name="mot_de_passe"
                        type={showPassword ? 'text' : 'password'}
                        value={form.mot_de_passe}
                        onChange={handleChange}
                        placeholder="Minimum 8 caractères"
                        autoComplete="new-password"
                        disabled={loading}
                        required
                        minLength={8}
                        className="w-full rounded-xl border border-slate-300 bg-slate-50 py-3.5 pl-10 pr-12 text-sm outline-none transition focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-100"
                      />

                      <button
                        type="button"
                        onClick={() =>
                          setShowPassword(
                            (current) => !current
                          )
                        }
                        disabled={loading}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                        aria-label={
                          showPassword
                            ? 'Masquer le mot de passe'
                            : 'Afficher le mot de passe'
                        }
                      >
                        {showPassword ? (
                          <EyeOff size={18} />
                        ) : (
                          <Eye size={18} />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Rôle */}
                  <div>
                    <label
                      htmlFor="role"
                      className="mb-2 block text-sm font-semibold text-slate-700"
                    >
                      Rôle
                    </label>

                    <select
                      id="role"
                      name="role"
                      value={form.role}
                      onChange={handleChange}
                      disabled={loading}
                      required
                      className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3.5 text-sm outline-none transition focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-100"
                    >
                      <option value="AGENT">
                        Agent de relevé
                      </option>

                      <option value="RESPONSABLE">
                        Responsable
                      </option>
                    </select>

                    <p className="mt-2 text-xs text-slate-400">
                      Administrateur non disponible dans
                      l'inscription publique.
                    </p>
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
                        Création en cours...
                      </>
                    ) : (
                      <>
                        <UserPlus size={19} />
                        Créer le compte
                      </>
                    )}
                  </button>

                </form>

                {/* Retour connexion */}
                <div className="mt-7 border-t border-slate-100 pt-6 text-center">
                  <p className="text-sm text-slate-500">
                    Vous avez déjà un compte ?{' '}

                    <button
                      type="button"
                      onClick={() => navigate('/')}
                      disabled={loading}
                      className="font-semibold text-blue-600 hover:text-blue-700 hover:underline disabled:opacity-50"
                    >
                      Se connecter
                    </button>
                  </p>
                </div>

                {/* Bas */}
                <div className="mt-6 flex items-center justify-center gap-5 text-xs text-slate-400">

                  <span className="flex items-center gap-1.5">
                    <Droplets size={14} />
                    Eau
                  </span>

                  <span className="flex items-center gap-1.5">
                    <Zap size={14} />
                    Électricité
                  </span>

                </div>

              </div>
            </div>

          </div>

          <p className="mt-5 text-center text-xs text-slate-400">
            Application web JIRAMA — Suivi et analyse des consommations
          </p>

        </div>
      </div>
    </div>
  );
}

export default Register;