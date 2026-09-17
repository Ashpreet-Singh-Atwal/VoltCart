/*
|--------------------------------------------------------------------------
| Address Controller
|--------------------------------------------------------------------------
*/

const {
  getUserAddresses,
  getUserAddress,
  createAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
} = require("../services/addressService");

/*
|--------------------------------------------------------------------------
| Get All Addresses
|--------------------------------------------------------------------------
| GET /api/addresses
|--------------------------------------------------------------------------
*/

const getAddresses = async (req, res, next) => {
  try {
    const addresses = await getUserAddresses(req.user._id);

    res.status(200).json({
      success: true,
      count: addresses.length,
      data: addresses,
    });
  } catch (error) {
    next(error);
  }
};

/*
|--------------------------------------------------------------------------
| Get Single Address
|--------------------------------------------------------------------------
| GET /api/addresses/:addressId
|--------------------------------------------------------------------------
*/

const getAddress = async (req, res, next) => {
  try {
    const address = await getUserAddress(
      req.user._id,
      req.params.addressId
    );

    if (!address) {
      return res.status(404).json({
        success: false,
        message: "Address not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: address,
    });
  } catch (error) {
    next(error);
  }
};

/*
|--------------------------------------------------------------------------
| Create Address
|--------------------------------------------------------------------------
| POST /api/addresses
|--------------------------------------------------------------------------
*/

const createNewAddress = async (req, res, next) => {
  try {
    const address = await createAddress(
      req.user._id,
      req.body
    );

    res.status(201).json({
      success: true,
      message: "Address created successfully",
      data: address,
    });
  } catch (error) {
    next(error);
  }
};

/*
|--------------------------------------------------------------------------
| Update Address
|--------------------------------------------------------------------------
| PUT /api/addresses/:addressId
|--------------------------------------------------------------------------
*/

const updateExistingAddress = async (
  req,
  res,
  next
) => {
  try {
    const address = await updateAddress(
      req.user._id,
      req.params.addressId,
      req.body
    );

    res.status(200).json({
      success: true,
      message: "Address updated successfully",
      data: address,
    });
  } catch (error) {
    next(error);
  }
};

/*
|--------------------------------------------------------------------------
| Delete Address
|--------------------------------------------------------------------------
| DELETE /api/addresses/:addressId
|--------------------------------------------------------------------------
*/

const removeAddress = async (req, res, next) => {
  try {
    const result = await deleteAddress(
      req.user._id,
      req.params.addressId
    );

    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

/*
|--------------------------------------------------------------------------
| Set Default Address
|--------------------------------------------------------------------------
| PATCH /api/addresses/:addressId/default
|--------------------------------------------------------------------------
*/

const makeDefaultAddress = async (
  req,
  res,
  next
) => {
  try {
    const address = await setDefaultAddress(
      req.user._id,
      req.params.addressId
    );

    res.status(200).json({
      success: true,
      message: "Default address updated successfully",
      data: address,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAddresses,
  getAddress,
  createNewAddress,
  updateExistingAddress,
  removeAddress,
  makeDefaultAddress,
};