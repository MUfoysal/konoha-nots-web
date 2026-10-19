import { validateNote } from '../entities/note.js?v=20261019-7';
export const listNotes = repository => repository.list();
export const getNote = (repository, id) => repository.get(id);
export const createNote = (repository, input, options) => repository.create({ ...validateNote(input), id: input.id }, options);
export const updateNote = (repository, id, input) => repository.update(id, validateNote(input));
export const deleteNote = (repository, id) => repository.remove(id);
