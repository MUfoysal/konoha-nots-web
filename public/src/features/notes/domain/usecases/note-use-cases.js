import { validateNote } from '../entities/note.js';
export const listNotes = repository => repository.list();
export const createNote = (repository, input) => repository.create(validateNote(input));
export const updateNote = (repository, id, input) => repository.update(id, validateNote(input));
export const deleteNote = (repository, id) => repository.remove(id);
