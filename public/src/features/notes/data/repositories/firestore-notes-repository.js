import { NotesRepository } from '../../domain/repositories/notes-repository.js';
export class FirestoreNotesRepository extends NotesRepository {
  constructor(dataSource) { super(); this.dataSource = dataSource; }
  list() { return this.dataSource.list(); }
  get(id) { return this.dataSource.get(id); }
  create(input, options) { return this.dataSource.create(input, options); }
  update(id, input) { return this.dataSource.update(id, input); }
  remove(id) { return this.dataSource.remove(id); }
}
