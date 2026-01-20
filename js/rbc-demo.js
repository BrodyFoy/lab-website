/**
 * RBC Shape Classification Demo
 * Demonstrates computer vision-based RBC morphology analysis
 * Based on Blood Advances 2023 paper by Foy et al.
 */

$(document).ready(function() {
    RBCDemo.init();
});

const RBCDemo = {
    // Sample images with pre-computed classification results
    sampleImages: [
        {
            id: 'healthy',
            label: 'Healthy',
            description: 'Normal',
            rawPath: 'images/rbc-diff-demo/Healthy.jpg',
            fitPath: 'images/rbc-diff-demo/Healthy_Fit.png',
            results: {
                microcytes: 5.5,
                macrocytes: 0.3,
                elliptocytes: 0.2,
                schistocytes: 0.2,
                sickleCells: 0,
                spiculatedCells: 0.4,
                teardrops: 0.1
            },
            clinical: 'A healthy patient, exhibiting mild microcytosis.'
        },
        {
            id: 'schistocytosis',
            label: 'Thrombotic thrombocytopenic purpura',
            description: 'Schistocytosis',
            rawPath: 'images/rbc-diff-demo/Schistocytosis.jpg',
            fitPath: 'images/rbc-diff-demo/Schistocytosis_Fit.png',
            results: {
                microcytes: 1.7,
                macrocytes: 0.8,
                elliptocytes: 0.2,
                schistocytes: 2.6,
                sickleCells: 0,
                spiculatedCells: 10.6,
                teardrops: 0.2
            },
            clinical: 'A patient with thrombotic thrombocytopenic purpura, causing an elevation in schistocytes and spiculated cells.'
        },
        {
            id: 'sickle-cell',
            label: 'Sickle Cell Anemia',
            description: 'Sickle cells',
            rawPath: 'images/rbc-diff-demo/Sickle cell.jpg',
            fitPath: 'images/rbc-diff-demo/Sickle cell_Fit.png',
            results: {
                microcytes: 1.3,
                macrocytes: 24.2,
                elliptocytes: 3.7,
                schistocytes: 0.7,
                sickleCells: 2.3,
                spiculatedCells: 0.2,
                teardrops: 0.9
            },
            clinical: 'A patient with sickle cell anemia, with secondary macrocytosis. The severity of disease also leads to misclassification of some sickle cells as elliptocytes.'
        },
        {
            id: 'elliptocytosis',
            label: 'Hereditary elliptocytosis',
            description: 'Ellipticytes',
            rawPath: 'images/rbc-diff-demo/Elliptocytosis.jpg',
            fitPath: 'images/rbc-diff-demo/Elliptocytosis_Fit.png',
            results: {
                microcytes: 25.9,
                macrocytes: 0.1,
                elliptocytes: 1.8,
                schistocytes: 0.5,
                sickleCells: 0,
                spiculatedCells: 0.1,
                teardrops: 0.1
            },
            clinical: 'A patient with a mild presentation of hereditary elliptocytosis, identified during an unrelated evaluation for iron-deficiency anemia (causing microcytosis).'
        }
    ],

    selectedImage: null,
    isFitted: false,

    // Magnifier configuration
    magnifier: {
        zoom: 2.5,
        lensSize: 150
    },

    init: function() {
        this.bindEvents();
        this.renderImageGallery();
        this.initMagnifier();
    },

    bindEvents: function() {
        $('#fit-model-btn').on('click', () => this.fitModel());
    },

    renderImageGallery: function() {
        const gallery = $('#image-gallery');
        gallery.empty();

        this.sampleImages.forEach(image => {
            const card = $(`
                <div class="image-card" data-id="${image.id}">
                    <img src="${image.rawPath}" alt="${image.label}">
                    <h4>${image.label}</h4>
                    <p>${image.description}</p>
                </div>
            `);

            card.on('click', () => this.selectImage(image));
            gallery.append(card);
        });
    },

    selectImage: function(image) {
        this.selectedImage = image;
        this.isFitted = false;

        // Update UI selection
        $('.image-card').removeClass('selected');
        $(`.image-card[data-id="${image.id}"]`).addClass('selected');

        // Show raw image initially
        $('#selected-image').attr('src', image.rawPath);
        $('#selected-label').text(image.label + ' - Smear');
        $('#selected-image-section').slideDown();

        // Enable fit button, hide results
        $('#fit-model-btn').prop('disabled', false).text('Fit Model');
        $('#results-section').hide();

        // Scroll to image
        $('html, body').animate({
            scrollTop: $('#selected-image-section').offset().top - 100
        }, 500);
    },

    fitModel: function() {
        if (!this.selectedImage) return;

        const image = this.selectedImage;

        if (!this.isFitted) {
            // Show loading state
            $('#fit-model-btn').text('Fitting...').prop('disabled', true);

            setTimeout(() => {
                // Swap to fitted image
                $('#selected-image').attr('src', image.fitPath);
                $('#selected-label').text(image.label + ' - Fit Model');
                this.isFitted = true;

                // Display results table
                this.displayResultsTable(image);

                // Update button to toggle back
                $('#fit-model-btn').text('Show Original').prop('disabled', false);

                // Show results section
                $('#results-section').slideDown();
            }, 500);
        } else {
            // Toggle back to raw image
            $('#selected-image').attr('src', image.rawPath);
            $('#selected-label').text(image.label + ' - Smear');
            this.isFitted = false;

            // Update button
            $('#fit-model-btn').text('Fit Model');

            // Hide results section
            $('#results-section').slideUp();
        }
    },

    displayResultsTable: function(image) {
        const cellTypes = [
            { key: 'microcytes', label: 'Microcytes' },
            { key: 'macrocytes', label: 'Macrocytes' },
            { key: 'elliptocytes', label: 'Elliptocytes' },
            { key: 'schistocytes', label: 'Schistocytes' },
            { key: 'sickleCells', label: 'Sickle Cells' },
            { key: 'spiculatedCells', label: 'Spiculated Cells' },
            { key: 'teardrops', label: 'Teardrops' }
        ];

        let tableRows = cellTypes.map(type =>
            `<tr><td>${type.label}</td><td><strong>${image.results[type.key]}%</strong></td></tr>`
        ).join('');

        const html = `
            <div class="result-component">
                <h4>Cell Type Distribution</h4>
                <table class="result-table">
                    ${tableRows}
                </table>
            </div>

            <div class="interpretation" style="margin-top: 1.5em;">
                <h4>Clinical Assessment</h4>
                <p>${image.clinical}</p>
            </div>
        `;

        $('#results-content').html(html);
    },

    // Magnifier functions
    initMagnifier: function() {
        const container = document.getElementById('magnifier-container');
        const img = document.getElementById('selected-image');
        const lens = document.getElementById('magnifier-lens');

        if (!container || !img || !lens) return;

        // Desktop: mouse events
        container.addEventListener('mouseenter', () => this.showMagnifier(lens, img));
        container.addEventListener('mousemove', (e) => this.moveMagnifier(e, lens, img));
        container.addEventListener('mouseleave', () => this.hideMagnifier(lens));

        // Mobile: touch events
        container.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.showMagnifier(lens, img);
            this.moveMagnifier(e.touches[0], lens, img);
        }, { passive: false });

        container.addEventListener('touchmove', (e) => {
            e.preventDefault();
            this.moveMagnifier(e.touches[0], lens, img);
        }, { passive: false });

        container.addEventListener('touchend', () => this.hideMagnifier(lens));
    },

    showMagnifier: function(lens, img) {
        // Don't show if no image is loaded
        if (!img.src || img.src === window.location.href) return;

        // Set lens background to current image
        lens.style.backgroundImage = `url('${img.src}')`;

        // Calculate background size for zoom effect
        const zoom = this.magnifier.zoom;
        lens.style.backgroundSize = `${img.width * zoom}px ${img.height * zoom}px`;

        lens.classList.add('active');
    },

    hideMagnifier: function(lens) {
        lens.classList.remove('active');
    },

    moveMagnifier: function(e, lens, img) {
        if (!lens.classList.contains('active')) return;

        const rect = img.getBoundingClientRect();
        const zoom = this.magnifier.zoom;
        const lensSize = this.magnifier.lensSize;

        // Get cursor position relative to image
        let x = e.clientX - rect.left;
        let y = e.clientY - rect.top;

        // Clamp to image bounds
        x = Math.max(0, Math.min(x, rect.width));
        y = Math.max(0, Math.min(y, rect.height));

        // Position lens centered on cursor
        const lensX = x - lensSize / 2;
        const lensY = y - lensSize / 2;

        lens.style.left = lensX + 'px';
        lens.style.top = lensY + 'px';

        // Calculate background position for magnification
        const bgX = -(x * zoom - lensSize / 2);
        const bgY = -(y * zoom - lensSize / 2);

        lens.style.backgroundPosition = `${bgX}px ${bgY}px`;
    }
};
