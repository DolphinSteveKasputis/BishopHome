# Foursquare API Diagnosis Log

## Account Info
- **Developer portal**: foursquare.com/developer
- **Organization**: Steve Kasputis
- **Project name**: MyLifeApp
- **Plan type**: Sandbox (as of 2026-04-05)
- **Free Places Pro Calls Remaining**: 10,000
- **API Credit Balance**: $0.00
- **Credit card**: Added on 2026-04-05 (no automatic payments enabled)
- **Movement SDK**: Disabled

## Keys Tested
| Key | Status | Notes |
|-----|--------|-------|
| `KMDO3313VHLO3KATMVP52XV3FY3J4E3V0ZLPDNYOC0I25CTH` | ❌ 401 "Invalid request token." | First key generated (MyLifeAppKey), later deleted |
| `IJIWESKCVVBCYCEUXRTMV40T3QSRUAGSBJHJ1OV3NN1FYLEF` | ❌ 401 "Invalid request token." | Second key (MyLifeApp2), currently active as of 2026-04-05 |

Both keys are exactly **48 characters** long. (Note: typical modern API keys are often longer — worth verifying the full key wasn't truncated in the UI.)

## Endpoints Tested
All tests run via `curl` from the development machine (Windows, Claude Code terminal).

| Endpoint | Auth Format | Result |
|----------|-------------|--------|
| `https://api.foursquare.com/v3/places/search?query=coffee&ll=40.7128,-74.0060&limit=1` | `Authorization: <key>` | ❌ 401 "Invalid request token." |
| `https://api.foursquare.com/v3/places/search?...` | `Authorization: Bearer <key>` | ❌ 410 "This endpoint is no longer supported. Please refer to our documentation for how to migrate to Foursquare's new endpoints." |
| `https://api.foursquare.com/v3/places/search?...` | `Authorization: fsq3<key>` | ❌ 401 (empty body) |
| `https://api.foursquare.com/v3/places/nearby?ll=40.7128,-74.0060&limit=1` | `Authorization: <key>` | ❌ 401 (empty body) |
| `https://api.foursquare.com/v3/autocomplete?query=coffee&ll=40.7128,-74.0060&limit=1` | `Authorization: <key>` | ❌ 401 "Invalid request token." |
| `https://api.foursquare.com/v3/places/search?...` | No auth | ❌ 401 (empty body) |
| `https://api.foursquare.com/v3/places/search?...&api_key=<key>` | Query param | ❌ 401 (empty body, curl exit 18) |
| `https://places.foursquare.com/v3/places/search?...` | `Authorization: <key>` | ❌ 200 but returned HTML (web portal, not API) |
| OAuth Client ID as key | `Authorization: <clientId>` | ❌ 401 |

## OAuth Credentials (not used — for reference only)
- **Client ID**: FK2K13G1K1HPR4VVEOR0MS35SDQQPWYOTQZGDWPX3DMFTPTM
- **Client Secret**: HV1TYQ0UND5TP14LA02T1BT50SZCOGHOGVKSR4WZK55CRQKD
- These are for OAuth user-facing flows, NOT for Places API server calls

## What We Know
- The endpoint `https://api.foursquare.com/v3/places/search` is the correct v3 Places API endpoint
- The correct auth header format is `Authorization: <key>` (no Bearer prefix — Bearer returns 410 Gone pointing to old v2 API)
- The account has free calls available (10,000 Places Pro calls)
- A credit card has been added but the plan still shows "Sandbox"
- No verification email was received from Foursquare
- The Foursquare developer status page requires its own API key to access

## Likely Root Cause
The account is still in **Sandbox mode** even after adding a credit card. Foursquare may require a manual upgrade from Sandbox → Production, or there may be an additional verification/activation step not yet completed. In Sandbox mode, Service API Keys appear to be generated but not actually authorized to call the live API.

## Things NOT Yet Tried
- [ ] Logging into the Foursquare developer playground and testing the key there directly
- [ ] Looking for a "Upgrade to Production" or "Activate" button anywhere in the portal
- [ ] Contacting Foursquare support (there's a "contact us" link in the banner)
- [ ] Waiting 24 hours after adding the credit card to see if activation is delayed
- [ ] Checking if the key visible in the UI is truncated vs. the actual full key value

## Alternative: OpenStreetMap Overpass API
If Foursquare cannot be resolved, use OpenStreetMap as a drop-in replacement:
- **No API key required**
- **No account required**
- **Completely free, no billing**
- Nearby places query: `https://overpass-api.de/api/interpreter`
- Reverse geocoding (already in plan): OpenStreetMap Nominatim
- Trade-off: No ratings or Foursquare-specific venue metadata, but venue names and categories are sufficient for check-in use case
