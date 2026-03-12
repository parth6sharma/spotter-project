import { useEffect } from 'react'
import { CircleMarker, MapContainer, Marker, Popup, Polyline, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

const defaultIcon = L.icon({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
})

function FitMapToPlan({ points }) {
  const map = useMap()

  useEffect(() => {
    if (!points.length) {
      return
    }

    const bounds = L.latLngBounds(points)
    map.fitBounds(bounds, { padding: [36, 36] })
  }, [map, points])

  return null
}

export function RouteMap({ plan }) {
  const routeCoordinates = plan?.route?.geometry?.map((point) => [point.latitude, point.longitude]) || []
  const locationMarkers = plan?.route?.locations || []
  const stopMarkers = (plan?.stops || []).filter((stop) => stop.location)

  if (!routeCoordinates.length) {
    return (
      <div className="map-shell map-empty">
        <div>
          <h3>Route preview will appear here</h3>
          <p>Generate a trip plan to render the map, route geometry, and stop markers.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="map-shell">
      <MapContainer center={routeCoordinates[0]} zoom={6} scrollWheelZoom className="map-shell">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitMapToPlan points={routeCoordinates} />
        <Polyline positions={routeCoordinates} pathOptions={{ color: '#2563eb', weight: 5, opacity: 0.92 }} />

        {locationMarkers.map((location) => (
          <Marker
            key={`${location.label}-${location.latitude}-${location.longitude}`}
            icon={defaultIcon}
            position={[location.latitude, location.longitude]}
          >
            <Popup>
              <strong>{location.label}</strong>
              <br />
              {location.address}
            </Popup>
          </Marker>
        ))}

        {stopMarkers.map((stop) => (
          <CircleMarker
            key={`${stop.order}-${stop.start_time}`}
            center={[stop.location.latitude, stop.location.longitude]}
            radius={7}
            pathOptions={{ color: '#7c3aed', fillColor: '#8b5cf6', fillOpacity: 0.9, weight: 2 }}
          >
            <Popup>
              <strong>{stop.type.replace(/_/g, ' ')}</strong>
              <br />
              {stop.detail}
              <br />
              {stop.duration_hours} hrs
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  )
}
