import { issueAccessToken } from "../utils/jwt.js";

export default function generateAccessToken(user, res) {
  return issueAccessToken(user, res);
}
