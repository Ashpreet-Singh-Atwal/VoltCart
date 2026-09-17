/*
|--------------------------------------------------------------------------
| Address Routes
|--------------------------------------------------------------------------
*/

const express = require("express");

const {
  getAddresses,
  getAddress,
  createNewAddress,
  updateExistingAddress,
  removeAddress,
  makeDefaultAddress,
} = require("../controllers/addressController");

const {
  createAddressValidator,
  updateAddressValidator,
  addressIdValidator,
} = require("../validators/addressValidator");

const {
  protect,
} = require("../middleware/authMiddleware");

const validate = require("../middleware/validationMiddleware");

const router = express.Router();

/*
|--------------------------------------------------------------------------
| All Address Routes Require Authentication
|--------------------------------------------------------------------------
*/

router.use(protect);

/*
|--------------------------------------------------------------------------
| GET /api/addresses
|--------------------------------------------------------------------------
| Get all saved addresses for logged-in user.
|--------------------------------------------------------------------------
*/

router.get(
  "/",
  getAddresses
);

/*
|--------------------------------------------------------------------------
| POST /api/addresses
|--------------------------------------------------------------------------
| Create a new saved address.
|--------------------------------------------------------------------------
*/

router.post(
  "/",
  createAddressValidator,
  validate,
  createNewAddress
);

/*
|--------------------------------------------------------------------------
| GET /api/addresses/:addressId
|--------------------------------------------------------------------------
| Get one address belonging to logged-in user.
|--------------------------------------------------------------------------
*/

router.get(
  "/:addressId",
  addressIdValidator,
  validate,
  getAddress
);

/*
|--------------------------------------------------------------------------
| PUT /api/addresses/:addressId
|--------------------------------------------------------------------------
| Update one address belonging to logged-in user.
|--------------------------------------------------------------------------
*/

router.put(
  "/:addressId",
  addressIdValidator,
  updateAddressValidator,
  validate,
  updateExistingAddress
);

/*
|--------------------------------------------------------------------------
| PATCH /api/addresses/:addressId/default
|--------------------------------------------------------------------------
| Make an address the user's default address.
|--------------------------------------------------------------------------
*/

router.patch(
  "/:addressId/default",
  addressIdValidator,
  validate,
  makeDefaultAddress
);

/*
|--------------------------------------------------------------------------
| DELETE /api/addresses/:addressId
|--------------------------------------------------------------------------
| Delete one saved address.
|--------------------------------------------------------------------------
*/

router.delete(
  "/:addressId",
  addressIdValidator,
  validate,
  removeAddress
);

module.exports = router;