// Initialize Socket.IO connection
const socket = io();

// Chart configuration
let powerChart;
let comparisonChart;
const maxDataPoints = 50;
const powerData = {
    labels: [],
    datasets: [{
        label: 'Consumo de Energia (W)',
        data: [],
        borderColor: 'rgb(75, 192, 192)',
        tension: 0.1
    }]
};

const comparisonData = {
    labels: ['Seu Notebook', 'Média Similar', 'Mais Eficiente', 'Menos Eficiente'],
    datasets: [{
        label: 'Consumo Médio (W)',
        data: [0, 45, 30, 65], 
        backgroundColor: [
            'rgba(75, 192, 192, 0.5)',
            'rgba(54, 162, 235, 0.5)',
            'rgba(75, 192, 75, 0.5)',
            'rgba(255, 99, 132, 0.5)'
        ],
        borderColor: [
            'rgb(75, 192, 192)',
            'rgb(54, 162, 235)',
            'rgb(75, 192, 75)',
            'rgb(255, 99, 132)'
        ],
        borderWidth: 1
    }]
};

// Initialize charts when document is ready
document.addEventListener('DOMContentLoaded', () => {
    initializeCharts();
    checkAuthStatus();
});

function initializeCharts() {
    // Power consumption chart
    const powerCtx = document.getElementById('powerChart').getContext('2d');
    powerChart = new Chart(powerCtx, {
        type: 'line',
        data: powerData,
        options: {
            responsive: true,
            animation: false,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Watts'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Tempo'
                    }
                }
            },
            plugins: {
                tooltip: {
                    mode: 'index',
                    intersect: false
                }
            }
        }
    });

    // Comparison chart
    const comparisonCtx = document.getElementById('comparisonChart').getContext('2d');
    comparisonChart = new Chart(comparisonCtx, {
        type: 'bar',
        data: comparisonData,
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Watts'
                    }
                }
            },
            plugins: {
                tooltip: {
                    mode: 'index',
                    intersect: false
                }
            }
        }
    });
}

// Socket.IO event handlers
socket.on('connect', () => {
    console.log('Connected to server');
    updateConnectionStatus(true);
});

socket.on('disconnect', () => {
    console.log('Disconnected from server');
    updateConnectionStatus(false);
});

socket.on('power_data', (data) => {
    updatePowerData(data);
});

// Update power consumption chart and metrics
function updatePowerData(data) {
    const timestamp = new Date(data.timestamp).toLocaleTimeString();
    
    // Update real-time chart
    powerData.labels.push(timestamp);
    powerData.datasets[0].data.push(data.current);

    if (powerData.labels.length > maxDataPoints) {
        powerData.labels.shift();
        powerData.datasets[0].data.shift();
    }

    powerChart.update();
    
    // Update current metrics
    document.getElementById('currentPower').textContent = `${data.current.toFixed(2)} W`;
    document.getElementById('detectedDevice').textContent = data.state || 'Analisando...';

    // Update efficiency metrics if stats are available
    if (data.stats) {
        updateEfficiencyMetrics(data.stats);
        updateComparisonChart(data.stats.mean);
    }
}

// Update efficiency metrics
function updateEfficiencyMetrics(stats) {
    const metricsHtml = `
        <div class="metric">
            <h5>Média de Consumo</h5>
            <p>${stats.mean.toFixed(2)} W</p>
        </div>
        <div class="metric">
            <h5>Pico de Consumo</h5>
            <p>${stats.max.toFixed(2)} W</p>
        </div>
        <div class="metric">
            <h5>Tendência</h5>
            <p>${stats.trend === 'increasing' ? '↑ Aumentando' : '↓ Diminuindo'}</p>
        </div>
    `;

    const metricsContainer = document.querySelector('.card-body');
    if (metricsContainer) {
        metricsContainer.innerHTML = metricsHtml;
    }
}

// Update comparison chart
function updateComparisonChart(currentMean) {
    comparisonData.datasets[0].data[0] = currentMean;
    comparisonChart.update();
}

// Update connection status
function updateConnectionStatus(connected) {
    const statusElement = document.createElement('div');
    statusElement.className = `alert alert-${connected ? 'success' : 'danger'} mt-3`;
    statusElement.textContent = connected ? 'Conectado ao servidor' : 'Desconectado do servidor';
    
    const existingStatus = document.querySelector('.alert');
    if (existingStatus) {
        existingStatus.remove();
    }
    
    document.querySelector('.container').insertBefore(statusElement, document.querySelector('.card'));
}

// Check authentication status
async function checkAuthStatus() {
    try {
        const response = await fetch('/auth/status');
        const data = await response.json();
        
        const authSection = document.getElementById('auth-section');
        const dashboard = document.getElementById('dashboard');
        const loginStatus = document.getElementById('loginStatus');

        if (data.authenticated) {
            authSection.classList.add('d-none');
            dashboard.classList.remove('d-none');
            loginStatus.innerHTML = `
                <span class="navbar-text text-light">
                    ${data.user.email}
                </span>
                <a href="/auth/logout" class="btn btn-outline-light ms-3">Logout</a>
            `;
        } else {
            authSection.classList.remove('d-none');
            dashboard.classList.add('d-none');
            loginStatus.innerHTML = '';
        }
    } catch (error) {
        console.error('Error checking auth status:', error);
    }
}
