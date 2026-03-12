const sheet = {
  width: 1120,
  height: 860,
}

const chart = {
  left: 144,
  right: 956,
  top: 236,
  headerHeight: 28,
  totalLeft: 984,
  totalRight: 1058,
}

chart.width = chart.right - chart.left
chart.graphTop = chart.top + chart.headerHeight

const dutyRows = [
  { key: 'off_duty', labelLines: ['1. Off Duty'], y: 295 },
  { key: 'sleeper_berth', labelLines: ['2. Sleeper', 'Berth'], y: 345 },
  { key: 'driving', labelLines: ['3. Driving'], y: 395 },
  { key: 'on_duty_not_driving', labelLines: ['4. On Duty', '(not driving)'], y: 445 },
]

const rowByStatus = Object.fromEntries(dutyRows.map((row) => [row.key, row]))
const dutyBand = 23
const chartBottom = dutyRows[dutyRows.length - 1].y + dutyBand

export function EldLogSheet({ log, trip, route, stops }) {
  const safeLog = log || { date: '', day_index: 1, totals: {}, segments: [] }
  const totals = safeLog.totals || {}
  const transitions = buildTransitions(safeLog.segments)

  const locations = route?.locations || []
  const origin = locations[0]?.address || 'Origin'
  const destination = locations.at(-1)?.address || 'Destination'
  const dayStops = (stops || []).filter((stop) => stop?.start_time?.startsWith?.(safeLog.date))
  const drivingHours = Number(totals.driving || 0)
  const onDutyHours = Number(totals.on_duty_not_driving || 0)
  const offDutyHours = Number(totals.off_duty || 0)
  const sleeperHours = Number(totals.sleeper_berth || 0)
  const totalMilesToday = estimateDailyMiles(route?.summary?.distance_miles || 0, route?.legs || [], safeLog, trip)
  const remarks = buildRemarks(dayStops)
  const remarksLines = toTextLines(remarks, 112, 4)
  const recap = buildRecapData({
    trip,
    drivingHours,
    onDutyHours,
    offDutyHours,
    sleeperHours,
  })
  const dateParts = getDateParts(safeLog.date)
  const tripStartLabel = trip?.start_datetime ? new Date(trip.start_datetime).toLocaleString() : 'N/A'

  return (
    <article className="eld-sheet">
      <header className="eld-sheet-header eld-sheet-header-paper">
        <div>
          <p>Rendered Driver Log</p>
          <h3>
            Day {safeLog.day_index} - {formatDate(safeLog.date)}
          </h3>
        </div>
        <div className="eld-meta">
          <span style={{ overflowWrap: 'break-word' }}>Start: {tripStartLabel}</span>
          <span>Origin: {origin}</span>
          <span>Destination: {destination}</span>
        </div>
      </header>

      <svg viewBox={`0 0 ${sheet.width} ${sheet.height}`} role="img" aria-label={`ELD log for ${safeLog.date}`}>
        <rect x="1" y="1" width={sheet.width - 2} height={sheet.height - 2} fill="#ffffff" stroke="#0f172a" />

        <text x="54" y="34" fontSize="29" fontWeight="700" fill="#000000">
          Drivers Daily Log
        </text>
        <text x="56" y="53" fontSize="11" fill="#000000">
          [24 hours]
        </text>
        <text x="836" y="24" fontSize="9.5" fill="#111827">
          Original - File at home terminal.
        </text>
        <text x="836" y="39" fontSize="9.5" fill="#111827">
          Duplicate - Driver retains in his/her possession for 8 days.
        </text>

        <text x="384" y="34" fontSize="10" fill="#111827">
          (month)
        </text>
        <text x="458" y="34" fontSize="10" fill="#111827">
          (day)
        </text>
        <text x="519" y="34" fontSize="10" fill="#111827">
          (year)
        </text>
        <line x1="348" y1="54" x2="420" y2="54" stroke="#0f172a" />
        <line x1="434" y1="54" x2="486" y2="54" stroke="#0f172a" />
        <line x1="500" y1="54" x2="562" y2="54" stroke="#0f172a" />
        <text x="382" y="50" textAnchor="middle" fontSize="12" fill="#000000">
          {dateParts.month}
        </text>
        <text x="460" y="50" textAnchor="middle" fontSize="12" fill="#000000">
          {dateParts.day}
        </text>
        <text x="531" y="50" textAnchor="middle" fontSize="12" fill="#000000">
          {dateParts.year}
        </text>

        <text x="58" y="90" fontSize="14" fontWeight="700" fill="#000000">
          From:
        </text>
        <text x="570" y="90" fontSize="14" fontWeight="700" fill="#000000">
          To:
        </text>
        <line x1="106" y1="96" x2="500" y2="96" stroke="#0f172a" />
        <line x1="604" y1="96" x2="1030" y2="96" stroke="#0f172a" />
        <text x="114" y="91" fontSize="11" fill="#000000">
          {origin}
        </text>
        <text x="614" y="91" fontSize="11" fill="#000000">
          {destination}
        </text>

        <FieldBox
          x={56}
          y={118}
          width={196}
          height={45}
          label="Total Miles Driving Today"
          value={formatNumber(totalMilesToday)}
          labelPosition="bottom"
          centerValue
        />
        <FieldBox
          x={254}
          y={118}
          width={172}
          height={45}
          label="Total Mileage Today"
          value={formatNumber(totalMilesToday)}
          labelPosition="bottom"
          centerValue
        />
        <FieldBox
          x={56}
          y={168}
          width={370}
          height={42}
          label="Truck/Tractor and Trailer Numbers or License Plate(s)/State (show each unit)"
          value="Unit 184 / Trailer 52 / Demo Fleet"
          labelPosition="bottom"
          valueFontSize={11}
        />

        <UnderlineField x={474} y={138} width={556} label="Name of Carrier or Carriers" value="Spotter Dispatch Demo" />
        <UnderlineField x={474} y={168} width={556} label="Main Office Address" value={formatAddressLine(origin, destination)} />
        <UnderlineField x={474} y={198} width={556} label="Home Terminal Address" value={origin} />

        <rect x="56" y={chart.top} width="1002" height={chart.headerHeight} fill="#111111" />
        <TextLines x={68} y={248} lines={['Mid-', 'night']} fontSize={10} lineHeight={10} fill="#ffffff" />
        {Array.from({ length: 24 }, (_, hour) => (
          <text
            key={`top-hour-${hour}`}
            x={xForHour(hour + 0.5)}
            y="254"
            textAnchor="middle"
            fontSize="10"
            fill="#ffffff"
          >
            {topHourLabel(hour)}
          </text>
        ))}
        <TextLines x={959} y={248} lines={['Mid-', 'night']} fontSize={10} lineHeight={10} fill="#ffffff" />
        <TextLines
          x={(chart.totalLeft + chart.totalRight) / 2}
          y={248}
          lines={['Total', 'Hours']}
          fontSize={10}
          lineHeight={10}
          fill="#ffffff"
          textAnchor="middle"
        />

        <rect x={chart.left} y={chart.graphTop} width={chart.width} height={chartBottom - chart.graphTop} fill="#ffffff" stroke="#0f172a" />
        <rect x={chart.totalLeft} y={chart.graphTop} width={chart.totalRight - chart.totalLeft} height={chartBottom - chart.graphTop} fill="#ffffff" stroke="#0f172a" />

        {Array.from({ length: 97 }, (_, index) => {
          const hourMark = index / 4
          const x = xForHour(hourMark)
          const isHour = index % 4 === 0
          const isMajor = index % 24 === 0 || index === 48 || index === 96
          const stroke = isMajor ? '#0f172a' : isHour ? '#475569' : '#94a3b8'
          const strokeWidth = isMajor ? '1.1' : isHour ? '0.9' : '0.7'

          return (
            <g key={`grid-${index}`}>
              <line x1={x} y1={chart.graphTop} x2={x} y2={chartBottom} stroke={stroke} strokeWidth={strokeWidth} />
              {dutyRows.map((row) => {
                const tickHalf = isMajor ? 23 : isHour ? 18 : 10
                return (
                  <line
                    key={`${row.key}-${index}`}
                    x1={x}
                    y1={row.y - tickHalf}
                    x2={x}
                    y2={row.y + tickHalf}
                    stroke="#0f172a"
                    strokeWidth={isHour ? '0.8' : '0.7'}
                  />
                )
              })}
            </g>
          )
        })}

        {dutyRows.map((row) => (
          <g key={row.key}>
            <TextLines x={22} y={row.labelLines.length > 1 ? row.y - 8 : row.y + 4} lines={row.labelLines} fontSize={11} lineHeight={12} fill="#000000" />
            <line x1={chart.left} y1={row.y} x2={chart.right} y2={row.y} stroke="#0f172a" strokeWidth="1.1" />
            <line x1={chart.totalLeft} y1={row.y - dutyBand} x2={chart.totalRight} y2={row.y - dutyBand} stroke="#0f172a" />
            <line x1={chart.totalLeft} y1={row.y + dutyBand} x2={chart.totalRight} y2={row.y + dutyBand} stroke="#0f172a" />
            <text x={(chart.totalLeft + chart.totalRight) / 2} y={row.y + 4} textAnchor="middle" fontSize="12" fill="#000000">
              {formatHours(totals[row.key] || 0)}
            </text>
          </g>
        ))}

        {transitions.map((segment, index) => (
          <g key={`${segment.status}-${segment.startHour}-${index}`}>
            <line
              x1={segment.startX}
              y1={segment.row.y}
              x2={segment.endX}
              y2={segment.row.y}
              stroke="#111111"
              strokeWidth="3.4"
              strokeLinecap="square"
            />
            {segment.nextRow && segment.nextRow.key !== segment.row.key ? (
              <line
                x1={segment.transitionX}
                y1={segment.row.y}
                x2={segment.transitionX}
                y2={segment.nextRow.y}
                stroke="#111111"
                strokeWidth="2.8"
                strokeLinecap="square"
              />
            ) : null}
          </g>
        ))}

        <text x="58" y="536" fontSize="14" fontWeight="700" fill="#000000">
          Remarks
        </text>
        <line x1="52" y1="546" x2="52" y2="742" stroke="#0f172a" strokeWidth="1.2" />
        <line x1="52" y1="606" x2="1034" y2="606" stroke="#64748b" strokeWidth="0.7" />
        <line x1="52" y1="648" x2="1034" y2="648" stroke="#64748b" strokeWidth="0.7" />
        <text x="60" y="582" fontSize="11" fontWeight="700" fill="#000000">
          Shipping
        </text>
        <text x="60" y="596" fontSize="11" fontWeight="700" fill="#000000">
          Documents:
        </text>
        <text x="60" y="627" fontSize="10.5" fill="#000000">
          DVL or Manifest No.
        </text>
        <text x="60" y="641" fontSize="10.5" fill="#000000">
          or
        </text>
        <text x="60" y="664" fontSize="10.5" fill="#000000">
          Shipper &amp; Commodity
        </text>
        <TextLines x={188} y={690} lines={remarksLines} fontSize={10.5} lineHeight={13} fill="#111827" />
        <text x="552" y="720" fontSize="9.5" textAnchor="middle" fill="#111827">
          Enter name of place you reported at and where released from work and when and where each change of duty occurred.
        </text>
        <text x="552" y="734" fontSize="9.5" textAnchor="middle" fill="#111827">
          Use time standard of home terminal.
        </text>

        <text x="52" y="778" fontSize="11" fontWeight="700" fill="#000000">
          Recap:
        </text>
        <text x="52" y="792" fontSize="11" fontWeight="700" fill="#000000">
          Complete at
        </text>
        <text x="52" y="806" fontSize="11" fontWeight="700" fill="#000000">
          end of the day 
        </text>

        <line x1="140" y1="806" x2="200" y2="806" stroke="#0f172a" strokeWidth="0.9" />
        <RecapColumn x={140} y={820} code="" lines={['On duty', 'hours', 'today,', 'Total lines', '3&4' ]} value={`${formatHours(recap.totalDutyToday)} hrs`} />
        <TextLines x={214} y={773} lines={['70 Hour /', '8 Day', 'Drivers']} fontSize={9.5} lineHeight={10} fill="#000000" textAnchor="middle" />

        <line x1="230" y1="806" x2="480" y2="806" stroke="#0f172a" strokeWidth="0.9" />

        <RecapColumn x={230} y={820} code="A." lines={['Total', 'hours on', 'duty last 8', 'days', 'including', 'today.']} value={`${formatHours(recap.currentCycle70)} hrs`} />
        <RecapColumn x={330} y={820} code="B." lines={['Total', 'hours', 'available', 'tomorrow', '70 hr', 'minus A.']} value={`${formatHours(recap.available70)} hrs`} />
        <RecapColumn x={420} y={820} code="C." lines={['Total', 'hours', 'gained', 'tomorrow', 'by taking', 'today off.']} value={`${formatHours(recap.gained70)} hrs`} />

        <TextLines x={510} y={773} lines={['60 Hour /', '7 Day', 'Drivers']} fontSize={9.5} lineHeight={10} fill="#000000" textAnchor="middle" />
        <line x1="570" y1="806" x2="860" y2="806" stroke="#0f172a" strokeWidth="0.9" />
        <RecapColumn x={570} y={820} code="A." lines={['Total', 'hours on', 'duty last 7', 'days', 'including', 'today.']} value={`${formatHours(recap.currentCycle60)} hrs`} />
        <RecapColumn x={670} y={820} code="B." lines={['Total', 'hours', 'available', 'tomorrow', '60 hr', 'minus A.']} value={`${formatHours(recap.available60)} hrs`} />
        <RecapColumn x={770} y={820} code="C." lines={['Total', 'hours', 'gained', 'tomorrow', 'by taking', 'today off.']} value={`${formatHours(recap.gained60)} hrs`} />

        <TextLines x={966} y={773} lines={['*If you took', '34', 'consecutive', 'hours off', 'duty you', 'have 60/70', 'hours', 'available']} fontSize={9.5} lineHeight={11} fill="#000000" textAnchor="middle" />
        {/* <text x="966" y="846" textAnchor="middle" fontSize="13" fontWeight="700" fill="#000000">
          {formatHours(recap.restartHours)} hrs
        </text> */}
      </svg>

      <footer className="eld-footer">
        <article>
          <span>Off duty</span>
          <strong>{formatHours(offDutyHours)} hrs</strong>
        </article>
        <article>
          <span>Sleeper</span>
          <strong>{formatHours(sleeperHours)} hrs</strong>
        </article>
        <article>
          <span>Driving</span>
          <strong>{formatHours(drivingHours)} hrs</strong>
        </article>
        <article>
          <span>On duty</span>
          <strong>{formatHours(onDutyHours)} hrs</strong>
        </article>
      </footer>
    </article>
  )
}

function FieldBox({
  x,
  y,
  width,
  height,
  label,
  value,
  labelPosition = 'bottom',
  valueAlign = 'left',
  valueFontSize = 12,
  centerValue = false,
}) {
  const labelLines = toTextLines(label, lineLimitForWidth(width, 9.5), 2)
  const valueLines = toTextLines(value, lineLimitForWidth(width, valueFontSize), 2)
  const valueX = centerValue ? x + width / 2 : x + 9
  const valueAnchor = centerValue || valueAlign === 'center' ? 'middle' : 'start'
  const labelY = labelPosition === 'top' ? y + 11 : y + height - (labelLines.length - 1)
  const valueY = labelPosition === 'top' ? y + 26 : y + Math.min(20, height / 2 + 5)

  return (
    <g>
      <rect x={x} y={y} width={width} height={height-10} fill="#ffffff" stroke="#0f172a" />
      <TextLines x={valueX} y={valueY} lines={valueLines} fontSize={valueFontSize} lineHeight={12} fill="#000000" textAnchor={valueAnchor} />
      <TextLines x={x + width / 2} y={labelY} lines={labelLines} fontSize={9.5} lineHeight={10} fill="#111827" textAnchor="middle" />
    </g>
  )
}

function UnderlineField({ x, y, width, label, value }) {
  const valueLines = toTextLines(value, lineLimitForWidth(width, 11), 2)

  return (
    <g>
      <line x1={x} y1={y} x2={x + width} y2={y} stroke="#0f172a" />
      <TextLines x={x + 10} y={y - (valueLines.length > 1 ? 9 : 5)} lines={valueLines} fontSize={(valueLines.length > 1 ? 9 :11)} lineHeight={11} fill="#000000" />
      <text x={x + width / 2} y={y + 13} textAnchor="middle" fontSize="9.5" fill="#111827">
        {label}
      </text>
    </g>
  )
}

function TextLines({ x, y, lines, fontSize = 11, lineHeight = 12, fill = '#000000', textAnchor = 'start', fontWeight = '400' }) {
  const safeLines = Array.isArray(lines) ? lines.filter(Boolean) : [lines].filter(Boolean)
  const renderedLines = safeLines.length ? safeLines : ['']

  return (
    <text x={x} y={y} fontSize={fontSize} fill={fill} textAnchor={textAnchor} fontWeight={fontWeight}>
      {renderedLines.map((line, index) => (
        <tspan key={`${line}-${index}`} x={x} dy={index === 0 ? 0 : lineHeight}>
          {line}
        </tspan>
      ))}
    </text>
  )
}

function RecapColumn({ x, y, code, lines, value }) {
  return (
    <g>
      <text x={x} y={y} fontSize="10" fontWeight="700" fill="#000000">
        {code}
      </text>
      <TextLines x={x + 16} y={y} lines={lines} fontSize={9.3} lineHeight={10} fill="#111827" />
      <text x={x + 16} y={796} fontSize="11.5" fontWeight="700" fill="#000000">
        {value}
      </text>
    </g>
  )
}

function buildTransitions(segments = []) {
  const normalized = segments
    .map((segment) => {
      const row = rowByStatus[segment?.status]
      const startHour = clampHour(segment?.start_hour)
      const endHour = clampHour(segment?.end_hour)

      if (!row || startHour === null || endHour === null) {
        return null
      }

      return {
        status: segment.status,
        row,
        startHour: Math.min(startHour, endHour),
        endHour: Math.max(startHour, endHour),
      }
    })
    .filter(Boolean)
    .sort((first, second) => first.startHour - second.startHour)

  return normalized.map((segment, index) => {
    const nextSegment = normalized[index + 1]

    return {
      ...segment,
      startX: xForHour(segment.startHour),
      endX: xForHour(segment.endHour),
      nextRow: nextSegment?.row || null,
      transitionX: nextSegment ? xForHour(segment.endHour) : null,
    }
  })
}

function clampHour(value) {
  const numericValue = Number(value)

  if (!Number.isFinite(numericValue)) {
    return null
  }

  return Math.min(24, Math.max(0, numericValue))
}

function xForHour(hour) {
  const clampedHour = clampHour(hour)
  return chart.left + ((clampedHour ?? 0) / 24) * chart.width
}

function topHourLabel(hour) {
  if (hour === 11) {
    return 'Noon'
  }

  const displayHour = hour % 12 === 0 ? 12 : hour % 12
  return String(displayHour)
}

function formatDate(value) {
  if (!value) {
    return 'Unknown date'
  }

  return new Date(`${value}T00:00:00`).toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function getDateParts(value) {
  if (!value) {
    return { month: '--', day: '--', year: '----' }
  }

  const date = new Date(`${value}T00:00:00`)

  return {
    month: String(date.getMonth() + 1).padStart(2, '0'),
    day: String(date.getDate()).padStart(2, '0'),
    year: String(date.getFullYear()),
  }
}

function buildRemarks(dayStops) {
  if (!dayStops.length) {
    return 'No stop or status-change remarks generated for this day.'
  }

  return dayStops
    .map((stop) => `${formatTime(stop.start_time)} ${humanize(stop.type)} at ${formatStopLocation(stop.location)}`)
    .join(' / ')
}

function buildRecapData({ trip, drivingHours, onDutyHours, offDutyHours, sleeperHours }) {
  const totalDutyToday = drivingHours + onDutyHours
  const totalHoursToday = totalDutyToday + offDutyHours + sleeperHours
  const currentCycle = Number(trip?.input_cycle_used_hours || 0)
  const projectedCycle = Number(trip?.projected_cycle_used_hours || currentCycle + totalDutyToday)

  return {
    totalDutyToday,
    totalHoursToday,
    currentCycle70: currentCycle,
    available70: Math.max(0, 70 - projectedCycle),
    gained70: Math.max(0, currentCycle + totalDutyToday - 70),
    currentCycle60: Math.min(60, currentCycle),
    available60: Math.max(0, 60 - Math.min(60, projectedCycle)),
    gained60: Math.max(0, Math.min(60, currentCycle + totalDutyToday) - 60),
    restartHours: Math.max(0, 70 - projectedCycle),
  }
}

function estimateDailyMiles(totalDistance, legs, log, trip) {
  const totalDriveHours = Number(legs.reduce((sum, leg) => sum + Number(leg.drive_time_hours || 0), 0))
  const driveToday = Number(log?.totals?.driving || 0)

  if (!totalDriveHours) {
    return 0
  }

  if (trip?.start_datetime && !new Date(trip.start_datetime).toISOString().startsWith(log.date)) {
    return 0
  }

  return Number(((driveToday / totalDriveHours) * totalDistance).toFixed(0))
}

function humanize(value) {
  if (!value) {
    return 'Stop'
  }

  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function formatStopLocation(location) {
  if (!location) {
    return 'route point'
  }

  if (location.label) {
    return location.label
  }

  return `${location.latitude.toFixed(2)}, ${location.longitude.toFixed(2)}`
}

function formatTime(value) {
  if (!value) {
    return '--:--'
  }

  return new Date(value).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  })
}

function formatHours(value) {
  return Number(value || 0).toFixed(1).replace(/\.0$/, '')
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString()
}

function formatAddressLine(origin, destination) {
  return `${origin} to ${destination}`
}

function lineLimitForWidth(width, fontSize) {
  return Math.max(8, Math.floor(width / (fontSize * 0.62)))
}

function toTextLines(value, maxChars = 24, maxLines = 2) {
  const text = String(value || '').replace(/\s+/g, ' ').trim()

  if (!text) {
    return ['']
  }

  const words = text.split(' ')
  const lines = []
  let currentLine = ''

  words.forEach((word) => {
    const nextLine = currentLine ? `${currentLine} ${word}` : word

    if (nextLine.length <= maxChars || !currentLine) {
      currentLine = nextLine
      return
    }

    lines.push(currentLine)
    currentLine = word
  })

  if (currentLine) {
    lines.push(currentLine)
  }

  if (lines.length <= maxLines) {
    return lines
  }

  const visibleLines = lines.slice(0, maxLines)
  visibleLines[maxLines - 1] = `${visibleLines[maxLines - 1].slice(0, Math.max(0, maxChars - 3)).trimEnd()}...`
  return visibleLines
}
