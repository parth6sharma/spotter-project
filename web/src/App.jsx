import { useMemo, useState } from 'react'
import './App.css'
import { EldLogSheet } from './components/EldLogSheet'
import { RouteMap } from './components/RouteMap'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '')

const initialFormState = {
  current_location: 'Dallas, TX',
  pickup_location: 'Houston, TX',
  dropoff_location: 'Austin, TX',
  current_cycle_used_hours: '18',
  trip_start_datetime: '',
}

const summaryMetricConfig = [
  { key: 'total_distance_miles', label: 'Distance', suffix: ' mi' },
  { key: 'total_drive_time_hours', label: 'Drive time', suffix: ' hrs' },
  { key: 'total_duty_hours', label: 'Duty time', suffix: ' hrs' },
  { key: 'total_elapsed_hours', label: 'Elapsed', suffix: ' hrs' },
]

function App() {
  const [formState, setFormState] = useState(initialFormState)
  const [plan, setPlan] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const formattedStartDate = useMemo(() => {
    if (!plan?.trip?.start_datetime) {
      return 'Not calculated yet'
    }

    return new Date(plan.trip.start_datetime).toLocaleString([], {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
  }, [plan])

  const handleChange = (event) => {
    const { name, value } = event.target
    setFormState((current) => ({ ...current, [name]: value }))
  }

  const loadExample = () => {
    setFormState({
      current_location: 'Dallas, TX',
      pickup_location: 'Memphis, TN',
      dropoff_location: 'Nashville, TN',
      current_cycle_used_hours: '24',
      trip_start_datetime: '',
    })
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setLoading(true)
    setError('')

    const payload = {
      current_location: { address: formState.current_location },
      pickup_location: { address: formState.pickup_location },
      dropoff_location: { address: formState.dropoff_location },
      current_cycle_used_hours: Number(formState.current_cycle_used_hours),
    }

    if (formState.trip_start_datetime) {
      payload.trip_start_datetime = new Date(formState.trip_start_datetime).toISOString()
    }

    try {
      const response = await fetch(`${API_BASE_URL}/trips/plan/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.detail || 'Unable to generate trip plan.')
      }

      setPlan(data)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app-shell">
      <header className="hero">
        <div className="hero-copy">
          <span className="eyebrow">Trip planner + ELD log builder</span>
          <span style={{marginLeft: '1em', alignContent:""}}>by Parth Sharma</span>
          <h1>Plan legal routes and generate driver log sheets in one flow.</h1>
          <p>
            Enter trip details, review the route with stops and rests, and render
            daily ELD logs that match the backend scheduling assumptions.
          </p>
          <div className="assumption-list">
            <span>70 hrs / 8 days</span>
            <span>No adverse conditions</span>
            <span>Fuel every 1,000 miles</span>
            <span>1 hour pickup + drop-off</span>
          </div>
        </div>

        <div className="hero-stat-card glass-panel">
          <p className="muted-label">Planned start</p>
          <h2>{formattedStartDate}</h2>
          <div className="stat-stack">
            {/* <div>
              <span className="muted-label">API</span>
              <strong>{`${API_BASE_URL}/trips/plan/`}</strong>
            </div> */}
            <div>
              <span className="muted-label">Cycle projection</span>
              <strong>
                {plan ? `${plan.trip.projected_cycle_used_hours} hrs used` : 'Awaiting request'}
              </strong>
            </div>
          </div>
        </div>
      </header>

      <main className="dashboard-grid">
        <section className="glass-panel form-panel">
          <div className="section-heading">
            <div>
              <p className="section-kicker">Trip input</p>
              <h2>Dispatch details</h2>
            </div>
            <button className="ghost-button" type="button" onClick={loadExample}>
              Load example
            </button>
          </div>

          <form className="planner-form" onSubmit={handleSubmit}>
            <label>
              <span>Current location</span>
              <input
                name="current_location"
                value={formState.current_location}
                onChange={handleChange}
                placeholder="Dallas, TX"
                required
              />
            </label>

            <label>
              <span>Pickup location</span>
              <input
                name="pickup_location"
                value={formState.pickup_location}
                onChange={handleChange}
                placeholder="Houston, TX"
                required
              />
            </label>

            <label>
              <span>Dropoff location</span>
              <input
                name="dropoff_location"
                value={formState.dropoff_location}
                onChange={handleChange}
                placeholder="Austin, TX"
                required
              />
            </label>

            <div className="field-row">
              <label>
                <span>Current cycle used (hrs)</span>
                <input
                  name="current_cycle_used_hours"
                  type="number"
                  min="0"
                  max="70"
                  step="0.5"
                  value={formState.current_cycle_used_hours}
                  onChange={handleChange}
                  required
                />
              </label>

              <label>
                <span>Trip start (optional)</span>
                <input
                  name="trip_start_datetime"
                  type="datetime-local"
                  value={formState.trip_start_datetime}
                  onChange={handleChange}
                />
              </label>
            </div>

            {error ? <div className="error-banner">{error}</div> : null}

            <button className="primary-button" type="submit" disabled={loading}>
              {loading ? 'Planning route…' : 'Generate trip plan'}
            </button>
          </form>
        </section>

        <section className="glass-panel overview-panel">
          <div className="section-heading compact">
            <div>
              <p className="section-kicker">Overview</p>
              <h2>Trip summary</h2>
            </div>
          </div>

          {plan ? (
            <>
              <div className="summary-grid">
                {summaryMetricConfig.map((item) => (
                  <article className="metric-card" key={item.key}>
                    <span>{item.label}</span>
                    <strong>
                      {plan.summary[item.key]}
                      {item.suffix}
                    </strong>
                  </article>
                ))}
              </div>

              <div className="warnings-list">
                {(plan.summary.warnings?.length ? plan.summary.warnings : ['No critical warnings.']).map(
                  (warning) => (
                    <div className="warning-chip" key={warning}>
                      {warning}
                    </div>
                  ),
                )}
              </div>

              <div className="location-strip">
                {plan.route.locations.map((location) => (
                  <article className="location-card" key={`${location.label}-${location.latitude}`}>
                    <span>{location.label}</span>
                    <strong>{location.address}</strong>
                    <small>
                      {location.latitude.toFixed(3)}, {location.longitude.toFixed(3)}
                    </small>
                  </article>
                ))}
              </div>
            </>
          ) : (
            <div className="empty-state">
              <h3>No trip loaded yet</h3>
              <p>Submit the trip details to see the route, stops, and log sheets.</p>
            </div>
          )}
        </section>
        
        <section className="glass-panel map-panel">
          <div className="section-heading compact">
            <div>
              <p className="section-kicker">Route map</p>
              <h2>Stops, rests, and path</h2>
            </div>
          </div>
          <RouteMap plan={plan} />
        </section>

        <section className="glass-panel stops-panel">
          <div className="section-heading compact">
            <div>
              <p className="section-kicker">Execution plan</p>
              <h2>Stops and service events</h2>
            </div>
          </div>

          <div className="stop-list">
            {plan?.stops?.length ? (
              plan.stops.map((stop) => (
                <article className="stop-card" key={`${stop.order}-${stop.start_time}`}>
                  <div>
                    <span className="stop-order">Stop {stop.order}</span>
                    <h3>{humanizeStopType(stop.type)}</h3>
                    <p>{stop.detail}</p>
                  </div>
                  <div className="stop-meta">
                    <strong>{formatDateTime(stop.start_time)}</strong>
                    <span>{stop.duration_hours} hrs</span>
                    <span>{stop.mile_marker} mi</span>
                  </div>
                </article>
              ))
            ) : (
              <div className="empty-state compact">
                <h3>No stops yet</h3>
                <p>Stops populate after a trip is planned.</p>
              </div>
            )}
          </div>
        </section>


        <section className="glass-panel instructions-panel">
          <div className="section-heading compact">
            <div>
              <p className="section-kicker">Directions</p>
              <h2>Turn-by-turn instructions</h2>
            </div>
          </div>

          <div className="leg-list">
            {plan?.route?.legs?.length ? (
              plan.route.legs.map((leg) => (
                <article className="leg-card" key={leg.index}>
                  <header>
                    <div>
                      <span>Leg {leg.index}</span>
                      <h3>
                        {leg.from} → {leg.to}
                      </h3>
                    </div>
                    <strong>
                      {leg.distance_miles} mi · {leg.drive_time_hours} hrs
                    </strong>
                  </header>
                  <ol>
                    {leg.steps.map((step, index) => (
                      <li key={`${leg.index}-${index}`}>
                        <span>{step.instruction}</span>
                        <small>
                          {step.distance_miles} mi · {step.duration_minutes} min
                        </small>
                      </li>
                    ))}
                  </ol>
                </article>
              ))
            ) : (
              <div className="empty-state compact">
                <h3>No instructions yet</h3>
                <p>The route instructions will appear once the plan is generated.</p>
              </div>
            )}
          </div>
        </section>

        <section className="glass-panel logs-panel">
          <div className="section-heading compact">
            <div>
              <p className="section-kicker">Daily logs</p>
              <h2>Rendered ELD sheets</h2>
            </div>
          </div>

          <div className="log-sheet-stack">
            {plan?.eld_logs?.length ? (
              plan.eld_logs.map((log) => (
                <EldLogSheet
                  key={log.date}
                  log={log}
                  trip={plan.trip}
                  route={plan.route}
                  stops={plan.stops}
                />
              ))
            ) : (
              <div className="empty-state">
                <h3>No log sheets yet</h3>
                <p>Submit a trip to draw the driver’s daily duty status chart.</p>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  )
}

function humanizeStopType(value) {
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function formatDateTime(value) {
  return new Date(value).toLocaleString([], {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

export default App
