from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime, time, timedelta
from math import asin, cos, radians, sin, sqrt
from typing import Any
from urllib.parse import quote
from urllib.request import Request, urlopen

from django.utils import timezone

MILES_PER_METER = 0.000621371
DEFAULT_START_HOUR = 8
MAX_DRIVING_HOURS_PER_SHIFT = 11.0
MAX_DUTY_HOURS_PER_SHIFT = 14.0
BREAK_AFTER_DRIVING_HOURS = 8.0
BREAK_DURATION_HOURS = 0.5
OFF_DUTY_RESET_HOURS = 10.0
PICKUP_DROPOFF_DURATION_HOURS = 1.0
FUEL_STOP_MILES = 1000.0
FUEL_STOP_DURATION_HOURS = 0.5
CYCLE_LIMIT_HOURS = 70.0
USER_AGENT = 'spotter-trip-planner/0.1'


class ExternalRoutingError(Exception):
    pass


@dataclass
class Point:
    latitude: float
    longitude: float


@dataclass
class ResolvedLocation:
    label: str
    address: str
    point: Point


@dataclass
class Event:
    start: datetime
    end: datetime
    status: str
    label: str
    start_mile: float
    end_mile: float
    location: dict[str, Any] | None = None

    @property
    def duration_hours(self) -> float:
        return round((self.end - self.start).total_seconds() / 3600, 2)


def build_trip_plan(payload: dict[str, Any]) -> dict[str, Any]:
    start_at = payload.get('trip_start_datetime') or _default_start_datetime()
    current_location = _resolve_location(payload['current_location'], 'Current location')
    pickup_location = _resolve_location(payload['pickup_location'], 'Pickup location')
    dropoff_location = _resolve_location(payload['dropoff_location'], 'Dropoff location')

    route_data = _fetch_route([current_location, pickup_location, dropoff_location])
    events, stops, warnings = _build_schedule(
        route_data=route_data,
        trip_start=start_at,
        pickup_location=pickup_location,
        dropoff_location=dropoff_location,
        current_cycle_used_hours=float(payload['current_cycle_used_hours']),
    )

    duty_hours = round(
        sum(event.duration_hours for event in events if event.status in {'driving', 'on_duty_not_driving'}),
        2,
    )
    projected_cycle_used = round(float(payload['current_cycle_used_hours']) + duty_hours, 2)

    if projected_cycle_used > CYCLE_LIMIT_HOURS:
        warnings.append(
            'Projected duty time exceeds the 70-hour / 8-day limit based on the single cycle input provided. '
            'A precise recap calculation needs the last 8 days of duty history.'
        )

    return {
        'trip': {
            'start_datetime': start_at.isoformat(),
            'assumptions': {
                'cycle_rule': 'Property-carrying driver, 70 hours / 8 days',
                'adverse_conditions': False,
                'fuel_every_miles': FUEL_STOP_MILES,
                'pickup_duration_hours': PICKUP_DROPOFF_DURATION_HOURS,
                'dropoff_duration_hours': PICKUP_DROPOFF_DURATION_HOURS,
            },
            'input_cycle_used_hours': float(payload['current_cycle_used_hours']),
            'projected_cycle_used_hours': projected_cycle_used,
        },
        'route': route_data,
        'stops': stops,
        'eld_logs': _build_eld_logs(events),
        'summary': {
            'total_distance_miles': route_data['summary']['distance_miles'],
            'total_drive_time_hours': route_data['summary']['drive_time_hours'],
            'total_duty_hours': duty_hours,
            'total_elapsed_hours': round(
                (events[-1].end - events[0].start).total_seconds() / 3600,
                2,
            ) if events else 0,
            'warnings': warnings,
        },
    }


def _default_start_datetime() -> datetime:
    now = timezone.now()
    return now.replace(hour=DEFAULT_START_HOUR, minute=0, second=0, microsecond=0)


def _resolve_location(raw_location: dict[str, Any], fallback_label: str) -> ResolvedLocation:
    label = raw_location.get('label') or fallback_label
    address = raw_location.get('address') or label

    latitude = raw_location.get('latitude')
    longitude = raw_location.get('longitude')
    if latitude is not None and longitude is not None:
        return ResolvedLocation(
            label=label,
            address=address,
            point=Point(latitude=float(latitude), longitude=float(longitude)),
        )

    query = quote(address)
    url = (
        'https://nominatim.openstreetmap.org/search'
        f'?q={query}&format=jsonv2&limit=1'
    )
    payload = _fetch_json(url)
    if not payload:
        raise ExternalRoutingError(f'Unable to geocode {label}.')

    result = payload[0]
    return ResolvedLocation(
        label=label,
        address=result.get('display_name', address),
        point=Point(latitude=float(result['lat']), longitude=float(result['lon'])),
    )


def _fetch_route(locations: list[ResolvedLocation]) -> dict[str, Any]:
    coordinates = ';'.join(
        f'{location.point.longitude},{location.point.latitude}' for location in locations
    )
    url = (
        'https://router.project-osrm.org/route/v1/driving/'
        f'{coordinates}?overview=full&geometries=geojson&steps=true'
    )
    payload = _fetch_json(url)

    routes = payload.get('routes') or []
    if not routes:
        raise ExternalRoutingError('Unable to build a route from the provided locations.')

    route = routes[0]
    geometry = route.get('geometry', {}).get('coordinates', [])
    polyline = [
        {'latitude': lat, 'longitude': lon}
        for lon, lat in geometry
    ]

    legs = []
    for index, leg in enumerate(route.get('legs', [])):
        instructions = []
        for step in leg.get('steps', []):
            maneuver = step.get('maneuver', {})
            road_name = step.get('name') or 'Continue'
            instruction = _format_instruction(maneuver, road_name, step.get('distance', 0.0))
            instructions.append(
                {
                    'instruction': instruction,
                    'distance_miles': round(step.get('distance', 0.0) * MILES_PER_METER, 2),
                    'duration_minutes': round(step.get('duration', 0.0) / 60, 1),
                }
            )

        legs.append(
            {
                'index': index + 1,
                'from': locations[index].label,
                'to': locations[index + 1].label,
                'distance_miles': round(leg.get('distance', 0.0) * MILES_PER_METER, 2),
                'drive_time_hours': round(leg.get('duration', 0.0) / 3600, 2),
                'steps': instructions,
            }
        )

    return {
        'locations': [
            {
                'label': location.label,
                'address': location.address,
                'latitude': location.point.latitude,
                'longitude': location.point.longitude,
            }
            for location in locations
        ],
        'geometry': polyline,
        'legs': legs,
        'summary': {
            'distance_miles': round(route.get('distance', 0.0) * MILES_PER_METER, 2),
            'drive_time_hours': round(route.get('duration', 0.0) / 3600, 2),
        },
    }


def _fetch_json(url: str) -> Any:
    request = Request(url, headers={'User-Agent': USER_AGENT})
    try:
        with urlopen(request, timeout=20) as response:
            return json.loads(response.read().decode('utf-8'))
    except Exception as exc:
        raise ExternalRoutingError(f'External routing service error: {exc}') from exc


def _format_instruction(maneuver: dict[str, Any], road_name: str, distance_meters: float) -> str:
    move_type = maneuver.get('type', 'continue').replace('_', ' ')
    modifier = maneuver.get('modifier', '')
    modifier_prefix = f' {modifier}' if modifier else ''
    return f'{move_type.title()}{modifier_prefix} onto {road_name} for {round(distance_meters * MILES_PER_METER, 2)} mi'


def _build_schedule(
    *,
    route_data: dict[str, Any],
    trip_start: datetime,
    pickup_location: ResolvedLocation,
    dropoff_location: ResolvedLocation,
    current_cycle_used_hours: float,
) -> tuple[list[Event], list[dict[str, Any]], list[str]]:
    events: list[Event] = []
    stops: list[dict[str, Any]] = []
    warnings: list[str] = []

    current_time = trip_start
    driving_since_break = 0.0
    driving_today = 0.0
    duty_today = 0.0
    cumulative_miles = 0.0
    next_fuel_at = FUEL_STOP_MILES
    geometry_points = [
        Point(latitude=point['latitude'], longitude=point['longitude'])
        for point in route_data['geometry']
    ]

    for leg in route_data['legs']:
        leg_miles = leg['distance_miles']
        leg_hours = leg['drive_time_hours']
        speed_mph = leg_miles / leg_hours if leg_hours else 0.0
        remaining_miles = leg_miles
        remaining_hours = leg_hours

        while remaining_hours > 0.01:
            drive_limit = min(
                MAX_DRIVING_HOURS_PER_SHIFT - driving_today,
                MAX_DUTY_HOURS_PER_SHIFT - duty_today,
                BREAK_AFTER_DRIVING_HOURS - driving_since_break,
            )

            if drive_limit <= 0.01:
                if driving_today >= MAX_DRIVING_HOURS_PER_SHIFT or duty_today >= MAX_DUTY_HOURS_PER_SHIFT:
                    off_duty_start = current_time
                    current_time += timedelta(hours=OFF_DUTY_RESET_HOURS)
                    events.append(
                        Event(
                            start=off_duty_start,
                            end=current_time,
                            status='off_duty',
                            label='10-hour reset',
                            start_mile=cumulative_miles,
                            end_mile=cumulative_miles,
                            location=_location_payload(_interpolate_along_geometry(geometry_points, cumulative_miles)),
                        )
                    )
                    stops.append(
                        _stop_payload(
                            stop_type='overnight_reset',
                            order=len(stops) + 1,
                            start=off_duty_start,
                            duration_hours=OFF_DUTY_RESET_HOURS,
                            mile_marker=cumulative_miles,
                            location=_location_payload(_interpolate_along_geometry(geometry_points, cumulative_miles)),
                            detail='Required 10-hour off-duty reset.',
                        )
                    )
                    driving_today = 0.0
                    duty_today = 0.0
                    driving_since_break = 0.0
                    continue

                break_start = current_time
                current_time += timedelta(hours=BREAK_DURATION_HOURS)
                events.append(
                    Event(
                        start=break_start,
                        end=current_time,
                        status='off_duty',
                        label='30-minute break',
                        start_mile=cumulative_miles,
                        end_mile=cumulative_miles,
                        location=_location_payload(_interpolate_along_geometry(geometry_points, cumulative_miles)),
                    )
                )
                stops.append(
                    _stop_payload(
                        stop_type='rest_break',
                        order=len(stops) + 1,
                        start=break_start,
                        duration_hours=BREAK_DURATION_HOURS,
                        mile_marker=cumulative_miles,
                        location=_location_payload(_interpolate_along_geometry(geometry_points, cumulative_miles)),
                        detail='30-minute break after 8 hours of driving.',
                    )
                )
                driving_since_break = 0.0
                continue

            drive_hours = min(remaining_hours, drive_limit)
            miles_driven = remaining_miles if remaining_hours == 0 else speed_mph * drive_hours
            segment_start = current_time
            segment_end = current_time + timedelta(hours=drive_hours)
            events.append(
                Event(
                    start=segment_start,
                    end=segment_end,
                    status='driving',
                    label=f"Drive to {leg['to']}",
                    start_mile=cumulative_miles,
                    end_mile=cumulative_miles + miles_driven,
                    location=_location_payload(_interpolate_along_geometry(geometry_points, cumulative_miles + miles_driven)),
                )
            )
            current_time = segment_end
            cumulative_miles += miles_driven
            remaining_miles = max(0.0, remaining_miles - miles_driven)
            remaining_hours = max(0.0, remaining_hours - drive_hours)
            driving_today += drive_hours
            duty_today += drive_hours
            driving_since_break += drive_hours

            while cumulative_miles >= next_fuel_at:
                fuel_start = current_time
                current_time += timedelta(hours=FUEL_STOP_DURATION_HOURS)
                events.append(
                    Event(
                        start=fuel_start,
                        end=current_time,
                        status='on_duty_not_driving',
                        label='Fuel stop',
                        start_mile=cumulative_miles,
                        end_mile=cumulative_miles,
                        location=_location_payload(_interpolate_along_geometry(geometry_points, cumulative_miles)),
                    )
                )
                duty_today += FUEL_STOP_DURATION_HOURS
                stops.append(
                    _stop_payload(
                        stop_type='fuel',
                        order=len(stops) + 1,
                        start=fuel_start,
                        duration_hours=FUEL_STOP_DURATION_HOURS,
                        mile_marker=cumulative_miles,
                        location=_location_payload(_interpolate_along_geometry(geometry_points, cumulative_miles)),
                        detail='Fuel stop inserted at approximately every 1,000 miles.',
                    )
                )
                next_fuel_at += FUEL_STOP_MILES

        leg_end_location = pickup_location if leg['to'] == pickup_location.label else dropoff_location
        service_start = current_time
        current_time += timedelta(hours=PICKUP_DROPOFF_DURATION_HOURS)
        service_label = 'Pickup' if leg['to'] == pickup_location.label else 'Dropoff'
        detail = '1 hour at pickup.' if service_label == 'Pickup' else '1 hour at delivery.'
        events.append(
            Event(
                start=service_start,
                end=current_time,
                status='on_duty_not_driving',
                label=service_label,
                start_mile=cumulative_miles,
                end_mile=cumulative_miles,
                location=_location_payload(leg_end_location.point),
            )
        )
        duty_today += PICKUP_DROPOFF_DURATION_HOURS
        stops.append(
            _stop_payload(
                stop_type=service_label.lower(),
                order=len(stops) + 1,
                start=service_start,
                duration_hours=PICKUP_DROPOFF_DURATION_HOURS,
                mile_marker=cumulative_miles,
                location=_location_payload(leg_end_location.point, label=leg_end_location.label),
                detail=detail,
            )
        )

    if current_cycle_used_hours + sum(
        event.duration_hours for event in events if event.status in {'driving', 'on_duty_not_driving'}
    ) > CYCLE_LIMIT_HOURS:
        warnings.append('Trip may require recap hours or a restart because the remaining cycle time appears limited.')

    return events, stops, warnings


def _build_eld_logs(events: list[Event]) -> list[dict[str, Any]]:
    if not events:
        return []

    daily_segments: dict[str, list[dict[str, Any]]] = {}
    for event in events:
        cursor = event.start
        while cursor < event.end:
            next_midnight = datetime.combine(cursor.date() + timedelta(days=1), time.min, tzinfo=cursor.tzinfo)
            segment_end = min(event.end, next_midnight)
            day_key = cursor.date().isoformat()
            day_start = datetime.combine(cursor.date(), time.min, tzinfo=cursor.tzinfo)
            start_hour = (cursor - day_start).total_seconds() / 3600
            end_hour = (segment_end - day_start).total_seconds() / 3600
            daily_segments.setdefault(day_key, []).append(
                {
                    'status': event.status,
                    'label': event.label,
                    'start_hour': round(start_hour, 2),
                    'end_hour': round(end_hour, 2),
                    'duration_hours': round(end_hour - start_hour, 2),
                }
            )
            cursor = segment_end

    logs = []
    for index, (day, segments) in enumerate(sorted(daily_segments.items()), start=1):
        totals = {
            'off_duty': 0.0,
            'sleeper_berth': 0.0,
            'driving': 0.0,
            'on_duty_not_driving': 0.0,
        }
        for segment in segments:
            totals[segment['status']] = round(totals.get(segment['status'], 0.0) + segment['duration_hours'], 2)

        logs.append(
            {
                'day_index': index,
                'date': day,
                'segments': segments,
                'totals': totals,
            }
        )

    return logs


def _stop_payload(
    *,
    stop_type: str,
    order: int,
    start: datetime,
    duration_hours: float,
    mile_marker: float,
    location: dict[str, Any] | None,
    detail: str,
) -> dict[str, Any]:
    return {
        'order': order,
        'type': stop_type,
        'start_time': start.isoformat(),
        'duration_hours': round(duration_hours, 2),
        'mile_marker': round(mile_marker, 2),
        'location': location,
        'detail': detail,
    }


def _location_payload(point: Point | None, label: str | None = None) -> dict[str, Any] | None:
    if point is None:
        return None

    payload = {
        'latitude': round(point.latitude, 6),
        'longitude': round(point.longitude, 6),
    }
    if label:
        payload['label'] = label
    return payload


def _interpolate_along_geometry(points: list[Point], target_miles: float) -> Point | None:
    if not points:
        return None
    if len(points) == 1 or target_miles <= 0:
        return points[0]

    traversed = 0.0
    for index in range(1, len(points)):
        start = points[index - 1]
        end = points[index]
        segment_miles = _haversine_miles(start, end)
        if traversed + segment_miles >= target_miles:
            ratio = 0.0 if segment_miles == 0 else (target_miles - traversed) / segment_miles
            return Point(
                latitude=start.latitude + (end.latitude - start.latitude) * ratio,
                longitude=start.longitude + (end.longitude - start.longitude) * ratio,
            )
        traversed += segment_miles

    return points[-1]


def _haversine_miles(first: Point, second: Point) -> float:
    latitude_1 = radians(first.latitude)
    longitude_1 = radians(first.longitude)
    latitude_2 = radians(second.latitude)
    longitude_2 = radians(second.longitude)

    delta_latitude = latitude_2 - latitude_1
    delta_longitude = longitude_2 - longitude_1
    a = (
        sin(delta_latitude / 2) ** 2
        + cos(latitude_1) * cos(latitude_2) * sin(delta_longitude / 2) ** 2
    )
    c = 2 * asin(sqrt(a))
    return 3958.7613 * c
