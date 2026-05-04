<template>
  <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col transition-all duration-200 hover:shadow-md h-80 relative group">
    <!-- Header -->
    <div class="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50 shrink-0">
      <h3 class="font-medium text-gray-800 dark:text-gray-200 truncate pr-4 text-sm">{{ chartData.title }}</h3>
      <div class="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <button @click="toggleFullscreen" class="p-1.5 text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors" title="Expand">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
          </svg>
        </button>
        <button @click="refreshChart" class="p-1.5 text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors" title="Refresh">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
        <button @click="removeChart" class="p-1.5 text-gray-500 hover:text-red-600 dark:hover:text-red-400 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors" title="Remove">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>

    <!-- Chart Container -->
    <div class="flex-1 p-2 relative min-h-0">
      <div v-if="isLoading" class="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-gray-800/80 z-10">
        <div class="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
      <div ref="chartRef" class="w-full h-full"></div>
    </div>

    <!-- Fullscreen Modal -->
    <Teleport to="body">
      <div v-if="isFullscreen" class="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 sm:p-8" @click.self="toggleFullscreen">
        <div class="bg-white dark:bg-gray-900 w-full max-w-5xl h-[80vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-gray-900/50 shrink-0">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">{{ chartData.title }}</h3>
            <button @click="toggleFullscreen" class="p-2 text-gray-500 hover:text-gray-900 dark:hover:text-white rounded-lg hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div class="flex-1 p-4 relative min-h-0">
            <div ref="fullscreenChartRef" class="w-full h-full"></div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script>
import * as echarts from 'echarts';
import { store } from '../store.js';
import { markRaw } from 'vue';

export default {
  name: 'ChartCard',
  props: {
    chartData: {
      type: Object,
      required: true
    }
  },
  data() {
    return {
      chartInstance: null,
      fullscreenChartInstance: null,
      isLoading: false,
      isFullscreen: false
    };
  },
  computed: {
    store() {
      return store;
    }
  },
  watch: {
    'store.isDarkMode'() {
      this.initChart();
      if (this.isFullscreen) {
        this.initFullscreenChart();
      }
    },
    chartData: {
      deep: true,
      handler() {
        if (this.chartInstance) {
          this.chartInstance.setOption(this.getChartOptions());
        }
        if (this.isFullscreen && this.fullscreenChartInstance) {
          this.fullscreenChartInstance.setOption(this.getChartOptions());
        }
      }
    }
  },
  mounted() {
    this.initChart();
    window.addEventListener('resize', this.handleResize);
  },
  beforeUnmount() {
    window.removeEventListener('resize', this.handleResize);
    if (this.chartInstance) {
      this.chartInstance.dispose();
    }
    if (this.fullscreenChartInstance) {
      this.fullscreenChartInstance.dispose();
    }
  },
  methods: {
    getChartOptions() {
      const { data: raw, chartType } = this.chartData;

      // ✅ FIX 1: extract actual array safely
      let data = raw?.data || [];

      if (!Array.isArray(data) || data.length === 0) {
        return {};
      }

      // Check for limit in sql string (e.g., from original user request via chartData.sql if available)
      const sqlQuery = this.chartData.sql || "";
      const limitMatch = sqlQuery.match(/LIMIT\s+(\d+)/i);
      if (limitMatch) {
          const limit = parseInt(limitMatch[1], 10);
          data = data.slice(0, limit);
      }

      let options = {
        backgroundColor: 'transparent',
        tooltip: { trigger: 'axis' },
        grid: { top: 30, right: 20, bottom: 30, left: 50, containLabel: true }
      };

      // 🔁 Common helpers
      const getX = (item) => item.name || item.category || item.date || item.year || Object.values(item)[0];
      const getY = (item) => item.total ?? item.value ?? Object.values(item)[1];

      // 📈 LINE
      if (chartType === 'line') {
        const xAxisData = data.map(getX);
        const seriesData = data.map(getY);

        options = {
          ...options,
          xAxis: {
            type: 'category',
            data: xAxisData,
            axisLine: {
              lineStyle: {
                color: this.store?.isDarkMode ? '#4b5563' : '#cbd5e1'
              }
            }
          },
          yAxis: {
            type: 'value',
            splitLine: {
              lineStyle: {
                color: this.store?.isDarkMode ? '#374151' : '#f1f5f9'
              }
            }
          },
          series: [{
            data: seriesData,
            type: 'line',
            smooth: true,
            lineStyle: { color: '#4f46e5', width: 3 },
            itemStyle: { color: '#4f46e5' }
          }]
        };
      }

      // 📊 BAR
      else if (chartType === 'bar') {
        const xAxisData = data.map(getX);
        const seriesData = data.map(getY);

        options = {
          ...options,
          xAxis: {
            type: 'category',
            data: xAxisData,
            axisLabel: { interval: 0, rotate: 30 },
            axisLine: {
              lineStyle: {
                color: this.store?.isDarkMode ? '#4b5563' : '#cbd5e1'
              }
            }
          },
          yAxis: {
            type: 'value',
            splitLine: {
              lineStyle: {
                color: this.store?.isDarkMode ? '#374151' : '#f1f5f9'
              }
            }
          },
          series: [{
            data: seriesData,
            type: 'bar',
            itemStyle: {
              color: '#3b82f6',
              borderRadius: [4, 4, 0, 0]
            },
            barWidth: '40%'
          }]
        };
      }

      // 🥧 PIE
      else if (chartType === 'pie') {
        options = {
          backgroundColor: 'transparent',
          tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
          legend: {
            orient: 'vertical',
            left: 'left',
            top: 'center',
            textStyle: {
              color: this.store?.isDarkMode ? '#e5e7eb' : '#374151'
            }
          },
          series: [{
            type: 'pie',
            radius: ['40%', '70%'],
            avoidLabelOverlap: false,
            itemStyle: {
              borderRadius: 10,
              borderColor: this.store?.isDarkMode ? '#1f2937' : '#fff',
              borderWidth: 2
            },
            data: data.map(item => ({
              name: getX(item),
              value: getY(item)
            }))
          }]
        };
      }

      return options;
    },
    initChart() {
      if (!this.$refs.chartRef) return;
      if (this.chartInstance) {
        this.chartInstance.dispose();
      }

      this.chartInstance = markRaw(echarts.init(this.$refs.chartRef, this.store.isDarkMode ? 'dark' : null));
      this.chartInstance.setOption(this.getChartOptions());
    },
    async initFullscreenChart() {
      await this.$nextTick();
      if (!this.$refs.fullscreenChartRef) return;
      if (this.fullscreenChartInstance) {
        this.fullscreenChartInstance.dispose();
      }

      this.fullscreenChartInstance = markRaw(echarts.init(this.$refs.fullscreenChartRef, this.store.isDarkMode ? 'dark' : null));

      const options = this.getChartOptions();
      // Adjust options for fullscreen
      if (options.series && options.series[0].type === 'pie') {
        options.series[0].radius = ['30%', '60%'];
      }
      options.textStyle = { fontSize: 14 };

      this.fullscreenChartInstance.setOption(options);
    },
    handleResize() {
      if (this.chartInstance) {
        this.chartInstance.resize();
      }
      if (this.isFullscreen && this.fullscreenChartInstance) {
        this.fullscreenChartInstance.resize();
      }
    },
    async toggleFullscreen() {
      this.isFullscreen = !this.isFullscreen;
      if (this.isFullscreen) {
        await this.initFullscreenChart();
      } else {
        if (this.fullscreenChartInstance) {
          this.fullscreenChartInstance.dispose();
          this.fullscreenChartInstance = null;
        }
      }
    },
    async refreshChart() {
      this.isLoading = true;
      await new Promise(resolve => setTimeout(resolve, 800));
      if (this.chartInstance) {
        this.chartInstance.setOption(this.getChartOptions());
      }
      if (this.isFullscreen && this.fullscreenChartInstance) {
        this.fullscreenChartInstance.setOption(this.getChartOptions());
      }
      this.isLoading = false;
    },
    removeChart() {
      this.$emit('remove', this.chartData.id);
    }
  }
}
</script>