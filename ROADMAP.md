# Roadmap de la IA — Cashflow IA

> App de finanzas por voz en español. Esta hoja define a dónde va la IA y sirve de
> check-list de implementación. Cada tarea completada se marca y se describe su
> criterio de aceptación.

## Filosofía

Evolucionar de *"un LLM que devuelve JSON para una sola frase"* a un **asistente
conversacional que ejecuta acciones reales de forma segura**:

- El **LLM entiende** (intención, entidades, contexto).
- Las **tools/funciones ejecutan** sobre tu `FinanceContext` (nunca escriben a
  Firebase directamente).
- El **análisis pesado se calcula en el cliente** (datos ya cargados); el LLM solo
  redacta y asesora → poca latencia, menos coste.

## Arquitectura propuesta

```
Voz/Texto → Motor de intención ──► Tool List (registrar, consultar, editar, presupuestar...)
                 │                        │
                 ▼                        ▼
          Contexto (categorías,        FinanceContext tools
          resumen, tendencias)   (addTransaction, setCategoryBudget, ...)
                 │
                 ▼
          Proxy api/deepseek.js (rate-limit, validación)  → DeepSeek
```

- El **proxy** (`api/deepseek.js`) sigue custodiando la key y los límites.
- Las **tools** mapean a funciones ya existentes en `FinanceContext.jsx`.
- Los **firestore.rules** actuales no cambian: la IA opera del lado cliente.

---

## Estado

| Fase | Área | Estado |
|------|------|--------|
| A    | Motor de entendimiento | ✅ Hecho (P0) |
| B    | Acciones con IA | ✅ Hecho (P0) |
| C    | Consultas inteligentes | ✅ Hecho (P0) |
| D    | Asesoría proactiva y análisis | 🚧 D1-D3 hecho · D4-D5 pendiente |
| E    | Conversación y voz | ☐ Pendiente |

---

## Fase A — Núcleo de entendimiento (P0)

- [ ] **A1. Clasificador de intención**
  - Detecta: `registro`, `consulta`, `accion` (editar/borrar), `asesoria`, `conversacion`/desconocido.
  - Reemplaza la bandera booleana `isQuery` de `parseVoiceCommand`.
- [ ] **A2. Extracción avanzada**
  Montos con coma (`,`,`s`), varias transacciones en una frase, fechas relativas,
  categorías, y detección de **gasto recurrente**.
- [ ] **A3. Salida validada**
  Validar el JSON devuelto por el LLM; ante ambigüedad, **preguntar antes de
  registrar** (evita elementos erróneos).
- [ ] **A4. Fallback NLP reforzado**
  Ampliar el regex (más categorías, fechas, sinónimos, plurales) para uso offline.

## Fase B — Acciones con IA (P0)

- [ ] **B1. Registrar gastos/ingresos** por voz — *existe, reforzar.*
- [ ] **B2. Registrar varios a la vez** por voz.
- [ ] **B3. Registrar recurrentes** por voz: "cada mes 20 soles en netflix" → `recurring:true` (usando la auto-generación inmediata).
- [ ] **B4. Editar/borrar** por voz: "borra el último gasto de transporte" → tool `deleteTransaction` con confirmación.
- [ ] **B5. Presupuestos** por voz: "ponle 400 a transporte" → `setCategoryBudget`.
- [ ] **B6. Moneda y CSV** por voz (cambiar moneda, exportar).

## Fase C — Consultas inteligentes (P0)

- [ ] C1. Preguntas con **filtro por categoría y periodo**: "cuánto gasté en transporte este mes".
- [ ] C2. Comparativas: "¿más o menos que el mes pasado?".
- [ ] C3. Balance y ahorro — ya existe, mejorar redacción.

## Fase D — Asesoría proactiva y análisis (P1)

- [x] D1. Insights enriquecidos: tendencias por categoría y **proyección de fin de mes**.
- [x] D2. **Alertas tempranas**: avisar cuando una categoría va a exceder su presupuesto antes de fin de mes.
- [x] D3. Anomalías: gastos duplicados, saltos inusuales, recurrente omitido.
- [ ] D4. Recomendaciones de ahorro personalizadas (recortar categoría dominante).
- [ ] D5. Resumen diario/semanal automático en español.

## Fase E — Conversación y voz (P1)

- [ ] E1. **Multiturno con memoria del turno** (registrar varias frases encadenadas).
- [ ] E2. **Corrección** ("no era 30, era 40") que ajusta el último registro.
- [ ] E3. **Confirmación hablada** contextual (mitiga errores de trancripción).
- [ ] E4. **TTS** más natural (opcional).

---

## Criterios transversales

- **Seguridad**: nunca exponer la key; solo `process.env.DEEPSEEK_API_KEY` en el servidor.
- **Límite**: proxy conserva rate-limit 25 req/min, máx 16KB, máx 10 mensajes.
- **Coste/latencia**: el análisis proactivo (Fase D) se calcula en cliente; el LLM solo redacta.
- **Privacidad**: los datos financieros viajan al proxy con los mismos `firestore.rules`; sin nueva superficie.

## Pasos siguientes sugeridos

1. Implementar **Fase A1–A4** (base de todo).
2. Implementar **Fases B y C** (acciones + consultas).
3. Implementar **Fase D1–D5** (asesoría proactiva).
4. Opcional: **Fase E** (conversación / voz).