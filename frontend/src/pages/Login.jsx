import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import {
  Activity, AlertCircle, CheckCircle2, Droplets, Eye, EyeOff, Lock,
  LogIn, ShieldCheck, User, UserPlus, Waves, Zap,
} from 'lucide-react';
import axiosClient from '../api/axiosClient';
import BoutonTheme from '../components/BoutonTheme.jsx';
import FondJirama from '../components/FondJirama.jsx';

const LOGO = '/images/Jirama.png';
const REDIRECTIONS = {
  ADMINISTRATEUR: '/dashboard/admin',
  AGENT: '/dashboard/agent',
  RESPONSABLE: '/dashboard/responsable',
};

function Login() {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const [identifiant, setIdentifiant] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [touche, setTouche] = useState({});
  const [soumis, setSoumis] = useState(false);
  const [afficherMdp, setAfficherMdp] = useState(false);
  const [majActive, setMajActive] = useState(false);
  const [chargement, setChargement] = useState(false);
  const [erreurGlobale, setErreurGlobale] = useState('');
  const [secousse, setSecousse] = useState(false);
  const refIdentifiant = useRef(null);
  const refMotDePasse = useRef(null);
  const montee = useRef(true);
  const controleur = useRef(null);
  const verrou = useRef(false);

  useEffect(() => {
    montee.current = true;
    return () => {
      montee.current = false;
      controleur.current?.abort();
    };
  }, []);

  const erreurs = {};
  if (!identifiant.trim()) erreurs.identifiant = 'Saisissez votre identifiant ou votre e-mail.';
  if (!motDePasse) erreurs.motDePasse = 'Saisissez votre mot de passe.';
  const formulaireValide = Object.keys(erreurs).length === 0;
  const erreurDe = (champ) => touche[champ] || soumis ? erreurs[champ] || '' : '';
  const handleBlur = (champ) => () => setTouche((courant) => ({ ...courant, [champ]: true }));
  const detecterMaj = (e) => {
    if (typeof e.getModifierState === 'function') setMajActive(e.getModifierState('CapsLock'));
  };
  const declencherSecousse = () => {
    setSecousse(false);
    requestAnimationFrame(() => { if (montee.current) setSecousse(true); });
  };
  const messageServeur = (error) => {
    const status = error.response?.status;
    const message = error.response?.data?.message;
    if (status === 400) return message || 'Les données envoyées sont invalides.';
    if (status === 401) return message || 'Identifiant ou mot de passe incorrect.';
    if (status === 403) return message || 'Votre compte est désactivé ou l’accès est refusé.';
    if (status === 404) return 'Le service de connexion est introuvable. Contactez l’administrateur.';
    if (status >= 500) return 'Une erreur est survenue sur le serveur. Réessayez dans quelques instants.';
    if (error.code === 'ERR_NETWORK' || !error.response) return 'Impossible de contacter le serveur. Vérifiez votre connexion ou que le service est démarré.';
    return message || 'Une erreur est survenue pendant la connexion.';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (verrou.current || chargement) return;
    setSoumis(true);
    setErreurGlobale('');
    if (!formulaireValide) {
      if (erreurs.identifiant) refIdentifiant.current?.focus();
      else refMotDePasse.current?.focus();
      return;
    }
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    verrou.current = true;
    setChargement(true);
    controleur.current?.abort();
    controleur.current = new AbortController();
    try {
      const response = await axiosClient.post('/auth/login', {
        identifiant: identifiant.trim(),
        mot_de_passe: motDePasse,
      }, { signal: controleur.current.signal });
      if (!montee.current) return;
      const token = response.data?.token;
      const user = response.data?.user;
      if (!token || !user) throw new Error('La réponse du serveur est invalide.');
      const role = String(user.role || '').trim().toUpperCase();
      if (!REDIRECTIONS[role]) {
        setErreurGlobale('Votre rôle n’est pas reconnu par l’application. Contactez l’administrateur.');
        declencherSecousse();
        return;
      }
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify({ ...user, role }));
      navigate(REDIRECTIONS[role], { replace: true });
    } catch (error) {
      if (error.code === 'ERR_CANCELED' || error.name === 'CanceledError') return;
      if (!montee.current) return;
      console.error('Erreur de connexion :', error);
      setErreurGlobale(messageServeur(error));
      declencherSecousse();
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

  const entrance = reduceMotion
    ? { initial: false, animate: { opacity: 1 } }
    : { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.65, ease: [0.16, 1, 0.3, 1] } };

  return (
    <FondJirama>
      <style>{`
        .jl-page{min-height:100svh;position:relative;isolation:isolate;overflow:hidden;color:#eaf2ff;background:#071426}
        .jl-page:before{content:"";position:absolute;inset:0;z-index:-2;background:radial-gradient(ellipse at 12% 18%,rgba(18,111,191,.26),transparent 42%),radial-gradient(ellipse at 88% 84%,rgba(12,190,153,.13),transparent 38%),#071426}
        .jl-orb{position:absolute;border-radius:50%;pointer-events:none;opacity:.7;animation:jl-float 12s ease-in-out infinite}
        .jl-orb-a{width:360px;height:360px;top:-180px;left:8%;background:radial-gradient(circle,rgba(27,151,236,.2),transparent 70%)}
        .jl-orb-b{width:420px;height:420px;right:-190px;bottom:-190px;background:radial-gradient(circle,rgba(27,210,167,.17),transparent 70%);animation-delay:-5s}
        .jl-shell{width:min(1120px,100%);margin:auto;display:grid;grid-template-columns:minmax(0,1.04fr) minmax(390px,.96fr);border:1px solid rgba(155,190,230,.18);border-radius:28px;overflow:hidden;background:rgba(10,27,48,.9);box-shadow:0 32px 100px rgba(0,0,0,.35);backdrop-filter:blur(18px)}
        .jl-showcase{position:relative;min-height:650px;padding:46px 44px 38px;display:flex;flex-direction:column;justify-content:space-between;overflow:hidden;background:linear-gradient(150deg,rgba(13,66,111,.9),rgba(7,35,63,.97) 58%,rgba(5,47,55,.97))}
        .jl-showcase:after{content:"";position:absolute;width:460px;height:460px;right:-210px;top:24%;border:1px solid rgba(151,215,255,.15);border-radius:50%;box-shadow:0 0 0 36px rgba(151,215,255,.025),0 0 0 72px rgba(151,215,255,.025);pointer-events:none}
        .jl-logo{display:inline-flex;align-items:center;justify-content:center;width:max-content;max-width:100%;padding:11px 15px;border-radius:15px;background:#fff;box-shadow:0 12px 32px rgba(0,0,0,.16)}
        .jl-logo img{display:block;height:46px;width:auto;max-width:180px;object-fit:contain}
        .jl-status{display:inline-flex;align-items:center;gap:9px;width:max-content;max-width:100%;margin-top:38px;padding:9px 13px;border:1px solid rgba(164,226,255,.2);border-radius:999px;background:rgba(255,255,255,.07);color:#d8f2ff;font-size:12px;font-weight:650}
        .jl-status-dot{width:7px;height:7px;border-radius:50%;background:#39e2b4;box-shadow:0 0 0 4px rgba(57,226,180,.12)}
        .jl-headline{max-width:470px;margin:24px 0 0;color:#fff;font-size:clamp(2.1rem,3.2vw,3.15rem);font-weight:760;letter-spacing:-.045em;line-height:1.08}
        .jl-headline span{color:#70d8ff}.jl-description{max-width:420px;margin-top:20px;color:#bfd4e8;font-size:15px;line-height:1.8}
        .jl-features{display:grid;gap:12px;margin-top:32px}.jl-feature{display:flex;align-items:center;gap:14px;padding:13px 14px;border:1px solid rgba(194,221,244,.12);border-radius:15px;background:rgba(255,255,255,.045);transition:background .2s,border-color .2s,transform .2s}
        .jl-feature:hover{transform:translateX(3px);background:rgba(255,255,255,.075);border-color:rgba(112,216,255,.28)}
        .jl-feature-icon{display:grid;place-items:center;width:42px;height:42px;flex:none;border-radius:12px;background:rgba(112,216,255,.12);color:#80e2ff}
        .jl-feature-title{color:#f2f8ff;font-size:13px;font-weight:700}.jl-feature-copy{margin-top:3px;color:#aac2d9;font-size:12px;line-height:1.5}
        .jl-showcase-foot{position:relative;z-index:1;margin-top:28px;color:#83a5c2;font-size:11px;letter-spacing:.04em}
        .jl-form-side{display:flex;align-items:center;justify-content:center;padding:48px 46px;background:rgba(7,20,37,.76)}.jl-form-inner{width:100%;max-width:390px}.jl-mobile-logo{display:none}
        .jl-overline{display:flex;align-items:center;gap:8px;margin-bottom:15px;color:#71d8ff;font-size:11px;font-weight:750;letter-spacing:.14em;text-transform:uppercase}
        .jl-title{margin:0;color:#f5f9ff;font-size:32px;font-weight:760;letter-spacing:-.045em;line-height:1.15}.jl-subtitle{margin:11px 0 0;color:#a9bdd1;font-size:14px;line-height:1.7}
        .jl-error{display:flex;align-items:flex-start;gap:10px;margin:22px 0 0;padding:13px 14px;border:1px solid rgba(255,112,130,.34);border-radius:13px;background:rgba(120,25,47,.23);color:#ffb9c2;font-size:12px;line-height:1.6}
        .jl-form{display:grid;gap:20px;margin-top:28px}.jl-label{display:block;margin-bottom:9px;color:#dce9f6;font-size:12px;font-weight:700}
        .jl-input-wrap{position:relative}.jl-input-icon{position:absolute;left:15px;top:50%;transform:translateY(-50%);color:#7e9ab5;pointer-events:none}
        .jl-input{display:block;width:100%;height:52px;padding:0 45px;border:1px solid rgba(150,183,214,.2);border-radius:13px;outline:none;background:rgba(16,37,60,.8);color:#f1f7ff;font:inherit;font-size:13px;transition:border-color .2s,box-shadow .2s,background .2s}
        .jl-input::placeholder{color:#91a8bf;opacity:1}.jl-input:hover{border-color:rgba(150,208,245,.38)}.jl-input:focus{border-color:#56c9f5;box-shadow:0 0 0 4px rgba(57,184,235,.12);background:rgba(17,42,68,.95)}.jl-input[aria-invalid=true]{border-color:#ff7488}.jl-input:disabled{opacity:.55;cursor:not-allowed}
        .jl-reveal{position:absolute;right:10px;top:50%;transform:translateY(-50%);display:grid;place-items:center;width:34px;height:34px;border:0;border-radius:9px;background:transparent;color:#8ca8c1;cursor:pointer;transition:color .2s,background .2s}.jl-reveal:hover{color:#fff;background:rgba(255,255,255,.08)}
        .jl-field-error{display:flex;align-items:flex-start;gap:6px;margin-top:8px;color:#ff9ca9;font-size:11px;line-height:1.5}.jl-caps{margin-top:8px;color:#ffd28a;font-size:11px}
        .jl-submit{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;min-height:53px;margin-top:2px;border:0;border-radius:13px;background:linear-gradient(105deg,#35b8ed,#16c7a2);color:#062036;font-size:13px;font-weight:800;box-shadow:0 12px 28px rgba(20,184,190,.19);cursor:pointer;transition:transform .2s,filter .2s,box-shadow .2s}
        .jl-submit:hover:not(:disabled){transform:translateY(-2px);filter:brightness(1.06);box-shadow:0 16px 32px rgba(20,184,190,.25)}.jl-submit:active:not(:disabled){transform:translateY(0)}.jl-submit:disabled{opacity:.7;cursor:wait}
        .jl-submit:focus-visible,.jl-reveal:focus-visible,.jl-register:focus-visible{outline:3px solid rgba(112,216,255,.85);outline-offset:3px}
        .jl-secure{display:flex;align-items:center;justify-content:center;gap:7px;margin-top:18px;color:#9ab0c5;font-size:11px}
        .jl-register-line{margin-top:27px;padding-top:23px;border-top:1px solid rgba(150,183,214,.14);text-align:center;color:#b3c5d7;font-size:12px;line-height:1.8}
        .jl-register{display:inline-flex;align-items:center;gap:5px;margin-left:4px;padding:0;border:0;background:none;color:#70d8ff;font:inherit;font-weight:750;cursor:pointer;text-underline-offset:4px}.jl-register:hover{text-decoration:underline}
        .jl-footnote{margin:20px 0 0;text-align:center;color:#9ab0c5;font-size:10px;letter-spacing:.035em}.jl-shake{animation:jl-shake .42s ease-in-out}
        /* Mode clair : les couleurs personnalisées du login doivent suivre html.dark */
        html:not(.dark) .jl-page{color:#0f172a;background:#f3f7fc}
        html:not(.dark) .jl-page:before{background:radial-gradient(ellipse at 12% 18%,rgba(42,139,214,.15),transparent 42%),radial-gradient(ellipse at 88% 84%,rgba(12,190,153,.10),transparent 38%),#f3f7fc}
        html:not(.dark) .jl-shell{border-color:rgba(15,95,168,.16);background:rgba(255,255,255,.94);box-shadow:0 28px 80px rgba(15,55,95,.15)}
        html:not(.dark) .jl-form-side{background:rgba(255,255,255,.88)}
        html:not(.dark) .jl-overline{color:#0f5fa8}
        html:not(.dark) .jl-title{color:#0a3566}
        html:not(.dark) .jl-subtitle{color:#52657b}
        html:not(.dark) .jl-label{color:#203a57}
        html:not(.dark) .jl-input-icon{color:#527493}
        html:not(.dark) .jl-input{border-color:#cbd8e6;background:#f8fafc;color:#10253d}
        html:not(.dark) .jl-input::placeholder{color:#71849a}
        html:not(.dark) .jl-input:hover{border-color:#8bbce5}
        html:not(.dark) .jl-input:focus{border-color:#2a8bd6;background:#fff;box-shadow:0 0 0 4px rgba(42,139,214,.14)}
        html:not(.dark) .jl-reveal{color:#526d89}
        html:not(.dark) .jl-reveal:hover{color:#0a3566;background:rgba(15,95,168,.08)}
        html:not(.dark) .jl-secure{color:#5c7188}
        html:not(.dark) .jl-register-line{border-color:#dce5ef;color:#52657b}
        html:not(.dark) .jl-register{color:#0f5fa8}
        html:not(.dark) .jl-footnote{color:#60758b}
        html:not(.dark) .jl-feature{border-color:rgba(194,221,244,.12)}
        html:not(.dark) .jl-page,.jl-shell,.jl-form-side,.jl-title,.jl-subtitle,.jl-label,.jl-input,.jl-secure,.jl-register-line,.jl-footnote{transition:background-color .28s ease,color .28s ease,border-color .28s ease,box-shadow .28s ease}
        @media(prefers-reduced-motion:reduce){html:not(.dark) .jl-page,.jl-shell,.jl-form-side,.jl-title,.jl-subtitle,.jl-label,.jl-input,.jl-secure,.jl-register-line,.jl-footnote{transition:none}}
        @keyframes jl-float{0%,100%{transform:translate3d(0,0,0)}50%{transform:translate3d(18px,-14px,0)}}@keyframes jl-shake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-5px)}40%,80%{transform:translateX(5px)}}
        @media(max-width:900px){.jl-shell{grid-template-columns:minmax(0,1fr);max-width:520px}.jl-showcase{display:none}.jl-form-side{padding:42px 34px}.jl-mobile-logo{display:flex;justify-content:center;margin-bottom:28px}.jl-title{font-size:30px}}
        @media(max-width:480px){.jl-form-side{padding:30px 22px}.jl-shell{border-radius:22px}.jl-input{height:50px}.jl-title{font-size:28px}.jl-mobile-logo .jl-logo img{height:39px}}
        @media(prefers-reduced-motion:reduce){.jl-orb{animation:none}.jl-feature,.jl-input,.jl-submit,.jl-reveal{transition:none}.jl-shake{animation:none}}
      `}</style>
      <BoutonTheme />
      <div className="jl-page flex min-h-screen items-center justify-center px-4 py-8 sm:px-6 lg:px-8">
        <div className="jl-orb jl-orb-a" aria-hidden="true" />
        <div className="jl-orb jl-orb-b" aria-hidden="true" />
        <motion.div className="w-full" style={{ maxWidth: 1120 }} {...entrance}>
          <div className="jl-shell">
            <aside className="jl-showcase" aria-label="Présentation de la plateforme JIRAMA">
              <div className="relative z-10">
                <div className="jl-logo"><img src={LOGO} alt="Logo JIRAMA" /></div>
                <div className="jl-status"><span className="jl-status-dot" aria-hidden="true" /> Plateforme de suivi des consommations</div>
                <h1 className="jl-headline">L’énergie et l’eau, <span>mieux maîtrisées.</span></h1>
                <p className="jl-description">Retrouvez les relevés, l’historique et les alertes de consommation dans un espace unique, clair et sécurisé.</p>
                <div className="jl-features">
                  <motion.div className="jl-feature" initial={reduceMotion ? false : { opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: reduceMotion ? 0 : .16, duration: .45 }}><div className="jl-feature-icon"><Droplets size={21} aria-hidden="true" /></div><div><div className="jl-feature-title">Consommation d’eau</div><div className="jl-feature-copy">Suivi des relevés en m³ et historique mensuel</div></div></motion.div>
                  <motion.div className="jl-feature" initial={reduceMotion ? false : { opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: reduceMotion ? 0 : .25, duration: .45 }}><div className="jl-feature-icon"><Zap size={21} aria-hidden="true" /></div><div><div className="jl-feature-title">Consommation électrique</div><div className="jl-feature-copy">Comparaisons et relevés en kWh</div></div></motion.div>
                  <motion.div className="jl-feature" initial={reduceMotion ? false : { opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: reduceMotion ? 0 : .34, duration: .45 }}><div className="jl-feature-icon"><Activity size={21} aria-hidden="true" /></div><div><div className="jl-feature-title">Analyse et alertes</div><div className="jl-feature-copy">Repérez les anomalies et suivez les indicateurs</div></div></motion.div>
                </div>
              </div>
              <div className="jl-showcase-foot">JIRAMA · SUIVI ET ANALYSE DES CONSOMMATIONS</div>
              <Waves className="pointer-events-none absolute -bottom-8 right-7 text-cyan-100/10" size={150} strokeWidth={0.8} aria-hidden="true" />
            </aside>

            <main className="jl-form-side">
              <motion.div className={`jl-form-inner ${secousse ? 'jl-shake' : ''}`} onAnimationEnd={() => setSecousse(false)} initial={reduceMotion ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .5, delay: reduceMotion ? 0 : .12 }}>
                <div className="jl-mobile-logo"><div className="jl-logo"><img src={LOGO} alt="Logo JIRAMA" /></div></div>
                <div className="jl-overline"><ShieldCheck size={15} aria-hidden="true" /> Accès sécurisé</div>
                <h2 className="jl-title">Heureux de vous revoir.</h2>
                <p className="jl-subtitle">Connectez-vous pour accéder à votre espace de travail JIRAMA.</p>
                {erreurGlobale && <motion.div role="alert" className="jl-error" initial={reduceMotion ? false : { opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .2 }}><AlertCircle size={18} className="mt-0.5 shrink-0" aria-hidden="true" /><p>{erreurGlobale}</p></motion.div>}
                <form onSubmit={handleSubmit} noValidate className="jl-form">
                  <div>
                    <label htmlFor="identifiant" className="jl-label">Identifiant ou adresse e-mail</label>
                    <div className="jl-input-wrap"><User className="jl-input-icon" size={18} aria-hidden="true" /><input id="identifiant" name="identifiant" ref={refIdentifiant} type="text" value={identifiant} onChange={(e) => { setIdentifiant(e.target.value); setErreurGlobale(''); }} onBlur={handleBlur('identifiant')} placeholder="Ex. admin ou admin@jirama.mg" autoComplete="username" autoCapitalize="none" spellCheck={false} disabled={chargement} required aria-invalid={erreurDe('identifiant') ? 'true' : 'false'} aria-describedby={erreurDe('identifiant') ? 'identifiant-err' : undefined} className="jl-input" /></div>
                    {erreurDe('identifiant') && <p id="identifiant-err" role="alert" className="jl-field-error"><AlertCircle size={14} aria-hidden="true" />{erreurDe('identifiant')}</p>}
                  </div>
                  <div>
                    <label htmlFor="motDePasse" className="jl-label">Mot de passe</label>
                    <div className="jl-input-wrap"><Lock className="jl-input-icon" size={18} aria-hidden="true" /><input id="motDePasse" name="motDePasse" ref={refMotDePasse} type={afficherMdp ? 'text' : 'password'} value={motDePasse} onChange={(e) => { setMotDePasse(e.target.value); setErreurGlobale(''); }} onBlur={(e) => { setMajActive(false); handleBlur('motDePasse')(e); }} onKeyDown={detecterMaj} onKeyUp={detecterMaj} placeholder="Saisissez votre mot de passe" autoComplete="current-password" disabled={chargement} required aria-invalid={erreurDe('motDePasse') ? 'true' : 'false'} aria-describedby={erreurDe('motDePasse') ? 'motDePasse-err' : undefined} className="jl-input" /><button type="button" className="jl-reveal" onClick={() => setAfficherMdp((v) => !v)} disabled={chargement} aria-label={afficherMdp ? 'Masquer le mot de passe' : 'Afficher le mot de passe'} aria-pressed={afficherMdp}>{afficherMdp ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>
                    {majActive && <p role="status" className="jl-caps"><AlertCircle size={13} className="inline mr-1" aria-hidden="true" />Verr. Maj activée</p>}
                    {erreurDe('motDePasse') && <p id="motDePasse-err" role="alert" className="jl-field-error"><AlertCircle size={14} aria-hidden="true" />{erreurDe('motDePasse')}</p>}
                  </div>
                  <button type="submit" disabled={chargement} className="jl-submit">{chargement ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />Connexion en cours…</> : <><LogIn size={18} aria-hidden="true" />Se connecter<CheckCircle2 size={17} aria-hidden="true" /></>}</button>
                </form>
                <div className="jl-secure"><ShieldCheck size={14} aria-hidden="true" /> Vos informations sont protégées</div>
                <div className="jl-register-line">Vous n’avez pas encore de compte ? <button type="button" onClick={() => navigate('/register')} disabled={chargement} className="jl-register"><UserPlus size={14} aria-hidden="true" />Créer un compte</button></div>
              </motion.div>
            </main>
          </div>
          <p className="jl-footnote">Application web JIRAMA · Suivi et analyse des consommations</p>
        </motion.div>
      </div>
    </FondJirama>
  );
}

export default Login;
