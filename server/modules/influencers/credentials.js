'use strict';
const { randomBytes, scrypt: derive, timingSafeEqual, createHash } = require('node:crypto');
const { promisify } = require('node:util');
const scrypt = promisify(derive);
const cookieName = '__Host-fp_influencer';
const cookieOptions = { httpOnly: true, secure: true, sameSite: 'strict', path: '/' };
const hash = value => createHash('sha256').update(value).digest('hex');
const email = value => String(value || '').trim().toLowerCase();
const phone = value => { const digits = String(value || '').replace(/\D/g, ''); return /^55\d{10,11}$/.test(digits) ? digits.slice(2) : digits; };
const passwordValid = value => typeof value === 'string' && /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,16}$/.test(value);
async function passwordRecord(password) {
  const salt = randomBytes(16).toString('hex');
  return { passwordSalt: salt, passwordHash: (await scrypt(password, salt, 64)).toString('hex') };
}
async function passwordMatches(password, record) {
  if (typeof password !== 'string' || password.length > 128) return false;
  const actual = await scrypt(password, record?.passwordSalt || '0'.repeat(32), 64);
  const expected = Buffer.from(record?.passwordHash || '0'.repeat(128), 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
function token(req) { return new RegExp(`(?:^|;\\s*)${cookieName}=([a-f0-9]{64})(?:;|$)`).exec(req.get('cookie') || '')?.[1] || ''; }
async function identity(db, req) {
  const value = token(req); if (!value) return null;
  const session = await db.collection('influencerPortalSessions').doc(hash(value)).get();
  if (!session.exists || !Number.isSafeInteger(session.data().expiresAt) || session.data().expiresAt <= Date.now()) return null;
  const saved = session.data(), id = saved.influencerId;
  const [accessDoc, influencerDoc] = await Promise.all([db.collection('influencerPortalAccess').doc(id).get(), db.collection('influencers').doc(id).get()]);
  if (!accessDoc.exists || !influencerDoc.exists) return null;
  const access = accessDoc.data(), influencer = influencerDoc.data();
  if (access.mustChangePassword && (!Number.isSafeInteger(access.temporaryExpiresAt) || access.temporaryExpiresAt<=Date.now())) return null;
  if (!access.enabled || access.version !== saved.version || influencer.active === false || influencer.portalEnabled !== true ||
    email(influencer.email) !== access.email || phone(influencer.phone) !== access.phone) return null;
  return { id, name: String(influencer.name || ''), email: access.email, mustChangePassword:access.mustChangePassword===true };
}
async function provision(db, id, input, actor) {
  const ref = db.collection('influencers').doc(id), snapshot = await ref.get();
  if (!snapshot.exists) throw Error('Influenciador não encontrado.');
  const person = snapshot.data(), accessRef = db.collection('influencerPortalAccess').doc(id);
  const current = await accessRef.get(), previous = current.exists ? current.data() : null;
  if (input.enabled === false) {
    await db.runTransaction(async tx => {
      tx.set(accessRef, { enabled: false, version: randomBytes(16).toString('hex') }, { merge: true });
      tx.update(ref, { portalEnabled: false, portalUpdatedAt: new Date().toISOString() });
    });
    return { enabled: false };
  }
  const address = email(person.email), number = phone(person.phone);
  const initialPassword = (!previous?.passwordHash || input.reset===true) && !input.password ? 'Fp' + randomBytes(7).toString('hex') : null;
  const password = input.password || initialPassword;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address) || !/^\d{10,11}$/.test(number) || person.active === false) throw Error('Salve um e-mail e telefone válidos e ative o cadastro antes de liberar o portal.');
  if ((!previous?.passwordHash || password) && !passwordValid(password)) throw Error('Use uma senha de 8 a 16 caracteres, somente letras e números, incluindo ambos.');
  const secret = password ? await passwordRecord(password) : { passwordHash: previous.passwordHash, passwordSalt: previous.passwordSalt };
  const lookup = db.collection('influencerPortalEmails').doc(hash(address));
  await db.runTransaction(async tx => {
    const duplicate = await tx.get(lookup);
    if (duplicate.exists && duplicate.data().influencerId !== id) throw Error('Este e-mail já está liberado para outro influenciador.');
    if (previous?.email && previous.email !== address) tx.delete(db.collection('influencerPortalEmails').doc(hash(previous.email)));
    tx.set(lookup, { influencerId: id });
    tx.set(accessRef, { ...secret, mustChangePassword:password?true:previous?.mustChangePassword===true, temporaryExpiresAt:password?Date.now()+48*3600000:previous?.temporaryExpiresAt||null, email: address, phone: number, enabled: true, version: randomBytes(16).toString('hex'), updatedAt: new Date().toISOString(), updatedBy: actor });
    tx.update(ref, { portalEnabled: true, portalUpdatedAt: new Date().toISOString() });
  });
  const temporary=password||null;
  const invitation=temporary ? 'Olá, '+String(person.name||'').slice(0,100)+'! Seu acesso à Fios Perfeitos está pronto.\nPortal: https://www.fiosperfeitos.com.br/pages/influenciadores.html\nE-mail: '+address+'\nTelefone cadastrado: '+number+'\nSenha temporária: '+temporary+'\nVálida por 48 horas. Entre, crie sua senha pessoal de 8 a 16 caracteres com letras e números e complete sua foto e os produtos da sua vitrine. Não compartilhe este acesso.' : null;
  return { enabled: true, ...(temporary ? {initialPassword:temporary,whatsappUrl:'https://wa.me/55'+number+'?text='+encodeURIComponent(invitation)} : {}) };
}
module.exports = { cookieName, cookieOptions, hash, email, phone, passwordValid, passwordRecord, passwordMatches, token, identity, provision, randomBytes };
