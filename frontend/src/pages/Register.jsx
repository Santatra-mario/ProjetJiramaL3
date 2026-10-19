import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';

import {
  AlertCircle,
  ArrowLeft,
  BarChart3,
  Check,
  CheckCircle2,
  ClipboardList,
  Droplets,
  Eye,
  EyeOff,
  Lock,
  Mail,
  ShieldCheck,
  User,
  UserPlus,
  X,
  XCircle,
  Zap,
} from 'lucide-react';

import axiosClient from '../api/axiosClient';
import BoutonTheme from '../components/BoutonTheme.jsx';
import FondJirama from '../components/FondJirama.jsx';
import { COULEURS } from '../theme/couleurs.js';

/* =========================================================
   CONSTANTES
========================================================= */
const REDIRECTION_SECONDES = 3;
const ORDRE_CHAMPS = [
  'nom',
  'prenom',
  'identifiant',
  'email',
  'mot_de_passe',
  'confirmation',
  'role',
];

const FORM_INITIAL = {
  nom: '',
  prenom: '',
  identifiant: '',
  email: '',
  mot_de_passe: '',
  confirmation: '',
  role: 'AGENT',
};

const REGEX_NOM = /^[A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ\s'’-]*$/;
const REGEX_IDENTIFIANT = /^[A-Za-z0-9._-]{3,30}$/;
const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ROLES = [
  {
    valeur: 'AGENT',
    titre: 'Agent de relevé',
    description: 'Saisit les relevés d’eau et d’électricité.',
    Icone: ClipboardList,
  },
  {
    valeur: 'RESPONSABLE',
    titre: 'Responsable',
    description: 'Suit, contrôle et analyse les consommations.',
    Icone: BarChart3,
  },
];

/* =========================================================
   FONCTIONS UTILITAIRES
========================================================= */

// Critères du mot de passe (affichés dans la checklist)
const critèresMotDePasse = (mdp) => [
  { cle: 'longueur', libelle: '8 caractères minimum', ok: mdp.length >= 8 },
  { cle: 'majuscule', libelle: 'Une majuscule', ok: /[A-Z]/.test(mdp) },
  { cle: 'minuscule', libelle: 'Une minuscule', ok: /[a-z]/.test(mdp) },
  { cle: 'chiffre', libelle: 'Un chiffre', ok: /\d/.test(mdp) },
  {
    cle: 'special',
    libelle: 'Un caractère spécial (conseillé)',
    ok: /[^A-Za-z0-9]/.test(mdp),
  },
];

// Transforme « Rakoto Mario » en « mario.rakoto » (sans accents)
const slug = (texte) =>
  texte
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

const suggererIdentifiant = (prenom, nom) => {
  const p = slug(prenom.trim());
  const n = slug(nom.trim());
  return [p, n].filter(Boolean).join('.').slice(0, 30);
};

// Validation complète du formulaire : retourne { champ: message }
const valider = (form) => {
  const erreurs = {};

  const nom = form.nom.trim();
  const prenom = form.prenom.trim();
  const identifiant = form.identifiant.trim();
  const email = form.email.trim();

  if (!nom) erreurs.nom = 'Le nom est obligatoire.';
  else if (nom.length < 2)
    erreurs.nom = 'Le nom doit contenir au moins 2 caractères.';
  else if (!REGEX_NOM.test(nom))
    erreurs.nom = 'Utilisez uniquement des lettres, espaces, tirets ou apostrophes.';

  if (!prenom) erreurs.prenom = 'Le prénom est obligatoire.';
  else if (prenom.length < 2)
    erreurs.prenom = 'Le prénom doit contenir au moins 2 caractères.';
  else if (!REGEX_NOM.test(prenom))
    erreurs.prenom = 'Utilisez uniquement des lettres, espaces, tirets ou apostrophes.';

  if (!identifiant) erreurs.identifiant = 'L’identifiant est obligatoire.';
  else if (identifiant.length < 3)
    erreurs.identifiant = 'L’identifiant doit contenir au moins 3 caractères.';
  else if (identifiant.length > 30)
    erreurs.identifiant = 'L’identifiant ne doit pas dépasser 30 caractères.';
  else if (!REGEX_IDENTIFIANT.test(identifiant))
    erreurs.identifiant =
      'Lettres, chiffres, point, tiret et underscore uniquement, sans espace.';

  if (!email) erreurs.email = 'L’adresse e-mail est obligatoire.';
  else if (!REGEX_EMAIL.test(email))
    erreurs.email = 'Saisissez une adresse e-mail valide.';

  const mdp = form.mot_de_passe;
  if (!mdp) erreurs.mot_de_passe = 'Le mot de passe est obligatoire.';
  else if (mdp.length < 8)
    erreurs.mot_de_passe = 'Le mot de passe doit contenir au moins 8 caractères.';
  else if (!/[A-Z]/.test(mdp) || !/[a-z]/.test(mdp) || !/\d/.test(mdp))
    erreurs.mot_de_passe =
      'Ajoutez au moins une majuscule, une minuscule et un chiffre.';

  if (!form.confirmation)
    erreurs.confirmation = 'Confirmez votre mot de passe.';
  else if (form.confirmation !== mdp)
    erreurs.confirmation = 'Les deux mots de passe ne correspondent pas.';

  if (!['AGENT', 'RESPONSABLE'].includes(form.role))
    erreurs.role = 'Le rôle sélectionné est invalide.';

  return erreurs;
};

/* =========================================================
   COMPOSANTS INTERNES
========================================================= */

// Petit message d'erreur ou d'aide sous un champ
function MessageChamp({ id, erreur, aide }) {
  if (erreur) {
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
  if (aide) {
    return (
      <p id={`${id}-aide`} className="mt-1.5 text-xs text-jr-doux">
        {aide}
      </p>
    );
  }
  return null;
}

// Champ texte avec icône, statut ✓ / ✗ et message
function ChampTexte({
  id,
  label,
  Icone,
  erreur,
  valide,
  aide,
  inputRef,
  ...props
}) {
  const classeEtat = erreur
    ? 'jr-field--err'
    : valide
    ? 'jr-field--ok'
    : '';

  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1.5 block text-sm font-semibold text-jr-texte"
      >
        {label}
      </label>

      <div className="relative">
        {Icone && (
          <Icone
            size={18}
            aria-hidden="true"
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-jr-faible"
          />
        )}

        <input
          id={id}
          name={id}
          ref={inputRef}
          aria-invalid={erreur ? 'true' : 'false'}
          aria-describedby={erreur ? `${id}-err` : aide ? `${id}-aide` : undefined}
          className={`jr-field w-full rounded-md border py-3 pr-10 text-sm text-jr-texte placeholder:text-jr-faible disabled:cursor-not-allowed disabled:opacity-60 ${
            Icone ? 'pl-10' : 'pl-4'
          } ${classeEtat}`}
          {...props}
        />

        {erreur && (
          <XCircle
            size={18}
            aria-hidden="true"
            className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-jr-err"
          />
        )}
        {!erreur && valide && (
          <CheckCircle2
            size={18}
            aria-hidden="true"
            className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-jr-ok"
          />
        )}
      </div>

      <MessageChamp id={id} erreur={erreur} aide={aide} />
    </div>
  );
}

// Champ mot de passe avec bouton œil et alerte Verr. Maj
function ChampMotDePasse({
  id,
  label,
  erreur,
  valide,
  visible,
  onToggle,
  inputRef,
  aide,
  children,
  ...props
}) {
  const [majActive, setMajActive] = useState(false);

  const detecterMaj = (e) => {
    if (typeof e.getModifierState === 'function') {
      setMajActive(e.getModifierState('CapsLock'));
    }
  };

  const classeEtat = erreur
    ? 'jr-field--err'
    : valide
    ? 'jr-field--ok'
    : '';

  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1.5 block text-sm font-semibold text-jr-texte"
      >
        {label}
      </label>

      <div className="relative">
        <Lock
          size={18}
          aria-hidden="true"
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-jr-faible"
        />

        <input
          id={id}
          name={id}
          ref={inputRef}
          type={visible ? 'text' : 'password'}
          aria-invalid={erreur ? 'true' : 'false'}
          aria-describedby={erreur ? `${id}-err` : aide ? `${id}-aide` : undefined}
          onKeyDown={detecterMaj}
          onKeyUp={detecterMaj}
          className={`jr-field w-full rounded-md border py-3 pl-10 pr-12 text-sm text-jr-texte placeholder:text-jr-faible disabled:cursor-not-allowed disabled:opacity-60 ${classeEtat}`}
          {...props}
          onBlur={(e) => {
            setMajActive(false);
            props.onBlur?.(e);
          }}
        />

        <button
          type="button"
          onClick={onToggle}
          disabled={props.disabled}
          aria-label={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
          aria-pressed={visible}
          className="jr-lien absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-jr-faible transition hover:text-jr-texte disabled:opacity-50"
        >
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
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

      <MessageChamp id={id} erreur={erreur} aide={aide} />
      {children}
    </div>
  );
}

// Barre de force + checklist du mot de passe
function ForceMotDePasse({ motDePasse }) {
  const criteres = critèresMotDePasse(motDePasse);
  const score = criteres.filter((c) => c.ok).length;

  // Niveau de 0 à 4 (4 barres)
  let niveau = 0;
  if (motDePasse) {
    if (score <= 2) niveau = 1;
    else if (score === 3) niveau = 2;
    else if (score === 4) niveau = 3;
    else niveau = 4;
  }

  const niveaux = [
    { texte: '', couleur: 'var(--jr-bordure)' },
    { texte: 'Faible', couleur: 'var(--jr-err)' },
    { texte: 'Moyen', couleur: COULEURS.elec },
    { texte: 'Bon', couleur: COULEURS.eauClair },
    { texte: 'Excellent', couleur: 'var(--jr-ok)' },
  ];
  const actuel = niveaux[niveau];

  return (
    <div className="mt-3 rounded-md border border-jr-bordure bg-jr-surface p-3">
      <div className="flex items-center gap-3">
        <div className="flex flex-1 gap-1.5" aria-hidden="true">
          {[1, 2, 3, 4].map((i) => (
            <span
              key={i}
              className="h-1.5 flex-1 rounded-full transition-colors duration-300"
              style={{ backgroundColor: i <= niveau ? actuel.couleur : 'var(--jr-bordure)' }}
            />
          ))}
        </div>

        <span
          aria-live="polite"
          className="min-w-[4.5rem] text-right text-xs font-semibold"
          style={{ color: niveau ? actuel.couleur : COULEURS.texteDoux }}
        >
          {niveau ? actuel.texte : 'Force'}
        </span>
      </div>

      <ul className="mt-3 grid grid-cols-1 gap-x-4 gap-y-1.5 sm:grid-cols-2">
        {criteres.map((c) => (
          <li
            key={c.cle}
            className={`flex items-center gap-2 text-xs ${
              c.ok ? 'text-jr-ok' : 'text-jr-doux'
            }`}
          >
            <span
              className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${
                c.ok ? 'bg-jr-ok-pale text-jr-ok' : 'bg-jr-bordure text-jr-faible'
              }`}
              aria-hidden="true"
            >
              {c.ok ? <Check size={11} strokeWidth={3} /> : <X size={11} strokeWidth={3} />}
            </span>
            {c.libelle}
            <span className="sr-only">{c.ok ? ' : validé' : ' : manquant'}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Carte de choix du rôle (vrai radio natif, navigation clavier incluse)
function CarteRole({ role, choisi, onChange, disabled }) {
  const { valeur, titre, description, Icone } = role;

  return (
    <label
      className={`jr-role relative flex cursor-pointer flex-col gap-2 rounded-md border-2 p-4 transition ${
        disabled ? 'cursor-not-allowed opacity-60' : ''
      }`}
      style={{
        borderColor: choisi ? COULEURS.elec : 'var(--jr-bordure)',
        backgroundColor: choisi ? COULEURS.elecPale : 'var(--jr-surface)',
      }}
    >
      <input
        type="radio"
        name="role"
        value={valeur}
        checked={choisi}
        onChange={onChange}
        disabled={disabled}
        className="sr-only"
      />

      <span className="flex items-center justify-between">
        <span
          className="flex h-10 w-10 items-center justify-center rounded-md"
          style={{
            backgroundColor: choisi ? COULEURS.elec : COULEURS.eauPale,
            color: choisi ? COULEURS.surElec : COULEURS.lien,
          }}
        >
          <Icone size={20} aria-hidden="true" />
        </span>

        <span
          className="flex h-5 w-5 items-center justify-center rounded-full border-2 transition"
          style={{
            borderColor: choisi ? COULEURS.elec : 'var(--jr-bordure-forte)',
            backgroundColor: choisi ? COULEURS.elec : 'transparent',
          }}
          aria-hidden="true"
        >
          {choisi && <Check size={12} strokeWidth={3.5} color={COULEURS.surElec} />}
        </span>
      </span>

      <span className="text-sm font-bold" style={{ color: COULEURS.texte }}>
        {titre}
      </span>
      <span className="text-xs leading-5 text-jr-doux">{description}</span>
    </label>
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
   PAGE D'INSCRIPTION
========================================================= */
function Register() {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();

  // --- État du formulaire ---
  const [form, setForm] = useState(FORM_INITIAL);
  const [touche, setTouche] = useState({});
  const [soumis, setSoumis] = useState(false);
  const [identifiantManuel, setIdentifiantManuel] = useState(false);

  // --- Erreurs renvoyées par le serveur ---
  const [erreursServeur, setErreursServeur] = useState({});
  const [erreurGlobale, setErreurGlobale] = useState('');
  const [secousse, setSecousse] = useState(false);

  // --- Affichage ---
  const [afficherMdp, setAfficherMdp] = useState(false);
  const [afficherConfirmation, setAfficherConfirmation] = useState(false);
  const [chargement, setChargement] = useState(false);

  // --- Succès + compte à rebours ---
  const [succes, setSucces] = useState('');
  const [compteARebours, setCompteARebours] = useState(REDIRECTION_SECONDES);

  // --- Références ---
  const refs = useRef({});
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

  // Compte à rebours après succès
  useEffect(() => {
    if (!succes) return undefined;

    const minuteur = setInterval(() => {
      setCompteARebours((valeur) => Math.max(valeur - 1, 0));
    }, 1000);

    return () => clearInterval(minuteur);
  }, [succes]);

  // Redirection quand le compte à rebours atteint 0
  useEffect(() => {
    if (succes && compteARebours <= 0) {
      navigate('/');
    }
  }, [succes, compteARebours, navigate]);

  // --- Validation ---
  const erreursLocales = useMemo(() => valider(form), [form]);
  const formulaireValide = Object.keys(erreursLocales).length === 0;

  // Erreur à afficher pour un champ (locale après blur/soumission, ou serveur)
  const erreurDe = (champ) => {
    if (erreursServeur[champ]) return erreursServeur[champ];
    if (touche[champ] || soumis) return erreursLocales[champ] || '';
    return '';
  };

  const estValide = (champ) =>
    Boolean(touche[champ]) &&
    !erreursLocales[champ] &&
    !erreursServeur[champ] &&
    Boolean(form[champ]);

  // --- Gestion des champs ---
  const handleChange = (e) => {
    const { name, value } = e.target;

    setForm((courant) => {
      const suivant = { ...courant, [name]: value };

      // Suggestion automatique de l'identifiant tant qu'il n'est pas saisi à la main
      if ((name === 'nom' || name === 'prenom') && !identifiantManuel) {
        suivant.identifiant = suggererIdentifiant(suivant.prenom, suivant.nom);
      }
      return suivant;
    });

    if (name === 'identifiant') {
      setIdentifiantManuel(value.trim() !== '');
    }

    // Efface les erreurs serveur liées au champ modifié
    setErreursServeur((courant) => {
      if (!courant[name] && !(name === 'nom' || name === 'prenom')) return courant;
      const copie = { ...courant };
      delete copie[name];
      if ((name === 'nom' || name === 'prenom') && !identifiantManuel) {
        delete copie.identifiant;
      }
      return copie;
    });
    setErreurGlobale('');
  };

  const handleBlur = (e) => {
    const { name } = e.target;
    setTouche((courant) => ({ ...courant, [name]: true }));
  };

  const changerRole = (e) => {
    setForm((courant) => ({ ...courant, role: e.target.value }));
    setErreurGlobale('');
  };

  // Place le focus sur le premier champ en erreur
  const focusPremiereErreur = useCallback((erreurs) => {
    const premier = ORDRE_CHAMPS.find((champ) => erreurs[champ]);
    if (premier && refs.current[premier]) {
      refs.current[premier].focus();
    }
  }, []);

  const declencherSecousse = () => {
    setSecousse(false);
    // Redémarre l'animation même si elle vient de jouer
    requestAnimationFrame(() => {
      if (montee.current) setSecousse(true);
    });
  };

  // --- Traduction des erreurs serveur ---
  const traiterErreurServeur = (error) => {
    const status = error.response?.status;
    const message = error.response?.data?.message;

    if (status === 409) {
      const texte = (message || '').toLowerCase();
      const champs = {};

      if (texte.includes('identifiant')) {
        champs.identifiant = 'Cet identifiant est déjà utilisé.';
      }
      if (texte.includes('mail')) {
        champs.email = 'Cette adresse e-mail est déjà utilisée.';
      }

      if (Object.keys(champs).length > 0) {
        setErreursServeur(champs);
        focusPremiereErreur(champs);
        return;
      }
      setErreurGlobale(
        message || 'Cet identifiant ou cette adresse e-mail existe déjà.'
      );
      return;
    }

    if (status === 400) {
      setErreurGlobale(message || 'Les informations saisies sont invalides.');
    } else if (status === 500) {
      setErreurGlobale(
        'Une erreur est survenue sur le serveur. Réessayez dans quelques instants ou contactez l’administrateur.'
      );
    } else if (error.code === 'ERR_NETWORK' || !error.response) {
      setErreurGlobale(
        'Impossible de contacter le serveur. Vérifiez votre connexion ou que le service est bien démarré.'
      );
    } else {
      setErreurGlobale(
        message || 'Une erreur est survenue lors de la création du compte.'
      );
    }
  };

  // --- Soumission ---
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Anti double envoi
    if (verrou.current || chargement) return;

    setSoumis(true);
    setErreurGlobale('');
    setErreursServeur({});

    // Validation : affiche toutes les erreurs et place le focus
    if (!formulaireValide) {
      focusPremiereErreur(erreursLocales);
      return;
    }

    // Normalisation avant envoi (la confirmation n'est jamais envoyée)
    const donnees = {
      nom: form.nom.trim(),
      prenom: form.prenom.trim(),
      identifiant: form.identifiant.trim(),
      email: form.email.trim().toLowerCase(),
      mot_de_passe: form.mot_de_passe,
      role: form.role,
    };

    verrou.current = true;
    setChargement(true);

    controleur.current?.abort();
    controleur.current = new AbortController();

    try {
      const response = await axiosClient.post('/auth/register', donnees, {
        signal: controleur.current.signal,
      });

      if (!montee.current) return;

      setSucces(response.data?.message || 'Votre compte a bien été créé.');
      setCompteARebours(REDIRECTION_SECONDES);
      setForm(FORM_INITIAL);
      setTouche({});
      setSoumis(false);
      setIdentifiantManuel(false);
      setAfficherMdp(false);
      setAfficherConfirmation(false);
    } catch (error) {
      // Requête annulée volontairement (démontage) : on ne fait rien
      if (error.code === 'ERR_CANCELED' || error.name === 'CanceledError') return;
      if (!montee.current) return;

      // Détail technique réservé au développeur
      console.error('Erreur création compte :', error);

      traiterErreurServeur(error);
      declencherSecousse();
    } finally {
      verrou.current = false;
      if (montee.current) setChargement(false);
    }
  };

  const peutSoumettre = formulaireValide && !chargement;

  /* -------------------------------------------------------
     RENDU
  ------------------------------------------------------- */
  return (
    <FondJirama>
      <BoutonTheme />

      <style>{`
        .jr-register-page { position:relative; isolation:isolate; overflow:hidden; min-height:100svh; color:var(--jr-texte); }
        .jr-register-page::before { content:""; position:fixed; inset:0; z-index:-2; pointer-events:none; background:radial-gradient(ellipse at 8% 12%,rgba(24,133,207,.16),transparent 42%),radial-gradient(ellipse at 92% 88%,rgba(12,190,153,.10),transparent 38%); }
        .jr-register-page::after { content:""; position:fixed; width:390px;height:390px;right:-210px;top:12%;z-index:-1;pointer-events:none;border-radius:50%;border:1px solid rgba(93,190,235,.12);box-shadow:0 0 0 38px rgba(93,190,235,.025),0 0 0 76px rgba(93,190,235,.02); }
        .jr-register-page .jr-register-shell { overflow:hidden; border-radius:24px; border:1px solid var(--jr-bordure); box-shadow:0 28px 90px rgba(1,13,28,.20); }
        .jr-register-page .jr-register-aside { min-height:760px; }
        .jr-register-page .jr-register-aside h1 { max-width:470px; letter-spacing:-.035em; line-height:1.12; }
        .jr-register-page .jr-register-form { padding:clamp(24px,4vw,52px); }
        .jr-register-page .jr-field { min-height:48px; border-radius:12px; border-color:var(--jr-bordure); background:var(--jr-surface); transition:border-color .18s ease,box-shadow .18s ease,background .18s ease; }
        .jr-register-page .jr-field:focus { outline:none; border-color:var(--jr-elec); box-shadow:0 0 0 4px color-mix(in srgb,var(--jr-elec) 18%,transparent); }
        .jr-register-page .jr-field--err { border-color:var(--jr-err)!important; box-shadow:0 0 0 2px color-mix(in srgb,var(--jr-err) 12%,transparent); }
        .jr-register-page .jr-field--ok { border-color:var(--jr-ok)!important; }
        .jr-register-page .jr-role { border-radius:14px; min-height:140px; transition:transform .18s ease,border-color .18s ease,box-shadow .18s ease; }
        .jr-register-page .jr-role:hover { transform:translateY(-2px); box-shadow:0 8px 22px rgba(5,30,55,.08); }
        .jr-register-page .jr-btn { min-height:50px; border-radius:12px; transition:transform .18s ease,filter .18s ease,box-shadow .18s ease; }
        .jr-register-page .jr-btn:hover:not(:disabled) { filter:brightness(1.04); }
        .jr-register-page .jr-lien:focus-visible,.jr-register-page .jr-btn:focus-visible,.jr-register-page .jr-role:focus-within { outline:3px solid var(--jr-elec); outline-offset:3px; }
        .jr-register-page .jr-register-logo { display:inline-flex;align-items:center;justify-content:center;border-radius:14px;background:#fff;padding:10px 14px;box-shadow:0 10px 28px rgba(0,0,0,.14); }
        .jr-register-page .jr-register-logo img { height:46px;width:auto;max-width:180px;object-fit:contain; }
        .jr-register-page .jr-register-overline { display:inline-flex;align-items:center;gap:8px;border:1px solid rgba(175,220,255,.2);border-radius:999px;padding:8px 12px;background:rgba(255,255,255,.07);color:#d8f2ff;font-size:12px;font-weight:650; }
        .jr-register-page .jr-register-title { font-size:clamp(1.8rem,3vw,2.3rem);font-weight:780;letter-spacing:-.04em;line-height:1.12; }
        .jr-register-page .jr-register-intro { max-width:42ch;line-height:1.7; }
        .jr-register-page .jr-register-foot { letter-spacing:.025em; }
        @media(max-width:1023px) { .jr-register-page .jr-register-shell { max-width:620px;margin-inline:auto; } .jr-register-page .jr-register-aside { display:none!important; } .jr-register-page .jr-register-form { padding:clamp(22px,5vw,42px); } }
        @media(max-width:520px) { .jr-register-page .jr-register-shell { border-radius:19px; } .jr-register-page .jr-role { min-height:120px; } .jr-register-page .jr-register-form { padding:22px 18px; } }
        @media(prefers-reduced-motion:reduce) { .jr-register-page .jr-field,.jr-register-page .jr-role,.jr-register-page .jr-btn { transition:none!important; } .jr-register-page .jr-role:hover { transform:none; } }
      `}</style>

      <div className="jr-register-page flex min-h-screen items-center justify-center px-4 pb-8 pt-20">
        <motion.div
          className="jr-entree w-full max-w-6xl"
          initial={reduceMotion ? false : { opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.62, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="jr-register-shell grid bg-jr-surface lg:grid-cols-[5fr_6fr]">
            {/* ==================== PANNEAU GAUCHE ==================== */}
            <aside
              className="jr-register-aside relative hidden overflow-hidden p-10 text-white lg:flex lg:flex-col lg:justify-between xl:p-12"
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
                <div className="jr-register-logo mb-10">
                  <img
                    src="/images/Jirama.png"
                    alt="Logo JIRAMA"
                    className="h-14 w-auto object-contain"
                  />
                </div>

                <div className="jr-register-overline">
                  <ShieldCheck size={16} aria-hidden="true" />
                  Espace sécurisé
                </div>

                <h1 className="mt-6 text-4xl font-bold leading-tight xl:text-[2.6rem]">
                  Créez votre compte pour suivre l’eau et l’électricité
                </h1>

                <p className="mt-5 max-w-md text-base leading-7 text-blue-100">
                  Saisissez les relevés, consultez l’historique et analysez les
                  consommations au même endroit.
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
                  Icone={BarChart3}
                  titre="Analyse des consommations"
                  texte="Courbes, statistiques et tendances"
                  couleur="var(--jr-av-analyse)"
                />
              </div>
            </aside>

            {/* ==================== COLONNE FORMULAIRE ==================== */}
            <main className="jr-register-form flex items-center justify-center">
              <div className="w-full max-w-md">
                {succes ? (
                  /* ---------- Écran de succès ---------- */
                  <div
                    className="py-6 text-center"
                    role="status"
                    aria-live="polite"
                  >
                    <div
                      className="jr-pop mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full"
                      style={{ backgroundColor: 'var(--jr-ok-pale)' }}
                    >
                      <CheckCircle2 size={44} className="text-jr-ok" aria-hidden="true" />
                    </div>

                    <h2 className="text-2xl font-bold" style={{ color: COULEURS.titre }}>
                      Compte créé
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-jr-doux">{succes}</p>

                    <p className="mt-6 text-sm text-jr-doux">
                      Redirection vers la connexion dans{' '}
                      <strong className="tabular-nums" style={{ color: COULEURS.lien }}>
                        {compteARebours} s
                      </strong>
                    </p>

                    <div
                      className="mx-auto mt-3 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-jr-bordure"
                      aria-hidden="true"
                    >
                      <div
                        className="jr-progression h-full rounded-full"
                        style={{
                          backgroundColor: COULEURS.elec,
                          animationDuration: `${REDIRECTION_SECONDES}s`,
                        }}
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => navigate('/')}
                      className="jr-btn mt-8 inline-flex w-full items-center justify-center gap-2 rounded-md px-4 py-3.5 text-sm font-bold shadow-lg transition hover:-translate-y-0.5"
                      style={{
                        backgroundColor: COULEURS.elec,
                        color: COULEURS.surElec,
                        boxShadow: `0 10px 24px -10px ${COULEURS.elec}`,
                      }}
                    >
                      Aller à la connexion maintenant
                    </button>
                  </div>
                ) : (
                  /* ---------- Formulaire ---------- */
                  <div className={secousse ? 'jr-secousse' : ''} onAnimationEnd={() => setSecousse(false)}>
                    <button
                      type="button"
                      onClick={() => navigate('/')}
                      disabled={chargement}
                      className="jr-lien mb-6 flex items-center gap-2 text-sm font-medium text-jr-doux transition hover:text-jr-texte disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <ArrowLeft size={17} aria-hidden="true" />
                      Retour à la connexion
                    </button>

                    {/* Logo mobile */}
                    <div className="mb-7 flex justify-center lg:hidden">
                      <span className="jr-register-logo">
                      <img
                        src="/images/Jirama.png"
                        alt="Logo JIRAMA"
                        className="h-14 w-auto object-contain"
                      />
                    </span>
                    </div>

                    <div className="mb-6">
                      <h2 className="jr-register-title" style={{ color: COULEURS.titre }}>
                        Créer un compte
                      </h2>
                      <p className="jr-register-intro mt-3 text-sm leading-6 text-jr-doux">
                        Renseignez vos informations pour accéder à l’application.
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
                      {/* Nom + prénom */}
                      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                        <ChampTexte
                          id="nom"
                          label="Nom"
                          Icone={User}
                          type="text"
                          value={form.nom}
                          onChange={handleChange}
                          onBlur={handleBlur}
                          placeholder="Nom"
                          autoComplete="family-name"
                          disabled={chargement}
                          required
                          inputRef={(el) => (refs.current.nom = el)}
                          erreur={erreurDe('nom')}
                          valide={estValide('nom')}
                        />

                        <ChampTexte
                          id="prenom"
                          label="Prénom"
                          type="text"
                          value={form.prenom}
                          onChange={handleChange}
                          onBlur={handleBlur}
                          placeholder="Prénom"
                          autoComplete="given-name"
                          disabled={chargement}
                          required
                          inputRef={(el) => (refs.current.prenom = el)}
                          erreur={erreurDe('prenom')}
                          valide={estValide('prenom')}
                        />
                      </div>

                      <ChampTexte
                        id="identifiant"
                        label="Identifiant"
                        Icone={User}
                        type="text"
                        value={form.identifiant}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        placeholder="Ex. mario.rakoto"
                        autoComplete="username"
                        autoCapitalize="none"
                        spellCheck={false}
                        maxLength={30}
                        disabled={chargement}
                        required
                        inputRef={(el) => (refs.current.identifiant = el)}
                        erreur={erreurDe('identifiant')}
                        valide={estValide('identifiant')}
                        aide={
                          !identifiantManuel && form.identifiant
                            ? 'Suggestion basée sur votre nom. Vous pouvez la modifier.'
                            : 'Lettres, chiffres, point, tiret ou underscore.'
                        }
                      />

                      <ChampTexte
                        id="email"
                        label="Adresse e-mail"
                        Icone={Mail}
                        type="email"
                        value={form.email}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        placeholder="exemple@jirama.mg"
                        autoComplete="email"
                        inputMode="email"
                        autoCapitalize="none"
                        spellCheck={false}
                        disabled={chargement}
                        required
                        inputRef={(el) => (refs.current.email = el)}
                        erreur={erreurDe('email')}
                        valide={estValide('email')}
                      />

                      <ChampMotDePasse
                        id="mot_de_passe"
                        label="Mot de passe"
                        value={form.mot_de_passe}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        placeholder="Minimum 8 caractères"
                        autoComplete="new-password"
                        disabled={chargement}
                        required
                        visible={afficherMdp}
                        onToggle={() => setAfficherMdp((v) => !v)}
                        inputRef={(el) => (refs.current.mot_de_passe = el)}
                        erreur={erreurDe('mot_de_passe')}
                        valide={estValide('mot_de_passe')}
                      >
                        <ForceMotDePasse motDePasse={form.mot_de_passe} />
                      </ChampMotDePasse>

                      <ChampMotDePasse
                        id="confirmation"
                        label="Confirmer le mot de passe"
                        value={form.confirmation}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        placeholder="Saisissez-le à nouveau"
                        autoComplete="new-password"
                        disabled={chargement}
                        required
                        visible={afficherConfirmation}
                        onToggle={() => setAfficherConfirmation((v) => !v)}
                        inputRef={(el) => (refs.current.confirmation = el)}
                        erreur={
                          // Correspondance vérifiée en direct dès qu'on tape
                          form.confirmation && erreursLocales.confirmation
                            ? erreursLocales.confirmation
                            : erreurDe('confirmation')
                        }
                        valide={
                          Boolean(form.confirmation) &&
                          form.confirmation === form.mot_de_passe &&
                          !erreursLocales.mot_de_passe
                        }
                      />

                      {/* Rôle */}
                      <fieldset>
                        <legend className="mb-1.5 text-sm font-semibold text-jr-texte">
                          Votre rôle
                        </legend>

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          {ROLES.map((role) => (
                            <CarteRole
                              key={role.valeur}
                              role={role}
                              choisi={form.role === role.valeur}
                              onChange={changerRole}
                              disabled={chargement}
                            />
                          ))}
                        </div>

                        <p className="mt-2 text-xs text-jr-doux">
                          Le rôle administrateur n’est pas proposé à l’inscription.
                        </p>
                      </fieldset>

                      {/* Bouton principal */}
                      <button
                        type="submit"
                        disabled={chargement}
                        aria-disabled={!peutSoumettre}
                        className="jr-btn flex w-full items-center justify-center gap-2 rounded-md px-4 py-3.5 text-sm font-bold transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:translate-y-0"
                        style={{
                          backgroundColor: peutSoumettre || chargement ? COULEURS.elec : 'var(--jr-desactive-fond)',
                          color: peutSoumettre || chargement ? COULEURS.surElec : 'var(--jr-desactive-texte)',
                          boxShadow: peutSoumettre
                            ? `0 12px 24px -12px ${COULEURS.elec}`
                            : 'none',
                          cursor: !peutSoumettre && !chargement ? 'not-allowed' : undefined,
                        }}
                        onMouseEnter={(e) => {
                          if (peutSoumettre) e.currentTarget.style.backgroundColor = COULEURS.elecFonce;
                        }}
                        onMouseLeave={(e) => {
                          if (peutSoumettre) e.currentTarget.style.backgroundColor = COULEURS.elec;
                        }}
                      >
                        {chargement ? (
                          <>
                            <span
                          className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent"
                          style={{ color: COULEURS.surElec }}
                          aria-hidden="true"
                        />
                            Création en cours…
                          </>
                        ) : (
                          <>
                            <UserPlus size={19} aria-hidden="true" />
                            Créer le compte
                          </>
                        )}
                      </button>
                    </form>

                    <div className="mt-6 border-t border-jr-bordure pt-5 text-center">
                      <p className="text-sm text-jr-doux">
                        Vous avez déjà un compte ?{' '}
                        <button
                          type="button"
                          onClick={() => navigate('/')}
                          disabled={chargement}
                          className="jr-lien font-semibold underline-offset-4 hover:underline disabled:opacity-50"
                          style={{ color: COULEURS.lien }}
                        >
                          Se connecter
                        </button>
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </main>
          </div>

          <p className="jr-register-foot mt-5 text-center text-xs text-jr-doux">
            Application web JIRAMA — Suivi et analyse des consommations
          </p>
        </motion.div>
      </div>
    </FondJirama>
  );
}

export default Register;
