'use client';

import L from 'leaflet';
import { Fragment, useState } from 'react';
import { CircleMarker, MapContainer, Marker, Polyline, Popup, TileLayer, Tooltip, useMapEvents } from 'react-leaflet';

type ProviderKey = 'frekuent' | 'televend';
type Urgency = 'empty' | 'critical' | 'normal' | 'ok' | 'unknown';

interface MachineMapPoint {
    id: string;
    name: string;
    location: string | null;
    provider: ProviderKey;
    latitude: number | null;
    longitude: number | null;
    hasCoordinates: boolean;
    fillRate: number | null;
    urgency: Urgency;
    totalToReplenish: number;
    dailyTotal: number;
    monthlyTotal: number;
}

interface MallorcaReplenishmentMapProps {
    points: MachineMapPoint[];
}

const MALLORCA_BOUNDS: [[number, number], [number, number]] = [
    [39.22, 2.28],
    [40.0, 3.48],
];

const MALLORCA_CENTER: [number, number] = [39.62, 2.98];
const INITIAL_ZOOM = 10;
const MOBILE_INITIAL_ZOOM = 9;

function markerColor(urgency: Urgency) {
    if (urgency === 'empty') return '#020617';
    if (urgency === 'critical') return '#ef1f14';
    if (urgency === 'normal') return '#f2b016';
    if (urgency === 'ok') return '#059669';
    return '#71717a';
}

function getInitialZoom() {
    if (typeof window === 'undefined') return INITIAL_ZOOM;
    return window.innerWidth < 640 ? MOBILE_INITIAL_ZOOM : INITIAL_ZOOM;
}

function urgencySeverity(urgency: Urgency) {
    if (urgency === 'empty') return 5;
    if (urgency === 'critical') return 4;
    if (urgency === 'normal') return 3;
    if (urgency === 'ok') return 2;
    return 1;
}

function markerLabel(urgency: Urgency) {
    if (urgency === 'empty') return 'Vacía';
    if (urgency === 'critical') return 'Crítica';
    if (urgency === 'normal') return 'Normal';
    if (urgency === 'ok') return 'Bien';
    return 'Sin datos de stock';
}

function formatProvider(provider: ProviderKey) {
    return provider === 'televend' ? 'Televend' : 'Frekuent';
}

function pointKey(point: MachineMapPoint) {
    return `${Number(point.latitude).toFixed(4)}:${Number(point.longitude).toFixed(4)}`;
}

function getGridSize(zoom: number) {
    if (zoom >= 15) return 0.00003;
    if (zoom >= 14) return 0.0005;
    if (zoom >= 13) return 0.0012;
    if (zoom >= 12) return 0.0028;
    if (zoom >= 11) return 0.006;
    return 0.014;
}

function getWorstUrgency(points: MachineMapPoint[]) {
    return points.slice().sort((a, b) => urgencySeverity(b.urgency) - urgencySeverity(a.urgency))[0]?.urgency || 'unknown';
}

function getClusterTitle(points: MachineMapPoint[]) {
    const firstLocation = points.find((point) => point.location)?.location;
    if (!firstLocation) return 'Zona';

    const normalized = firstLocation.split(',')[0]?.split(' · ')[0]?.trim();
    return normalized || 'Zona';
}

function clusterPoints(points: MachineMapPoint[], zoom: number) {
    const gridSize = getGridSize(zoom);
    const groups = new Map<string, MachineMapPoint[]>();

    for (const point of points) {
        if (!point.latitude || !point.longitude) continue;
        const key = `${Math.round(point.latitude / gridSize)}:${Math.round(point.longitude / gridSize)}:${zoom >= 15 ? pointKey(point) : ''}`;
        groups.set(key, [...(groups.get(key) || []), point]);
    }

    return Array.from(groups.values()).map((group) => {
        const lat = group.reduce((sum, point) => sum + Number(point.latitude), 0) / group.length;
        const lng = group.reduce((sum, point) => sum + Number(point.longitude), 0) / group.length;

        return {
            id: group.map((point) => point.id).join('-'),
            lat,
            lng,
            points: group.slice().sort((a, b) => {
                const urgencyDiff = urgencySeverity(b.urgency) - urgencySeverity(a.urgency);
                if (urgencyDiff !== 0) return urgencyDiff;
                if (b.totalToReplenish !== a.totalToReplenish) return b.totalToReplenish - a.totalToReplenish;
                return a.name.localeCompare(b.name, 'es');
            }),
            worstUrgency: getWorstUrgency(group),
            title: getClusterTitle(group),
        };
    });
}

function getFanRadiusMeters(zoom: number) {
    if (zoom <= 10) return 3600;
    if (zoom === 11) return 1800;
    if (zoom === 12) return 900;
    if (zoom === 13) return 430;
    if (zoom === 14) return 210;
    return 95;
}

function fanPosition(lat: number, lng: number, index: number, total: number, zoom: number): [number, number] {
    const pointsPerRing = 12;
    const ring = Math.floor(index / pointsPerRing);
    const indexInRing = index % pointsPerRing;
    const itemsInRing = Math.min(pointsPerRing, total - ring * pointsPerRing);
    const angleOffset = ring % 2 === 0 ? -90 : -75;
    const angle = ((360 / Math.max(itemsInRing, 1)) * indexInRing + angleOffset) * (Math.PI / 180);
    const radiusMeters = getFanRadiusMeters(zoom) * (1 + ring * 0.72);
    const latOffset = (Math.sin(angle) * radiusMeters) / 111_320;
    const lngOffset = (Math.cos(angle) * radiusMeters) / (111_320 * Math.cos((lat * Math.PI) / 180));

    return [lat + latOffset, lng + lngOffset];
}

function clusterIcon(points: MachineMapPoint[], urgency: Urgency) {
    const color = markerColor(urgency);
    const attention = points.filter((point) => ['critical', 'normal'].includes(point.urgency)).length;
    const size = Math.min(42, Math.max(30, 28 + Math.sqrt(points.length) * 1.55));
    const label = points.length > 99 ? '99+' : String(points.length);
    const attentionLabel = attention > 99 ? '99+' : String(attention);

    return L.divIcon({
        className: 'lify-map-cluster-marker',
        html: `
            <div class="lify-map-cluster-shell" style="width:${size}px;height:${size}px;">
                <div class="lify-map-cluster-pulse" style="background:${color};"></div>
                <div class="lify-map-cluster-core" style="background:${color};">
                    <span>${label}</span>
                </div>
                ${
                    attention > 0
                        ? `<div class="lify-map-cluster-badge" style="color:${color};">${attentionLabel}</div>`
                        : ''
                }
            </div>
        `,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
    });
}

function MapInteractionLayer({
    points,
    initialZoom,
}: {
    points: MachineMapPoint[];
    initialZoom: number;
}) {
    const [zoom, setZoom] = useState(initialZoom);
    const [expandedClusterId, setExpandedClusterId] = useState<string | null>(null);
    const map = useMapEvents({
        zoomend: () => {
            setZoom(map.getZoom());
            setExpandedClusterId(null);
        },
        dragstart: () => setExpandedClusterId(null),
    });
    const clusters = clusterPoints(points, zoom);

    return (
        <>
            {clusters.map((cluster) => {
                if (cluster.points.length > 1) {
                    const color = markerColor(cluster.worstUrgency);
                    const attention = cluster.points.filter((point) => ['critical', 'normal'].includes(point.urgency)).length;
                    const isExpanded = expandedClusterId === cluster.id;
                    const fanPoints = cluster.points.map((point, index) => ({
                        point,
                        position: fanPosition(cluster.lat, cluster.lng, index, cluster.points.length, zoom),
                    }));

                    return (
                        <Fragment key={cluster.id}>
                            {isExpanded && (
                                <>
                                    {fanPoints.map(({ point, position }) => (
                                        <Polyline
                                            key={`${point.id}-fan-line`}
                                            positions={[[cluster.lat, cluster.lng], position]}
                                            pathOptions={{
                                                color: markerColor(point.urgency),
                                                opacity: 0.34,
                                                weight: 1.6,
                                            }}
                                        />
                                    ))}
                                    {fanPoints.map(({ point, position }) => {
                                        const pointColor = markerColor(point.urgency);

                                        return (
                                            <CircleMarker
                                                key={`${point.id}-fan-point`}
                                                center={position}
                                                radius={7}
                                                pathOptions={{
                                                    color: '#ffffff',
                                                    fillColor: pointColor,
                                                    fillOpacity: 0.98,
                                                    opacity: 1,
                                                    weight: 2.5,
                                                }}
                                            >
                                                <Tooltip direction="top" className="lify-map-status-tooltip">
                                                    <span className="font-black">{point.name}</span>
                                                    <span className="block text-xs">
                                                        {markerLabel(point.urgency)} · {point.fillRate ?? '--'}%
                                                    </span>
                                                </Tooltip>
                                                <Popup className="lify-map-popup" maxWidth={340}>
                                                    <div className="w-72 max-w-[72vw] space-y-3">
                                                        <div>
                                                            <div className="mb-2 flex items-center gap-2">
                                                                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: pointColor }} />
                                                                <p className="text-xs font-black uppercase text-zinc-500">
                                                                    {markerLabel(point.urgency)}
                                                                </p>
                                                            </div>
                                                            <p className="break-words text-base font-black text-zinc-950">{point.name}</p>
                                                            <p className="mt-1 break-words text-xs font-semibold text-zinc-500">
                                                                {point.location || 'Sin dirección'}
                                                            </p>
                                                        </div>
                                                        <div className="grid grid-cols-3 gap-2 text-center">
                                                            <div className="rounded-xl bg-zinc-50 p-2">
                                                                <p className="text-[10px] font-black uppercase text-zinc-500">Llenado</p>
                                                                <p className="text-lg font-black text-zinc-900">{point.fillRate ?? '--'}%</p>
                                                            </div>
                                                            <div className="rounded-xl bg-zinc-50 p-2">
                                                                <p className="text-[10px] font-black uppercase text-zinc-500">Reponer</p>
                                                                <p className="text-lg font-black text-zinc-900">{point.totalToReplenish}</p>
                                                            </div>
                                                            <div className="rounded-xl bg-zinc-50 p-2">
                                                                <p className="text-[10px] font-black uppercase text-zinc-500">Fuente</p>
                                                                <p className="text-sm font-black text-zinc-900">{formatProvider(point.provider)}</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </Popup>
                                            </CircleMarker>
                                        );
                                    })}
                                </>
                            )}
                            <Marker
                                position={[cluster.lat, cluster.lng]}
                                icon={clusterIcon(cluster.points, cluster.worstUrgency)}
                                zIndexOffset={isExpanded ? 500 : 0}
                                eventHandlers={{
                                    click: () => setExpandedClusterId(isExpanded ? null : cluster.id),
                                    dblclick: () => {
                                        map.setView([cluster.lat, cluster.lng], Math.min(zoom + 2, 15), {
                                            animate: true,
                                        });
                                    },
                                }}
                            >
                                <Tooltip direction="top" className="lify-map-status-tooltip">
                                    <span className="font-black">{cluster.title}</span>
                                    <span className="block text-xs">
                                        {isExpanded ? 'Toca para cerrar' : 'Toca para desplegar'} · {cluster.points.length} máquinas · {attention} requieren atención
                                    </span>
                                </Tooltip>
                                {!isExpanded && (
                                    <Popup className="lify-map-popup" maxWidth={360}>
                                        <div className="w-72 max-w-[74vw] space-y-3">
                                            <div>
                                                <div className="mb-2 flex items-center gap-2">
                                                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} />
                                                    <p className="text-xs font-black uppercase text-zinc-500">{cluster.title}</p>
                                                </div>
                                                <p className="text-lg font-black text-zinc-950">
                                                    {cluster.points.length} máquinas
                                                </p>
                                                <p className="text-xs font-semibold text-zinc-500">
                                                    {attention} requieren revisión · peor estado: {markerLabel(cluster.worstUrgency)}
                                                </p>
                                            </div>

                                            <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                                                {cluster.points.slice(0, 24).map((point) => (
                                                    <div key={point.id} className="rounded-xl border border-zinc-100 bg-zinc-50 p-3">
                                                        <div className="flex items-start justify-between gap-3">
                                                            <div className="min-w-0">
                                                                <p className="truncate text-sm font-black text-zinc-950">{point.name}</p>
                                                                <p className="mt-1 line-clamp-2 text-xs font-semibold text-zinc-500">{point.location || 'Sin dirección'}</p>
                                                            </div>
                                                            <span className="shrink-0 rounded-full px-2 py-1 text-xs font-black text-white" style={{ backgroundColor: markerColor(point.urgency) }}>
                                                                {point.fillRate ?? '--'}%
                                                            </span>
                                                        </div>
                                                        <p className="mt-2 text-xs font-bold text-zinc-600">
                                                            {markerLabel(point.urgency)} · Reponer {point.totalToReplenish}
                                                        </p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </Popup>
                                )}
                            </Marker>
                        </Fragment>
                    );
                }

                const point = cluster.points[0];
                const color = markerColor(point.urgency);

                return (
                    <CircleMarker
                        key={point.id}
                        center={[cluster.lat, cluster.lng]}
                        radius={7}
                        pathOptions={{
                            color: '#ffffff',
                            fillColor: color,
                            fillOpacity: 0.96,
                            opacity: 1,
                            weight: 2,
                        }}
                    >
                        <Tooltip direction="top" className="lify-map-status-tooltip">
                            <span className="font-black">{point.name}</span>
                            <span className="block text-xs">{markerLabel(point.urgency)}</span>
                        </Tooltip>
                        <Popup className="lify-map-popup" maxWidth={340}>
                            <div className="w-72 max-w-[72vw] space-y-3">
                                <div>
                                    <div className="mb-2 flex items-center gap-2">
                                        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} />
                                        <p className="text-xs font-black uppercase text-zinc-500">
                                            {markerLabel(point.urgency)}
                                        </p>
                                    </div>
                                    <p className="break-words text-base font-black text-zinc-950">{point.name}</p>
                                    <p className="mt-1 break-words text-xs font-semibold text-zinc-500">
                                        {point.location || 'Sin dirección'}
                                    </p>
                                </div>
                                <div className="grid grid-cols-3 gap-2 text-center">
                                    <div className="rounded-xl bg-zinc-50 p-2">
                                        <p className="text-[10px] font-black uppercase text-zinc-500">Llenado</p>
                                        <p className="text-lg font-black text-zinc-900">{point.fillRate ?? '--'}%</p>
                                    </div>
                                    <div className="rounded-xl bg-zinc-50 p-2">
                                        <p className="text-[10px] font-black uppercase text-zinc-500">Reponer</p>
                                        <p className="text-lg font-black text-zinc-900">{point.totalToReplenish}</p>
                                    </div>
                                    <div className="rounded-xl bg-zinc-50 p-2">
                                        <p className="text-[10px] font-black uppercase text-zinc-500">Fuente</p>
                                        <p className="text-sm font-black text-zinc-900">{formatProvider(point.provider)}</p>
                                    </div>
                                </div>
                            </div>
                        </Popup>
                    </CircleMarker>
                );
            })}
        </>
    );
}

export function MallorcaReplenishmentMap({ points }: MallorcaReplenishmentMapProps) {
    const initialZoom = getInitialZoom();
    const visiblePoints = points.slice().sort(
        (a, b) => urgencySeverity(b.urgency) - urgencySeverity(a.urgency),
    );

    return (
        <div className="relative h-[62vh] min-h-[360px] overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-100 shadow-inner sm:h-[520px]">
            <MapContainer
                className="h-full w-full"
                center={MALLORCA_CENTER}
                zoom={initialZoom}
                minZoom={9}
                maxZoom={16}
                maxBounds={MALLORCA_BOUNDS}
                maxBoundsViscosity={0.7}
                scrollWheelZoom={false}
                doubleClickZoom
                zoomControl
            >
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                <MapInteractionLayer points={visiblePoints} initialZoom={initialZoom} />
            </MapContainer>
        </div>
    );
}
