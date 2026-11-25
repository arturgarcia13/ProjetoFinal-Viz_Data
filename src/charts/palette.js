/**
 * Paleta Semântica Única do Projeto.
 * Nenhuma cor se repete com significados conflitantes entre gráficos.
 */
export const SEMANTIC_PALETTE = {
  // Gênero (exclusivo em todo o site)
  women: '#FF7AE5', // Rosa Vibrante = Mulheres
  men: '#FCE34D',   // Amarelo Solar = Homens

  // Conformidade / Alerta / Gap (exclusivo)
  ok: '#00D09C',    // Verde-menta = Cota respeitada / Superávit / Sem vazamento
  alert: '#FF5E2B', // Laranja-vermelho = Subfinanciamento / Déficit / Irregular (<30%) / Alerta crítico
  floor: '#FFB020', // Âmbar = Limite operacional (30%–33,3%) / Atenção moderada

  // Anos / Série Temporal (nunca usa Rosa, Amarelo ou Laranja)
  y2018: 'rgba(255, 255, 255, 0.62)', // Cinza-gelo translúcido
  y2022: '#FFFFFF',                   // Branco puro (ou vazado com borda branca)
  y2026: '#5CE1E6',                   // Ciano editorial sólido

  // Fontes de Receita (H2B barra 100% e H4 Sankey)
  fefc: '#5CE1E6',  // Ciano
  fp: '#00D09C',    // Verde-menta
  prop: '#B8A9FF',  // Lavanda editorial
  priv: '#FFFFFF',  // Branco

  // Etapas do Funil (H5)
  cand: '#B8A9FF',    // 1. Candidatas
  votes: '#5CE1E6',   // 2. Votos nominais
  elected: '#FF7AE5', // 3. Eleitas (Rosa feminino)

  // Superfícies & Texto sobre verde escuro (#003D2B)
  surface: '#003D2B',
  surfaceAlt: '#005C40',
  ink: '#FFFFFF',
  muted: 'rgba(255, 255, 255, 0.84)',
  subtle: 'rgba(255, 255, 255, 0.45)',
  grid: 'rgba(255, 255, 255, 0.14)',
};
