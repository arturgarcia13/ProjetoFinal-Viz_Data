# DESIGN.md — Identidade Visual e Design System

> **Referência:** Projeto *Mulheres em Diálogo* (Instituto Update)  
> **Estilo:** Data Storytelling Editorial, Flat Design Contemporâneo e Comunicação Cívica Inclusiva

---

## 1. Conceito, Personalidade e Tom de Voz

### Personalidade Visual
* **Estética:** Editorial contemporânea, cívica e inclusiva, com apelo gráfico estritamente *flat* (sem gradientes, brilhos ou sombras pesadas).
* **Atmosfera:** Energética, democrática e acolhedora — ressignifica a base verde e amarela ao combiná-la com tons vibrantes de laranja coral e rosa.
* **Voz Visual:** Direta, afirmativa e comunitária, estruturada em alto contraste e amplo espaço negativo (*breathing room*).

### Tom de Voz e Microcopy
* **Abertura Concreta:** Usa cenas e imagens do cotidiano para ancorar dados abstratos (*"calçadas, pontos de ônibus, escolas"*).
* **Pontes, não Polarização:** Linguagem unificadora e afirmativa (*"para além das diferenças políticas, religiosas, regionais ou culturais"*, *"avançar em direitos sem criar divisões"*).
* **Perguntas como Subtítulos:** Emprega perguntas diretas (*"O que pensam as mulheres brasileiras?"*) para introduzir seções analíticas.
* **CTAs Diretos no Imperativo:** Sem floreios — sempre verbo + objeto exato:
  * *"Leia a Pesquisa..."*
  * *"Baixe a pesquisa"*
  * *"Baixe o mapa narrativo"*
  * *"Conheça os lançamentos anteriores."*

---

## 2. Paleta de Cores

| Função | Nome Sugerido | HEX | Uso Principal | Contraste / Regra de Uso |
| :--- | :--- | :--- | :--- | :--- |
| **Fundo Primário** | Verde Esmeralda | `#00805A` | Background principal de seções e canvas | Base dominante (~60% da interface) |
| **Destaque / Título** | Amarelo Solar | `#FCE34D` | Títulos H1/H2, Big Numbers, 1ª camada gráfica | Usar em texto grande/bold sobre o verde |
| **Acento Secundário** | Laranja Coral | `#FF5E2B` | Ilustrações, estados ativos, alertas, séries de dados | Alto impacto visual; evitar texto fino branco sobre ele |
| **Acento Terciário** | Rosa Vibrante | `#FF7AE5` | Ilustrações, tags, gráficos comparativos e detalhes | Combinar com texto verde escuro (`#003D2B`) |
| **Texto / Ícones** | Branco Puro | `#FFFFFF` | Corpo de texto, subtítulos, CTAs e iconografia linear | Contraste seguro (~4.9:1 sobre `#00805A`) |
| **Superfície Escura** *(UI)* | Verde Profundo | `#005C40` | Hover de botões, cards secundários e rodapés | Mantém coesão monocromática na interface |
| **Texto sobre Acento** *(UI)* | Verde Noturno | `#003D2B` | Texto sobre botões amarelos, badges rosas ou cards claros | Garante acessibilidade WCAG AAA sobre cores vibrantes |

### Ordem de Cores para Visualização de Dados
Para gráficos e séries categóricas sobre fundo verde escuro (`#00805A`), seguir esta ordem de prioridade:
1. `#FCE34D` (Amarelo Solar)
2. `#FF7AE5` (Rosa Vibrante)
3. `#FF5E2B` (Laranja Coral)
4. `#FFFFFF` (Branco Puro)

---

## 3. Tipografia e Hierarquia

A hierarquia combina uma fonte **display condensada de alto impacto** com uma **sans-serif limpa e compacta** para leitura fluida.

| Nível | Características | Equivalentes Web (Google Fonts) | Regras de Estilo |
| :--- | :--- | :--- | :--- |
| **Display (H1/H2)** | Sans-serif condensada, peso pesado, caixa alta, entrelinha fechada | **Anton**, **Barlow Condensed (800/900)** ou **Oswald (700)** | `text-transform: uppercase`, `line-height: 0.95`, cor `#FCE34D` |
| **Big Numbers** | Mesma família do Display, escala ampliada | **Anton** ou **Barlow Condensed (800)** | `clamp(3.5rem, 6vw, 5.5rem)`, `line-height: 0.9`, cor `#FCE34D` |
| **Lead (Destaque)** | Sans-serif humanista/neogrotesca, peso regular/médio | **Barlow**, **Roboto Condensed** ou **DM Sans** | `18px–20px`, `line-height: 1.35`, cor `#FFFFFF` |
| **Corpo (Parágrafo)** | Mesma família do Lead, escala menor para blocos informativos | **Barlow** ou **Inter** | `14px–16px`, `line-height: 1.5`, cor `#FFFFFF` (ou `88%` opacidade) |
| **Kicker / Tag** | Rótulo de categoria acima do título (ex.: `pesquisa`) | Mesma família do corpo (`font-weight: 700`) | `12px`, `letter-spacing: 0.08em`, `uppercase` ou `lowercase` estilizado |
| **CTA / Link** | Texto curto em negrito, direto e limpo | Mesma família do corpo (`font-weight: 700`) | `14px`, cor `#FFFFFF`, transição para `#FCE34D` no `:hover` |

---

## 4. Elementos Gráficos e Ilustração

* **Silhuetas em Camadas:** Formas vetoriais 100% chapadas (*flat*), sem contornos (`stroke: none`), representando diversidade através de perfis sobrepostos (amarelo na frente, laranja no meio, rosa ao fundo).
* **Sangria (*Bleed*):** As ilustrações encostam diretamente nas bordas inferior e esquerda do container, ancorando o peso visual da composição.
* **Grafismo de Apoio (Ícone):** Asterisco/estrela de 8 pontas com traço orgânico/irregular (estética de recorte manual) em branco (`#FFFFFF`), utilizado acima do título como marcador de seção.

---

## 5. Arquitetura de Página e Layout

### Grid e Alinhamento
* **Split Assimétrico (Desktop):** Divisão aproximada de **45% / 55%** — elementos gráficos pesados à esquerda e coluna editorial limpa à direita.
* **Alinhamento:** Alinhamento estrito à esquerda em toda a coluna de conteúdo (`ícone → título → lead → corpo → CTA`).
* **Espaçamento:** Uso generoso de espaço negativo ao redor dos blocos de texto para leitura rápida sem poluição visual.

### Ritmo Narrativo Modular (5 Blocos)

| Ordem | Tipo de Bloco | Estrutura de Conteúdo | Função na Interface |
| :--- | :--- | :--- | :--- |
| **01** | **Hero Editorial** | Manchete em caixa alta + 3 parágrafos curtos + selo de parceria + CTA primário | Imersão narrativa e contexto imediato |
| **02** | **Faixa de Big Numbers** | Grid de 3 colunas com percentual gigante (`92%`, `59%`, `70%`) + 1 frase objetiva | Prova quantitativa rápida e escaneável |
| **03** | **Manifesto / Sobre** | Split assimétrico (ilustração à esquerda + texto à direita sobre `#00805A`) | Quebra visual e posicionamento institucional |
| **04** | **Showcase de Pesquisa** | Kicker + Título + Pergunta-chave + Parágrafo metodológico + CTA + grid de 3 Big Numbers | Apresentação de entregáveis e dados principais |
| **05** | **Recurso Complementar** | Título + resumo prático + CTA de download | Aprofundamento e conversão final |

---

## 6. Diretrizes de Componentes de UI

* **Botão Primário:** Fundo `--brand-yellow` (`#FCE34D`), texto `--brand-text-on-accent` (`#003D2B`), `font-weight: 700`, sem sombra (*flat*).
* **Botão Secundário / Ghost:** Borda `1.5px solid #FFFFFF`, fundo transparente, texto `#FFFFFF`. No `:hover`, preencher com `#FFFFFF` e texto `#00805A`.
* **Cards / Containers:** Fundo `--brand-bg-dark` (`#005C40`) para agrupamentos sobre o fundo verde, ou branco (`#FFFFFF`) com texto `--brand-bg-darker` (`#003D2B`) para áreas de leitura longa ou gráficos em fundo claro.
* **Big Numbers:** Valor em fonte Display (`#FCE34D` sobre fundo escuro, ou `#00805A` / `#FF5E2B` sobre fundo claro) acompanhado de legenda curta (máx. 12–16 palavras) alinhada à esquerda.

---

## 7. Design Tokens e CSS Base

```css
:root {
  /* Cores Principais */
  --brand-bg-primary: #00805A;
  --brand-bg-dark: #005C40;
  --brand-bg-darker: #003D2B;

  /* Cores de Acento */
  --brand-yellow: #FCE34D;
  --brand-orange: #FF5E2B;
  --brand-pink: #FF7AE5;

  /* Neutros e Texto */
  --brand-text-primary: #FFFFFF;
  --brand-text-muted: rgba(255, 255, 255, 0.88);
  --brand-text-on-accent: #003D2B;

  /* Tipografia */
  --font-display: 'Anton', 'Barlow Condensed', sans-serif;
  --font-body: 'Barlow', 'Inter', sans-serif;

  /* Escala Tipográfica */
  --text-display: clamp(2.5rem, 5vw, 4rem);
  --text-stat: clamp(3.5rem, 6vw, 5rem);
  --text-lead: 1.25rem;
  --text-body: 0.9375rem;
  --text-cta: 0.875rem;
  --text-kicker: 0.75rem;

  /* Espaçamento e Bordas */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-pill: 9999px;
  --space-section: clamp(3rem, 6vw, 6rem);
}

/* Componente: Grid de Big Numbers */
.stat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 2.5rem;
}

.stat-value {
  font-family: var(--font-display);
  font-size: var(--text-stat);
  line-height: 0.9;
  color: var(--brand-yellow);
  margin-bottom: 0.75rem;
}

.stat-label {
  font-family: var(--font-body);
  font-size: var(--text-body);
  line-height: 1.4;
  color: var(--brand-text-primary);
  max-width: 28ch;
}

/* Componente: Botões */
.btn-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.75rem 1.5rem;
  background-color: var(--brand-yellow);
  color: var(--brand-text-on-accent);
  font-family: var(--font-body);
  font-size: var(--text-cta);
  font-weight: 700;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: opacity 0.2s ease;
}

.btn-primary:hover {
  opacity: 0.9;
}

.btn-ghost {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.75rem 1.5rem;
  background-color: transparent;
  color: var(--brand-text-primary);
  font-family: var(--font-body);
  font-size: var(--text-cta);
  font-weight: 700;
  border: 1.5px solid var(--brand-text-primary);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background-color 0.2s ease, color 0.2s ease;
}

.btn-ghost:hover {
  background-color: var(--brand-text-primary);
  color: var(--brand-bg-primary);
}
```

---

## 8. Utilitário de Verificação (DevTools)

Caso queira auditar os nomes exatos das fontes `@font-face` ou cores computadas diretamente na página de referência, execute o snippet abaixo no Console do navegador:

```javascript
(() => {
  const els = ['body', 'h1', 'h2', 'h3', 'p', 'a'];
  console.table(els.map(sel => {
    const el = document.querySelector(sel);
    if (!el) return { sel };
    const s = getComputedStyle(el);
    return {
      sel,
      font: s.fontFamily.split(',')[0],
      size: s.fontSize,
      weight: s.fontWeight,
      color: s.color,
      bg: s.backgroundColor
    };
  }));
})();
```