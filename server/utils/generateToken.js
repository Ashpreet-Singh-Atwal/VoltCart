const jwt = require("jsonwebtoken");

const generateToken = (userId, options = {}) => {
  if (!process.env.JWT_SECRET) {
    throw new Error(
      "JWT_SECRET is not configured"
    );
  }

  const {
    rememberMe = false
  } = options;

  const expiresIn = rememberMe
    ? "30d"
    : "1d";

  return jwt.sign(
    {
      userId: userId.toString()
    },
    process.env.JWT_SECRET,
    {
      expiresIn
    }
  );
};

module.exports = generateToken;