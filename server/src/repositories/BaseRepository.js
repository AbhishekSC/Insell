export default class BaseRepository {
  constructor(model) {
    this.model = model;
  }

  findById(id) {
    return this.model.findById(id);
  }

  find(query = {}, projection = null, options = {}) {
    return this.model.find(query, projection, options);
  }

  create(payload) {
    return this.model.create(payload);
  }

  updateById(id, payload, options = { new: true }) {
    return this.model.findByIdAndUpdate(id, payload, options);
  }

  deleteById(id) {
    return this.model.findByIdAndDelete(id);
  }
}
