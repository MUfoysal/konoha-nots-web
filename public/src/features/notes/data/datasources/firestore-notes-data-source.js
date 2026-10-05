import { addDoc, collection, deleteDoc, doc, getDocs, orderBy, query, serverTimestamp, updateDoc } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';
import { noteFromDocument } from '../../domain/entities/note.js';

export class FirestoreNotesDataSource {
  constructor(db, getUid) { this.db = db; this.getUid = getUid; }
  notesCollection() {
    const uid = this.getUid();
    if (!uid) throw Object.assign(new Error('Sign in to access your scrolls.'), { code: 'permission-denied' });
    return collection(this.db, 'users', uid, 'notes');
  }
  async list() {
    const snapshot = await getDocs(query(this.notesCollection(), orderBy('updatedAt', 'desc')));
    return snapshot.docs.map(item => noteFromDocument(item.id, item.data()));
  }
  async create(data) {
    const reference = await addDoc(this.notesCollection(), { title: data.title, content: data.content, tags: data.tags, isPinned: data.pinned, color: data.color, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    return { ...data, id: reference.id, createdAt: Date.now(), updatedAt: Date.now() };
  }
  async update(id, data) {
    await updateDoc(doc(this.notesCollection(), id), { title: data.title, content: data.content, tags: data.tags, isPinned: data.pinned, color: data.color, updatedAt: serverTimestamp() });
    return { ...data, id, updatedAt: Date.now() };
  }
  async remove(id) { await deleteDoc(doc(this.notesCollection(), id)); }
}
