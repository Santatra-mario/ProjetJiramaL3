'use strict';
const bcrypt = require('bcrypt');
const pool = require('../config/db');
const DEFAULT = { theme: 'system', compactMode: false, reduceMotion: false, notifications: { anomalies: true, releves: true, decisions: true } };
const userId = (req) => { const n = Number(req.user?.id ?? req.user?.userId ?? req.user?.user_id); return Number.isSafeInteger(n) && n > 0 ? n : null; };
const role = (req) => String(req.user?.role || '').trim().toUpperCase();
const map = (r) => r ? ({ theme: ['clair','sombre','system'].includes(r.theme) ? r.theme : 'system', compactMode: !!r.compact_mode, reduceMotion: !!r.reduce_motion, notifications: { anomalies: r.notif_anomalies !== false, releves: r.notif_releves !== false, decisions: r.notif_decisions !== false } }) : JSON.parse(JSON.stringify(DEFAULT));
function fail(res, error, label) {
  console.error(`${label}:`, error);
  if (['42P01','42703'].includes(error?.code)) return res.status(503).json({ status:'error', code:'SETTINGS_MIGRATION_REQUIRED', message:'La structure des paramètres est absente. Exécutez sql/004_settings_utilisateur.sql puis redémarrez le backend.' });
  return res.status(500).json({ status:'error', message:'Impossible de charger ou d’enregistrer les paramètres.' });
}
async function audit(req, action, details = {}) {
  try { await pool.query(`INSERT INTO user_audit_logs(user_id, actor_role, action, resource_type, details) VALUES($1,$2,$3,'settings',$4::jsonb)`, [userId(req), role(req), action, JSON.stringify(details)]); }
  catch (e) { console.error('Audit des paramètres indisponible:', e.message); }
}

async function getSettings(req,res) {
  const id = userId(req); if (!id) return res.status(401).json({status:'error',message:'Identité invalide. Reconnectez-vous.'});
  try {
    const u = await pool.query('SELECT id, nom, prenom, identifiant, email, role, statut FROM users WHERE id=$1 LIMIT 1',[id]);
    if (!u.rowCount) return res.status(401).json({status:'error',message:'Utilisateur introuvable. Reconnectez-vous.'});
    await pool.query('INSERT INTO user_settings(user_id) VALUES($1) ON CONFLICT(user_id) DO NOTHING',[id]);
    const s = await pool.query('SELECT theme, compact_mode, reduce_motion, notif_anomalies, notif_releves, notif_decisions, updated_at FROM user_settings WHERE user_id=$1 LIMIT 1',[id]);
    return res.json({status:'success',profile:u.rows[0],settings:map(s.rows[0]),updatedAt:s.rows[0]?.updated_at || null});
  } catch(e) { return fail(res,e,'GET paramètres'); }
}

async function updatePreferences(req,res) {
  const id = userId(req); if (!id) return res.status(401).json({status:'error',message:'Identité invalide. Reconnectez-vous.'});
  const x = req.body?.settings && typeof req.body.settings==='object' ? req.body.settings : (req.body || {});
  const theme = x.theme === undefined ? null : String(x.theme).trim().toLowerCase();
  if (theme !== null && !['clair','sombre','system'].includes(theme)) return res.status(400).json({status:'error',message:'Thème invalide.'});
  for (const key of ['compactMode','reduceMotion']) if (x[key] !== undefined && typeof x[key] !== 'boolean') return res.status(400).json({status:'error',message:`${key} doit être un booléen.`});
  const notif = x.notifications && typeof x.notifications==='object' ? x.notifications : {};
  for (const key of ['anomalies','releves','decisions']) if (notif[key] !== undefined && typeof notif[key] !== 'boolean') return res.status(400).json({status:'error',message:`La préférence ${key} doit être booléenne.`});
  try {
    await pool.query('INSERT INTO user_settings(user_id) VALUES($1) ON CONFLICT(user_id) DO NOTHING',[id]);
    const cur = await pool.query('SELECT theme,compact_mode,reduce_motion,notif_anomalies,notif_releves,notif_decisions FROM user_settings WHERE user_id=$1',[id]);
    const c = map(cur.rows[0]);
    const next = {theme:theme ?? c.theme, compactMode:x.compactMode ?? c.compactMode, reduceMotion:x.reduceMotion ?? c.reduceMotion, notifications:{anomalies:notif.anomalies ?? c.notifications.anomalies,releves:notif.releves ?? c.notifications.releves,decisions:notif.decisions ?? c.notifications.decisions}};
    const saved = await pool.query(`UPDATE user_settings SET theme=$2, compact_mode=$3, reduce_motion=$4, notif_anomalies=$5, notif_releves=$6, notif_decisions=$7, updated_at=CURRENT_TIMESTAMP WHERE user_id=$1 RETURNING theme,compact_mode,reduce_motion,notif_anomalies,notif_releves,notif_decisions,updated_at`, [id,next.theme,next.compactMode,next.reduceMotion,next.notifications.anomalies,next.notifications.releves,next.notifications.decisions]);
    await audit(req,'MODIFICATION_PREFERENCES',{theme:next.theme});
    return res.json({status:'success',message:'Préférences enregistrées.',settings:map(saved.rows[0]),updatedAt:saved.rows[0].updated_at});
  } catch(e) { return fail(res,e,'PATCH préférences'); }
}

async function updateProfile(req,res) {
  const id = userId(req); if (!id) return res.status(401).json({status:'error',message:'Identité invalide. Reconnectez-vous.'});
  const nom = req.body?.nom === undefined ? undefined : String(req.body.nom).trim();
  const prenom = req.body?.prenom === undefined ? undefined : String(req.body.prenom).trim();
  const email = req.body?.email === undefined ? undefined : String(req.body.email).trim().toLowerCase();
  if (nom !== undefined && (!nom || nom.length>100)) return res.status(400).json({status:'error',message:'Le nom est obligatoire (100 caractères maximum).'});
  if (prenom !== undefined && (!prenom || prenom.length>100)) return res.status(400).json({status:'error',message:'Le prénom est obligatoire (100 caractères maximum).'});
  if (email !== undefined && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length>180)) return res.status(400).json({status:'error',message:'Adresse e-mail invalide.'});
  if (nom===undefined && prenom===undefined && email===undefined) return res.status(400).json({status:'error',message:'Aucune information à modifier.'});
  try {
    const current = await pool.query('SELECT nom,prenom,email FROM users WHERE id=$1 LIMIT 1',[id]);
    if (!current.rowCount) return res.status(404).json({status:'error',message:'Utilisateur introuvable.'});
    const c=current.rows[0];
    const saved=await pool.query('UPDATE users SET nom=$2,prenom=$3,email=$4 WHERE id=$1 RETURNING id,nom,prenom,identifiant,email,role,statut',[id,nom??c.nom,prenom??c.prenom,email??c.email]);
    await audit(req,'MODIFICATION_PROFIL',{champs:[nom!==undefined?'nom':null,prenom!==undefined?'prenom':null,email!==undefined?'email':null].filter(Boolean)});
    return res.json({status:'success',message:'Profil mis à jour.',profile:saved.rows[0]});
  } catch(e) { if (e?.code==='23505') return res.status(409).json({status:'error',message:'Cette adresse e-mail est déjà utilisée.'}); return fail(res,e,'PATCH profil'); }
}

async function changePassword(req,res) {
  const id=userId(req); if (!id) return res.status(401).json({status:'error',message:'Identité invalide. Reconnectez-vous.'});
  const current=String(req.body?.currentPassword||''); const next=String(req.body?.newPassword||''); const confirm=String(req.body?.confirmPassword||'');
  if (!current||!next||!confirm) return res.status(400).json({status:'error',message:'Tous les champs sont obligatoires.'});
  if (next.length<8) return res.status(400).json({status:'error',message:'Le nouveau mot de passe doit contenir au moins 8 caractères.'});
  if (next!==confirm) return res.status(400).json({status:'error',message:'La confirmation ne correspond pas au nouveau mot de passe.'});
  if (next===current) return res.status(400).json({status:'error',message:'Le nouveau mot de passe doit être différent de l’ancien.'});
  try {
    const u=await pool.query('SELECT mot_de_passe FROM users WHERE id=$1 LIMIT 1',[id]);
    if (!u.rowCount) return res.status(404).json({status:'error',message:'Utilisateur introuvable.'});
    if (!await bcrypt.compare(current,u.rows[0].mot_de_passe||'')) return res.status(400).json({status:'error',message:'Le mot de passe actuel est incorrect.'});
    const hash=await bcrypt.hash(next,12);
    await pool.query('UPDATE users SET mot_de_passe=$2 WHERE id=$1',[id,hash]);
    await audit(req,'CHANGEMENT_MOT_DE_PASSE',{modifie:true});
    return res.json({status:'success',message:'Mot de passe modifié avec succès.'});
  } catch(e) { return fail(res,e,'PATCH mot de passe'); }
}

async function getAuditLog(req,res) {
  const id=userId(req); if (!id) return res.status(401).json({status:'error',message:'Identité invalide. Reconnectez-vous.'});
  const isAdmin=role(req)==='ADMINISTRATEUR'; const limit=Math.min(Math.max(Number.parseInt(req.query.limit,10)||50,1),100);
  try {
    const result=isAdmin ? await pool.query(`SELECT a.id,a.user_id,u.nom,u.prenom,a.actor_role,a.action,a.resource_type,a.resource_id,a.details,a.created_at FROM user_audit_logs a LEFT JOIN users u ON u.id=a.user_id ORDER BY a.created_at DESC,a.id DESC LIMIT $1`,[limit]) : await pool.query(`SELECT a.id,a.user_id,u.nom,u.prenom,a.actor_role,a.action,a.resource_type,a.resource_id,a.details,a.created_at FROM user_audit_logs a LEFT JOIN users u ON u.id=a.user_id WHERE a.user_id=$1 ORDER BY a.created_at DESC,a.id DESC LIMIT $2`,[id,limit]);
    return res.json({status:'success',logs:result.rows});
  } catch(e) { return fail(res,e,'GET journal audit'); }
}

module.exports={getSettings,updatePreferences,updateProfile,changePassword,getAuditLog};
