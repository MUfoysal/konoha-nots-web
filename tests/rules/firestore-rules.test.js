import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, setDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';

let environment;
before(async () => {
  environment = await initializeTestEnvironment({
    projectId: 'konoha-notes-rules-test',
    firestore: { rules: fs.readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8') },
  });
});
after(async () => environment?.cleanup());

const noteData = () => ({ title: 'Scroll', content: '<p>hello</p>', tags: ['work'], isPinned: false, color: 'default', createdAt: serverTimestamp(), updatedAt: serverTimestamp() });

test('authenticated owner can create, read, update, and delete a note', async () => {
  const db = environment.authenticatedContext('user-a', { email: 'a@example.test', email_verified: true }).firestore();
  const reference = doc(collection(db, 'users', 'user-a', 'notes'));
  await assertSucceeds(setDoc(reference, noteData()));
  await assertSucceeds(getDoc(reference));
  await assertSucceeds(updateDoc(reference, { title: 'Updated', updatedAt: serverTimestamp() }));
  await assertSucceeds(deleteDoc(reference));
});

test('profile can be created only for the owner with a matching private username claim', async () => {
  const db = environment.authenticatedContext('profile-user', { email: 'p@example.test', email_verified: false }).firestore();
  await assertSucceeds(setDoc(doc(db, 'usernames', 'leaf_user'), { uid: 'profile-user' }));
  await assertSucceeds(setDoc(doc(db, 'users', 'profile-user'), {
    uid: 'profile-user', displayName: 'Leaf User', username: 'leaf_user', email: 'p@example.test',
    photoURL: null, clan: 'Ronin', createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  }));
  const other = environment.authenticatedContext('other-user', { email: 'o@example.test' }).firestore();
  await assertFails(setDoc(doc(other, 'users', 'other-user'), {
    uid: 'other-user', displayName: 'Other', username: 'leaf_user', email: 'o@example.test',
    photoURL: null, clan: 'Ronin', createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  }));
});

test('users cannot access another account notes and unverified users cannot access notes', async () => {
  const owner = environment.authenticatedContext('owner', { email: 'owner@example.test', email_verified: true }).firestore();
  const foreign = doc(owner, 'users', 'owner', 'notes', 'private-scroll');
  await assertSucceeds(setDoc(foreign, noteData()));
  const otherUser = environment.authenticatedContext('other', { email: 'other@example.test', email_verified: true }).firestore();
  await assertFails(getDoc(doc(otherUser, 'users', 'owner', 'notes', 'private-scroll')));
  await assertFails(updateDoc(doc(otherUser, 'users', 'owner', 'notes', 'private-scroll'), { title: 'stolen', updatedAt: serverTimestamp() }));
  await assertFails(deleteDoc(doc(otherUser, 'users', 'owner', 'notes', 'private-scroll')));
  const unverified = environment.authenticatedContext('unverified', { email: 'u@example.test', email_verified: false }).firestore();
  await assertFails(setDoc(doc(unverified, 'users', 'unverified', 'notes', 'n'), noteData()));
});

test('unauthenticated access and invalid note shapes are denied', async () => {
  const anonymous = environment.unauthenticatedContext().firestore();
  await assertFails(getDoc(doc(anonymous, 'users', 'someone', 'notes', 'n')));
  const owner = environment.authenticatedContext('owner', { email: 'owner@example.test', email_verified: true }).firestore();
  await assertFails(setDoc(doc(owner, 'users', 'owner', 'notes', 'bad'), { ...noteData(), extraField: true }));
  await assertFails(setDoc(doc(owner, 'users', 'owner', 'notes', 'long-tag'), { ...noteData(), tags: ['x'.repeat(41)] }));
});

test('username claims are private, owner-bound, and cannot be taken twice', async () => {
  const first = environment.authenticatedContext('first').firestore();
  const username = doc(first, 'usernames', 'leaf_writer');
  await assertSucceeds(setDoc(username, { uid: 'first' }));
  await assertSucceeds(setDoc(username, { uid: 'first' }));
  const second = environment.authenticatedContext('second').firestore();
  await assertFails(setDoc(doc(second, 'usernames', 'leaf_writer'), { uid: 'second' }));
  await assertFails(getDoc(doc(second, 'usernames', 'leaf_writer')));
});


test('users can read only their own profile and cannot change its UID', async () => {
  const owner = environment.authenticatedContext('profile-owner', { email: 'owner@example.test' }).firestore();
  await assertSucceeds(setDoc(doc(owner, 'usernames', 'profile_owner'), { uid: 'profile-owner' }));
  const profile = doc(owner, 'users', 'profile-owner');
  await assertSucceeds(setDoc(profile, {
    uid: 'profile-owner', displayName: 'Owner', username: 'profile_owner', email: 'owner@example.test',
    photoURL: null, clan: 'Ronin', createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  }));
  await assertSucceeds(getDoc(profile));
  const other = environment.authenticatedContext('profile-reader', { email: 'reader@example.test' }).firestore();
  await assertFails(getDoc(doc(other, 'users', 'profile-owner')));
  await assertFails(updateDoc(doc(other, 'users', 'profile-owner'), { displayName: 'Intruder', updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(profile, { uid: 'profile-reader', updatedAt: serverTimestamp() }));
});

test('note creation timestamps cannot be changed after creation', async () => {
  const db = environment.authenticatedContext('timestamp-owner', { email: 't@example.test', email_verified: true }).firestore();
  const reference = doc(collection(db, 'users', 'timestamp-owner', 'notes'));
  await assertSucceeds(setDoc(reference, noteData()));
  await assertFails(updateDoc(reference, { createdAt: new Date(0), updatedAt: serverTimestamp() }));
});
