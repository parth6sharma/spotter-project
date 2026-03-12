from datetime import datetime
from unittest.mock import patch

from django.test import TestCase
from django.urls import reverse
from django.utils import timezone

from .services import Point, ResolvedLocation, build_trip_plan


class HealthCheckTests(TestCase):
    def test_project_home_endpoint(self):
        response = self.client.get("/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["api"], "/api/")

    def test_api_root_endpoint(self):
        response = self.client.get("/api/")

        self.assertEqual(response.status_code, 200)
        self.assertIn("trip_plan", response.json()["endpoints"])

    def test_favicon_endpoint(self):
        response = self.client.get("/favicon.ico")

        self.assertEqual(response.status_code, 204)

    def test_health_endpoint(self):
        response = self.client.get(reverse("health-check"))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "ok"})


class TripPlanApiTests(TestCase):
    @patch("trips.views.build_trip_plan")
    def test_trip_plan_endpoint_returns_payload(self, mocked_build_trip_plan):
        mocked_build_trip_plan.return_value = {
            "trip": {},
            "route": {},
            "stops": [],
            "eld_logs": [],
            "summary": {},
        }
        payload = {
            "current_location": {
                "latitude": 32.7767,
                "longitude": -96.7970,
                "label": "Dallas",
            },
            "pickup_location": {
                "latitude": 29.7604,
                "longitude": -95.3698,
                "label": "Houston",
            },
            "dropoff_location": {
                "latitude": 30.2672,
                "longitude": -97.7431,
                "label": "Austin",
            },
            "current_cycle_used_hours": 12,
        }

        response = self.client.post(
            reverse("trip-plan"), payload, content_type="application/json"
        )

        self.assertEqual(response.status_code, 200)
        self.assertIn("route", response.json())
        mocked_build_trip_plan.assert_called_once()


class TripPlanServiceTests(TestCase):
    @patch("trips.services._fetch_route")
    @patch("trips.services._resolve_location")
    def test_build_trip_plan_generates_stops_and_logs(
        self, mocked_resolve_location, mocked_fetch_route
    ):
        mocked_resolve_location.side_effect = [
            ResolvedLocation("Current", "Current", Point(32.7767, -96.7970)),
            ResolvedLocation("Pickup", "Pickup", Point(29.7604, -95.3698)),
            ResolvedLocation("Dropoff", "Dropoff", Point(30.2672, -97.7431)),
        ]
        mocked_fetch_route.return_value = {
            "locations": [],
            "geometry": [
                {"latitude": 32.7767, "longitude": -96.7970},
                {"latitude": 29.7604, "longitude": -95.3698},
                {"latitude": 30.2672, "longitude": -97.7431},
            ],
            "legs": [
                {
                    "index": 1,
                    "from": "Current",
                    "to": "Pickup",
                    "distance_miles": 250.0,
                    "drive_time_hours": 4.5,
                    "steps": [],
                },
                {
                    "index": 2,
                    "from": "Pickup",
                    "to": "Dropoff",
                    "distance_miles": 165.0,
                    "drive_time_hours": 3.0,
                    "steps": [],
                },
            ],
            "summary": {
                "distance_miles": 415.0,
                "drive_time_hours": 7.5,
            },
        }

        result = build_trip_plan(
            {
                "current_location": {
                    "label": "Current",
                    "latitude": 32.7767,
                    "longitude": -96.7970,
                },
                "pickup_location": {
                    "label": "Pickup",
                    "latitude": 29.7604,
                    "longitude": -95.3698,
                },
                "dropoff_location": {
                    "label": "Dropoff",
                    "latitude": 30.2672,
                    "longitude": -97.7431,
                },
                "current_cycle_used_hours": 20.0,
                "trip_start_datetime": timezone.make_aware(
                    datetime(2026, 3, 11, 8, 0, 0)
                ),
            }
        )

        self.assertEqual(result["summary"]["total_distance_miles"], 415.0)
        self.assertGreaterEqual(len(result["stops"]), 2)
        self.assertGreaterEqual(len(result["eld_logs"]), 1)
        self.assertIn("projected_cycle_used_hours", result["trip"])
