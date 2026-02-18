const vsStar = `#version 300 es
in vec4 a_position;
uniform mat4 u_projection;
uniform mat4 u_view;
uniform vec2 u_mouse; 

out float v_fade;

void main() {
    vec4 clipPos = u_projection * u_view * a_position;
    vec2 mouse = clipPos.xy / clipPos.w;

    float dist = length(mouse - u_mouse);
    v_fade = smoothstep(0.0, 1.0, dist); // some dentro de raio 0.15

    gl_Position = clipPos;
    gl_PointSize = 1.0;
}`;

const fsStar = `#version 300 es
precision highp float;
in float v_fade;
out vec4 outColor;
void main() {
    outColor = vec4(1.0, 1.0, 1.0, v_fade);
}`;