import config from '../configs/config.json';
import indexDBOverlay from '../memory/local/file_worker';

const CHART_COLORS = {
  primary: 'rgb(54, 162, 235)',
  secondary: 'rgb(54, 162, 235, 0.5)',
  accent: 'rgb(75, 192, 192)',
  background: 'rgba(54, 162, 235, 0.1)'
};

const ANIMATION_CONFIG = {
  duration: 1500,
  easing: 'easeOutQuart'
};

export async function createTextStatsCharts(fileId) {
  try {
    const stats = await indexDBOverlay.getItem('text_stats', fileId);
    if (!stats) return null;

    return {
      readabilityChart: createReadabilityChart(stats.readabilityScores),
      paragraphLengthChart: createParagraphDistributionChart(stats.paragraphStats),
      sentenceTypesChart: createSentenceTypesChart(stats.sentenceTypes),
      wordStatsChart: createWordStatsRadarChart(stats.wordStats)
    };
  } catch (error) {
    console.error('Error creating text stats charts:', error);
    return null;
  }
}

function createReadabilityChart(readabilityScores) {
  return {
    type: 'line',
    data: {
      labels: Array.from({ length: readabilityScores.length }, (_, i) => `P${i + 1}`),
      datasets: [{
        label: 'Readability Score by Paragraph',
        data: readabilityScores,
        borderColor: CHART_COLORS.primary,
        backgroundColor: CHART_COLORS.background,
        tension: 0.3,
        fill: true
      }]
    },
    options: {
      responsive: true,
      animation: {
        ...ANIMATION_CONFIG,
        x: {
          duration: 750
        },
        y: {
          duration: 1000
        }
      },
      plugins: {
        title: {
          display: true,
          text: 'Readability Scores'
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Score'
          }
        }
      }
    }
  };
}

function createParagraphDistributionChart(paragraphStats) {
  return {
    type: 'bar',
    data: {
      labels: Array.from({ length: paragraphStats.distribution.length }, (_, i) => `P${i + 1}`),
      datasets: [{
        label: 'Paragraph Length',
        data: paragraphStats.distribution,
        backgroundColor: CHART_COLORS.primary,
        borderColor: CHART_COLORS.accent,
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      animation: {
        ...ANIMATION_CONFIG,
        delay: (context) => context.dataIndex * 100
      },
      plugins: {
        title: {
          display: true,
          text: 'Paragraph Length Distribution'
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Characters'
          }
        }
      }
    }
  };
}

function createSentenceTypesChart(sentenceTypes) {
  return {
    type: 'doughnut',
    data: {
      labels: ['Statements', 'Questions', 'Exclamations'],
      datasets: [{
        data: [
          sentenceTypes.statements,
          sentenceTypes.questions,
          sentenceTypes.exclamations
        ],
        backgroundColor: [
          CHART_COLORS.primary,
          CHART_COLORS.secondary,
          CHART_COLORS.accent
        ],
        borderWidth: 1,
        borderColor: '#fff'
      }]
    },
    options: {
      responsive: true,
      animation: {
        ...ANIMATION_CONFIG,
        animateRotate: true,
        animateScale: true
      },
      plugins: {
        title: {
          display: true,
          text: 'Sentence Types Distribution'
        },
        legend: {
          position: 'bottom'
        }
      },
      cutout: '60%'
    }
  };
}

function createWordStatsRadarChart(wordStats) {
  const maxValues = {
    total: Math.max(wordStats.total, 300),
    unique: Math.max(wordStats.unique, 200),
    averageLength: Math.max(wordStats.averageLength, 10)
  };

  return {
    type: 'radar',
    data: {
      labels: ['Total Words', 'Unique Words', 'Avg Word Length'],
      datasets: [{
        label: 'Word Statistics',
        data: [
          (wordStats.total / maxValues.total) * 100,
          (wordStats.unique / maxValues.unique) * 100,
          (wordStats.averageLength / maxValues.averageLength) * 100
        ],
        backgroundColor: CHART_COLORS.background,
        borderColor: CHART_COLORS.primary,
        pointBackgroundColor: CHART_COLORS.accent,
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: CHART_COLORS.primary
      }]
    },
    options: {
      responsive: true,
      animation: {
        ...ANIMATION_CONFIG,
        animateRotate: true,
        animateScale: true
      },
      plugins: {
        title: {
          display: true,
          text: 'Word Statistics'
        }
      },
      scales: {
        r: {
          beginAtZero: true,
          max: 100,
          ticks: {
            stepSize: 20
          },
          grid: {
            color: CHART_COLORS.background
          },
          pointLabels: {
            font: {
              size: 12
            }
          }
        }
      }
    }
  };
} 