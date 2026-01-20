/**
 * GMM Demo for Foy Lab Website
 * Demonstrates Gaussian Mixture Model fitting for blood count data
 * Based on Nature 2024 paper: "Haematologic setpoints are a patient-specific deep physiologic phenotype"
 */

(function($) {
    'use strict';

    // ===== MODULE STRUCTURE =====

    const GMMDemo = {
        // Configuration
        config: {
            sampleData: null,
            currentData: null,
            fittedModel: null,
            plotDiv: 'gmm-plot'
        },

        // Initialization
        init: function() {
            this.generateSampleData();
            this.bindEvents();
            this.setupPlot();
        },

        // Event handlers
        bindEvents: function() {
            $('#load-sample').on('click', this.loadSampleData.bind(this));
            $('#fit-gmm').on('click', this.fitGMM.bind(this));
            $('#data-input').on('input', this.validateInput.bind(this));
        },

        // Data generation using Box-Muller transform
        generateSampleData: function() {
            // Generate realistic WBC count data:
            // Main population: N(6.0, 0.8) - normal setpoint
            // Outlier population: N(14.0, 2.0) - acute values

            const normal = this.generateGaussian(6.0, 0.8, 15);
            const outliers = this.generateGaussian(14.0, 2.0, 3);

            this.config.sampleData = [...normal, ...outliers];
        },

        generateGaussian: function(mean, stdDev, n) {
            // Box-Muller transform for normal distribution
            const values = [];
            for (let i = 0; i < n; i++) {
                const u1 = Math.random();
                const u2 = Math.random();
                const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
                values.push(mean + z0 * stdDev);
            }
            return values;
        },

        // Data loading
        loadSampleData: function() {
            const dataStr = this.config.sampleData.map(v => v.toFixed(1)).join(', ');
            $('#data-input').val(dataStr);
            this.validateInput();
        },

        // Input validation
        validateInput: function() {
            const input = $('#data-input').val().trim();
            if (!input) {
                $('#fit-gmm').prop('disabled', true);
                return false;
            }

            try {
                const values = input.split(',').map(v => parseFloat(v.trim()));
                const valid = values.every(v => !isNaN(v) && v > 0 && v < 100);

                if (valid && values.length >= 1) {
                    this.config.currentData = values;
                    $('#fit-gmm').prop('disabled', false);
                    $('.error-message').removeClass('show');
                    return true;
                } else {
                    this.showError('Please enter at least 1 valid WBC value (0-100)');
                    $('#fit-gmm').prop('disabled', true);
                    return false;
                }
            } catch (e) {
                this.showError('Invalid input format');
                $('#fit-gmm').prop('disabled', true);
                return false;
            }
        },

        // GMM fitting with automatic model selection
        fitGMM: function() {
            if (!this.validateInput()) return;

            const data = this.config.currentData;

            // Show loading state
            $('#fit-gmm').text('Fitting...').prop('disabled', true);

            // Use setTimeout to prevent UI blocking
            setTimeout(() => {
                try {
                    let bestModel;

                    // Handle small sample sizes
                    if (data.length < 5) {
                        bestModel = this.simpleMeanStd(data);
                    } else {
                        // Fit models with 1, 2, and 3 components
                        const models = [];
                        for (let k = 1; k <= 3; k++) {
                            const model = this.simpleGMM(data, k);
                            const bic = this.calculateBIC(data, model);

                            // Apply weight constraint: dominant component must have >= 50% weight
                            const maxWeight = Math.max(...model.weights);
                            const passesWeightConstraint = maxWeight >= 0.5;

                            models.push({
                                ...model,
                                bic: bic,
                                passesWeightConstraint: passesWeightConstraint
                            });
                        }

                        // Select best model: prefer models that pass weight constraint, then lowest BIC
                        const validModels = models.filter(m => m.passesWeightConstraint);
                        bestModel = validModels.length > 0
                            ? validModels.reduce((best, m) => m.bic < best.bic ? m : best)
                            : models[0]; // Fallback to 1-component if none pass constraint
                    }

                    this.config.fittedModel = bestModel;

                    // Visualize results
                    this.plotTimeSeries(data, bestModel);
                    this.plotResults(data, bestModel);
                    this.displayResults(bestModel);

                } catch (error) {
                    this.showError('GMM fitting failed: ' + error.message);
                    console.error(error);
                } finally {
                    $('#fit-gmm').text('Fit Model').prop('disabled', false);
                }
            }, 100);
        },

        // Simple mean and std calculation for small samples
        simpleMeanStd: function(data) {
            const n = data.length;
            const mean = data.reduce((sum, v) => sum + v, 0) / n;

            let variance = NaN;
            if (n >= 3) {
                const sumSquares = data.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0);
                variance = sumSquares / (n - 1);
            }

            return {
                nComponents: 1,
                means: [mean],
                variances: [variance],
                weights: [1.0],
                isSimple: true
            };
        },

        // Simple GMM implementation using EM algorithm
        simpleGMM: function(data, k) {
            const n = data.length;

            // Initialize using k-means++
            const means = this.initializeMeans(data, k);
            let variances = new Array(k).fill(1.0);
            let weights = new Array(k).fill(1.0 / k);

            // EM algorithm
            const maxIter = 100;
            const tolerance = 0.001;
            let prevLogLikelihood = -Infinity;

            for (let iter = 0; iter < maxIter; iter++) {
                // E-step: Calculate responsibilities
                const responsibilities = [];
                for (let i = 0; i < n; i++) {
                    const resp = [];
                    let sum = 0;
                    for (let j = 0; j < k; j++) {
                        const prob = weights[j] * this.gaussianPDF(data[i], means[j], Math.sqrt(variances[j]));
                        resp.push(prob);
                        sum += prob;
                    }
                    // Normalize
                    responsibilities.push(resp.map(r => r / (sum + 1e-10)));
                }

                // M-step: Update parameters
                for (let j = 0; j < k; j++) {
                    // Update weights
                    const nk = responsibilities.reduce((sum, r) => sum + r[j], 0);
                    weights[j] = nk / n;

                    // Update means
                    let meanSum = 0;
                    for (let i = 0; i < n; i++) {
                        meanSum += responsibilities[i][j] * data[i];
                    }
                    means[j] = meanSum / nk;

                    // Update variances
                    let varSum = 0;
                    for (let i = 0; i < n; i++) {
                        const diff = data[i] - means[j];
                        varSum += responsibilities[i][j] * diff * diff;
                    }
                    variances[j] = varSum / nk;
                }

                // Check convergence
                const logLikelihood = this.calculateLogLikelihood(data, means, variances, weights);
                if (Math.abs(logLikelihood - prevLogLikelihood) < tolerance) {
                    break;
                }
                prevLogLikelihood = logLikelihood;
            }

            return {
                nComponents: k,
                means: means,
                variances: variances,
                weights: weights
            };
        },

        // K-means++ initialization
        initializeMeans: function(data, k) {
            const means = [];
            const sortedData = [...data].sort((a, b) => a - b);

            if (k === 1) {
                means.push(sortedData[Math.floor(sortedData.length / 2)]);
            } else if (k === 2) {
                means.push(sortedData[Math.floor(sortedData.length / 3)]);
                means.push(sortedData[Math.floor(2 * sortedData.length / 3)]);
            } else {
                for (let i = 0; i < k; i++) {
                    const idx = Math.floor((i + 1) * sortedData.length / (k + 1));
                    means.push(sortedData[idx]);
                }
            }

            return means;
        },

        // Calculate log-likelihood
        calculateLogLikelihood: function(data, means, variances, weights) {
            let logLikelihood = 0;
            for (let i = 0; i < data.length; i++) {
                let sum = 0;
                for (let j = 0; j < means.length; j++) {
                    sum += weights[j] * this.gaussianPDF(data[i], means[j], Math.sqrt(variances[j]));
                }
                logLikelihood += Math.log(sum + 1e-10);
            }
            return logLikelihood;
        },

        // Calculate Bayesian Information Criterion (BIC)
        calculateBIC: function(data, model) {
            const n = data.length;
            const k = model.nComponents;
            // Number of parameters: k means + k variances + (k-1) weights
            const numParams = k + k + (k - 1);

            const logLikelihood = this.calculateLogLikelihood(
                data,
                model.means,
                model.variances,
                model.weights
            );

            // BIC = -2 * log(L) + k * log(n)
            return -2 * logLikelihood + numParams * Math.log(n);
        },

        // Plotting - Time Series
        plotTimeSeries: function(data, model) {
            const n = data.length;
            const indices = Array.from({length: n}, (_, i) => i + 1);

            // Calculate dynamic 95% CI using cumulative GMM fits
            const upperCI = [];
            const lowerCI = [];
            const meanLine = [];

            for (let i = 0; i < n; i++) {
                if (i < 2) {
                    // Don't plot CI for first 2 points (not stable)
                    upperCI.push(null);
                    lowerCI.push(null);
                    meanLine.push(null);
                } else {
                    // Fit model to data up to this point
                    const cumulativeData = data.slice(0, i + 1);
                    let mean, variance;

                    if (cumulativeData.length <= 4) {
                        // For 3-4 points: use overall mean and std
                        mean = cumulativeData.reduce((sum, v) => sum + v, 0) / cumulativeData.length;
                        const sumSquares = cumulativeData.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0);
                        variance = sumSquares / (cumulativeData.length - 1);
                    } else {
                        // For 5+ points: use std of primary GMM component
                        // Fit all three models and select best (same as main fitting logic)
                        const models = [];
                        for (let k = 1; k <= 3; k++) {
                            const tempModel = this.simpleGMM(cumulativeData, k);
                            const bic = this.calculateBIC(cumulativeData, tempModel);
                            const maxWeight = Math.max(...tempModel.weights);
                            const passesWeightConstraint = maxWeight >= 0.5;

                            models.push({
                                ...tempModel,
                                bic: bic,
                                passesWeightConstraint: passesWeightConstraint
                            });
                        }

                        // Select best model
                        const validModels = models.filter(m => m.passesWeightConstraint);
                        const cumulativeModel = validModels.length > 0
                            ? validModels.reduce((best, m) => m.bic < best.bic ? m : best)
                            : models[0];

                        // Get dominant component stats
                        const dominantIdx = cumulativeModel.weights.indexOf(Math.max(...cumulativeModel.weights));
                        mean = cumulativeModel.means[dominantIdx];
                        variance = cumulativeModel.variances[dominantIdx];
                    }

                    if (!isNaN(variance)) {
                        const stdDev = Math.sqrt(variance);
                        upperCI.push(mean + 1.96 * stdDev);
                        lowerCI.push(mean - 1.96 * stdDev);
                        meanLine.push(mean);
                    } else {
                        upperCI.push(null);
                        lowerCI.push(null);
                        meanLine.push(null);
                    }
                }
            }

            const traces = [];

            // 95% CI filled area (only from index 3 onwards)
            const validIndices = indices.map((idx, i) => upperCI[i] !== null ? idx : null).filter(v => v !== null);
            const validUpper = upperCI.filter(v => v !== null);
            const validLower = lowerCI.filter(v => v !== null);

            if (validIndices.length > 0) {
                traces.push({
                    x: [...validIndices, ...validIndices.slice().reverse()],
                    y: [...validUpper, ...validLower.slice().reverse()],
                    fill: 'toself',
                    fillcolor: 'rgba(98, 157, 209, 0.2)',
                    line: {color: 'transparent'},
                    name: '95% CI',
                    type: 'scatter',
                    hoverinfo: 'skip',
                    showlegend: true
                });
            }

            // Mean line trace
            const validMeanIndices = indices.map((idx, i) => meanLine[i] !== null ? idx : null).filter(v => v !== null);
            const validMean = meanLine.filter(v => v !== null);

            if (validMeanIndices.length > 0) {
                traces.push({
                    x: validMeanIndices,
                    y: validMean,
                    mode: 'lines',
                    name: 'Setpoint Mean',
                    line: {
                        color: '#000000',
                        width: 2
                    },
                    hovertemplate: 'Mean: %{y:.2f}<extra></extra>'
                });
            }

            // Data points with line
            traces.push({
                x: indices,
                y: data,
                mode: 'lines+markers',
                name: 'WBC Values',
                line: {
                    color: '#629DD1',
                    width: 2
                },
                marker: {
                    color: '#629DD1',
                    size: 8,
                    symbol: 'circle'
                }
            });

            const layout = {
                title: 'WBC Count Time Series',
                xaxis: {
                    title: 'Measurement Number',
                    gridcolor: '#e0e0e0'
                },
                yaxis: {
                    title: 'WBC Count (10³/μL)',
                    gridcolor: '#e0e0e0'
                },
                hovermode: 'closest',
                showlegend: true,
                font: {
                    family: 'Rubik, sans-serif',
                    color: '#555f66'
                },
                plot_bgcolor: '#f9f9f9',
                paper_bgcolor: '#ffffff'
            };

            Plotly.newPlot('gmm-timeseries-plot', traces, layout, {
                responsive: true,
                displayModeBar: true,
                displaylogo: false,
                modeBarButtonsToRemove: ['lasso2d', 'select2d']
            });
        },

        // Plotting - Distribution
        setupPlot: function() {
            const layout = {
                title: 'GMM Fit to WBC Count Data',
                xaxis: {
                    title: 'WBC Count (10³/μL)',
                    gridcolor: '#e0e0e0'
                },
                yaxis: {
                    title: 'Probability Density',
                    gridcolor: '#e0e0e0'
                },
                hovermode: 'closest',
                showlegend: true,
                font: {
                    family: 'Rubik, sans-serif',
                    color: '#555f66'
                },
                plot_bgcolor: '#f9f9f9',
                paper_bgcolor: '#ffffff'
            };

            Plotly.newPlot(this.config.plotDiv, [], layout, {
                responsive: true,
                displayModeBar: true,
                displaylogo: false,
                modeBarButtonsToRemove: ['lasso2d', 'select2d']
            });
        },

        plotResults: function(data, model) {
            const traces = [];

            // Data points as rug plot
            traces.push({
                x: data,
                y: data.map(() => 0),
                mode: 'markers',
                type: 'scatter',
                name: 'Data Points',
                marker: {
                    color: '#629DD1',
                    size: 12,
                    symbol: 'line-ns-open',
                    line: { width: 2 }
                }
            });

            // Generate smooth curves for each component
            const xRange = this.generateRange(
                Math.min(...data) - 2,
                Math.max(...data) + 2,
                200
            );

            const colors = ['#e74c3c', '#2ecc71', '#f39c12'];

            model.means.forEach((mean, i) => {
                const stdDev = Math.sqrt(model.variances[i]);
                const weight = model.weights[i];

                const yValues = xRange.map(x => {
                    return weight * this.gaussianPDF(x, mean, stdDev);
                });

                traces.push({
                    x: xRange,
                    y: yValues,
                    mode: 'lines',
                    name: `Component ${i + 1} (μ=${mean.toFixed(2)})`,
                    line: {
                        width: 2,
                        color: colors[i % colors.length]
                    }
                });
            });

            // Total mixture density
            const totalDensity = xRange.map(x => {
                return model.means.reduce((sum, mean, i) => {
                    const stdDev = Math.sqrt(model.variances[i]);
                    const weight = model.weights[i];
                    return sum + weight * this.gaussianPDF(x, mean, stdDev);
                }, 0);
            });

            traces.push({
                x: xRange,
                y: totalDensity,
                mode: 'lines',
                name: 'Total Mixture',
                line: {
                    width: 3,
                    color: '#192024',
                    dash: 'dash'
                }
            });

            const layout = {
                title: `GMM Fit (${model.nComponents} component${model.nComponents > 1 ? 's' : ''})`,
                xaxis: {
                    title: 'WBC Count (10³/μL)',
                    gridcolor: '#e0e0e0'
                },
                yaxis: {
                    title: 'Probability Density',
                    gridcolor: '#e0e0e0'
                },
                hovermode: 'closest',
                showlegend: true,
                font: {
                    family: 'Rubik, sans-serif',
                    color: '#555f66'
                },
                plot_bgcolor: '#f9f9f9',
                paper_bgcolor: '#ffffff'
            };

            Plotly.react(this.config.plotDiv, traces, layout);
        },

        // Display results - show only dominant component
        displayResults: function(model) {
            // Find dominant component (highest weight)
            const dominantIdx = model.weights.indexOf(Math.max(...model.weights));
            const dominant = {
                mean: model.means[dominantIdx],
                variance: model.variances[dominantIdx],
                weight: model.weights[dominantIdx]
            };

            const stdDev = Math.sqrt(dominant.variance);
            const ci95 = [dominant.mean - 1.96 * stdDev, dominant.mean + 1.96 * stdDev];

            let html = `
                <div class="result-component">
                    <h4>Identified Setpoint (${model.nComponents}-component model)</h4>
                    <table class="result-table">
                        <tr><td>Setpoint:</td><td><strong>${dominant.mean.toFixed(2)} × 10³/μL</strong></td></tr>
                        <tr><td>Std. Deviation:</td><td>${stdDev.toFixed(2)}</td></tr>
                        <tr><td>95% CI:</td><td>[${ci95[0].toFixed(2)}, ${ci95[1].toFixed(2)}]</td></tr>
                        <tr><td>% of values:</td><td>${(dominant.weight * 100).toFixed(1)}%</td></tr>
                    </table>
                </div>
            `;

            // Add interpretation based on model complexity
            if (model.nComponents > 1) {
                const outlierPct = (100 - dominant.weight * 100).toFixed(0);
                html += `
                    <p style="margin-top: 1.5em; font-style: italic;">
                        ${outlierPct}% of values identified as outliers, potentially representing acute illness or measurement variability.
                    </p>
                `;
            }

            $('#results-content').html(html);
            $('#results-panel').slideDown();
        },

        // Utilities
        gaussianPDF: function(x, mean, stdDev) {
            const coefficient = 1 / (stdDev * Math.sqrt(2 * Math.PI));
            const exponent = -Math.pow(x - mean, 2) / (2 * Math.pow(stdDev, 2));
            return coefficient * Math.exp(exponent);
        },

        generateRange: function(min, max, steps) {
            const step = (max - min) / steps;
            const range = [];
            for (let i = 0; i <= steps; i++) {
                range.push(min + i * step);
            }
            return range;
        },

        showError: function(message) {
            const errorDiv = $('.error-message');
            if (errorDiv.length === 0) {
                $('#data-input').after(`<div class="error-message show">${message}</div>`);
            } else {
                errorDiv.text(message).addClass('show');
            }
        }
    };

    // Initialize when DOM is ready
    $(document).ready(function() {
        // Check if Plotly is loaded
        if (typeof Plotly === 'undefined') {
            $('#gmm-demo-section').html(
                '<div class="error-message show">Plotly library failed to load. ' +
                'Please check your internet connection and refresh the page.</div>'
            );
            return;
        }

        GMMDemo.init();
    });

})(jQuery);
