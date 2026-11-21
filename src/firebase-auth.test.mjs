import assert from 'node:assert/strict';
import { exchangeGoogleLogin, googleLoginError, mountGoogleLogin } from './firebase-auth.js';
import { cloud } from './cloud.js';

let cleaned = 0, popup = 0;
const auth = {};
const sdk = {
  GoogleAuthProvider: class { setCustomParameters(value) { assert.deepEqual(value, {prompt:'select_account'}); } },
  signInWithPopup: async value => { assert.equal(value, auth); popup++; return {user:{getIdToken:async () => 'verified-by-backend-token'}}; },
  signOut: async value => { assert.equal(value, auth); cleaned++; },
};
const profile = { id:'existing-account' };
assert.equal(await exchangeGoogleLogin(sdk, auth, 'teacher', true, async (token, portal, remember) => {
  assert.equal(token, 'verified-by-backend-token'); assert.equal(portal, 'teacher'); assert.equal(remember, true);
  return profile;
}), profile);
assert.equal(popup, 1); assert.equal(cleaned, 1);
await assert.rejects(exchangeGoogleLogin(sdk, auth, 'student', false, async () => { throw new Error('Not authorized'); }), /Not authorized/);
assert.equal(cleaned, 2);
sdk.signInWithPopup = async () => { throw Object.assign(new Error('cancelled'), {code:'auth/popup-closed-by-user'}); };
await assert.rejects(exchangeGoogleLogin(sdk, auth, 'student', false, () => assert.fail('Cancelled popup must not exchange a token')), /cancelled/);
assert.equal(cleaned, 3);
assert.match(googleLoginError({code:'auth/popup-blocked'}).message, /封鎖/);
assert.equal(googleLoginError(new Error('Backend rejection')).message, 'Backend rejection');
cloud.authConfig = async () => ({firebase:{enabled:false}});
const button = {isConnected:true, hidden:true};
await mountGoogleLogin(button, 'admin', assert.fail, assert.fail);
assert.equal(button.hidden, true);
console.log('Firebase frontend: token exchange, denied account, popup cancellation, cleanup and disabled config passed');
