"use strict";

var vsPlanet = `#version 300 es

in vec4 a_position;

uniform mat4 u_matrix;

out float v_height;

void main() {
  v_height = length(a_position.xyz) - 1.0;
  gl_Position = u_matrix * a_position;
}`;


var fsPlanet = `#version 300 es

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
  
  const programPlanet = gl.createProgram();

  const vertexShader = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(vertexShader, vsPlanet);
  gl.compileShader(vertexShader);
  gl.attachShader(programPlanet, vertexShader);

  const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(fragmentShader, fsPlanet);
  gl.compileShader(fragmentShader);
  gl.attachShader(programPlanet, fragmentShader);

  gl.linkProgram(programPlanet);

  if (!gl.getProgramParameter(programPlanet, gl.LINK_STATUS)) {
      console.log(gl.getShaderInfoLog(vertexShader));
      console.log(gl.getShaderInfoLog(fragmentShader));
  }
  gl.useProgram(programPlanet);

  var positionAttributeLocation = gl.getAttribLocation(programPlanet, "a_position");
  var matrixLocation = gl.getUniformLocation(programPlanet, "u_matrix");
  const heightLocation = gl.getUniformLocation(programPlanet, "u_height");
  const seaLevelLocation = gl.getUniformLocation(programPlanet, "u_seaLevel");
  const noiseTypeLocation = gl.getUniformLocation(programPlanet, "u_noiseType");

  var resolution = 250;
  var noiseType = 0;    // 0 = Perlin, 1 = Random
  var height = 0.45;
  var baseSphere = createBaseSphere(resolution);
  var planet = generatePlanet(baseSphere, noiseType, height)

  var vao = gl.createVertexArray();
  gl.bindVertexArray(vao);

  var vertexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, planet.vertices, gl.STATIC_DRAW);

  var indexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, planet.indices, gl.STATIC_DRAW);

  gl.vertexAttribPointer(positionAttributeLocation, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(positionAttributeLocation);

  gl.bindVertexArray(null);

  var fieldOfViewRadians = degToRad(60);
  var cameraAngleRadians = degToRad(0);
  var rotation = degToRad(0);
  var then = 0;
  var deltaTime;
  var seaLevel = 0;
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
    baseSphere = createBaseSphere(resolution);
    planet = generatePlanet(baseSphere, noiseType, height);
    update();
  });

  //Seletor de Ruído
  const noiseSelector = document.querySelector("#noiseSelect");

  noiseSelector.addEventListener("change", (e) => {
    if (e.target.value === "random") noiseType = 1;
    else if (e.target.value === "perlin") noiseType = 0;
    planet = generatePlanet(baseSphere, noiseType, height);
    update();
  });

  //Altura
  const heightInput = document.querySelector("#heightRange");
  const heightDisp = document.querySelector("#heightValue");

  heightInput.addEventListener("change", (e) => {
    height = parseFloat(e.target.value) / 100;
    heightDisp.textContent = height;
    planet = generatePlanet(baseSphere, noiseType, height);
    update();
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

    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, planet.vertices, gl.STATIC_DRAW);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, planet.indices, gl.STATIC_DRAW);

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
    var radius = 3.5;

    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    gl.clearColor(0.02, 0.02, 0.05, 1.0);

    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LESS);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.enable(gl.CULL_FACE);
    gl.frontFace(gl.CCW);

    gl.useProgram(programPlanet);

    gl.bindVertexArray(vao);

    // Compute the matrix
    var aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
    var zNear = 1;
    var zFar = 800;

    var projectionMatrix = m4.perspective(fieldOfViewRadians, aspect, zNear, zFar);
    var cameraMatrix = m4.yRotation(cameraAngleRadians);
    cameraMatrix = m4.translate(cameraMatrix, 0, 0, radius * 0.8);
    var cameraPosition = [cameraMatrix[12], cameraMatrix[13], cameraMatrix[14]];
    var up = [0, 1, 0];
    var modelPosition = [0, 0, 0]
    var cameraMatrix = m4.lookAt(cameraPosition, modelPosition, up);

    // Make a view matrix from the camera matrix.
    var viewMatrix = m4.inverse(cameraMatrix);

    // create a viewProjection matrix. This will both apply perspective
    // AND move the world so that the camera is effectively the origin
    var viewProjectionMatrix = m4.multiply(projectionMatrix, viewMatrix);
    
    var modelMatrix = m4.translation(0, 0, 0);
    modelMatrix = m4.yRotate(modelMatrix, rotation);

    var mvpMatrix = m4.multiply(viewProjectionMatrix, modelMatrix);

    gl.uniformMatrix4fv(matrixLocation, false, mvpMatrix);
    gl.uniform1f(heightLocation, height);
    gl.uniform1f(seaLevelLocation, seaLevel);
    gl.uniform1i(noiseTypeLocation, noiseType);

    gl.drawElements(gl.TRIANGLES, baseSphere.indices.length, gl.UNSIGNED_INT, 0);
  }
}

function radToDeg(r) {
  return r * 180 / Math.PI;
}

function degToRad(d) {
  return d * Math.PI / 180;
}


main();