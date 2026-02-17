"use strict"

async function main() {
    // Get A WebGL context
    /** @type {HTMLCanvasElement} */
    const canvas = document.querySelector("#canvas");
    const gl = canvas.getContext("webgl2");
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

    const positionAttributeLocation = gl.getAttribLocation(programPlanet, "a_position");
    const normalAttributeLocation = gl.getAttribLocation(programPlanet, "a_normal");
    const matrixLocation = gl.getUniformLocation(programPlanet, "u_matrix");
    const seaLevelLocation = gl.getUniformLocation(programPlanet, "u_seaLevel");

    var resolution = 250;
    var noiseType = 0;    // 0 = Perlin, 1 = Random
    var displacement = 0.45;
    var baseSphere = createBaseSphere(resolution);
    var planet = generatePlanet(baseSphere, noiseType, displacement)
    var seaLevel = 0;

    const cameraTarget = [0, 0, 0];
    const cameraPosition = [0, 0, 4];
    const zNear = 0.1;
    const zFar = 50;

    var vertexBuffer = gl.createBuffer();
    var normalBuffer = gl.createBuffer();
    var indexBuffer = gl.createBuffer();

    var vao1 = gl.createVertexArray();
    updateVAO(vao1);

    // ----------- OBJECTS ---------------

    const models = {
        tree: await loadOBJ(gl, './Assets/obj/Tree_1_A_Color1.obj', vsObject, fsObject),
        grass: await loadOBJ(gl, './Assets/obj/Grass_2_C_Color1.obj', vsObject, fsObject),
        rock: await loadOBJ(gl, './Assets/obj/Rock_3_A_Color1.obj', vsObject, fsObject),
        cloud: await loadOBJ(gl, './Assets/obj/cloud.obj', vsObject, fsObject),
    };

    async function loadOBJ(gl, objHref, vs, fs) {
        twgl.setAttributePrefix("a_");

        const programObject = twgl.createProgramInfo(gl, [vs, fs]);

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
            const vao = twgl.createVAOFromBufferInfo(gl, programObject, bufferInfo);

            return {
                bufferInfo,
                vao,
                material: materials[material],
            };
        });

        return { programObject, parts };
    }


    var objectInstances = [];
    var treeCount = 10;
    var rockCount = 10;
    var grassCount = 10;
    var cloudCount = 5;

    placeObjects();

    requestAnimationFrame(render);

    // Setup a ui.

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
    const objInput = document.querySelector("#objRange");
    const objDisp = document.querySelector("#objValue");

    objInput.addEventListener("change", (e) => {
        treeCount = parseInt(e.target.value);
        objDisp.textContent = treeCount;
        placeObjects(); 
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
                    offset = 0.3;
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
        time *= 0.001;  // convert to seconds

        twgl.resizeCanvasToDisplaySize(gl.canvas);
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
        
        gl.enable(gl.DEPTH_TEST);
        gl.clearColor(0.02, 0.02, 0.05, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);


        const fieldOfViewRadians = degToRad(60);
        const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
        
        const projection = m4.perspective(fieldOfViewRadians, aspect, zNear, zFar);

        const up = [0, 1, 0];

        const camera = m4.lookAt(cameraPosition, cameraTarget, up);

        const view = m4.inverse(camera);

        // DRAW PLANET

        gl.useProgram(programPlanet);

        gl.bindVertexArray(vao1);

        var viewProjectionMatrix = m4.multiply(projection, view);
        
        var modelMatrix = m4.translation(0, 0, 0);
        modelMatrix = m4.yRotation(time);

        var mvpMatrix = m4.multiply(viewProjectionMatrix, modelMatrix);

        gl.uniformMatrix4fv(matrixLocation, false, mvpMatrix);
        gl.uniform1f(seaLevelLocation, seaLevel);

        gl.drawElements(gl.TRIANGLES, baseSphere.indices.length, gl.UNSIGNED_INT, 0);
        gl.bindVertexArray(null);

        // DRAW OBJECTS 
        
        for (const instance of objectInstances) {

            const { model, type } = instance;
            const modelData = models[type];

            gl.useProgram(modelData.programObject.program);

            modelMatrix = m4.yRotation(time);
            
            twgl.setUniforms(modelData.programObject, {
                u_lightDirection: m4.normalize([-1, 3, 5]),
                u_view: view,
                u_projection: projection,
            });

            for (const { bufferInfo, vao, material } of modelData.parts) {
                gl.bindVertexArray(vao);

                const diffuse = material.diffuse
                    ? [...material.diffuse, material.opacity ?? 1]
                    : [1, 1, 1, 1];

                twgl.setUniforms(modelData.programObject, {
                    u_model: m4.multiply(modelMatrix, model),
                    u_diffuse: diffuse,
                    u_diffuseMap: material.diffuseTexture,
                    u_hasDiffuseMap: !!material.diffuseMap,
                });


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

function normalizeVec4(v) {
  const len = Math.hypot(v[0], v[1], v[2], v[3]);
  const n = [
    v[0] / len,
    v[1] / len,
    v[2] / len,
    v[3] / len,
  ];
  return n;
}


