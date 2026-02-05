"use strict";

var vertexShaderSource = `#version 300 es

in vec4 a_position;

uniform mat4 u_matrix;
uniform float u_height;
uniform float u_seaLevel;
uniform int u_noiseType;

out float v_height;

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
  v_height = height;

  vec3 displacedPosition = pos + normal * height;

  gl_Position = u_matrix * vec4(displacedPosition, 1.0);
}`;

var fragmentShaderSource = `#version 300 es

precision highp float;

in float v_height;

uniform float u_seaLevel;

out vec4 outColor;

void main() {
  if (v_height < u_seaLevel) {
    outColor = vec4(0.0, 0.3, 0.7, 1.0);   // Mar
  } else if (v_height < u_seaLevel + 0.05) {
    outColor = vec4(0.9, 0.8, 0.6, 1.0);   // Praia
  } else {
    outColor = vec4(0.1, 0.6, 0.2, 1.0);   // Terra
  }
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
    requestAnimationFrame(render);
  });

  //Nível do Mar
  const seaLevelInput = document.querySelector("#seaLevelRange");
  const seaLevelDisp = document.querySelector("#seaValue");

  seaLevelInput.addEventListener("change", (e) => {
    seaLevel = parseFloat(e.target.value) / 100;
    seaLevelDisp.textContent = seaLevel;
    requestAnimationFrame(render);
  });

  //Quantidade de Objetos
  const objInput = document.querySelector("#objRange");
  const objDisp = document.querySelector("#objValue");

  objInput.addEventListener("input", (e) => {
    objectCount = parseInt(e.target.value);
    objDisp.textContent = objectCount;
    // Aqui você deve disparar a lógica para reposicionar árvores/objetos
    //update(); 
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

    gl.clearColor(0.02, 0.02, 0.05, 1.0);

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

main();