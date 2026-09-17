const crypto = require("crypto");
const bcrypt = require("bcryptjs");

const User = require("../models/User");
const generateToken = require("../utils/generateToken");

const SALT_ROUNDS = 12;

const getCookieName = () => {
  return process.env.COOKIE_NAME || "voltcart_token";
};

const getCookieOptions = (rememberMe = false) => {
  const isProduction =
    process.env.NODE_ENV === "production";

  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    path: "/",
    maxAge: rememberMe
      ? 30 * 24 * 60 * 60 * 1000
      : 24 * 60 * 60 * 1000
  };
};

const getClearCookieOptions = () => {
  const isProduction =
    process.env.NODE_ENV === "production";

  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    path: "/"
  };
};

const sanitizeUser = (user) => {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    phone: user.phone || "",
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
};

const registerUser = async ({
  name,
  email,
  password
}) => {
  const normalizedEmail =
    email.toLowerCase().trim();

  const existingUser = await User.findOne({
    email: normalizedEmail
  });

  if (existingUser) {
    const error = new Error(
      "An account with this email already exists"
    );

    error.statusCode = 409;

    throw error;
  }

  const hashedPassword =
    await bcrypt.hash(
      password,
      SALT_ROUNDS
    );

  const user = await User.create({
    name: name.trim(),
    email: normalizedEmail,
    password: hashedPassword
  });

  return {
    user: sanitizeUser(user)
  };
};

const loginUser = async ({
  email,
  password,
  rememberMe = false
}) => {
  const normalizedEmail =
    email.toLowerCase().trim();

  const user = await User.findOne({
    email: normalizedEmail
  }).select("+password");

  if (!user) {
    const error = new Error(
      "Invalid email or password"
    );

    error.statusCode = 401;

    throw error;
  }

  if (!user.isActive) {
    const error = new Error(
      "Invalid email or password"
    );

    error.statusCode = 401;

    throw error;
  }

  const passwordMatches =
    await bcrypt.compare(
      password,
      user.password
    );

  if (!passwordMatches) {
    const error = new Error(
      "Invalid email or password"
    );

    error.statusCode = 401;

    throw error;
  }

  user.lastActivityAt = new Date();

  await user.save({
    validateBeforeSave: false
  });

  const token = generateToken(
    user._id,
    {
      rememberMe
    }
  );

  return {
    token,
    cookieName: getCookieName(),
    cookieOptions:
      getCookieOptions(rememberMe),
    user: sanitizeUser(user)
  };
};

const logoutUser = () => {
  return {
    cookieName: getCookieName(),
    cookieOptions:
      getClearCookieOptions()
  };
};

const getCurrentUser = async (
  userId
) => {
  const user = await User.findById(
    userId
  );

  if (!user || !user.isActive) {
    const error = new Error(
      "User account could not be found"
    );

    error.statusCode = 401;

    throw error;
  }

  return sanitizeUser(user);
};

const updateProfile = async (
  userId,
  updates
) => {
  const allowedUpdates = {};

  if (
    typeof updates.name === "string"
  ) {
    allowedUpdates.name =
      updates.name.trim();
  }

  if (
    typeof updates.phone === "string"
  ) {
    allowedUpdates.phone =
      updates.phone.trim();
  }

  const user = await User.findByIdAndUpdate(
    userId,
    {
      $set: allowedUpdates
    },
    {
      new: true,
      runValidators: true
    }
  );

  if (!user) {
    const error = new Error(
      "User account could not be found"
    );

    error.statusCode = 404;

    throw error;
  }

  return sanitizeUser(user);
};

const createPasswordResetToken = async (
  email
) => {
  const normalizedEmail =
    email.toLowerCase().trim();

  const user = await User.findOne({
    email: normalizedEmail
  }).select(
    "+passwordResetToken +passwordResetExpires"
  );

  /*
   * Always return the same result to the
   * controller regardless of whether the
   * account exists.
   *
   * This prevents account discovery.
   */
  if (!user || !user.isActive) {
    return;
  }

  const rawToken =
    crypto.randomBytes(32).toString("hex");

  const hashedToken =
    crypto
      .createHash("sha256")
      .update(rawToken)
      .digest("hex");

  const expiresAt =
    new Date(
      Date.now() +
        15 * 60 * 1000
    );

  user.passwordResetToken =
    hashedToken;

  user.passwordResetExpires =
    expiresAt;

  await user.save({
    validateBeforeSave: false
  });

  /*
   * The raw token should be sent through
   * an email provider.
   *
   * No token is returned from this method
   * to the HTTP controller.
   */
  return {
    userId: user._id,
    email: user.email,
    rawToken,
    expiresAt
  };
};

const resetPassword = async ({
  token,
  password
}) => {
  if (!token) {
    const error = new Error(
      "Invalid or expired reset link"
    );

    error.statusCode = 400;

    throw error;
  }

  const hashedToken =
    crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: {
      $gt: new Date()
    }
  }).select(
    "+passwordResetToken +passwordResetExpires"
  );

  if (!user) {
    const error = new Error(
      "Invalid or expired reset link"
    );

    error.statusCode = 400;

    throw error;
  }

  const hashedPassword =
    await bcrypt.hash(
      password,
      SALT_ROUNDS
    );

  user.password =
    hashedPassword;

  user.passwordResetToken =
    undefined;

  user.passwordResetExpires =
    undefined;

  user.lastActivityAt =
    new Date();

  await user.save();

  return sanitizeUser(user);
};

module.exports = {
  registerUser,
  loginUser,
  logoutUser,
  getCurrentUser,
  updateProfile,
  createPasswordResetToken,
  resetPassword,
  getCookieName,
  getCookieOptions,
  getClearCookieOptions
};