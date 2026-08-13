import BaseRepository from "./BaseRepository.js";
import User from "../models/User.model.js";

export default class UserRepository extends BaseRepository {
  constructor() {
    super(User);
  }

  findByEmailWithPassword(email) {
    return this.model.findOne({ email }, "+password +email");
  }

  findByEmail(email) {
    return this.model.findOne({ email });
  }

  updateById(userId, payload) {
    return this.model.findByIdAndUpdate(userId, payload, { new: true });
  }
}
