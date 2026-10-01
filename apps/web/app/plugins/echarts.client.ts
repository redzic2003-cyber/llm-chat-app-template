import { BarChart, LineChart, PieChart } from "echarts/charts";
import { GridComponent, LegendComponent, TooltipComponent, DatasetComponent } from "echarts/components";
import { use } from "echarts/core";
import { SVGRenderer } from "echarts/renderers";
import VChart from "vue-echarts";

// Import « à la carte » d'ECharts : seuls les graphiques utilisés sont embarqués.
use([BarChart, LineChart, PieChart, GridComponent, LegendComponent, TooltipComponent, DatasetComponent, SVGRenderer]);

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.component("VChart", VChart);
});
