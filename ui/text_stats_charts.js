// import config from '../configs/config.json';
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
    console.log('Retrieved stats:', stats);
    
    if (!stats) {
      console.log('No stats found for fileId:', fileId);
      return null;
    }

    const charts = {
      readabilityChart: createReadabilityChart(stats.readabilityScores),
      paragraphLengthChart: createParagraphDistributionChart(stats.paragraphStats),
      sentenceTypesChart: createSentenceTypesChart(stats.sentenceTypes),
      wordStatsRadarChart: createWordStatsRadarChart(stats.wordStats)
    };

    console.log('Created chart configs:', charts);
    return charts;
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
          text: 'Sentence Types Distribution',
          font: {
            size: 14
          }
        },
        legend: {
          position: 'bottom',
          labels: {
            font: {
              size: 11
            }
          }
        }
      },
      cutout: '80%',
      maintainAspectRatio: true,
      aspectRatio: 1.5
    }
  };
}

function createWordStatsRadarChart(wordStats) {
  console.log('Input wordStats:', wordStats);
  
  const data = [
    wordStats.total || 0,
    wordStats.unique || 0,
    (wordStats.averageLength || 0) * 20
  ];
  
  console.log('Processed data array:', data);

  return {
    type: 'radar',
    data: {
      labels: ['Total Words', 'Unique Words', 'Avg Word Length (×20)'],
      datasets: [{
        label: 'Word Statistics',
        data: data,
        backgroundColor: 'rgba(54, 162, 235, 0.2)',
        borderColor: 'rgb(54, 162, 235)',
        borderWidth: 2,
        pointBackgroundColor: 'rgb(54, 162, 235)',
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: 'rgb(54, 162, 235)',
        pointRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      scales: {
        r: {
          beginAtZero: true,
          ticks: {
            callback: function(value) {
              return value;
            }
          }
        }
      },
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              const value = context.raw;
              const index = context.dataIndex;
              return index === 2 
                ? `${context.label.replace(' (×20)', '')}: ${(value/20).toFixed(2)}`
                : `${context.label}: ${Math.round(value)}`;
            }
          }
        }
      }
    }
  };
} 