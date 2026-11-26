/**
 * Decodificação da base analítica validada (sem PII) e utilitários de filtro.
 */

export const CARGO_LABEL = {
  all: 'Federal + Estadual',
  '6': 'Deputado Federal',
  '7': 'Deputado Estadual',
};

export const IBGE_TO_UF = {
  '11': 'RO', '12': 'AC', '13': 'AM', '14': 'RR', '15': 'PA', '16': 'AP', '17': 'TO',
  '21': 'MA', '22': 'PI', '23': 'CE', '24': 'RN', '25': 'PB', '26': 'PE', '27': 'AL',
  '28': 'SE', '29': 'BA', '31': 'MG', '32': 'ES', '33': 'RJ', '35': 'SP', '41': 'PR',
  '42': 'SC', '43': 'RS', '50': 'MS', '51': 'MT', '52': 'GO', '53': 'DF',
};

export const UF_NAMES = {
  AC: 'Acre', AL: 'Alagoas', AM: 'Amazonas', AP: 'Amapá', BA: 'Bahia', CE: 'Ceará',
  DF: 'Distrito Federal', ES: 'Espírito Santo', GO: 'Goiás', MA: 'Maranhão',
  MG: 'Minas Gerais', MS: 'Mato Grosso do Sul', MT: 'Mato Grosso', PA: 'Pará',
  PB: 'Paraíba', PE: 'Pernambuco', PI: 'Piauí', PR: 'Paraná', RJ: 'Rio de Janeiro',
  RN: 'Rio Grande do Norte', RO: 'Rondônia', RR: 'Roraima', RS: 'Rio Grande do Sul',
  SC: 'Santa Catarina', SE: 'Sergipe', SP: 'São Paulo', TO: 'Tocantins',
};

const DICT_FIELDS = new Set(['race', 'p', 'fed', 'chapa', 'uf', 'cargo', 'tpConta']);

export function decodeAnalyticalBase(raw) {
  const schema = raw.meta.schema;
  const dicts = raw.dict;
  const candidates = raw.candidates.map((row) => {
    const obj = {};
    for (let i = 0; i < schema.length; i += 1) {
      const key = schema[i];
      const val = row[i];
      obj[key] = DICT_FIELDS.has(key) ? dicts[key][val] : val;
    }
    return obj;
  });

  // Pré-computa as métricas legais da chapa completa (Federação/Partido × UF × Cargo × Ano)
  // para que filtros por partido federado (ex.: PC do B, PSDB) não fragmentem a chapa em H1/H7.
  const slateMap = new Map();
  for (const c of candidates) {
    if (c.g !== 'F' && c.g !== 'M') continue;
    const key = `${c.y}|${c.uf}|${c.cargo}|${c.chapa}`;
    let s = slateMap.get(key);
    if (!s) {
      s = { key, uf: c.uf, cargo: c.cargo, chapa: c.chapa, nReg: 0, fReg: 0, nApto: 0, fApto: 0 };
      slateMap.set(key, s);
    }
    s.nReg += 1;
    if (c.g === 'F') s.fReg += 1;
    if (c.apto) {
      s.nApto += 1;
      if (c.g === 'F') s.fApto += 1;
    }
  }
  for (const c of candidates) {
    const key = `${c.y}|${c.uf}|${c.cargo}|${c.chapa}`;
    const s = slateMap.get(key);
    c.slateKey = key;
    c.slateNReg = s ? s.nReg : 0;
    c.slateFReg = s ? s.fReg : 0;
    c.slatePctReg = s && s.nReg > 0 ? s.fReg / s.nReg : 0;
    c.slateNApto = s ? s.nApto : 0;
    c.slateFApto = s ? s.fApto : 0;
    c.slatePctApto = s && s.nApto > 0 ? s.fApto / s.nApto : 0;
  }

  return { meta: raw.meta, candidates };
}

export function filterCandidates(candidates, filters = {}) {
  const {
    year = 2022,
    cargo = 'all',
    uf = null,
    party = null,
    parties = null,
  } = filters;

  return candidates.filter((c) => {
    if (year != null && c.y !== year) return false;
    if (cargo && cargo !== 'all' && c.cargo !== cargo) return false;
    if (uf && c.uf !== uf) return false;
    if (party && c.p !== party) return false;
    if (parties && parties.size > 0 && !parties.has(c.p)) return false;
    return true;
  });
}

export async function loadAppData() {
  const [rawBase, coverage, brUf, hubs] = await Promise.all([
    fetch('data/analytical_base.json').then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status} em data/analytical_base.json`);
      return r.json();
    }),
    fetch('data/coverage.json').then((r) => (r.ok ? r.json() : { years: {} })),
    fetch('data/br_uf.json').then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status} em data/br_uf.json`);
      return r.json();
    }),
    fetch('data/network_hubs.json').then((r) => (r.ok ? r.json() : { years: {} })).catch(() => ({ years: {} })),
  ]);

  const { meta, candidates } = decodeAnalyticalBase(rawBase);
  return { meta, candidates, coverage, brUf, hubs };
}
