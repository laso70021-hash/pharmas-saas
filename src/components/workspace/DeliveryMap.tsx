import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

type Pt = { lat: number; lng: number } | null;
type Locations = { pickup: Pt; dropoff: Pt };
type GeocodeResult = { features?: { center?: [number, number] }[] };
type DirectionsResult = { routes?: { geometry?: { type: 'LineString'; coordinates: [number, number][] } }[] };

// Dar es Salaam as the default view.
const DEFAULT: [number, number] = [39.2083, -6.7924];

async function geocode(token: string, address: string): Promise<Pt> {
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?country=tz&limit=1&access_token=${encodeURIComponent(token)}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error('Address lookup failed');
  const data = await response.json() as GeocodeResult;
  const center = data.features?.[0]?.center;
  return center ? { lng: center[0], lat: center[1] } : null;
}

export default function DeliveryMap({ token, pickup = null, dropoff, rider, pickupAddress, dropoffAddress, showRoute = true, routeTarget = 'dropoff', routeFrom = null, heightClassName = 'h-72', onPick }: {
  token: string;
  pickup?: Pt;
  dropoff: Pt;
  rider: Pt;
  pickupAddress?: string | null;
  dropoffAddress?: string | null;
  showRoute?: boolean;
  routeTarget?: 'pickup' | 'dropoff';
  routeFrom?: Pt;
  heightClassName?: string;
  onPick?: (p: { lat: number; lng: number }) => void;
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const marks = useRef<{ pickup?: mapboxgl.Marker; dropoff?: mapboxgl.Marker; rider?: mapboxgl.Marker }>({});
  const pick = useRef(onPick); pick.current = onPick;
  const pickupLat = pickup?.lat;
  const pickupLng = pickup?.lng;
  const dropoffLat = dropoff?.lat;
  const dropoffLng = dropoff?.lng;
  const riderLat = rider?.lat;
  const riderLng = rider?.lng;
  const routeFromLat = routeFrom?.lat;
  const routeFromLng = routeFrom?.lng;
  const [resolved, setResolved] = useState<Locations>({ pickup: null, dropoff: null });
  const [routeError, setRouteError] = useState('');

  useEffect(() => {
    if (!el.current) return;
    mapboxgl.accessToken = token;
    const m = new mapboxgl.Map({ container: el.current, style: 'mapbox://styles/mapbox/streets-v12', center: DEFAULT, zoom: 11 });
    m.addControl(new mapboxgl.NavigationControl(), 'top-right');
    m.on('click', (e) => pick.current?.({ lat: e.lngLat.lat, lng: e.lngLat.lng }));
    map.current = m;
    return () => { m.remove(); map.current = null; marks.current = {}; };
  }, [token]);

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    let cancelled = false;
    const pickupPoint = pickupLat != null && pickupLng != null ? { lat: pickupLat, lng: pickupLng } : null;
    const dropoffPoint = dropoffLat != null && dropoffLng != null ? { lat: dropoffLat, lng: dropoffLng } : null;
    const routeFromPoint = routeFromLat != null && routeFromLng != null ? { lat: routeFromLat, lng: routeFromLng } : null;
    setRouteError('');
    if (!showRoute) {
      setResolved({ pickup: pickupPoint, dropoff: dropoffPoint });
      return () => { cancelled = true; };
    }

    const drawRoute = async () => {
      try {
        const [pickupResolved, dropoffResolved] = await Promise.all([
          pickupPoint ?? (pickupAddress ? geocode(token, pickupAddress) : null),
          dropoffPoint ?? (dropoffAddress ? geocode(token, dropoffAddress) : null),
        ]);
        if (cancelled) return;
        setResolved({ pickup: pickupResolved, dropoff: dropoffResolved });
        const from = routeFromPoint ?? pickupResolved;
        const to = routeTarget === 'pickup' ? pickupResolved : dropoffResolved;
        if (!from || !to) {
          setRouteError('Add or verify pickup and delivery addresses to show the route.');
          return;
        }
        if (from.lat === to.lat && from.lng === to.lng) {
          setRouteError(routeTarget === 'pickup' ? 'Waiting for the rider’s live location to draw the route to pickup.' : '');
          return;
        }

        const bounds = new mapboxgl.LngLatBounds().extend([from.lng, from.lat]).extend([to.lng, to.lat]);
        m.fitBounds(bounds, { padding: 64, maxZoom: 14 });
        const response = await fetch(`https://api.mapbox.com/directions/v5/mapbox/driving/${from.lng},${from.lat};${to.lng},${to.lat}?geometries=geojson&overview=full&access_token=${encodeURIComponent(token)}`);
        if (!response.ok) throw new Error('Directions lookup failed');
        const data = await response.json() as DirectionsResult;
        const geometry = data.routes?.[0]?.geometry;
        if (!geometry?.coordinates?.length) throw new Error('No driving route found');
        if (!m.isStyleLoaded()) await new Promise<void>((resolve) => m.once('load', () => resolve()));
        if (cancelled) return;

        const feature = {
          type: 'Feature' as const,
          properties: {},
          geometry,
        };
        const source = m.getSource('delivery-route') as mapboxgl.GeoJSONSource | undefined;
        if (source) source.setData(feature);
        else {
          m.addSource('delivery-route', { type: 'geojson', data: feature });
          m.addLayer({
            id: 'delivery-route',
            type: 'line',
            source: 'delivery-route',
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: { 'line-color': '#2563eb', 'line-width': 5, 'line-opacity': 0.9 },
          });
        }
      } catch {
        if (!cancelled) setRouteError('Could not draw the road route. Check the addresses and map directions access.');
      }
    };

    void drawRoute();
    return () => { cancelled = true; };
  }, [token, pickupLat, pickupLng, pickupAddress, dropoffLat, dropoffLng, dropoffAddress, routeFromLat, routeFromLng, routeTarget, showRoute]);

  useEffect(() => {
    const m = map.current; if (!m) return;
    const pickupPoint = pickupLat != null && pickupLng != null ? { lat: pickupLat, lng: pickupLng } : null;
    const dropoffPoint = dropoffLat != null && dropoffLng != null ? { lat: dropoffLat, lng: dropoffLng } : null;
    const riderPoint = riderLat != null && riderLng != null ? { lat: riderLat, lng: riderLng } : null;
    const set = (key: 'pickup' | 'dropoff' | 'rider', point: Pt, color: string) => {
      if (!point) { marks.current[key]?.remove(); delete marks.current[key]; return; }
      if (!marks.current[key]) marks.current[key] = new mapboxgl.Marker({ color }).setLngLat([point.lng, point.lat]).addTo(m);
      else marks.current[key]!.setLngLat([point.lng, point.lat]);
    };
    set('pickup', pickupPoint ?? resolved.pickup, '#16a34a');
    set('dropoff', dropoffPoint ?? resolved.dropoff, '#dc2626');
    set('rider', riderPoint, '#2563eb');
  }, [pickupLat, pickupLng, dropoffLat, dropoffLng, riderLat, riderLng, resolved]);

  return (
    <div className={`relative w-full ${heightClassName} rounded-xl overflow-hidden border border-slate-200`}>
      <div ref={el} className="w-full h-full" />
      {routeError && <p role="status" className="absolute bottom-2 left-2 right-2 rounded-lg bg-white/95 px-3 py-2 text-xs text-slate-700 shadow">{routeError}</p>}
      <div className="absolute left-2 top-2 flex gap-2 rounded-lg bg-white/95 px-2.5 py-1.5 text-[10px] font-bold text-slate-700 shadow">
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-green-600" />Pickup</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-blue-600" />Rider</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-600" />Drop-off</span>
      </div>
    </div>
  );
}
