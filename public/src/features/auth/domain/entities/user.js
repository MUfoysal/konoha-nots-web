export function userFromAuth(firebaseUser, profile = {}) {
  return {
    id: firebaseUser.uid,
    uid: firebaseUser.uid,
    name: profile.displayName || firebaseUser.displayName || 'Shinobi',
    username: profile.username || firebaseUser.email?.split('@')[0] || 'shinobi',
    email: firebaseUser.email || '',
    emailVerified: firebaseUser.emailVerified,
    clan: profile.clan || 'Ronin',
    avatar: profile.photoURL || firebaseUser.photoURL || null,
    createdAt: profile.createdAt?.toMillis?.() || firebaseUser.metadata.creationTime || new Date().toISOString(),
  };
}
