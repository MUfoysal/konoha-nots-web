import { NotesRepository } from '../../domain/repositories/notes-repository.js';
export class FirestoreNotesRepository extends NotesRepository {
  constructor(dataSource) { super(); this.dataSource = dataSource; }
  list() { return this.dataSource.list(); }
  create(input) { return this.dataSource.create(input); }
  update(id, input) { return this.dataSource.update(id, input); }
  remove(id) { return this.dataSource.remove(id); }
}
