const MAX_FEATURES = 2000;
const MAX_OBJECTS = 300;

export function geoCoordinates(geometry) {
  if (!geometry || typeof geometry !== "object") return [];
  if (geometry.type === "GeometryCollection") {
    return (geometry.geometries || []).flatMap(geoCoordinates);
  }
  const points = [];
  function collect(value) {
    if (!Array.isArray(value)) return;
    if (value.length >= 2 && typeof value[0] === "number" && typeof value[1] === "number") {
      points.push([value[0], value[1]]);
    } else value.forEach(collect);
  }
  collect(geometry.coordinates);
  return points;
}

export function parseGeoCollection(content = "") {
  try {
    const collection = JSON.parse(content);
    if (collection?.type !== "FeatureCollection" || !Array.isArray(collection.features) ||
        collection.features.length > MAX_FEATURES) return null;
    const reference = collection.crs?.properties?.name;
    if (collection.crs && (collection.crs.type !== "name" ||
        !["EPSG:4326", "OGC:CRS84", "urn:ogc:def:crs:OGC:1.3:CRS84"].includes(reference))) return null;
    if (!collection.features.every((feature) => {
      if (feature?.type !== "Feature" || !feature.geometry) return false;
      const points = geoCoordinates(feature.geometry);
      return points.length > 0 && points.every(([lon, lat]) =>
        Number.isFinite(lon) && lon >= -180 && lon <= 180 && Number.isFinite(lat) && lat >= -90 && lat <= 90);
    })) return null;
    return collection;
  } catch { return null; }
}

export function geoCoordinateBounds(collection) {
  const coords = (collection?.features || []).flatMap((feature) => geoCoordinates(feature.geometry));
  if (!coords.length) return null;
  let minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity;
  for (const [lon, lat] of coords) {
    if (lon < minLon) minLon = lon;
    if (lat < minLat) minLat = lat;
    if (lon > maxLon) maxLon = lon;
    if (lat > maxLat) maxLat = lat;
  }
  return [minLon, minLat, maxLon, maxLat];
}

export function addGeoPoint(collection, { name = "Point", longitude, latitude } = {}) {
  if (!collection || !Array.isArray(collection.features) || collection.features.length >= MAX_FEATURES) {
    throw new RangeError("Geospatial feature limit reached");
  }
  const lon = Number(longitude), lat = Number(latitude);
  if (!Number.isFinite(lon) || longitude === "" || longitude == null || lon < -180 || lon > 180) {
    throw new RangeError("Invalid longitude (−180 to 180)");
  }
  if (!Number.isFinite(lat) || latitude === "" || latitude == null || lat < -90 || lat > 90) {
    throw new RangeError("Invalid latitude (−90 to 90)");
  }
  if (typeof name !== "string" || name.length > 120) throw new RangeError("Invalid feature name");
  return {
    ...collection,
    features: [...collection.features, {
      type: "Feature", properties: { name: name || "Point" },
      geometry: { type: "Point", coordinates: [lon, lat] }
    }]
  };
}

export function parseCadScene(content = "") {
  try {
    const scene = JSON.parse(content);
    if (scene?.kind !== "hydria-cad-scene" || !Array.isArray(scene.objects) || scene.objects.length > MAX_OBJECTS) return null;
    if (!scene.objects.every((object) => object && object.type === "box" &&
      typeof object.id === "string" && typeof object.name === "string" &&
      Array.isArray(object.position) && object.position.length === 3 &&
      object.position.every((value) => Number.isFinite(value) && Math.abs(value) <= 10000) &&
      Array.isArray(object.size) && object.size.length === 3 &&
      object.size.every((value) => Number.isFinite(value) && value > 0 && value <= 10000))) return null;
    return scene;
  } catch { return null; }
}

export function addCadBox(scene, { name = "Volume", size = [2, 2, 2] } = {}) {
  if (!scene || !Array.isArray(scene.objects) || scene.objects.length >= MAX_OBJECTS) {
    throw new RangeError("CAD object limit reached");
  }
  if (!Array.isArray(size) || size.length !== 3 ||
      !size.every((value) => Number.isFinite(Number(value)) && Number(value) > 0 && Number(value) <= 10000)) {
    throw new RangeError("Invalid CAD size; all dimensions must be positive");
  }
  if (typeof name !== "string" || name.length > 120) throw new RangeError("Invalid CAD object name");
  return { ...scene, objects: [...scene.objects, {
    id: globalThis.crypto.randomUUID(), type: "box", name: name || "Volume",
    position: [0, 0, 0], size: size.map(Number)
  }] };
}

export function projectIsometricPoint([x, y, z]) {
  return { x: (x - y) * Math.sqrt(3) / 2, y: (x + y) / 2 - z };
}
