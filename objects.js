"use strict";

 const vsObject = `#version 300 es
in vec4 a_position;
in vec3 a_normal;
in vec2 a_texcoord;

uniform mat4 u_projection;
uniform mat4 u_view;
uniform mat4 u_world;
uniform mat4 u_worldInverseTranspose;
uniform vec3 u_cameraPosition;

out vec3 v_normal;
out vec2 v_texcoord;
out vec3 v_surfaceToView;

void main() {
  vec4 worldPosition = u_world * a_position;
  v_surfaceToView = u_cameraPosition - worldPosition.xyz;
  gl_Position = u_projection * u_view * worldPosition;
  v_normal = mat3(u_worldInverseTranspose) * a_normal;
  v_texcoord = a_texcoord;
}
`;

 const fsObject = `#version 300 es
precision highp float;

in vec3 v_normal;
in vec2 v_texcoord;
in vec3 v_surfaceToView;

uniform sampler2D u_diffuseMap;
uniform bool u_hasDiffuseMap;
uniform vec3 u_diffuse;
uniform vec3 u_ambient;
uniform vec3 u_specular;
uniform float u_shininess;
uniform vec3 u_reverseLightDirection;

out vec4 outColor;

void main () {
  vec3 normal = normalize(v_normal);
  vec3 surfaceToViewDirection = normalize(v_surfaceToView);
  vec3 lightDir = normalize(u_reverseLightDirection);
  vec3 halfVector = normalize(lightDir + surfaceToViewDirection);

  vec3 baseColor = u_diffuse;

  if (u_hasDiffuseMap) {
    baseColor *= texture(u_diffuseMap, v_texcoord).rgb;
  }

  vec3 diffuse = max(dot(lightDir, normal), 0.0) * baseColor;

  float specAngle = max(dot(normal, halfVector), 0.0);

  vec3 specular = u_specular * pow(specAngle, u_shininess);

  vec3 ambient = u_ambient * baseColor;

  outColor = vec4(ambient + diffuse + specular, 1);
}
`;

function parseOBJ(text) {
  // because indices are base 1 let's just fill in the 0th data
  const objPositions = [[0, 0, 0]];
  const objTexcoords = [[0, 0]];
  const objNormals = [[0, 0, 0]];
  const objColors = [[0, 0, 0]];

  // same order as `f` indices
  const objVertexData = [
    objPositions,
    objTexcoords,
    objNormals,
    objColors,
  ];

  // same order as `f` indices
  let webglVertexData = [
    [],   // positions
    [],   // texcoords
    [],   // normals
    [],   // colors
  ];

  const materialLibs = [];
  const geometries = [];
  let geometry;
  let groups = ['default'];
  let material = 'default';
  let object = 'default';

  const noop = () => {};
 
  function newGeometry() {
    // If there is an existing geometry and it's
    // not empty then start a new one.
    if (geometry && geometry.data.position.length) {
      geometry = undefined;
    }
  }
 
  function setGeometry() {
    if (!geometry) {
      const position = [];
      const texcoord = [];
      const normal = [];
      const color = [];
      webglVertexData = [
        position,
        texcoord,
        normal,
        color,
      ];
      geometry = {
        object,
        groups,
        material,
        data: {
          position,
          texcoord,
          normal,
          color,
        },
      };
      geometries.push(geometry);
    }
  }

  function addVertex(vert) {
    const ptn = vert.split('/');
    ptn.forEach((objIndexStr, i) => {
      if (!objIndexStr) {
        return;
      }
      const objIndex = parseInt(objIndexStr);
      const index = objIndex + (objIndex >= 0 ? 0 : objVertexData[i].length);
      webglVertexData[i].push(...objVertexData[i][index]);

      // if this is the position index (index 0) and we parsed
      // vertex colors then copy the vertex colors to the webgl vertex color data
      if (i === 0 && objColors.length > 1) {
        geometry.data.color.push(...objColors[index]);
      }
    });
  }

    const keywords = {
    v(parts) {
      // if there are more than 3 values here they are vertex colors
      if (parts.length > 3) {
        objPositions.push(parts.slice(0, 3).map(parseFloat));
        objColors.push(parts.slice(3).map(parseFloat));
      } else {
        objPositions.push(parts.map(parseFloat));
      }
    },
    vn(parts) {
      objNormals.push(parts.map(parseFloat));
    },
    vt(parts) {
      // should check for missing v and extra w?
      objTexcoords.push(parts.map(parseFloat));
    },
    f(parts) {
      setGeometry();
      const numTriangles = parts.length - 2;
      for (let tri = 0; tri < numTriangles; ++tri) {
        addVertex(parts[0]);
        addVertex(parts[tri + 1]);
        addVertex(parts[tri + 2]);
      }
    },
    s: noop,    // smoothing group
    mtllib(parts, unparsedArgs) {
      // the spec says there can be multiple filenames here
      // but many exist with spaces in a single filename
      materialLibs.push(unparsedArgs);
    },
    usemtl(parts, unparsedArgs) {
      material = unparsedArgs;
      newGeometry();
    },
    g(parts) {
      groups = parts;
      newGeometry();
    },
    o(parts, unparsedArgs) {
      object = unparsedArgs;
      newGeometry();
    },
  };

  const keywordRE = /(\w*)(?: )*(.*)/;
  const lines = text.split('\n');
  for (let lineNo = 0; lineNo < lines.length; ++lineNo) {
    const line = lines[lineNo].trim();
    if (line === '' || line.startsWith('#')) {
      continue;
    }
    const m = keywordRE.exec(line);
    if (!m) {
      continue;
    }
    const [, keyword, unparsedArgs] = m;
    const parts = line.split(/\s+/).slice(1);
    const handler = keywords[keyword];
    if (!handler) {
      console.warn('unhandled keyword:', keyword);  // eslint-disable-line no-console
      continue;
    }
    handler(parts, unparsedArgs);
  }

  // remove any arrays that have no entries.
  for (const geometry of geometries) {
    geometry.data = Object.fromEntries(
        Object.entries(geometry.data).filter(([, array]) => array.length > 0));
  }


  return {geometries, materialLibs}
}

function parseMTL(text) {
  const materials = {};
  let material;

  const keywords = {
    newmtl(parts, unparsedArgs) {
      material = {};
      materials[unparsedArgs] = material;
    },
    /* eslint brace-style:0 */
    Ns(parts)     { material.shininess      = parseFloat(parts[0]); },
    Ka(parts)     { material.ambient        = parts.map(parseFloat); },
    Kd(parts)     { material.diffuse        = parts.map(parseFloat); },
    Ks(parts)     { material.specular       = parts.map(parseFloat); },
    Ke(parts)     { material.emissive       = parts.map(parseFloat); },
    Ni(parts)     { material.opticalDensity = parseFloat(parts[0]); },
    d(parts)      { material.opacity        = parseFloat(parts[0]); },
    illum(parts)  { material.illum          = parseInt(parts[0]); },
    map_Kd(parts) { material.diffuseMap     = parts[0]},
  };

  const keywordRE = /(\w*)(?: )*(.*)/;
  const lines = text.split('\n');
  for (let lineNo = 0; lineNo < lines.length; ++lineNo) {
    const line = lines[lineNo].trim();
    if (line === '' || line.startsWith('#')) {
      continue;
    }
    const m = keywordRE.exec(line);
    if (!m) {
      continue;
    }
    const [, keyword, unparsedArgs] = m;
    const parts = line.split(/\s+/).slice(1);
    const handler = keywords[keyword];
    if (!handler) {
      console.warn('unhandled keyword:', keyword);  // eslint-disable-line no-console
      continue;
    }
    handler(parts, unparsedArgs);
  }

  return materials;
}