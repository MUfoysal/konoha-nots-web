import { collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc, updateDoc } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';
import { noteFromDocument } from '../../domain/entities/note.js';

export class FirestoreNotesDataSource {
  constructor(db, getUid) { this.db = db; this.getUid = getUid; }
  notesCollection() {
    const uid = this.getUid();
    if (!uid) throw Object.assign(new Error('Sign in to access your scrolls.'), { code: 'permission-denied' });
    return collection(this.db, 'users', uid, 'notes');
  }
  async list() {
    // Read the full user's notes collection so older documents without updatedAt
    // remain visible; the Notes UI already sorts the loaded archive locally.
    const snapshot = await getDocs(this.notesCollection());
    return snapshot.docs.map(item => noteFromDocument(item.id, item.data()));
  }
  async get(id) {
    const snapshot = await getDoc(doc(this.notesCollection(), String(id)));
    return snapshot.exists() ? noteFromDocument(snapshot.id, snapshot.data()) : null;
  }
  async create(data, { retry = false, ownerUid } = {}) {
    const uid = this.getUid();
    if (ownerUid && uid !== ownerUid) throw Object.assign(new Error('Your sign-in session changed before the scroll was created.'), { code: 'permission-denied' });
    const notes = this.notesCollection();
    const reference = data.id ? doc(notes, data.id) : doc(notes);
    if (retry && data.id) {
      const existing = await getDoc(reference);
      if (existing.exists()) return noteFromDocument(existing.id, existing.data());
    }
    await setDoc(reference, { title: data.title, content: data.content, tags: data.tags, isPinned: data.pinned, color: data.color, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    return { ...data, id: reference.id, createdAt: Date.now(), updatedAt: Date.now() };
  }
  async update(id, data) {
    await updateDoc(doc(this.notesCollection(), id), { title: data.title, content: data.content, tags: data.tags, isPinned: data.pinned, color: data.color, updatedAt: serverTimestamp() });
    return { ...data, id, updatedAt: Date.now() };
  }
  async remove(id) { await deleteDoc(doc(this.notesCollection(), id)); }
}
