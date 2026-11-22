import assert from 'node:assert/strict';
import { exchangeProviderLogin, providerLoginError, mountProviderLogin,authorizeProviderAccount } from './firebase-auth.js';
import { cloud } from './cloud.js';

let cleaned = 0, popup = 0;
const auth = {};
const sdk = {
  GoogleAuthProvider: class { setCustomParameters(value) { assert.deepEqual(value, {prompt:'select_account'}); } },
  signInWithPopup: async value => { assert.equal(value, auth); popup++; return {user:{getIdToken:async () => 'verified-by-backend-token'}}; },
  signOut: async value => { assert.equal(value, auth); cleaned++; },
};
const profile = { id:'existing-account' };
assert.equal(await exchangeProviderLogin(sdk, auth, 'teacher', true, async (token, portal, remember) => {
  assert.equal(token, 'verified-by-backend-token'); assert.equal(portal, 'teacher'); assert.equal(remember, true);
  return profile;
}), profile);
assert.equal(popup, 1); assert.equal(cleaned, 1);
await assert.rejects(exchangeProviderLogin(sdk, auth, 'student', false, async () => { throw new Error('Not authorized'); }), /Not authorized/);
assert.equal(cleaned, 2);
sdk.signInWithPopup = async () => { throw Object.assign(new Error('cancelled'), {code:'auth/popup-closed-by-user'}); };
await assert.rejects(exchangeProviderLogin(sdk, auth, 'student', false, () => assert.fail('Cancelled popup must not exchange a token')), /cancelled/);
assert.equal(cleaned, 3);
assert.match(providerLoginError({code:'auth/popup-blocked'}).message, /封鎖/);
assert.equal(providerLoginError(new Error('Backend rejection')).message, 'Backend rejection');
cloud.authConfig = async () => ({firebase:{enabled:false}});
const button = {isConnected:true, hidden:true};
await mountProviderLogin(button, 'admin', assert.fail, assert.fail);
assert.equal(button.hidden, true);
cloud.authConfig=async()=>({firebase:{enabled:true,config:{projectId:'old-backend'}}});
await mountProviderLogin(button,'student',assert.fail,assert.fail);
assert.equal(button.hidden,true,'Old email-based backend must not show the provider login button');
await mountProviderLogin(button,'student',assert.fail,assert.fail,'github');
assert.equal(button.hidden,true,'Backend without GitHub capability must not show GitHub login');
sdk.GithubAuthProvider=class {};
sdk.signInWithPopup=async(authValue,provider)=>{assert.equal(authValue,auth);assert.ok(provider instanceof sdk.GithubAuthProvider);return {user:{getIdToken:async()=> 'github-id-token'}};};
assert.equal(await exchangeProviderLogin(sdk,auth,'student',true,async(token,portal,remember,provider)=>{assert.equal(token,'github-id-token');assert.equal(provider,'github');assert.equal(portal,'student');assert.equal(remember,true);return profile;},()=>{},'github'),profile);
await assert.rejects(authorizeProviderAccount(sdk,auth,assert.fail,'unknown'),/不支援/);
assert.match(providerLoginError({code:'auth/popup-blocked'},'github').message,/GitHub/);
assert.match(providerLoginError({code:'auth/account-exists-with-different-credential'},'github').message,/不會自動合併/);
console.log('Firebase frontend: token exchange, denied account, popup cancellation, cleanup and disabled config passed');
