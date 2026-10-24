import assert from "node:assert/strict";
import {
  parseGeoCollection,
  geoCoordinateBounds,
  addGeoPoint,
  parseCadScene,
  addCadBox,
  projectIsometricPoint
} from "../../frontend/components/spatialStudioModel.js";

const geo = parseGeoCollection(JSON.stringify({ type: "FeatureCollection", features: [
  { type: "Feature", properties: { name: "A" }, geometry: { type: "Point", coordinates: [2, 48] } },
  { type: "Feature", properties: { name: "B" }, geometry: { type: "LineString", coordinates: [[3, 49], [4, 50]] } }
] }));
assert.deepEqual(geoCoordinateBounds(geo), [2, 48, 4, 50]);
const extended = addGeoPoint(geo, { name: "C", longitude: -1, latitude: 46 });
assert.equal(extended.features.length, 3);
assert.equal(geo.features.length, 2);
assert.deepEqual(geoCoordinateBounds(extended), [-1, 46, 4, 50]);
const denseGeo = { features: [{ geometry: { type: "LineString", coordinates:
  Array.from({ length: 160000 }, (_, index) => [index % 100, index % 50]) } }] };
assert.deepEqual(geoCoordinateBounds(denseGeo), [0, 0, 99, 49],
  "Large geometry bounds must not overflow the JavaScript argument stack");
assert.throws(() => addGeoPoint(geo, { longitude: 181, latitude: 0 }), /longitude/i);
assert.throws(() => addGeoPoint(geo, { longitude: 0, latitude: -91 }), /latitude/i);
assert.equal(parseGeoCollection('{"type":"FeatureCollection","features":[{"geometry":null}]}'), null);
assert.equal(parseGeoCollection(JSON.stringify({ type: "FeatureCollection", crs: {
  type: "name", properties: { name: "EPSG:3857" }
}, features: [{ type: "Feature", geometry: { type: "Point", coordinates: [2, 48] } }] })), null,
"Unsupported coordinate reference systems must not be shown as WGS84");

const scene = parseCadScene(JSON.stringify({ kind: "hydria-cad-scene", objects: [] }));
assert.ok(scene);
const withBox = addCadBox(scene, { name: "Murs", size: [4, 3, 2] });
assert.deepEqual(withBox.objects[0].size, [4, 3, 2]);
assert.equal(scene.objects.length, 0);
assert.throws(() => addCadBox(scene, { size: [-1, 1, 1] }), /size/i);
assert.equal(parseCadScene('{"kind":"hydria-cad-scene","objects":[null]}'), null);
assert.deepEqual(projectIsometricPoint([0, 0, 0]), { x: 0, y: 0 });
assert.equal(projectIsometricPoint([0, 0, 2]).y < 0, true, "Z must project upward");
assert.equal(projectIsometricPoint([2, 0, 0]).x > 0, true, "X must project to the right");
console.log("3D & GIS prototype spatial models validated.");
