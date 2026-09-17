/*
|--------------------------------------------------------------------------
| Address Service
|--------------------------------------------------------------------------
| Business logic for saved customer addresses.
|--------------------------------------------------------------------------
*/

const Address = require("../models/Address");

const {
  ADDRESS_LABELS,
} = require("../utils/constants");

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

const normalizeAddressData = (data) => {
  const normalized = {
    label: data.label,
    fullName: data.fullName.trim(),
    phone: data.phone.trim(),
    addressLine1: data.addressLine1.trim(),
    city: data.city.trim(),
    state: data.state.trim(),
    postalCode: data.postalCode.trim(),
    country: data.country.trim(),
  };

  if (data.addressLine2 !== undefined) {
    normalized.addressLine2 = data.addressLine2.trim();
  }

  if (data.landmark !== undefined) {
    normalized.landmark = data.landmark.trim();
  }

  if (data.isDefault !== undefined) {
    normalized.isDefault = Boolean(data.isDefault);
  }

  return normalized;
};

/*
|--------------------------------------------------------------------------
| Unset Existing Default Address
|--------------------------------------------------------------------------
*/

const unsetDefaultAddress = async (userId, excludeAddressId = null) => {
  const filter = {
    userId,
    isDefault: true,
  };

  if (excludeAddressId) {
    filter._id = {
      $ne: excludeAddressId,
    };
  }

  await Address.updateMany(
    filter,
    {
      $set: {
        isDefault: false,
      },
    }
  );
};

/*
|--------------------------------------------------------------------------
| Get All User Addresses
|--------------------------------------------------------------------------
*/

const getUserAddresses = async (userId) => {
  return Address.find({
    userId,
  })
    .sort({
      isDefault: -1,
      createdAt: -1,
    })
    .lean();
};

/*
|--------------------------------------------------------------------------
| Get Single User Address
|--------------------------------------------------------------------------
*/

const getUserAddress = async (userId, addressId) => {
  return Address.findOne({
    _id: addressId,
    userId,
  }).lean();
};

/*
|--------------------------------------------------------------------------
| Create Address
|--------------------------------------------------------------------------
*/

const createAddress = async (userId, addressData) => {
  const data = normalizeAddressData(addressData);

  /*
   * If this is the first address, automatically make it default.
   */
  const addressCount = await Address.countDocuments({
    userId,
  });

  const shouldBeDefault =
    addressCount === 0 || data.isDefault === true;

  /*
   * Only one address can be default.
   */
  if (shouldBeDefault) {
    await unsetDefaultAddress(userId);
  }

  const address = await Address.create({
    userId,
    ...data,
    isDefault: shouldBeDefault,
  });

  return address.toObject();
};

/*
|--------------------------------------------------------------------------
| Update Address
|--------------------------------------------------------------------------
*/

const updateAddress = async (
  userId,
  addressId,
  addressData
) => {
  const existingAddress = await Address.findOne({
    _id: addressId,
    userId,
  });

  if (!existingAddress) {
    const error = new Error("Address not found");
    error.statusCode = 404;
    throw error;
  }

  const data = normalizeAddressData(addressData);

  /*
   * If the address is being made default,
   * unset every other default address first.
   */
  if (data.isDefault === true) {
    await unsetDefaultAddress(userId, addressId);
  }

  /*
   * If isDefault is omitted during an update,
   * preserve the current value.
   */
  if (data.isDefault === undefined) {
    delete data.isDefault;
  }

  Object.assign(existingAddress, data);

  await existingAddress.save();

  return existingAddress.toObject();
};

/*
|--------------------------------------------------------------------------
| Delete Address
|--------------------------------------------------------------------------
*/

const deleteAddress = async (userId, addressId) => {
  const address = await Address.findOne({
    _id: addressId,
    userId,
  });

  if (!address) {
    const error = new Error("Address not found");
    error.statusCode = 404;
    throw error;
  }

  const wasDefault = address.isDefault;

  await Address.deleteOne({
    _id: addressId,
    userId,
  });

  /*
   * If the deleted address was the default one,
   * automatically promote the newest remaining address.
   */
  if (wasDefault) {
    const replacementAddress = await Address.findOne({
      userId,
    }).sort({
      createdAt: -1,
    });

    if (replacementAddress) {
      replacementAddress.isDefault = true;
      await replacementAddress.save();
    }
  }

  return {
    message: "Address deleted successfully",
    deletedAddressId: addressId,
  };
};

/*
|--------------------------------------------------------------------------
| Set Default Address
|--------------------------------------------------------------------------
*/

const setDefaultAddress = async (
  userId,
  addressId
) => {
  const address = await Address.findOne({
    _id: addressId,
    userId,
  });

  if (!address) {
    const error = new Error("Address not found");
    error.statusCode = 404;
    throw error;
  }

  /*
   * Unset current default address.
   */
  await unsetDefaultAddress(userId, addressId);

  /*
   * Set selected address as default.
   */
  address.isDefault = true;

  await address.save();

  return address.toObject();
};

module.exports = {
  getUserAddresses,
  getUserAddress,
  createAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
};