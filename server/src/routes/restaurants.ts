import { Router } from "express";
import { asyncHandler } from "../asyncHandler.js";
import { findNearbyRestaurants, GooglePlacesAuthError } from "../googlePlaces.js";

export const restaurantsRouter = Router();

const NOT_CONFIGURED_MESSAGE =
  "Restaurant location lookup isn't set up yet — add a real GOOGLE_PLACES_API_KEY in server/.env.";

// Nearby restaurants for the "use my location" flow. No auth required — it's
// a pure geo lookup, no user data involved (matches /api/foods/search).
restaurantsRouter.get("/nearby", asyncHandler(async (req, res) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    res.status(400).json({ error: "lat and lng query params are required" });
    return;
  }

  try {
    const restaurants = await findNearbyRestaurants(lat, lng);
    res.json(restaurants);
  } catch (err) {
    if (err instanceof GooglePlacesAuthError) {
      res.status(503).json({ error: NOT_CONFIGURED_MESSAGE });
      return;
    }
    throw err;
  }
}));
