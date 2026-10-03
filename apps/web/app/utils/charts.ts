/**
 * Options ECharts communes : une seule série → une seule couleur (accent), barres
 * fines (≤ 24 px) à extrémité arrondie de 4 px, grille et axes en filets discrets,
 * étiquettes de texte dans les couleurs de texte (jamais la couleur de la série).
 */
const ACCENT = "#1d4ed8";
const ACCENT_HOVER = "#1e40af";
const TEXT_MUTED = "#5d6877";
const GRID = "#eceef2";
const AXIS = "#cdd2da";
/** Même police que l'interface (aucune police monospace). */
const textStyle = { fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' };

const tooltip = {
  backgroundColor: "#ffffff",
  borderColor: "#e2e5ea",
  borderWidth: 1,
  textStyle: { color: "#18212d", fontSize: 12 },
  extraCssText: "box-shadow: 0 6px 18px rgba(16,24,40,.12); border-radius: 8px;",
};

const categoryAxis = {
  axisLine: { lineStyle: { color: AXIS, width: 1 } },
  axisTick: { show: false },
  axisLabel: { color: TEXT_MUTED, fontSize: 11 },
};

const valueAxis = {
  minInterval: 1,
  axisLine: { show: false },
  axisTick: { show: false },
  axisLabel: { color: TEXT_MUTED, fontSize: 11 },
  splitLine: { lineStyle: { color: GRID, width: 1, type: "solid" as const } },
};

export function columnChart(labels: string[], values: number[], seriesName: string) {
  return {
    animationDuration: 300,
    textStyle,
    grid: { left: 8, right: 12, top: 12, bottom: 4, containLabel: true },
    tooltip: { ...tooltip, trigger: "axis", axisPointer: { type: "shadow", shadowStyle: { color: "rgba(29,78,216,0.06)" } } },
    xAxis: { type: "category", data: labels, ...categoryAxis },
    yAxis: { type: "value", ...valueAxis },
    series: [
      {
        name: seriesName,
        type: "bar",
        data: values,
        barMaxWidth: 24,
        barCategoryGap: "35%",
        itemStyle: { color: ACCENT, borderRadius: [4, 4, 0, 0] },
        emphasis: { itemStyle: { color: ACCENT_HOVER } },
      },
    ],
  };
}

export function horizontalBarChart(labels: string[], values: number[], seriesName: string) {
  return {
    animationDuration: 300,
    textStyle,
    grid: { left: 8, right: 40, top: 4, bottom: 4, containLabel: true },
    tooltip: { ...tooltip, trigger: "axis", axisPointer: { type: "shadow", shadowStyle: { color: "rgba(29,78,216,0.06)" } } },
    xAxis: { type: "value", ...valueAxis, axisLabel: { show: false }, splitLine: { show: false } },
    yAxis: {
      type: "category",
      data: labels,
      inverse: true,
      ...categoryAxis,
      axisLine: { show: false },
      axisLabel: { color: "#18212d", fontSize: 12, width: 180, overflow: "truncate" },
    },
    series: [
      {
        name: seriesName,
        type: "bar",
        data: values,
        barMaxWidth: 18,
        itemStyle: { color: ACCENT, borderRadius: [0, 4, 4, 0] },
        emphasis: { itemStyle: { color: ACCENT_HOVER } },
        label: { show: true, position: "right", color: TEXT_MUTED, fontSize: 12 },
      },
    ],
  };
}

/** Hauteur d'un graphique en barres horizontales (axe compris), sans défilement imbriqué. */
export const horizontalChartHeight = (rows: number) => `${Math.max(120, rows * 34 + 16)}px`;
