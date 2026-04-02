# Procedural Planet - WebGL2

Este projeto é um gerador de planetas procedurais desenvolvido com WebGL2. Ele utiliza algoritmos de ruído para criar terrenos dinâmicos e permite a interação direta do utilizador para personalizar a aparência do planeta e do ambiente ao seu redor.

---

## Funcionalidades

- **Geração de Terreno Procedural:** Criação de esferas com vértices deslocados usando ruído de Perlin ou valores aleatórios.
- **Sistema de Biomas Dinâmico:** As cores do terreno (água, areia e relva) adaptam-se automaticamente com base na altura dos vértices e no nível do mar definido.
- **Distribuição de Objetos:** Posicionamento automático de árvores, pedras, ervas e nuvens sobre a superfície do planeta.
- **Iluminação e Sombras:** Implementação de Shadow Mapping para sombras realistas e modelo de reflexo de Blinn-Phong para iluminação.
- **Interatividade:**
  - Rotação do planeta através do rato.
  - Modo **"Plant Trees"**: Permite plantar árvores clicando diretamente na superfície do planeta usando técnicas de Raycasting.
  - Painel de controlo (UI) para ajustar resolução, velocidade da luz, rotação e densidade de objetos.
- **Fundo Estelar:** Um sistema de partículas para estrelas que reagem à posição do rato (efeito de fade-out).

---

## Tecnologias Utilizadas

- **WebGL2:** API gráfica principal para renderização.
- **TWGL.js:** Biblioteca auxiliar para simplificar a gestão de buffers, programas e texturas.
- **m4.js:** Biblioteca para manipulação de matrizes 3D.
- **JavaScript (ES6+):** Lógica da aplicação e geração procedural.

---

## Estrutura do Projeto

| Ficheiro | Descrição |
|---|---|
| `index.html` | Estrutura da página e interface de utilizador (sliders e seletores). |
| `main.js` | Coração da aplicação. Contém o ciclo de renderização, lógica de sombras, câmara e interações do rato. |
| `planet.js` | Lógica de criação da geometria da esfera, aplicação de ruído de Perlin e shaders do planeta. |
| `objects.js` | Carregador de modelos OBJ/MTL e funções de parsing para os objetos 3D. |
| `stars.js` | Sistema de partículas e shaders para o fundo de estrelas. |
| `style.css` | Estilização da interface flutuante e do canvas. |

---

## Como Usar

1. Abra o ficheiro `index.html` num navegador que suporte WebGL2.
2. Use os **Sliders** no painel lateral para:
   - Alterar o **Detail Level** (Resolução da malha).
   - Ajustar o **Sea Level** (Nível da água).
   - Controlar a **Light Speed** e a **Planet Rotation**.
3. Ative a opção **Plant Trees** e clique no planeta para adicionar árvores manualmente.
4. Arraste o mouse sobre o planeta para o rotacionar e observar de diferentes ângulos.
