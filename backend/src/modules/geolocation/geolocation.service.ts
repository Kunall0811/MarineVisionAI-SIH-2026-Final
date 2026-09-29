import { Injectable } from '@nestjs/common';

export interface FrameNavigation {
  latitude: number | null;
  longitude: number | null;
  heading: number | null; // degrees, 0 = North, clockwise
  range: number | null; // sonar range in metres for this side
  side: string; // PORT | STARBOARD | BOTH | UNKNOWN
  navigationSource: string; // REAL | ESTIMATED | UNAVAILABLE
  depth: number | null;
}

export interface PixelBBox {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface GeolocationResult {
  latitude: number | null;
  longitude: number | null;
  depth: number | null;
  locationStatus: 'REAL' | 'ESTIMATED' | 'UNAVAILABLE';
  lengthMetres: number | null;
  widthMetres: number | null;
}

const EARTH_RADIUS_M = 6371000;

/**
 * Converts a detection's pixel-space bounding box into real-world
 * coordinates using classic side-scan-sonar slant-range geometry:
 *
 *   across-track distance (m) = (pixel_offset_from_nadir / half_image_width) * range
 *   the point is then projected from the vessel/AUV position using its
 *   heading, rotated 90 degrees to the correct side (port = -90, starboard = +90).
 *
 * If the sonar frame has no navigation fix at all, this NEVER fabricates a
 * coordinate - it returns locationStatus = 'UNAVAILABLE'. If navigation was
 * itself already flagged as ESTIMATED (e.g. interpolated between two GPS
 * fixes), the resulting detection coordinate is also flagged ESTIMATED.
 */
@Injectable()
export class GeolocationService {
  computeDetectionLocation(
    nav: FrameNavigation,
    bbox: PixelBBox,
    imageWidth: number,
    imageHeight: number,
  ): GeolocationResult {
    if (
      nav.navigationSource === 'UNAVAILABLE' ||
      nav.latitude === null ||
      nav.longitude === null ||
      nav.heading === null ||
      nav.range === null ||
      !imageWidth
    ) {
      return {
        latitude: null,
        longitude: null,
        depth: nav.depth,
        locationStatus: 'UNAVAILABLE',
        lengthMetres: null,
        widthMetres: null,
      };
    }

    const centerX = (bbox.x1 + bbox.x2) / 2;
    const centerY = (bbox.y1 + bbox.y2) / 2;

    // Side-scan sonar imagery is usually stored as: left half = port channel,
    // right half = starboard channel, with the nadir (vessel track) running
    // down the vertical centre line.
    const halfWidth = imageWidth / 2;
    const isPortHalf = centerX < halfWidth;
    const side = nav.side === 'BOTH' || nav.side === 'UNKNOWN' ? (isPortHalf ? 'PORT' : 'STARBOARD') : nav.side;

    const pixelFromNadir = isPortHalf ? halfWidth - centerX : centerX - halfWidth;
    const fractionOfRange = Math.min(1, Math.max(0, pixelFromNadir / halfWidth));
    const acrossTrackDistance = fractionOfRange * nav.range;

    // Bearing perpendicular to vessel heading: port = heading - 90, starboard = heading + 90
    const bearingDeg = side === 'PORT' ? nav.heading - 90 : nav.heading + 90;
    const bearingRad = (((bearingDeg % 360) + 360) % 360) * (Math.PI / 180);

    const destination = this.destinationPoint(
      nav.latitude,
      nav.longitude,
      acrossTrackDistance,
      bearingRad,
    );

    // Physical object dimensions from pixel bbox, scaled by metres-per-pixel
    // derived from the known sonar range across the image half-width.
    const metresPerPixel = nav.range / halfWidth;
    const widthMetres = Math.abs(bbox.x2 - bbox.x1) * metresPerPixel;
    const lengthMetres = Math.abs(bbox.y2 - bbox.y1) * metresPerPixel;

    return {
      latitude: Number(destination.lat.toFixed(6)),
      longitude: Number(destination.lon.toFixed(6)),
      depth: nav.depth,
      locationStatus: nav.navigationSource === 'REAL' ? 'REAL' : 'ESTIMATED',
      lengthMetres: Number(lengthMetres.toFixed(2)),
      widthMetres: Number(widthMetres.toFixed(2)),
    };
  }

  private destinationPoint(lat: number, lon: number, distanceMetres: number, bearingRad: number) {
    const latRad = (lat * Math.PI) / 180;
    const lonRad = (lon * Math.PI) / 180;
    const angularDistance = distanceMetres / EARTH_RADIUS_M;

    const destLatRad = Math.asin(
      Math.sin(latRad) * Math.cos(angularDistance) +
        Math.cos(latRad) * Math.sin(angularDistance) * Math.cos(bearingRad),
    );
    const destLonRad =
      lonRad +
      Math.atan2(
        Math.sin(bearingRad) * Math.sin(angularDistance) * Math.cos(latRad),
        Math.cos(angularDistance) - Math.sin(latRad) * Math.sin(destLatRad),
      );

    return {
      lat: (destLatRad * 180) / Math.PI,
      lon: (destLonRad * 180) / Math.PI,
    };
  }
}
