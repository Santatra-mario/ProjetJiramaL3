import { useEffect, useMemo, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import { MapPin } from 'lucide-react';

/* =========================================================
   CARTE LEAFLET / OPENSTREETMAP
   ---------------------------------------------------------
   Composant partagé par :
     - le dialogue de localisation du planning (sélection de la
       position GPS d'un abonné) ;
     - la carte du planning des contrôles (marqueurs).

   Les tuiles proviennent d'OpenStreetMap et l'attribution est
   toujours affichée. Aucune clé d'API n'est nécessaire.
========================================================= */

const TILE_URL = import.meta.env.VITE_OSM_TILE_URL
  || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

const ATTRIBUTION = import.meta.env.VITE_OSM_ATTRIBUTION
  || '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors';

const CENTRE_DEFAUT = [-18.8792, 47.5079]; // Antananarivo
const ZOOM_DEFAUT = 12;

function iconeMarqueur(color, selected, label) {
  const size = selected ? 24 : 18;
  return L.divIcon({
    className: 'jr-map-marker',
    html: `<span aria-hidden="true" style="display:block;width:${size}px;height:${size}px;border-radius:9999px;`
      + `border:3px solid #fff;background:${color};box-shadow:0 1px 5px rgba(15,23,42,.45)`
      + `${selected ? ';outline:2px solid rgba(15,23,42,.55);outline-offset:2px' : ''}"></span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}

function iconePosition() {
  return L.divIcon({
    className: 'jr-map-picker',
    html: '<span aria-hidden="true" style="display:flex;width:26px;height:26px;align-items:center;justify-content:center;'
      + 'border-radius:9999px;border:3px solid #fff;background:#0f766e;color:#fff;'
      + 'box-shadow:0 2px 6px rgba(15,23,42,.45);font-size:12px">●</span>',
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
}

function coordonneeValide(latitude, longitude) {
  const lat = Number(latitude);
  const lng = Number(longitude);
  return Number.isFinite(lat) && Number.isFinite(lng)
    && lat >= -90 && lat <= 90
    && lng >= -180 && lng <= 180;
}

export default function CarteLeaflet({
  markers = [],
  selectedId = null,
  onSelect,
  onPick,
  pick = null,
  center,
  zoom,
  height = 360,
  emptyMessage = 'Aucune position à afficher.',
  className = '',
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const coucheRef = useRef(null);
  const pickRef = useRef(null);
  const onPickRef = useRef(onPick);
  const onSelectRef = useRef(onSelect);

  onPickRef.current = onPick;
  onSelectRef.current = onSelect;

  const marqueursValides = useMemo(() => markers
    .filter((marker) => coordonneeValide(marker.latitude, marker.longitude))
    .map((marker) => ({
      ...marker,
      id: String(marker.id),
      latitude: Number(marker.latitude),
      longitude: Number(marker.longitude),
    })), [markers]);

  const signature = useMemo(
    () => marqueursValides.map((marker) => `${marker.id}:${marker.latitude}:${marker.longitude}`).join('|'),
    [marqueursValides]
  );

  const pickValide = pick && coordonneeValide(pick.latitude, pick.longitude);
  const pickLat = pickValide ? Number(pick.latitude) : null;
  const pickLng = pickValide ? Number(pick.longitude) : null;

  /* ----------------------------------------------------
     Initialisation de la carte (une seule fois)
  ---------------------------------------------------- */
  useEffect(() => {
    const node = containerRef.current;
    if (!node) return undefined;

    const depart = center && coordonneeValide(center[0], center[1]) ? center : CENTRE_DEFAUT;
    const map = L.map(node, {
      center: depart,
      zoom: zoom || ZOOM_DEFAUT,
      zoomControl: true,
      attributionControl: true,
    });

    L.tileLayer(TILE_URL, {
      maxZoom: 19,
      attribution: ATTRIBUTION,
    }).addTo(map);

    map.on('click', (event) => {
      if (!onPickRef.current) return;
      onPickRef.current(
        Number(event.latlng.lat.toFixed(6)),
        Number(event.latlng.lng.toFixed(6))
      );
    });

    mapRef.current = map;
    coucheRef.current = L.layerGroup().addTo(map);

    const redimensionner = () => map.invalidateSize();
    const observer = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(redimensionner)
      : null;
    observer?.observe(node);
    const timer = window.setTimeout(redimensionner, 120);

    return () => {
      window.clearTimeout(timer);
      observer?.disconnect();
      map.remove();
      mapRef.current = null;
      coucheRef.current = null;
      pickRef.current = null;
    };
    // center/zoom ne servent qu'au montage : les mises à jour passent par
    // les effets dédiés (marqueurs, sélection, position choisie).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ----------------------------------------------------
     Marqueurs du planning
  ---------------------------------------------------- */
  useEffect(() => {
    const map = mapRef.current;
    const couche = coucheRef.current;
    if (!map || !couche) return;

    couche.clearLayers();

    for (const marker of marqueursValides) {
      const selected = String(marker.id) === String(selectedId);
      const point = L.marker([marker.latitude, marker.longitude], {
        icon: iconeMarqueur(marker.color || '#2563eb', selected, marker.label),
        title: marker.label || '',
        alt: marker.label || 'Position de l’abonné',
        keyboard: true,
        riseOnHover: true,
      });
      point.on('click', () => onSelectRef.current?.(marker.id));
      couche.addLayer(point);
    }

    if (!marqueursValides.length) return;
    if (marqueursValides.length === 1) {
      map.setView([marqueursValides[0].latitude, marqueursValides[0].longitude], 16);
      return;
    }
    const limites = L.latLngBounds(marqueursValides.map((marker) => [marker.latitude, marker.longitude]));
    map.fitBounds(limites, { padding: [32, 32], maxZoom: 17 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  /* ----------------------------------------------------
     Recentrage sur la sélection
  ---------------------------------------------------- */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedId) return;
    const cible = marqueursValides.find((marker) => marker.id === String(selectedId));
    if (!cible) return;
    map.panTo([cible.latitude, cible.longitude], { animate: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  /* ----------------------------------------------------
     Position choisie (fiche abonné)
  ---------------------------------------------------- */
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (pickRef.current) {
      map.removeLayer(pickRef.current);
      pickRef.current = null;
    }

    if (pickLat === null || pickLng === null) return;

    const marqueur = L.marker([pickLat, pickLng], {
      icon: iconePosition(),
      draggable: true,
      keyboard: true,
      title: 'Position GPS de l’abonné',
    });
    marqueur.on('dragend', () => {
      const position = marqueur.getLatLng();
      onPickRef.current?.(
        Number(position.lat.toFixed(6)),
        Number(position.lng.toFixed(6))
      );
    });
    marqueur.addTo(map);
    pickRef.current = marqueur;
    map.setView([pickLat, pickLng], Math.max(map.getZoom(), 15), { animate: true });
  }, [pickLat, pickLng]);

  /* L'invite ne doit pas recouvrir la carte lorsque l'utilisateur a déjà
     placé (ou retrouvé) la position à enregistrer. */
  const aucunMarqueur = marqueursValides.length === 0 && pickLat === null;

  return (
    <div
      className={`relative overflow-hidden rounded-lg border border-jr-bordure bg-jr-surface ${className}`}
      style={{ height }}
    >
      <div
        ref={containerRef}
        className="jr-carte-leaflet h-full w-full"
        role="application"
        aria-label="Carte OpenStreetMap"
      />

      {aucunMarqueur && (
        <div className="pointer-events-none absolute inset-0 z-[900] flex flex-col items-center justify-center bg-jr-surface/70 px-6 text-center">
          <MapPin size={26} className="text-jr-faible" aria-hidden="true" />
          <p className="mt-2 text-sm font-semibold text-jr-titre">{emptyMessage}</p>
          <p className="mt-1 max-w-sm text-xs text-jr-faible">
            Les abonnés sans coordonnées restent listés : aucune position n’est inventée.
          </p>
        </div>
      )}

      <a
        href="https://www.openstreetmap.org/copyright"
        target="_blank"
        rel="noreferrer"
        className="absolute bottom-0 right-0 z-[900] bg-jr-surface/90 px-2 py-0.5 text-[10px] text-jr-faible underline underline-offset-2"
      >
        © OpenStreetMap
      </a>
    </div>
  );
}
