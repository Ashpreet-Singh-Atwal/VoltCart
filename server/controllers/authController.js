const authService = require("../services/authService");

const register = async (
  req,
  res,
  next
) => {
  try {
    const {
      name,
      email,
      password
    } = req.body;

    const result =
      await authService.registerUser({
        name,
        email,
        password
      });

    /*
     * Automatically log the user in
     * after successful registration.
     */
    const loginResult =
      await authService.loginUser({
        email,
        password,
        rememberMe: false
      });

    res.cookie(
      loginResult.cookieName,
      loginResult.token,
      loginResult.cookieOptions
    );

    return res.status(201).json({
      success: true,
      message:
        "Account created successfully",
      user: result.user
    });
  } catch (error) {
    next(error);
  }
};

const login = async (
  req,
  res,
  next
) => {
  try {
    const {
      email,
      password,
      rememberMe = false
    } = req.body;

    const result =
      await authService.loginUser({
        email,
        password,
        rememberMe
      });

    res.cookie(
      result.cookieName,
      result.token,
      result.cookieOptions
    );

    return res.status(200).json({
      success: true,
      message: "Login successful",
      user: result.user
    });
  } catch (error) {
    next(error);
  }
};

const logout = async (
  req,
  res,
  next
) => {
  try {
    const result =
      authService.logoutUser();

    res.clearCookie(
      result.cookieName,
      result.cookieOptions
    );

    return res.status(200).json({
      success: true,
      message:
        "Logged out successfully"
    });
  } catch (error) {
    next(error);
  }
};

const getMe = async (
  req,
  res,
  next
) => {
  try {
    const user =
      await authService.getCurrentUser(
        req.user._id
      );

    return res.status(200).json({
      success: true,
      user
    });
  } catch (error) {
    next(error);
  }
};

const forgotPassword = async (
  req,
  res,
  next
) => {
  try {
    const { email } = req.body;

    /*
     * The service creates a reset token
     * when the account exists.
     *
     * Email delivery will be connected
     * to the email provider later.
     */
    await authService.createPasswordResetToken(
      email
    );

    /*
     * IMPORTANT:
     * This exact response is returned
     * whether or not the email exists.
     */
    return res.status(200).json({
      success: true,
      message:
        "If an account exists for that email, password reset instructions have been sent."
    });
  } catch (error) {
    next(error);
  }
};

const resetPassword = async (
  req,
  res,
  next
) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    await authService.resetPassword({
      token,
      password
    });

    return res.status(200).json({
      success: true,
      message:
        "Password has been reset successfully. You can now log in with your new password."
    });
  } catch (error) {
    next(error);
  }
};

const updateProfile = async (
  req,
  res,
  next
) => {
  try {
    const user =
      await authService.updateProfile(
        req.user._id,
        req.body
      );

    return res.status(200).json({
      success: true,
      message:
        "Profile updated successfully",
      user
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  logout,
  getMe,
  forgotPassword,
  resetPassword,
  updateProfile
};