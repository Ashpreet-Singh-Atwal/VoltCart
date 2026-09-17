require("dotenv").config();

const app = require("./app");
const connectDB = require("./config/db");

const {
  connectRedis,
  disconnectRedis,
} = require("./config/redis");

const {
  expireDueReservations,
} = require("./services/reservationService");

const PORT =
  process.env.PORT || 5000;

/*
|--------------------------------------------------------------------------
| Reservation Cleanup Interval
|--------------------------------------------------------------------------
|
| The database expiry timestamp is authoritative.
|
| This interval simply makes sure expired reservations are released
| from inventory without waiting for a customer to make another request.
|
*/

const RESERVATION_CLEANUP_INTERVAL_MS =
  30 * 1000;

let reservationCleanupInterval = null;

/*
|--------------------------------------------------------------------------
| Start Server
|--------------------------------------------------------------------------
*/

const startServer = async () => {
  try {
    /*
    |--------------------------------------------------------------------------
    | Connect MongoDB
    |--------------------------------------------------------------------------
    */

    await connectDB();
    await connectRedis();

    /*
    |--------------------------------------------------------------------------
    | Start HTTP server
    |--------------------------------------------------------------------------
    */

    const server = app.listen(
      PORT,
      () => {
        console.log(
          `VoltCart server running on port ${PORT}`
        );

        console.log(
          `Environment: ${
            process.env.NODE_ENV ||
            "development"
          }`
        );
      }
    );

    /*
    |--------------------------------------------------------------------------
    | Reservation Cleanup Worker
    |--------------------------------------------------------------------------
    */

    reservationCleanupInterval =
      setInterval(async () => {
        try {
          const expiredCount =
            await expireDueReservations();

          if (expiredCount > 0) {
            console.log(
              `Expired ${expiredCount} reservation(s)`
            );
          }
        } catch (error) {
          console.error(
            "Reservation cleanup failed:",
            error.message
          );
        }
      }, RESERVATION_CLEANUP_INTERVAL_MS);

    /*
    |--------------------------------------------------------------------------
    | Graceful Shutdown
    |--------------------------------------------------------------------------
    */

    const shutdown = async (signal) => {
  console.log(
    `${signal} received. Shutting down gracefully...`
  );
 
  if (reservationCleanupInterval) {
    clearInterval(reservationCleanupInterval);
    reservationCleanupInterval = null;
  }
 
  server.close(async () => {
    try {
      await disconnectRedis();
 
      console.log(
        "HTTP server and Redis connection closed."
      );
 
      process.exit(0);
      } catch (error) {
        console.error(
          "Shutdown failed:",
          error
        );
  
        process.exit(1);
      }
    });
  };

    process.on(
      "SIGINT",
      () => shutdown("SIGINT")
    );

    process.on(
      "SIGTERM",
      () => shutdown("SIGTERM")
    );

    /*
    |--------------------------------------------------------------------------
    | Unhandled Promise Rejection
    |--------------------------------------------------------------------------
    */

    process.on(
      "unhandledRejection",
      (error) => {
        console.error(
          "Unhandled promise rejection:",
          error
        );
      }
    );

    /*
    |--------------------------------------------------------------------------
    | Uncaught Exception
    |--------------------------------------------------------------------------
    */

    process.on(
      "uncaughtException",
      (error) => {
        console.error(
          "Uncaught exception:",
          error
        );

        shutdown(
          "uncaughtException"
        );
      }
    );
  } catch (error) {
    console.error(
      "Failed to start VoltCart server:",
      error
    );

    process.exit(1);
  }
};

startServer();