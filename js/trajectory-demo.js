/**
 * WBC-Platelet Recovery Trajectory Demo
 * Visualizes inflammatory recovery dynamics in 2D WBC-PLT space
 * Based on Nature Communications 2022 paper by Foy et al.
 */

$(document).ready(function() {
    TrajectoryDemo.init();
});

const TrajectoryDemo = {
    config: {
        wbcData: [],
        pltData: [],
        // Sample data: Patient follows normal recovery days 0-3, then develops secondary infection
        // Day 0: Post-surgical starting point (WBC=15, PLT=140)
        // Days 1-3: Normal recovery trajectory
        // Days 4-7: Secondary infection causes WBC spike and PLT stall/drop
        sampleWBC: [15.0, 10.6, 7.5, 7.5, 9.2, 12.5],
        samplePLT: [140, 140, 160, 190, 175, 155]
    },

    init: function() {
        this.bindEvents();
        this.setupEmptyPlots();
    },

    bindEvents: function() {
        $('#load-sample').on('click', () => this.loadSampleData());
        $('#wbc-input, #plt-input').on('input', () => this.validateInput());
        $('#generate-trajectory').on('click', () => this.generateTrajectory());
    },

    loadSampleData: function() {
        $('#wbc-input').val(this.config.sampleWBC.join(', '));
        $('#plt-input').val(this.config.samplePLT.join(', '));
        this.validateInput();
    },

    validateInput: function() {
        const wbcInput = $('#wbc-input').val().trim();
        const pltInput = $('#plt-input').val().trim();

        if (!wbcInput || !pltInput) {
            $('#generate-trajectory').prop('disabled', true);
            return false;
        }

        try {
            const wbcValues = wbcInput.split(',').map(v => parseFloat(v.trim()));
            const pltValues = pltInput.split(',').map(v => parseFloat(v.trim()));

            const wbcValid = wbcValues.every(v => !isNaN(v) && v > 0 && v < 100);
            const pltValid = pltValues.every(v => !isNaN(v) && v > 0 && v < 1000);
            const sameLengthAndEnough = wbcValues.length === pltValues.length && wbcValues.length >= 3;

            if (wbcValid && pltValid && sameLengthAndEnough) {
                this.config.wbcData = wbcValues;
                this.config.pltData = pltValues;
                $('#generate-trajectory').prop('disabled', false);
                return true;
            } else {
                $('#generate-trajectory').prop('disabled', true);
                return false;
            }
        } catch (e) {
            $('#generate-trajectory').prop('disabled', true);
            return false;
        }
    },

    generateTrajectory: function() {
        if (!this.validateInput()) return;

        // Show loading state
        $('#generate-trajectory').text('Generating...').prop('disabled', true);

        setTimeout(() => {
            try {
                // Plot time series and trajectory
                this.plotTimeSeries();
                this.plotTrajectory();
                this.displayResults();

                $('#results-panel').slideDown();
            } catch (error) {
                console.error('Trajectory generation failed:', error);
                alert('Failed to generate trajectory. Please check your input values.');
            } finally {
                $('#generate-trajectory').text('Generate Trajectory').prop('disabled', false);
            }
        }, 100);
    },

    plotTimeSeries: function() {
        const n = this.config.wbcData.length;
        const timePoints = Array.from({length: n}, (_, i) => i);  // Days 0, 1, 2, ...

        const traces = [
            {
                x: timePoints,
                y: this.config.wbcData,
                mode: 'lines+markers',
                name: 'WBC',
                yaxis: 'y1',
                line: {
                    color: '#629DD1',
                    width: 3
                },
                marker: {
                    color: '#629DD1',
                    size: 10,
                    symbol: 'circle'
                }
            },
            {
                x: timePoints,
                y: this.config.pltData,
                mode: 'lines+markers',
                name: 'Platelet',
                yaxis: 'y2',
                line: {
                    color: '#E67E22',
                    width: 3
                },
                marker: {
                    color: '#E67E22',
                    size: 10,
                    symbol: 'square'
                }
            }
        ];

        const layout = {
            title: 'WBC and Platelet Counts Over Time',
            xaxis: {
                title: 'Day',
                gridcolor: '#e0e0e0'
            },
            yaxis: {
                title: 'WBC Count (10³/μL)',
                titlefont: {color: '#629DD1'},
                tickfont: {color: '#629DD1'},
                gridcolor: '#e0e0e0'
            },
            yaxis2: {
                title: 'Platelet Count (10³/μL)',
                titlefont: {color: '#E67E22'},
                tickfont: {color: '#E67E22'},
                overlaying: 'y',
                side: 'right'
            },
            hovermode: 'x unified',
            showlegend: true,
            legend: {
                x: 0.02,
                y: 0.98,
                bgcolor: 'rgba(255,255,255,0.8)',
                bordercolor: '#e0e0e0',
                borderwidth: 1
            },
            font: {
                family: 'Rubik, sans-serif',
                color: '#555f66'
            },
            plot_bgcolor: '#f9f9f9',
            paper_bgcolor: '#ffffff'
        };

        Plotly.newPlot('trajectory-timeseries-plot', traces, layout, {
            responsive: true,
            displayModeBar: true,
            displaylogo: false,
            modeBarButtonsToRemove: ['lasso2d', 'select2d']
        });
    },

    plotTrajectory: function() {
        const n = this.config.wbcData.length;
        const wbc = this.config.wbcData;
        const plt = this.config.pltData;

        // Normal reference rectangle (WBC: 4.5-11, PLT: 150-450)
        const normalReferenceBox = {
            type: 'rect',
            xref: 'x',
            yref: 'y',
            x0: 4.5,
            y0: 150,
            x1: 11,
            y1: 450,
            fillcolor: 'rgba(46, 204, 113, 0.15)',
            line: {
                color: 'rgba(46, 204, 113, 0.5)',
                width: 2,
                dash: 'dot'
            }
        };

        // Average recovery trajectory (based on Nature Comm 2022)
        // WBC: Exponential decay from 15 to 7.5 with half-life of 1 day (over 7 days)
        // PLT: Flat day 0-1, then linear growth from 140 to 280 between days 1-7
        const totalDays = 7;
        const avgTrajectoryPoints = 50;  // Smooth curve
        const avgWBC = [];
        const avgPLT = [];

        // Half-life of 1 day means decay constant k = ln(2)/1 = 0.693
        const halfLife = 1;
        const decayConstant = Math.log(2) / halfLife;

        for (let i = 0; i < avgTrajectoryPoints; i++) {
            const day = (i / (avgTrajectoryPoints - 1)) * totalDays;  // 0 to 7 days

            // WBC: Exponential decay from 15 to 7.5
            // WBC(t) = 7.5 + 7.5 * exp(-k*t)
            avgWBC.push(7.5 + 7.5 * Math.exp(-decayConstant * day));

            // PLT: Flat at 140 for day 0-1, then linear growth to 280 by day 7
            if (day <= 1) {
                avgPLT.push(140);
            } else {
                // Linear from 140 at day 1 to 280 at day 7
                const pltValue = 140 + (280 - 140) * ((day - 1) / (totalDays - 1));
                avgPLT.push(pltValue);
            }
        }

        // Create color scale from early (red) to late (blue)
        const colors = Array.from({length: n}, (_, i) => {
            const fraction = i / (n - 1);
            const r = Math.round(220 * (1 - fraction) + 98 * fraction);
            const g = Math.round(50 * (1 - fraction) + 157 * fraction);
            const b = Math.round(50 * (1 - fraction) + 209 * fraction);
            return `rgb(${r},${g},${b})`;
        });

        // Build traces array
        const traces = [];

        // Average trajectory trace (add first so it appears behind)
        traces.push({
            x: avgWBC,
            y: avgPLT,
            mode: 'lines',
            name: 'Typical Recovery',
            line: {
                color: 'rgba(128, 128, 128, 0.6)',
                width: 3,
                dash: 'dash'
            },
            hovertemplate: 'Typical Recovery<br>WBC: %{x:.1f}<br>PLT: %{y:.0f}<extra></extra>'
        });

        // Main trajectory scatter plot
        traces.push({
            x: wbc,
            y: plt,
            mode: 'markers+lines',
            name: 'Patient Trajectory',
            line: {
                color: 'rgba(98, 157, 209, 0.3)',
                width: 2
            },
            marker: {
                color: colors,
                size: 15,
                line: {
                    color: '#fff',
                    width: 2
                }
            },
            text: Array.from({length: n}, (_, i) => `Day ${i}`),
            hovertemplate: '<b>%{text}</b><br>WBC: %{x:.1f}<br>PLT: %{y:.0f}<extra></extra>'
        });

        // Add arrows showing direction
        const annotations = [];
        for (let i = 0; i < n - 1; i++) {
            annotations.push({
                x: wbc[i + 1],
                y: plt[i + 1],
                ax: wbc[i],
                ay: plt[i],
                xref: 'x',
                yref: 'y',
                axref: 'x',
                ayref: 'y',
                showarrow: true,
                arrowhead: 2,
                arrowsize: 1,
                arrowwidth: 2,
                arrowcolor: colors[i],
                opacity: 0.6
            });
        }

        const layout = {
            title: '2D Trajectory in WBC-Platelet Space',
            height: 550,
            xaxis: {
                title: 'WBC Count (10³/μL)',
                gridcolor: '#e0e0e0',
                zeroline: false,
                range: [5, 16]
            },
            yaxis: {
                title: 'Platelet Count (10³/μL)',
                gridcolor: '#e0e0e0',
                zeroline: false,
                range: [100, 350]
            },
            shapes: [normalReferenceBox],
            annotations: annotations,
            hovermode: 'closest',
            showlegend: true,
            legend: {
                x: 0.02,
                y: 0.98,
                bgcolor: 'rgba(255,255,255,0.8)',
                bordercolor: '#e0e0e0',
                borderwidth: 1
            },
            font: {
                family: 'Rubik, sans-serif',
                color: '#555f66'
            },
            plot_bgcolor: '#f9f9f9',
            paper_bgcolor: '#ffffff'
        };

        Plotly.newPlot('trajectory-plot', traces, layout, {
            responsive: true,
            displayModeBar: true,
            displaylogo: false,
            modeBarButtonsToRemove: ['lasso2d', 'select2d']
        });
    },

    displayResults: function() {
        const wbc = this.config.wbcData;
        const plt = this.config.pltData;
        const n = wbc.length;

        // Calculate trajectory metrics
        const initialWBC = wbc[0];
        const finalWBC = wbc[n - 1];
        const initialPLT = plt[0];
        const finalPLT = plt[n - 1];

        const wbcChange = finalWBC - initialWBC;
        const pltChange = finalPLT - initialPLT;

        const html = `
            <div class="result-component">
                <h4>Trajectory Summary</h4>
                <table class="result-table">
                    <tr><td>Time Points:</td><td><strong>${n}</strong></td></tr>
                    <tr><td>WBC Change:</td><td>${initialWBC.toFixed(1)} → ${finalWBC.toFixed(1)} (${wbcChange > 0 ? '+' : ''}${wbcChange.toFixed(1)})</td></tr>
                    <tr><td>PLT Change:</td><td>${initialPLT.toFixed(0)} → ${finalPLT.toFixed(0)} (${pltChange > 0 ? '+' : ''}${pltChange.toFixed(0)})</td></tr>
                </table>
            </div>
        `;

        $('#results-content').html(html);
    },

    setupEmptyPlots: function() {
        const emptyLayout = {
            xaxis: {title: 'Day', gridcolor: '#e0e0e0'},
            yaxis: {title: 'Count', gridcolor: '#e0e0e0'},
            font: {family: 'Rubik, sans-serif', color: '#555f66'},
            plot_bgcolor: '#f9f9f9',
            paper_bgcolor: '#ffffff',
            annotations: [{
                text: 'Load data to view visualization',
                xref: 'paper',
                yref: 'paper',
                showarrow: false,
                font: {size: 14, color: '#999'}
            }]
        };

        Plotly.newPlot('trajectory-timeseries-plot', [], emptyLayout, {responsive: true});
        Plotly.newPlot('trajectory-plot', [], emptyLayout, {responsive: true});
    }
};
