const jwt = require("jsonwebtoken");
const User = require("../models/User");

const protect = async (req, res, next) => {
  try {
    const token = req.cookies?.[
      process.env.COOKIE_NAME || "voltcart_token"
    ];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Authentication required"
      });
    }

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({
        success: false,
        message: "Authentication configuration is missing"
      });
    }

    let decoded;

    try {
      decoded = jwt.verify(
        token,
        process.env.JWT_SECRET
      );
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: "Authentication required"
      });
    }

    const user = await User.findById(
      decoded.userId
    );

    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: "Authentication required"
      });
    }

    req.user = user;

    /*
    |--------------------------------------------------------------------------
    | Activity tracking
    |--------------------------------------------------------------------------
    */

    user.lastActivityAt = new Date();

    await user.save({
      validateBeforeSave: false
    });

    next();
  } catch (error) {
    next(error);
  }
};

const optionalAuth = async (
  req,
  res,
  next
) => {
  try {
    const token = req.cookies?.[
      process.env.COOKIE_NAME || "voltcart_token"
    ];

    if (!token) {
      req.user = null;
      return next();
    }

    try {
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET
      );

      const user = await User.findById(
        decoded.userId
      );

      if (user && user.isActive) {
        req.user = user;
      } else {
        req.user = null;
      }
    } catch (error) {
      req.user = null;
    }

    next();
  } catch (error) {
    next(error);
  }
};

const requireAdmin = (
  req,
  res,
  next
) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Authentication required"
    });
  }

  if (req.user.role !== "admin") {
    return res.status(403).json({
      success: false,
      message: "Admin access required"
    });
  }

  next();
};

module.exports = {
  protect,
  optionalAuth,
  requireAdmin
};