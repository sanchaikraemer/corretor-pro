export const COMMERCIAL_SCHEMA_VERSION = 715;
export const COMMERCIAL_SCHEMA_MINOR = "715-motor-comercial-v2-layout-mobile";

export function commercialSchemaFrom(analysis) {
  return Number(analysis?._schemaComercial || analysis?.modeloComercial?.versao || 0);
}

export function stampCommercialSchema(analysis) {
  const out = analysis && typeof analysis === "object" ? analysis : {};
  out._schemaComercial = COMMERCIAL_SCHEMA_VERSION;
  out._schemaComercialMinor = COMMERCIAL_SCHEMA_MINOR;
  if (out.modeloComercial && typeof out.modeloComercial === "object") {
    out.modeloComercial.versao = COMMERCIAL_SCHEMA_VERSION;
  }
  return out;
}
