# Spotter Backend

Django backend for trip planning and ELD log generation.

## Structure

- `src/config/` contains the Django project settings and entry modules
- `src/trips/` contains the API app, routing, validation, and ELD logic
- `manage.py`, `requirements.txt`, and `README.md` stay at the repo root

## What it does

- Accepts current, pickup, and dropoff locations
- Accepts current cycle used hours
- Uses free map services:
  - Nominatim for geocoding
  - OSRM for routing
- Returns:
  - Route summary and turn-by-turn steps
  - Suggested stops for pickup, dropoff, breaks, overnight resets, and fuel
  - ELD log sheet data grouped by day for frontend rendering

## API

### Health check

- `GET /api/health/`

### Trip planner

- `POST /api/trips/plan/`

Example request:

```json
{
  "current_location": {"address": "Dallas, TX"},
  "pickup_location": {"address": "Houston, TX"},
  "dropoff_location": {"address": "Austin, TX"},
  "current_cycle_used_hours": 18
}
```

You can also send coordinates directly:

```json
{
  "current_location": {"label": "Dallas", "latitude": 32.7767, "longitude": -96.7970},
  "pickup_location": {"label": "Houston", "latitude": 29.7604, "longitude": -95.3698},
  "dropoff_location": {"label": "Austin", "latitude": 30.2672, "longitude": -97.7431},
  "current_cycle_used_hours": 18,
  "trip_start_datetime": "2026-03-11T08:00:00Z"
}
```

## Run locally

```bash
/home/parth/Projects/spotter-project/.venv/bin/pip install -r requirements.txt
/home/parth/Projects/spotter-project/.venv/bin/python manage.py migrate
/home/parth/Projects/spotter-project/.venv/bin/python manage.py runserver
```

## Notes

- The 70-hour cycle validation is approximate because a full recap calculation needs the prior 8 days of duty history, not just the current total used hours.
- The frontend can use the returned `route.geometry`, `stops`, and `eld_logs` objects to render the map and daily log sheets.
