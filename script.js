"use strict";

var vertexShaderSource = `#version 300 es

in vec4 a_position;

uniform mat4 u_matrix;
uniform float u_height;
uniform float u_seaLevel;
uniform int u_noiseType;

out vec4 v_color;

// Funções auxiliares

float rand(vec3 c) {
  return fract(sin(dot(c, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
}

vec3 fade(vec3 t) {
  return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
}

// Perlin noise

float perlin(vec3 p) {
  vec3 pi = floor(p);
  vec3 pf = fract(p);

  vec3 w = fade(pf);

  float n000 = rand(pi + vec3(0,0,0));
  float n001 = rand(pi + vec3(0,0,1));
  float n010 = rand(pi + vec3(0,1,0));
  float n011 = rand(pi + vec3(0,1,1));
  float n100 = rand(pi + vec3(1,0,0));
  float n101 = rand(pi + vec3(1,0,1));
  float n110 = rand(pi + vec3(1,1,0));
  float n111 = rand(pi + vec3(1,1,1));

  float nx00 = mix(n000, n100, w.x);
  float nx01 = mix(n001, n101, w.x);
  float nx10 = mix(n010, n110, w.x);
  float nx11 = mix(n011, n111, w.x);

  float nxy0 = mix(nx00, nx10, w.y);
  float nxy1 = mix(nx01, nx11, w.y);

  return mix(nxy0, nxy1, w.z);
}

void main() {

  vec3 pos = a_position.xyz;
  vec3 normal = normalize(pos);

  float noiseValue;

  if (u_noiseType == 0) {
    noiseValue = perlin(normal * 4.0);
  } else {
    noiseValue = rand(normal * 10.0);
  }

  float height = noiseValue * u_height;

  vec3 displacedPosition = pos + normal * height;

  // Cores por threshold

  if (height < u_seaLevel) {
    v_color = vec4(0.0, 0.3, 0.7, 1.0); // Mar
  } else if (height < u_seaLevel + 0.05) {
    v_color = vec4(0.9, 0.8, 0.6, 1.0); // Praia
  } else {
    v_color = vec4(0.1, 0.6, 0.2, 1.0); //  Terra
  }

  gl_Position = u_matrix * vec4(displacedPosition, 1.0);
}`;

var fragmentShaderSource = `#version 300 es

precision highp float;

in vec4 v_color;

out vec4 outColor;

void main() {
  outColor = v_color;
}
`;

function main() {
  
  /** @type {HTMLCanvasElement} */
  var canvas = document.querySelector("#canvas");
  var gl = canvas.getContext("webgl2");
  if (!gl) {
    return;
  }
  
  const program = gl.createProgram();

  const vertexShader = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(vertexShader, vertexShaderSource);
  gl.compileShader(vertexShader);
  gl.attachShader(program, vertexShader);

  const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(fragmentShader, fragmentShaderSource);
  gl.compileShader(fragmentShader);
  gl.attachShader(program, fragmentShader);

  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.log(gl.getShaderInfoLog(vertexShader));
      console.log(gl.getShaderInfoLog(fragmentShader));
  }
  gl.useProgram(program);

  var positionAttributeLocation = gl.getAttribLocation(program, "a_position");
  var matrixLocation = gl.getUniformLocation(program, "u_matrix");
  const heightLocation = gl.getUniformLocation(program, "u_height");
  const seaLevelLocation = gl.getUniformLocation(program, "u_seaLevel");
  const noiseTypeLocation = gl.getUniformLocation(program, "u_noiseType");

  var resolution = 500;
  var sphere = createSphere(resolution);

  var vao = gl.createVertexArray();
  gl.bindVertexArray(vao);

  var vertexData = new Float32Array(sphere.vertices);
  var indexData = new Uint32Array(sphere.indices);

  var vertexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, vertexData, gl.STATIC_DRAW);

  var indexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indexData, gl.STATIC_DRAW);

  gl.vertexAttribPointer(positionAttributeLocation, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(positionAttributeLocation);

  gl.bindVertexArray(null);

  var fieldOfViewRadians = degToRad(60);
  var cameraAngleRadians = degToRad(0);
  var rotation = degToRad(0);
  var then = 0;
  var deltaTime;
  let height = 0.45;
  let seaLevel = 0.15;
  let noiseType = 0; // 0 = Perlin, 1 = Random
  var objectCount = 10;
  const rotationSpeed = 0.75;

  requestAnimationFrame(render);

  // Setup a ui.
  //Slider de Resolução
  const resInput = document.querySelector("#resRange");
  const resDisp = document.querySelector("#resValue");

  resInput.addEventListener("change", (e) => {
    resolution = parseInt(e.target.value);
    resDisp.textContent = resolution;
    sphere = createSphere(resolution);
    update();
  });

  //Seletor de Ruído
  const noiseSelector = document.querySelector("#noiseSelect");

  noiseSelector.addEventListener("change", (e) => {
    if (e.target.value === "random") noiseType = 1;
    else if (e.target.value === "perlin") noiseType = 0;
    requestAnimationFrame(render);
  });

  //Altura
  const heightInput = document.querySelector("#heightRange");
  const heightDisp = document.querySelector("#heightValue");

  heightInput.addEventListener("change", (e) => {
    height = parseFloat(e.target.value) / 100;
    heightDisp.textContent = height;
    update();
  });

  //Nível do Mar
  const seaLevelInput = document.querySelector("#seaLevelRange");
  const seaLevelDisp = document.querySelector("#seaValue");

  seaLevelInput.addEventListener("change", (e) => {
    seaLevel = parseFloat(e.target.value) / 100;
    seaLevelDisp.textContent = seaLevel;
    update();
  });

  //Quantidade de Objetos
  const objInput = document.querySelector("#objRange");
  const objDisp = document.querySelector("#objValue");

  objInput.addEventListener("input", (e) => {
    objectCount = parseInt(e.target.value);
    objDisp.textContent = objectCount;
    // Aqui você deve disparar a lógica para reposicionar árvores/objetos
    update(); 
  });

  function update(){
    gl.bindVertexArray(vao);

    vertexData = new Float32Array(sphere.vertices);
    indexData = new Uint32Array(sphere.indices);

    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertexData, gl.STATIC_DRAW);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indexData, gl.STATIC_DRAW);

    gl.vertexAttribPointer(positionAttributeLocation, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(positionAttributeLocation);

    gl.bindVertexArray(null);

    requestAnimationFrame(render);
  }

  function resizeCanvasToDisplaySize() {
    var width = gl.canvas.clientWidth;
    var height = gl.canvas.clientHeight;
    if (gl.canvas.width != width ||
        gl.canvas.height != height) {
      gl.canvas.width = width;
      gl.canvas.height = height;
    }
  }

  function render(now) {
    now *= 0.001;
    deltaTime = now - then;
    then = now;

    resizeCanvasToDisplaySize();
    drawScene();
    requestAnimationFrame(render);
  }

  function drawScene() {
    // Every frame increase the rotation a little.
    rotation += rotationSpeed * deltaTime;
    var radius = 5;

    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    // Clear the canvas
    gl.clearColor(0, 0, 0, 0);

    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LESS);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.enable(gl.CULL_FACE);
    gl.frontFace(gl.CCW);

    gl.useProgram(program);

    gl.bindVertexArray(vao);

    // Compute the matrix
    var aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
    var zNear = 1;
    var zFar = 800;
    var projectionMatrix = m4.perspective(fieldOfViewRadians, aspect, zNear, zFar);

    var modelPosition = [0, 0, 0]

    var cameraMatrix = m4.yRotation(cameraAngleRadians);
    cameraMatrix = m4.translate(cameraMatrix, 0, 0, radius * 0.8);

    var cameraPosition = [cameraMatrix[12], cameraMatrix[13], cameraMatrix[14]];

    var up = [0, 1, 0];

    var cameraMatrix = m4.lookAt(cameraPosition, modelPosition, up);

    // Make a view matrix from the camera matrix.
    var viewMatrix = m4.inverse(cameraMatrix);

    // create a viewProjection matrix. This will both apply perspective
    // AND move the world so that the camera is effectively the origin
    var viewProjectionMatrix = m4.multiply(projectionMatrix, viewMatrix);

    var modelMatrix = m4.translation(0, 0, 0);
    modelMatrix = m4.yRotate(modelMatrix, rotation);

    var mvpMatrix = m4.multiply(viewProjectionMatrix, modelMatrix);
    /*viewProjectionMatrix = m4.translate(viewProjectionMatrix, translation[0], translation[1], translation[2]);
    viewProjectionMatrix = m4.xRotate(viewProjectionMatrix, rotation[0]);
    viewProjectionMatrix = m4.yRotate(viewProjectionMatrix, rotation[1]);
    viewProjectionMatrix = m4.zRotate(viewProjectionMatrix, rotation[2]);
    viewProjectionMatrix = m4.scale(viewProjectionMatrix, scale[0], scale[1], scale[2]);*/

    gl.uniformMatrix4fv(matrixLocation, false, mvpMatrix);
    gl.uniform1f(heightLocation, height);
    gl.uniform1f(seaLevelLocation, seaLevel);
    gl.uniform1i(noiseTypeLocation, noiseType);

    gl.drawElements(gl.TRIANGLES, sphere.indices.length, gl.UNSIGNED_INT, 0);
  }
}

function radToDeg(r) {
  return r * 180 / Math.PI;
}

function degToRad(d) {
  return d * Math.PI / 180;
}

function createSphere(resolution) {
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

var m4 = {

  perspective: function(fieldOfViewInRadians, aspect, near, far) {
    var f = Math.tan(Math.PI * 0.5 - 0.5 * fieldOfViewInRadians);
    var rangeInv = 1.0 / (near - far);
 
    return [
      f / aspect, 0, 0, 0,
      0, f, 0, 0,
      0, 0, (near + far) * rangeInv, -1,
      0, 0, near * far * rangeInv * 2, 0
    ];
  },

  multiply: function(a, b) {
    var a00 = a[0 * 4 + 0];
    var a01 = a[0 * 4 + 1];
    var a02 = a[0 * 4 + 2];
    var a03 = a[0 * 4 + 3];
    var a10 = a[1 * 4 + 0];
    var a11 = a[1 * 4 + 1];
    var a12 = a[1 * 4 + 2];
    var a13 = a[1 * 4 + 3];
    var a20 = a[2 * 4 + 0];
    var a21 = a[2 * 4 + 1];
    var a22 = a[2 * 4 + 2];
    var a23 = a[2 * 4 + 3];
    var a30 = a[3 * 4 + 0];
    var a31 = a[3 * 4 + 1];
    var a32 = a[3 * 4 + 2];
    var a33 = a[3 * 4 + 3];
    var b00 = b[0 * 4 + 0];
    var b01 = b[0 * 4 + 1];
    var b02 = b[0 * 4 + 2];
    var b03 = b[0 * 4 + 3];
    var b10 = b[1 * 4 + 0];
    var b11 = b[1 * 4 + 1];
    var b12 = b[1 * 4 + 2];
    var b13 = b[1 * 4 + 3];
    var b20 = b[2 * 4 + 0];
    var b21 = b[2 * 4 + 1];
    var b22 = b[2 * 4 + 2];
    var b23 = b[2 * 4 + 3];
    var b30 = b[3 * 4 + 0];
    var b31 = b[3 * 4 + 1];
    var b32 = b[3 * 4 + 2];
    var b33 = b[3 * 4 + 3];
    return [
      b00 * a00 + b01 * a10 + b02 * a20 + b03 * a30,
      b00 * a01 + b01 * a11 + b02 * a21 + b03 * a31,
      b00 * a02 + b01 * a12 + b02 * a22 + b03 * a32,
      b00 * a03 + b01 * a13 + b02 * a23 + b03 * a33,
      b10 * a00 + b11 * a10 + b12 * a20 + b13 * a30,
      b10 * a01 + b11 * a11 + b12 * a21 + b13 * a31,
      b10 * a02 + b11 * a12 + b12 * a22 + b13 * a32,
      b10 * a03 + b11 * a13 + b12 * a23 + b13 * a33,
      b20 * a00 + b21 * a10 + b22 * a20 + b23 * a30,
      b20 * a01 + b21 * a11 + b22 * a21 + b23 * a31,
      b20 * a02 + b21 * a12 + b22 * a22 + b23 * a32,
      b20 * a03 + b21 * a13 + b22 * a23 + b23 * a33,
      b30 * a00 + b31 * a10 + b32 * a20 + b33 * a30,
      b30 * a01 + b31 * a11 + b32 * a21 + b33 * a31,
      b30 * a02 + b31 * a12 + b32 * a22 + b33 * a32,
      b30 * a03 + b31 * a13 + b32 * a23 + b33 * a33,
    ];
  },

  inverse: function(m) {
    var m00 = m[0 * 4 + 0];
    var m01 = m[0 * 4 + 1];
    var m02 = m[0 * 4 + 2];
    var m03 = m[0 * 4 + 3];
    var m10 = m[1 * 4 + 0];
    var m11 = m[1 * 4 + 1];
    var m12 = m[1 * 4 + 2];
    var m13 = m[1 * 4 + 3];
    var m20 = m[2 * 4 + 0];
    var m21 = m[2 * 4 + 1];
    var m22 = m[2 * 4 + 2];
    var m23 = m[2 * 4 + 3];
    var m30 = m[3 * 4 + 0];
    var m31 = m[3 * 4 + 1];
    var m32 = m[3 * 4 + 2];
    var m33 = m[3 * 4 + 3];
    var tmp_0  = m22 * m33;
    var tmp_1  = m32 * m23;
    var tmp_2  = m12 * m33;
    var tmp_3  = m32 * m13;
    var tmp_4  = m12 * m23;
    var tmp_5  = m22 * m13;
    var tmp_6  = m02 * m33;
    var tmp_7  = m32 * m03;
    var tmp_8  = m02 * m23;
    var tmp_9  = m22 * m03;
    var tmp_10 = m02 * m13;
    var tmp_11 = m12 * m03;
    var tmp_12 = m20 * m31;
    var tmp_13 = m30 * m21;
    var tmp_14 = m10 * m31;
    var tmp_15 = m30 * m11;
    var tmp_16 = m10 * m21;
    var tmp_17 = m20 * m11;
    var tmp_18 = m00 * m31;
    var tmp_19 = m30 * m01;
    var tmp_20 = m00 * m21;
    var tmp_21 = m20 * m01;
    var tmp_22 = m00 * m11;
    var tmp_23 = m10 * m01;

    var t0 = (tmp_0 * m11 + tmp_3 * m21 + tmp_4 * m31) -
             (tmp_1 * m11 + tmp_2 * m21 + tmp_5 * m31);
    var t1 = (tmp_1 * m01 + tmp_6 * m21 + tmp_9 * m31) -
             (tmp_0 * m01 + tmp_7 * m21 + tmp_8 * m31);
    var t2 = (tmp_2 * m01 + tmp_7 * m11 + tmp_10 * m31) -
             (tmp_3 * m01 + tmp_6 * m11 + tmp_11 * m31);
    var t3 = (tmp_5 * m01 + tmp_8 * m11 + tmp_11 * m21) -
             (tmp_4 * m01 + tmp_9 * m11 + tmp_10 * m21);

    var d = 1.0 / (m00 * t0 + m10 * t1 + m20 * t2 + m30 * t3);

    return [
      d * t0,
      d * t1,
      d * t2,
      d * t3,
      d * ((tmp_1 * m10 + tmp_2 * m20 + tmp_5 * m30) -
           (tmp_0 * m10 + tmp_3 * m20 + tmp_4 * m30)),
      d * ((tmp_0 * m00 + tmp_7 * m20 + tmp_8 * m30) -
           (tmp_1 * m00 + tmp_6 * m20 + tmp_9 * m30)),
      d * ((tmp_3 * m00 + tmp_6 * m10 + tmp_11 * m30) -
           (tmp_2 * m00 + tmp_7 * m10 + tmp_10 * m30)),
      d * ((tmp_4 * m00 + tmp_9 * m10 + tmp_10 * m20) -
           (tmp_5 * m00 + tmp_8 * m10 + tmp_11 * m20)),
      d * ((tmp_12 * m13 + tmp_15 * m23 + tmp_16 * m33) -
           (tmp_13 * m13 + tmp_14 * m23 + tmp_17 * m33)),
      d * ((tmp_13 * m03 + tmp_18 * m23 + tmp_21 * m33) -
           (tmp_12 * m03 + tmp_19 * m23 + tmp_20 * m33)),
      d * ((tmp_14 * m03 + tmp_19 * m13 + tmp_22 * m33) -
           (tmp_15 * m03 + tmp_18 * m13 + tmp_23 * m33)),
      d * ((tmp_17 * m03 + tmp_20 * m13 + tmp_23 * m23) -
           (tmp_16 * m03 + tmp_21 * m13 + tmp_22 * m23)),
      d * ((tmp_14 * m22 + tmp_17 * m32 + tmp_13 * m12) -
           (tmp_16 * m32 + tmp_12 * m12 + tmp_15 * m22)),
      d * ((tmp_20 * m32 + tmp_12 * m02 + tmp_19 * m22) -
           (tmp_18 * m22 + tmp_21 * m32 + tmp_13 * m02)),
      d * ((tmp_18 * m12 + tmp_23 * m32 + tmp_15 * m02) -
           (tmp_22 * m32 + tmp_14 * m02 + tmp_19 * m12)),
      d * ((tmp_22 * m22 + tmp_16 * m02 + tmp_21 * m12) -
           (tmp_20 * m12 + tmp_23 * m22 + tmp_17 * m02)),
    ];
  },

  cross: function(a, b) {
    return [
       a[1] * b[2] - a[2] * b[1],
       a[2] * b[0] - a[0] * b[2],
       a[0] * b[1] - a[1] * b[0],
    ];
  },

  subtractVectors: function(a, b) {
    return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  },

  normalize: function(v) {
    var length = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
    // make sure we don't divide by 0.
    if (length > 0.00001) {
      return [v[0] / length, v[1] / length, v[2] / length];
    } else {
      return [0, 0, 0];
    }
  },

  lookAt: function(cameraPosition, target, up) {
    var zAxis = m4.normalize(
        m4.subtractVectors(cameraPosition, target));
    var xAxis = m4.normalize(m4.cross(up, zAxis));
    var yAxis = m4.normalize(m4.cross(zAxis, xAxis));

    return [
      xAxis[0], xAxis[1], xAxis[2], 0,
      yAxis[0], yAxis[1], yAxis[2], 0,
      zAxis[0], zAxis[1], zAxis[2], 0,
      cameraPosition[0],
      cameraPosition[1],
      cameraPosition[2],
      1,
    ];
  },

  translation: function(tx, ty, tz) {
    return [
       1,  0,  0,  0,
       0,  1,  0,  0,
       0,  0,  1,  0,
       tx, ty, tz, 1,
    ];
  },

  xRotation: function(angleInRadians) {
    var c = Math.cos(angleInRadians);
    var s = Math.sin(angleInRadians);

    return [
      1, 0, 0, 0,
      0, c, s, 0,
      0, -s, c, 0,
      0, 0, 0, 1,
    ];
  },

  yRotation: function(angleInRadians) {
    var c = Math.cos(angleInRadians);
    var s = Math.sin(angleInRadians);

    return [
      c, 0, -s, 0,
      0, 1, 0, 0,
      s, 0, c, 0,
      0, 0, 0, 1,
    ];
  },

  zRotation: function(angleInRadians) {
    var c = Math.cos(angleInRadians);
    var s = Math.sin(angleInRadians);

    return [
       c, s, 0, 0,
      -s, c, 0, 0,
       0, 0, 1, 0,
       0, 0, 0, 1,
    ];
  },

  scaling: function(sx, sy, sz) {
    return [
      sx, 0,  0,  0,
      0, sy,  0,  0,
      0,  0, sz,  0,
      0,  0,  0,  1,
    ];
  },

  translate: function(m, tx, ty, tz) {
    return m4.multiply(m, m4.translation(tx, ty, tz));
  },

  xRotate: function(m, angleInRadians) {
    return m4.multiply(m, m4.xRotation(angleInRadians));
  },

  yRotate: function(m, angleInRadians) {
    return m4.multiply(m, m4.yRotation(angleInRadians));
  },

  zRotate: function(m, angleInRadians) {
    return m4.multiply(m, m4.zRotation(angleInRadians));
  },

  scale: function(m, sx, sy, sz) {
    return m4.multiply(m, m4.scaling(sx, sy, sz));
  },

};

main();