"use strict"

const vsShadow = `#version 300 es
layout(location = 0) in vec4 a_position;

uniform mat4 u_lightViewProjection;
uniform mat4 u_world;

void main() {
  gl_Position = u_lightViewProjection * u_world * a_position;
}
`;

const fsShadow = `#version 300 es
precision highp float;

void main() {}

`;

async function main() {
    // Get A WebGL context
    /** @type {HTMLCanvasElement} */
    const canvas = document.querySelector("#canvas");
    const gl = canvas.getContext("webgl2");
    if (!gl) {
        return;
    }

    // ------------ PLANET PROGRAM --------------

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

    const positionAttributeLocation = gl.getAttribLocation(programPlanet, "a_position");
    const normalAttributeLocation = gl.getAttribLocation(programPlanet, "a_normal");
    const worldLocation = gl.getUniformLocation(programPlanet, "u_world");
    const seaLevelLocation = gl.getUniformLocation(programPlanet, "u_seaLevel");
    const reverseLightDirectionLocation = gl.getUniformLocation(programPlanet, "u_reverseLightDirection");
    const worldInverseTransposeLocation = gl.getUniformLocation(programPlanet, "u_worldInverseTranspose");
    const projectionLocation = gl.getUniformLocation(programPlanet, "u_projection");
    const viewLocation = gl.getUniformLocation(programPlanet, "u_view");
    const cameraPositionLocation = gl.getUniformLocation(programPlanet, "u_cameraPosition");
    const shadowMapLocation = gl.getUniformLocation(programPlanet, "u_shadowMap");
    const lightViewProjectionLocation = gl.getUniformLocation(programPlanet, "u_lightViewProjection");

    var resolution = 250;
    var noiseType = 0;    // 0 = Perlin, 1 = Random
    var displacement = 0.45;
    var baseSphere = createBaseSphere(resolution);
    var planet = generatePlanet(baseSphere, noiseType, displacement)
    var seaLevel = 0;

    var vertexBuffer = gl.createBuffer();
    var normalBuffer = gl.createBuffer();
    var indexBuffer = gl.createBuffer();

    var vao1 = gl.createVertexArray();
    updateVAO(vao1);

    // ----------- OBJECT PROGRAMS ---------------

    const models = {
        tree: await loadOBJ(gl, './Assets/obj/Tree_1_A_Color1.obj', vsObject, fsObject),
        grass: await loadOBJ(gl, './Assets/obj/Grass_2_C_Color1.obj', vsObject, fsObject),
        rock: await loadOBJ(gl, './Assets/obj/Rock_3_A_Color1.obj', vsObject, fsObject),
        cloud: await loadOBJ(gl, './Assets/obj/cloud.obj', vsObject, fsObject),
    };

    var objectInstances = [];
    var treeCount = 10;
    var rockCount = 10;
    var grassCount = 10;
    var cloudCount = 10;

    placeObjects();

    // ---------- STARS PROGRAM --------------

    const starCount = 10000;
    const starVertices = [];

    for (let i = 0; i < starCount; i++) {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const r = 30;
        starVertices.push(
            r * Math.sin(phi) * Math.cos(theta),
            r * Math.cos(phi),
            r * Math.sin(phi) * Math.sin(theta)
        );
    }

    const starBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, starBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(starVertices), gl.STATIC_DRAW);

    const programStars = twgl.createProgramInfo(gl, [vsStar, fsStar]);

    // ----------- SHADOW TEXTURE -------------

    const programShadowInfo = twgl.createProgramInfo(gl, [vsShadow, fsShadow]);

    const depthTexture = gl.createTexture();
    const depthTextureSize = 2048;

    gl.bindTexture(gl.TEXTURE_2D, depthTexture);
    gl.texImage2D(
        gl.TEXTURE_2D,      // target
        0,                  // mip level
        gl.DEPTH_COMPONENT32F, // internal format
        depthTextureSize,   // width
        depthTextureSize,   // height
        0,                  // border
        gl.DEPTH_COMPONENT, // format
        gl.FLOAT,           // type
        null);              // data

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);


    const depthFramebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, depthFramebuffer);
    gl.framebufferTexture2D(
        gl.FRAMEBUFFER,       // target
        gl.DEPTH_ATTACHMENT,  // attachment point
        gl.TEXTURE_2D,        // texture target
        depthTexture,         // texture
        0);                   // mip level

    // ------------ ANIMATION AMBIENT --------

    // Estado do mouse
    let isDragging = false;
    let lastMouseX = 0;
    let lastMouseY = 0;
    let planetRotation = m4.identity();

    canvas.addEventListener('mousedown', (e) => {   
        isDragging = true;
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
    });

    canvas.addEventListener('mouseup', () => { isDragging = false; });
    canvas.addEventListener('mouseleave', () => { isDragging = false; });

    let mouse = { x: -99, y: -99 };

    canvas.addEventListener('mousemove', (e) => {

        const rect = canvas.getBoundingClientRect();
        mouse.x = ((e.clientX - rect.left) / rect.width)  *  2 - 1;
        mouse.y = ((e.clientY - rect.top)  / rect.height) * -2 + 1;

        if (!isDragging) return;

        const dx = e.clientX - lastMouseX;
        const dy = e.clientY - lastMouseY;

        lastMouseX = e.clientX;
        lastMouseY = e.clientY;

        const sensitivity = 0.01;
        const rotY = m4.yRotation(dx * sensitivity);
        const rotX = m4.xRotation(dy * sensitivity);

        planetRotation = m4.multiply(rotY, planetRotation);
        planetRotation = m4.multiply(rotX, planetRotation);
    });
        
    //------------- CONSTANTS -------------

    var lightPosition = [.5, .5, 5];
    const lightTarget = [0, 0, 0];
    var lightDirection = [
        lightTarget[0] - lightPosition[0],
        lightTarget[1] - lightPosition[1],
        lightTarget[2] - lightPosition[2],
    ];
    var reverseLightDirection = [-lightDirection[0], -lightDirection[1], -lightDirection[2]];
    const cameraTarget = [0, 0, 0];
    const cameraPosition = [0, 0, 4];
    const zNear = 0.1;
    const zFar = 50;
    var lightSpeed = 0.5;
    var rotationSpeed = 0.001;

    // ------------- RENDER --------------

    requestAnimationFrame(render);

    // ------------ Setup ui --------------

    //Slider de Resolução
    const resInput = document.querySelector("#resRange");
    const resDisp = document.querySelector("#resValue");

    resInput.addEventListener("change", (e) => {
        resolution = parseInt(e.target.value);
        resDisp.textContent = resolution;
        baseSphere = createBaseSphere(resolution);
        planet = generatePlanet(baseSphere, noiseType, displacement);
        updateVAO(vao1);
        placeObjects();

    });

    //Seletor de Ruído
    const noiseSelector = document.querySelector("#noiseSelect");

    noiseSelector.addEventListener("change", (e) => {
        if (e.target.value === "random") noiseType = 1;
        else if (e.target.value === "perlin") noiseType = 0;
        planet = generatePlanet(baseSphere, noiseType, displacement);
        updateVAO(vao1);
        placeObjects();
    });

    //Altura
    const heightInput = document.querySelector("#heightRange");
    const heightDisp = document.querySelector("#heightValue");

    heightInput.addEventListener("change", (e) => {
        displacement = parseFloat(e.target.value) / 100;
        heightDisp.textContent = displacement;
        planet = generatePlanet(baseSphere, noiseType, displacement);
        updateVAO(vao1);
        placeObjects();
    });

    //Nível do Mar
    const seaLevelInput = document.querySelector("#seaLevelRange");
    const seaLevelDisp = document.querySelector("#seaValue");

    seaLevelInput.addEventListener("change", (e) => {
        seaLevel = parseFloat(e.target.value) / 100;
        seaLevelDisp.textContent = seaLevel;
        placeObjects();
    });

    //Quantidade de Árvores
    const treesInput = document.querySelector("#treeRange");
    const treesDisp = document.querySelector("#treeValue");

    treesInput.addEventListener("change", (e) => {
        treeCount = parseInt(e.target.value);
        treesDisp.textContent = treeCount;
        placeObjects(); 
    });

    //Quantidade de Pedras
    const rocksInput = document.querySelector("#rockRange");
    const rocksDisp = document.querySelector("#rockValue");

    rocksInput.addEventListener("change", (e) => {
        rockCount = parseInt(e.target.value);
        rocksDisp.textContent = rockCount;
        placeObjects(); 
    });

    //Quantidade de Gramas
    const grassesInput = document.querySelector("#grassRange");
    const grassesDisp = document.querySelector("#grassValue");

    grassesInput.addEventListener("change", (e) => {
        grassCount = parseInt(e.target.value);
        grassesDisp.textContent = grassCount;
        placeObjects(); 
    });

    //Quantidade de Nuvens
    const cloudsInput = document.querySelector("#cloudRange");
    const cloudsDisp = document.querySelector("#cloudValue");

    cloudsInput.addEventListener("change", (e) => {
        cloudCount = parseInt(e.target.value);
        cloudsDisp.textContent = cloudCount;
        placeObjects(); 
    });

        //Velocidade da Luz
    const lightspeedInput = document.querySelector("#lightspeedRange");
    const lightspeedDisp = document.querySelector("#lightspeedValue");

    lightspeedInput.addEventListener("input", (e) => {
        lightSpeed = parseFloat(e.target.value) / 100 * 2; 
        lightspeedDisp.textContent = e.target.value;
    });

    //Velocidade de Rotação do Planeta
    const rotationPlanetInput = document.querySelector("#rotationPlanetRange");
    const rotationPlanetDisp = document.querySelector("#rotationPlanetValue");

    rotationPlanetInput.addEventListener("input", (e) => {
        rotationSpeed = parseFloat(e.target.value) / 100 * 0.05;
        rotationPlanetDisp.textContent = e.target.value;
    });

    function updateVAO(vao){
        gl.bindVertexArray(vao);

        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, planet.vertices, gl.STATIC_DRAW);
        gl.vertexAttribPointer(positionAttributeLocation, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(positionAttributeLocation);
        

        gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, planet.normals, gl.STATIC_DRAW);
        gl.vertexAttribPointer(normalAttributeLocation, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(normalAttributeLocation);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, planet.indices, gl.STATIC_DRAW);

        gl.bindVertexArray(null);
    }

    async function loadOBJ(gl, objHref, vs, fs) {
        twgl.setAttributePrefix("a_");

        const programObjectInfo = twgl.createProgramInfo(gl, [vs, fs]);

        const response = await fetch(objHref);
        const text = await response.text();
        const obj = parseOBJ(text);

        const baseHref = new URL(objHref, window.location.href);

        const matTexts = await Promise.all(
            obj.materialLibs.map(async filename => {
                const matHref = new URL(filename, baseHref).href;
                const response = await fetch(matHref);
                return response.text();
            })
        );

        const materials = parseMTL(matTexts.join('\n'));

        for (const mat of Object.values(materials)) {
            if (mat.diffuseMap) {
                mat.diffuseTexture = twgl.createTexture(gl, {
                    src: new URL(mat.diffuseMap, baseHref).href,
                    flipY: true,
                });
            } else {
                mat.diffuseTexture = twgl.createTexture(gl, {
                    src: [255, 255, 255, 255],
                });
            }
        }

        const parts = obj.geometries.map(({ material, data }) => {
        const bufferInfo = twgl.createBufferInfoFromArrays(gl, data);
        const vao = twgl.createVAOFromBufferInfo(gl, programObjectInfo, bufferInfo);

            return {
                bufferInfo,
                vao,
                material: materials[material],
            };
        });

        return { programObjectInfo, parts };
    }

    function placeObjects() {
        objectInstances = [];

        placeObj(treeCount, "tree");
        placeObj(rockCount, "rock");
        placeObj(grassCount, "grass");
        placeObj(cloudCount, "cloud");
    }

    function placeObj(objectCount, type) {

        for (let i = 0; i < objectCount; i++) {

            let isSea = true;
            let index;
            let px, py, pz;
            const maxTentativas = 100000;

            if (type != "cloud") {

                for (let tentativa = 0; tentativa < maxTentativas; tentativa++) {
                    index = Math.floor(Math.random() * (planet.vertices.length / 3));

                    px = planet.vertices[index * 3 + 0];
                    py = planet.vertices[index * 3 + 1];
                    pz = planet.vertices[index * 3 + 2];

                    if ((Math.hypot(px, py, pz) - 1) > seaLevel){
                        isSea = false;
                        break;
                    }
                }   
            
                if (isSea){
                    break;
                }
            } else {
                index = Math.floor(Math.random() * (planet.vertices.length / 3));

                px = planet.vertices[index * 3 + 0];
                py = planet.vertices[index * 3 + 1];
                pz = planet.vertices[index * 3 + 2];
            }

            let nx = planet.normals[index * 3 + 0];
            let ny = planet.normals[index * 3 + 1];
            let nz = planet.normals[index * 3 + 2];

            const n = [nx, ny, nz];

            const normal = normalizeVec3(n);

            let offset;
            let scale;

            switch (type) {
                case "tree":
                    scale = m4.scaling(0.07, 0.07, 0.07);
                    offset= 0.01
                    break;
                case "rock":
                    scale = m4.scaling(0.2, 0.2, 0.2);
                    offset = 0.01;
                    break;
                case "grass":
                    scale = m4.scaling(0.2, 0.2, 0.2);
                    offset = -0.025;
                    break;
                case "cloud":
                    scale = m4.scaling(0.001, 0.001, 0.001);
                    offset = 0.25;
                    break;
            }

            const translation = m4.translation(
            px + normal[0] * offset,
            py + normal[1] * offset, 
            pz + normal[2] * offset
            );

            const rotation = alignYToNormal(normal);

            let model = m4.identity();
            model = m4.multiply(model, translation);
            model = m4.multiply(model, rotation);
            model = m4.multiply(model, scale);

            objectInstances.push({
                model: model,
                type: type,
            });
        }
    }


    function render(time) {
        time *= 0.001;

        twgl.resizeCanvasToDisplaySize(gl.canvas);

        lightPosition[0] = Math.cos(time * lightSpeed) * 5;
        lightPosition[2] = Math.sin(time * lightSpeed) * 5;

        lightDirection = normalizeVec3([
            lightTarget[0] - lightPosition[0],
            lightTarget[1] - lightPosition[1],
            lightTarget[2] - lightPosition[2],
        ]);
        reverseLightDirection = [-lightDirection[0], -lightDirection[1], -lightDirection[2]];
  
        const rotation = m4.yRotation(rotationSpeed);
        planetRotation = m4.multiply(rotation, planetRotation);

        // -------- SHADOW MAPPING -----------

        gl.bindFramebuffer(gl.FRAMEBUFFER, depthFramebuffer);
        gl.viewport(0, 0, depthTextureSize, depthTextureSize);
        gl.clearDepth(1.0);
        gl.clear(gl.DEPTH_BUFFER_BIT);
        
        gl.enable(gl.DEPTH_TEST);

            //OBJECTS 

        const up = [0, 1, 0];
        const fieldOfViewRadians = degToRad(60);
        const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;

        const lightView = m4.inverse(m4.lookAt(lightPosition, lightTarget, up));
        const lightProjection = m4.orthographic(
            -4, 4,
            -4, 4,
            0.1,
            8
        );
        var lightViewProjection = m4.multiply(lightProjection, lightView);
        var modelMatrix;

        for (const instance of objectInstances) {

            const { model, type } = instance;
            const modelData = models[type];

            gl.useProgram(programShadowInfo.program);

            const rotation = planetRotation;
            modelMatrix = m4.multiply(rotation, model);
            
            twgl.setUniforms(programShadowInfo, {
                u_world: modelMatrix,
                u_lightViewProjection: lightViewProjection,
            });
            
            for (const { bufferInfo, vao} of modelData.parts) {
                gl.bindVertexArray(vao);
                twgl.drawBufferInfo(gl, bufferInfo);
                gl.bindVertexArray(null);
            }
        }

            // PLANET

        gl.useProgram(programShadowInfo.program);
        gl.bindVertexArray(vao1);

        modelMatrix = planetRotation;

        twgl.setUniforms(programShadowInfo, {
            u_world: modelMatrix,
            u_lightViewProjection: lightViewProjection,
        });

        gl.drawElements(gl.TRIANGLES, baseSphere.indices.length, gl.UNSIGNED_INT, 0);
        gl.bindVertexArray(null);

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, depthTexture);

        //----------- DRAW -------------

        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
        gl.clearColor(0.02, 0.02, 0.05, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
 
        const projection = m4.perspective(fieldOfViewRadians, aspect, zNear, zFar);

        const camera = m4.lookAt(cameraPosition, cameraTarget, up);

        const view = m4.inverse(camera);

        // DRAW STARS

        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

        gl.useProgram(programStars.program);
        gl.bindBuffer(gl.ARRAY_BUFFER, starBuffer);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
        twgl.setUniforms(programStars, {
            u_projection: projection,
            u_view: view,
            u_mouse: [mouse.x, mouse.y],
        });
        gl.drawArrays(gl.POINTS, 0, starCount);

        gl.disable(gl.BLEND);

        // DRAW PLANET

        gl.useProgram(programPlanet);

        gl.bindVertexArray(vao1);
        
        modelMatrix = planetRotation;

        var modelInverseMatrix = m4.inverse(modelMatrix);
        var modelInverseTransposeMatrix = m4.transpose(modelInverseMatrix);

        gl.uniformMatrix4fv(worldLocation, false, modelMatrix);
        gl.uniformMatrix4fv(worldInverseTransposeLocation, false, modelInverseTransposeMatrix);
        gl.uniformMatrix4fv(projectionLocation, false, projection);
        gl.uniformMatrix4fv(viewLocation, false, view);
        gl.uniform3fv(cameraPositionLocation, cameraPosition);
        gl.uniform1f(seaLevelLocation, seaLevel);
        gl.uniform3fv(reverseLightDirectionLocation, normalizeVec3(reverseLightDirection));
        gl.uniform1i(shadowMapLocation, 0);
        gl.uniformMatrix4fv(lightViewProjectionLocation, false, lightViewProjection);

        gl.drawElements(gl.TRIANGLES, baseSphere.indices.length, gl.UNSIGNED_INT, 0);
        gl.bindVertexArray(null);

        // DRAW OBJECTS 
        
        for (const instance of objectInstances) {

            const { model, type } = instance;
            const modelData = models[type];

            gl.useProgram(modelData.programObjectInfo.program);
           
            twgl.setUniforms(modelData.programObjectInfo, {
                u_reverseLightDirection: normalizeVec3(reverseLightDirection),
                u_view: view,
                u_projection: projection,
                u_cameraPosition: cameraPosition,
                u_lightViewProjection: lightViewProjection,
                u_shadowMap: 0
            });

            for (const { bufferInfo, vao, material } of modelData.parts) {
                gl.bindVertexArray(vao);

                const diffuse = material.diffuse
                    ? [...material.diffuse]
                    : [1, 1, 1];
                
                const ambient = material.ambient
                    ? [...material.ambient] : [0.2, 0.2, 0.2];

                const specular = material.specular
                    ? [...material.specular] : [0.5, 0.5, 0.5];

                const shininess = material.shininess ?? 40.0;

                const rotation = planetRotation;
    
                modelMatrix = m4.multiply(rotation, model);
                
                modelInverseMatrix = m4.inverse(modelMatrix);
                modelInverseTransposeMatrix = m4.transpose(modelInverseMatrix);

                twgl.setUniforms(modelData.programObjectInfo, {
                    u_world: modelMatrix,
                    u_worldInverseTranspose: modelInverseTransposeMatrix,
                    u_diffuse: diffuse,
                    u_diffuseMap: material.diffuseTexture,
                    u_hasDiffuseMap: !!material.diffuseMap,
                    u_ambient: ambient,
                    u_specular: specular,
                    u_shininess: shininess,
                });

                gl.activeTexture(gl.TEXTURE0);
                gl.bindTexture(gl.TEXTURE_2D, depthTexture);

                twgl.drawBufferInfo(gl, bufferInfo);
                gl.bindVertexArray(null);
            }
        }

        requestAnimationFrame(render);
    }
}

main();

function degToRad(deg) {
    return deg * Math.PI / 180;
}

function alignYToNormal(normal) {
  const up = [0, 1, 0];

  const axis = m4.cross(up, normal);

  const angle = Math.acos(m4.dot(up, normal));

  return m4.axisRotation(axis, angle);
}

function normalizeVec3(v) {
  const len = Math.hypot(v[0], v[1], v[2]);
  const n = [
    v[0] / len,
    v[1] / len,
    v[2] / len,
  ];
  return n;
}