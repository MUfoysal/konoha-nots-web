export function userFromAuth(firebaseUser, profile = {}) {
  const photoURL = profile.photoURL;
  const isFirebaseStoragePhoto = typeof photoURL === 'string'
    && photoURL.startsWith('https://firebasestorage.googleapis.com/v0/b/');
  const avatarMatch = typeof photoURL === 'string'
    ? /^konoha-avatar:v1:[a-z0-9-]+\.webp\|(\d+(?:\.\d{1,2})?)\|(\d{1,3})\|(\d{1,3})$/.exec(photoURL)
    : null;
  const isCatalogPhoto = Boolean(avatarMatch
    && Number(avatarMatch[1]) >= 1 && Number(avatarMatch[1]) <= 2.5
    && Number(avatarMatch[2]) <= 100 && Number(avatarMatch[3]) <= 100);
  const authPhotoURL = typeof firebaseUser.photoURL === 'string' && firebaseUser.photoURL.startsWith('https://')
    ? firebaseUser.photoURL
    : null;
  return {
    id: firebaseUser.uid,
    uid: firebaseUser.uid,
    name: profile.displayName || firebaseUser.displayName || 'Shinobi',
    username: profile.username || firebaseUser.email?.split('@')[0] || 'shinobi',
    email: firebaseUser.email || '',
    emailVerified: firebaseUser.emailVerified,
    clan: profile.clan || 'Ronin',
    avatar: isFirebaseStoragePhoto || isCatalogPhoto ? photoURL : authPhotoURL,
    createdAt: profile.createdAt?.toMillis?.() || firebaseUser.metadata.creationTime || new Date().toISOString(),
  };
}
