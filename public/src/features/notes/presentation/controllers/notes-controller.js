import * as useCases from '../../domain/usecases/note-use-cases.js';

export class NotesController {
  constructor(repository) { this.repository = repository; this.state = 'loading'; }
  async load() { this.state = 'loading'; try { const notes = await useCases.listNotes(this.repository); this.state = notes.length ? 'loaded' : 'empty'; return notes; } catch (error) { this.state = 'error'; throw error; } }
  async create(input) { this.state = 'saving'; try { const note = await useCases.createNote(this.repository, input); this.state = 'saved'; return note; } catch (error) { this.state = 'error'; throw error; } }
  async update(id, input) { this.state = 'saving'; try { const note = await useCases.updateNote(this.repository, id, input); this.state = 'saved'; return note; } catch (error) { this.state = 'error'; throw error; } }
  async remove(id) { this.state = 'deleting'; try { await useCases.deleteNote(this.repository, id); this.state = 'loaded'; } catch (error) { this.state = 'error'; throw error; } }
}
