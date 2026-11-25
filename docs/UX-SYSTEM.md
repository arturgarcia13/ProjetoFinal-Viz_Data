# UX System: Scrollytelling Baseado em Dados (Ref. The Pudding)

- **Data:** 2026-11-25
- **Tags:** #ux-system #scrollytelling #dataviz #arquitetura-frontend
- **Status:** Concluído
- **Pasta:** `📁 03_Recursos`
- **Referência:** [Why is Fox News obsessed with the WNBA? - The Pudding](https://pudding.cool/2026/11/wnba-politics/)
- **Próximos Passos:** Definir a stack da aplicação alvo e prototipar os componentes `ScrollyContainer` e `ReactiveStage`.

---

## 1. Arquitetura de Informação e Fluxo Narrativo

O sistema opera como um **ensaio visual guiado por dados (scrollytelling)** estruturado em um funil cognitivo de 5 etapas:

**Anedota → Evidência Visual em Escala → Análise Quantitativa → Síntese → Metodologia**

### Pilares Estruturais
* **Acessibilidade Inicial:** Link de salto imediato (`Skip to main content`) posicionado antes da barra de navegação.
* **Navegação Hierárquica por Capítulos (TOC):** Menu de duas camadas separando **macro-seções** e **sub-âncoras** (ex.: `Intro • Who Fox News Covers` | `Fightin' Words • Key Phrases • Players • Framing Chart` | `Identity Politics • Us vs. Them • Web Chart • Race • LGBTQ+ • Fouls` | `This Matters` | `Further Reading` | `Data & Methods`). Permite salto não-linear sem quebrar o ritmo de leitura linear.
* **Divulgação Progressiva (Progressive Disclosure):** A metodologia é resumida em poucas frases no fluxo principal, com link de escape (`See more in the methods`) apontando para a seção `Data & Methods` ao final, mantendo a carga cognitiva baixa durante a narrativa.

---

## 2. Mecânicas Centrais de UX (Padrões Replicáveis)

| Padrão de UX | Comportamento na Interface | Função Cognitiva |
| :--- | :--- | :--- |
| **Sticky Canvas + Scroll Steps** | O gráfico ou mosaico permanece fixo na viewport enquanto blocos curtos de texto rolam sobre ou ao lado dele. Cada bloco dispara uma mutação de estado no visual. | Elimina a desconexão espacial entre o texto explicativo e a visualização de dados. |
| **Macro → Micro (Grid to Pull-Out)** | Exibe primeiro um grande volume (~40 exemplos de vídeos ou manchetes) em mosaico; no passo seguinte do scroll, **extrai e amplia** 3 a 4 itens específicos em foco. | Comprova escala e padrão sistêmico primeiro; em seguida, entrega evidência legível sem poluir a tela. |
| **Evidência Inline com Metadados** | Citações e recortes exibem data, fonte, link externo (`Article ↗︎`) e **destaque tipográfico** exato nos termos analisados. | Permite auditoria instantânea da afirmação sem tirar o usuário do fluxo de leitura. |
| **Gráfico Divergente Ancorado no Zero** | Eixo central marcado como `Equal`, expandindo em duas direções (`← Grupo A` vs. `Grupo B →`) com marcadores claros de magnitude (`5×`, `10×`, `15×`). | Traduz estatística relativa em direção e proporção visuais imediatas. |
| **Rótulos de Troca de Contexto** | Micro-cabeçalhos de modalidade (ex.: `on the web`, `on television`) precedem cada novo gráfico. | Sinaliza mudança de dataset ou fonte antes que o usuário tente interpretar a nova visualização. |
| **Mídia Nativa Contextualizada** | Vídeos curtos com tarjas/legendas originais e capturas de tela reais anotadas integradas diretamente aos passos do scroll. | Ancora dados abstratos em artefatos reais facilmente reconhecíveis. |

---

## 3. Anatomia dos Componentes para Replicação

Para implementar esse UX System em uma aplicação, a interface deve ser desacoplada em **4 camadas independentes**:

### 1. Shell de Navegação (`ChapterNav`)
* **Estrutura:** Lista de capítulos e sub-itens com estado ativo sincronizado à seção visível na viewport.
* **Regra de UX:** Permitir acesso direto aos gráficos exploratórios para usuários que preferem ir direto aos dados em vez de ler a narrativa linear.

### 2. Motor de Scrollytelling (`ScrollyContainer`)
* **Layout:** Container com `position: relative`; camada visual com `position: sticky; top: 0; height: 100vh`; coluna de cards narrativos (`StepCard`) com espaçamento vertical generoso (`60vh` a `80vh` entre cards) para garantir ritmo de leitura e tempo de transição.
* **Gatilho:** `IntersectionObserver` (ou biblioteca leve como `scrollama`) monitorando qual `StepCard` cruza a zona de ativação (geralmente o centro da viewport) para atualizar um único estado `activeStep`.

### 3. Camada Visual Reativa (`ReactiveStage`)
* **Gestão de Estado:** Recebe `activeStep` como propriedade e interpola transições visuais suaves (ex.: `step 0` = grid com 40 itens em baixa opacidade; `step 1` = 4 itens ampliados em destaque com `opacity: 1` e demais reduzidos a `0.15`).
* **Responsividade (Mobile):** Em telas estreitas, o `ReactiveStage` ocupa o fundo ou a metade superior fixa, enquanto os `StepCards` deslizam por cima com fundo sólido ou semitransparente de alto contraste.

### 4. Módulos de Visualização Comparativa (`DivergentChart` & `EvidenceCard`)
* **`DivergentChart`:** Deve sempre apresentar rótulos direcionais com setas nas extremidades (`←` / `→`) e uma linha vertical central de referência (`Equal`).
* **`EvidenceCard`:** Componente atômico composto por 4 slots fixos:
  1. Metadado (Data + Fonte)
  2. Link Externo (`↗︎`)
  3. Texto com destaque semântico (highlight)
  4. Tag de Categoria

---

## 4. Gargalos Técnicos e Pontos de Atenção

* **Performance de Mídia no Mosaico:** Carregar dezenas de vídeos ou imagens pesadas simultaneamente no estado macro trava o scroll. Utilize thumbnails estáticas ou spritesheets na visão macro e carregue o vídeo/mídia completa sob demanda apenas nos itens em estado *pull-out*.
* **Proibição de Scroll Hijacking:** Nunca sequestre ou altere a física do scroll nativo do navegador. O motor deve apenas **observar** a posição do scroll para disparar transições CSS/SVG.
* **Acessibilidade de Movimento:** Respeitar a media query `prefers-reduced-motion`, substituindo animações de zoom e deslocamento por transições simples de opacidade ou layouts estáticos.

---

## 5. Resumo Executivo e Tarefas (PARA)

### Fatos Centrais e Decisões
* O fluxo narrativo deve guiar o usuário do micro (anedota) ao macro (dados), fechando com transparência metodológica sob demanda.
* A espinha dorsal técnica combina `position: sticky` + `IntersectionObserver` sem interferir no scroll nativo.
* A transição **Macro → Micro** é o recurso principal para provar volume sem sacrificar a legibilidade.

### Tarefas e Prazos
- [ ] Mapear os dados e a narrativa da aplicação alvo para o padrão **Macro → Micro** — *Prazo: A definir*
- [ ] Definir a stack (React, Vue, Svelte ou HTML/JS puro) para o protótipo — *Prazo: A definir*
- [ ] Implementar o protótipo do `ScrollyContainer` + `ReactiveStage` com suporte a `prefers-reduced-motion` — *Prazo: A definir*