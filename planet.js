"use strict";

const vsPlanet = `#version 300 es

in vec4 a_position;
in vec3 a_normal;

uniform mat4 u_projection;
uniform mat4 u_view;
uniform mat4 u_world;
uniform mat4 u_worldInverseTranspose;
uniform vec3 u_cameraPosition;

out float v_height;
out vec3 v_normal;
out vec3 v_surfaceToView;

void main() {

  vec4 worldPosition = u_world * a_position;

  v_height = length(a_position.xyz) - 1.0;

  v_normal = mat3(u_worldInverseTranspose) * a_normal;

  v_surfaceToView = u_cameraPosition - worldPosition.xyz;

  gl_Position = u_projection * u_view * worldPosition;
}
`;

const fsPlanet = `#version 300 es
precision highp float;

in float v_height;
in vec3 v_normal;
in vec3 v_surfaceToView;

uniform float u_seaLevel;
uniform vec3 u_reverseLightDirection;

out vec4 outColor;

void main() {

  vec3 baseColor;

  if (v_height < u_seaLevel) {
    baseColor = vec3(0.0, 0.3, 0.7);
  } else if (v_height < u_seaLevel + 0.05) {
    baseColor = vec3(0.9, 0.8, 0.6);
  } else {
    baseColor = vec3(0.1, 0.6, 0.2);
  }

  vec3 normal = normalize(v_normal);
  vec3 lightDir = normalize(u_reverseLightDirection);
  vec3 viewDir = normalize(v_surfaceToView);
  vec3 halfVector = normalize(lightDir + viewDir);

  vec3 ambient = vec3(0.15) * baseColor;

  vec3 diffuse = max(dot(normal, lightDir), 0.0) * baseColor;

  float specAngle = max(dot(normal, halfVector), 0.0);
  float spec = pow(specAngle, 64.0);
  vec3 specular = vec3(0.6) * spec;

  outColor = vec4(ambient + diffuse + specular, 1.0);
}
`;


function createBaseSphere(resolution) {
    const vertices = [];
    const indices = [];

    for (let j = 0; j < resolution; j++) {
        const v = j / resolution;
        const theta = v * Math.PI;

        for (let i = 0; i <= resolution; i++) {
        const u = i / resolution;
        const phi = u * 2 * Math.PI;

        const x = Math.sin(theta) * Math.cos(phi);
        const y = Math.cos(theta);
        const z = Math.sin(theta) * Math.sin(phi);

        vertices.push(x, y, z);
        }
    }

    for (let j = 0; j < resolution; j++) {
        for (let i = 0; i < resolution; i++) {
        const p1 = j * (resolution + 1) + i;
        const p2 = p1 + resolution + 1;

        indices.push(p1, p1 + 1, p2);
        indices.push(p1 + 1, p2 + 1, p2);
        }
    }

    return { vertices, indices };
}

function generatePlanet(sphere, noiseType, heightScale) {

    var displacedVertices = [];
    var normals = [];
    const variation = 0.7; 

    for (let i = 0; i < sphere.vertices.length; i += 3) {
        let x = sphere.vertices[i];
        let y = sphere.vertices[i + 1];
        let z = sphere.vertices[i + 2];

        // Frequência do ruído
        let nx = 2 * x;
        let ny = 2 * y;
        let nz = 2 * z;

        let noiseVal = 0;

        if (noiseType === 0) {
        noiseVal = perlin(nx, ny, nz);
        } else {
        noiseVal = (Math.random() - 0.5) * variation;
        }

        const h = noiseVal * heightScale;
        
        const len = Math.sqrt(x * x + y * y + z * z);
        const scale = (1 + h);

        displacedVertices[i]     = (x / len) * scale;
        displacedVertices[i + 1] = (y / len) * scale;
        displacedVertices[i + 2] = (z / len) * scale;

        normals[i]      = (x / len);
        normals[i + 1]  = (y / len);
        normals[i + 2]  = (z / len);
    }

    return {
        vertices: new Float32Array(displacedVertices),
        normals: new Float32Array(normals),
        indices: new Uint32Array(sphere.indices),
    };
}

function fract(x) {
  return x - Math.floor(x);
}

function fade(t) {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function lerp(a, b, t) {
  return a + t * (b - a);
}

function grad(hash, x, y, z) {
  const h = hash & 15;
  const u = h < 8 ? x : y;
  const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
  return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
}

const perm = new Uint8Array(512);
for (let i = 0; i < 256; i++) 
    perm[i] = perm[i + 256] = Math.floor(Math.random() * 256);

function perlin(x, y, z) {
  const X = Math.floor(x) & 255;
  const Y = Math.floor(y) & 255;
  const Z = Math.floor(z) & 255;

  x -= Math.floor(x);
  y -= Math.floor(y);
  z -= Math.floor(z);

  const u = fade(x);
  const v = fade(y);
  const w = fade(z);

  const A = perm[X] + Y;
  const AA = perm[A] + Z;
  const AB = perm[A + 1] + Z;
  const B = perm[X + 1] + Y;
  const BA = perm[B] + Z;
  const BB = perm[B + 1] + Z;

  return lerp(
    lerp(
      lerp(grad(perm[AA], x, y, z), grad(perm[BA], x - 1, y, z), u),
      lerp(grad(perm[AB], x, y - 1, z), grad(perm[BB], x - 1, y - 1, z), u),
      v
    ),
    lerp(
      lerp(grad(perm[AA + 1], x, y, z - 1), grad(perm[BA + 1], x - 1, y, z - 1), u),
      lerp(grad(perm[AB + 1], x, y - 1, z - 1), grad(perm[BB + 1], x - 1, y - 1, z - 1), u),
      v
    ),
    w
  );
}