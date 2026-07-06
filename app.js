// VelocityRide App Logic
document.addEventListener('DOMContentLoaded', () => {
    // State variables
    let map = null;
    let pickupLatLng = null;
    let dropoffLatLng = null;
    let pickupMarker = null;
    let dropoffMarker = null;
    let routeLine = null;
    let activeRide = null;
    let activeDriverMarker = null;
    let staticDriverMarkers = {}; // Store idle drivers
    let selectedRideType = 'Economy';
    let simulationInterval = null;

    // Elements
    const pickupInput = document.getElementById('pickup-input');
    const dropoffInput = document.getElementById('dropoff-input');
    const clearPickupBtn = document.getElementById('clear-pickup');
    const clearDropoffBtn = document.getElementById('clear-dropoff');
    const quickLocBtns = document.querySelectorAll('.quick-loc-btn');
    
    const rideSelectionCard = document.getElementById('ride-selection-card');
    const rideCards = document.querySelectorAll('.ride-card');
    const priceEconomy = document.getElementById('price-economy');
    const priceComfort = document.getElementById('price-comfort');
    const pricePremium = document.getElementById('price-premium');
    
    const statDist = document.getElementById('stat-dist');
    const statTime = document.getElementById('stat-time');
    const bookBtn = document.getElementById('book-btn');
    
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');
    const statusTabBtn = document.getElementById('status-tab-btn');
    
    // Status Subpanes
    const statusMatching = document.getElementById('status-matching');
    const statusActiveTrip = document.getElementById('status-active-trip');
    const statusCompleted = document.getElementById('status-completed');
    
    // Status Elements
    const summaryClass = document.getElementById('summary-class');
    const summaryFare = document.getElementById('summary-fare');
    const cancelMatchingBtn = document.getElementById('cancel-matching-btn');
    const cancelActiveBtn = document.getElementById('cancel-active-btn');
    
    const tripBadge = document.getElementById('trip-badge');
    const etaLabel = document.getElementById('eta-label');
    const tripEta = document.getElementById('trip-eta');
    const tripProgress = document.getElementById('trip-progress');
    const driverNameVal = document.getElementById('driver-name-val');
    const driverCarVal = document.getElementById('driver-car-val');
    const driverPlateVal = document.getElementById('driver-plate-val');
    const driverRatingVal = document.getElementById('driver-rating-val');
    const tripPickupName = document.getElementById('trip-pickup-name');
    const tripDropoffName = document.getElementById('trip-dropoff-name');
    
    const receiptBase = document.getElementById('receipt-base');
    const receiptTotal = document.getElementById('receipt-total');
    const newRideBtn = document.getElementById('new-ride-btn');
    const mapHintOverlay = document.getElementById('map-hint-overlay');
    const hintText = document.getElementById('hint-text');

    // Initialize Leaflet Map
    function initMap() {
        // Center of San Francisco
        const sfCenter = [37.7749, -122.4194];
        map = L.map('map', {
            zoomControl: true,
            attributionControl: true
        }).setView(sfCenter, 13);

        // Load Dark Theme Maps (CartoDB Dark Matter)
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
            subdomains: 'abcd',
            maxZoom: 20
        }).addTo(map);

        // Handle Map Click Events
        map.on('click', (e) => {
            const latlng = e.latlng;
            
            // If ride is active, ignore clicks
            if (activeRide) return;

            if (!pickupLatLng) {
                setPickup(latlng.lat, latlng.lng, `Location: ${latlng.lat.toFixed(4)}, ${latlng.lng.toFixed(4)}`);
            } else if (!dropoffLatLng) {
                setDropoff(latlng.lat, latlng.lng, `Location: ${latlng.lat.toFixed(4)}, ${latlng.lng.toFixed(4)}`);
            }
        });

        // Load Initial Idle Drivers
        fetchIdleDrivers();
        // Start polling idle drivers every 10 seconds to keep them visible
        setInterval(fetchIdleDrivers, 10000);
    }

    // Custom Map Icons
    const pickupIcon = L.divIcon({
        className: 'map-marker-icon',
        html: `<div class="dot pickup-dot" style="width:16px;height:16px;border:2px solid white;"></div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10]
    });

    const dropoffIcon = L.divIcon({
        className: 'map-marker-icon',
        html: `<div class="dot dropoff-dot" style="width:16px;height:16px;border:2px solid white;"></div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10]
    });

    const carIconHtml = (rotation = 0) => `
        <div class="car-marker" style="width:34px;height:34px;transform: rotate(${rotation}deg);">
            <svg class="car-marker-svg" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12.3V16c0 .6.4 1 1 1h2" />
                <circle cx="7" cy="17" r="2" />
                <circle cx="17" cy="17" r="2" />
            </svg>
        </div>
    `;

    // Fetch Idle Drivers from DB and Draw on Map
    function fetchIdleDrivers() {
        if (activeRide) return; // Do not overwrite active map simulation

        fetch('/api/drivers')
            .then(res => res.json())
            .then(drivers => {
                // Clear old static markers
                Object.values(staticDriverMarkers).forEach(m => map.removeLayer(m));
                staticDriverMarkers = {};

                drivers.forEach(d => {
                    if (d.status === 'idle') {
                        const marker = L.marker([d.lat, d.lng], {
                            icon: L.divIcon({
                                className: 'map-marker-icon',
                                html: carIconHtml(Math.random() * 360),
                                iconSize: [34, 34],
                                iconAnchor: [17, 17]
                            })
                        });
                        
                        marker.bindPopup(`
                            <div style="font-family: var(--font-primary); color: white; margin-top:2px;">
                                <strong>${d.name}</strong><br>
                                ${d.vehicle_model} (${d.vehicle_type})<br>
                                Rating: ★${d.rating}
                            </div>
                        `);
                        
                        marker.addTo(map);
                        staticDriverMarkers[d.id] = marker;
                    }
                });
            })
            .catch(err => console.error("Error fetching idle drivers:", err));
    }

    // Set Pickup Location
    function setPickup(lat, lng, name) {
        pickupLatLng = L.latLng(lat, lng);
        pickupInput.value = name;
        pickupInput.parentNode.classList.add('filled');
        
        if (pickupMarker) map.removeLayer(pickupMarker);
        
        pickupMarker = L.marker(pickupLatLng, { icon: pickupIcon }).addTo(map);
        
        hintText.innerHTML = "Now, click to set your <strong>Drop-off Location</strong>";
        
        calculateRouteAndEstimates();
    }

    // Set Dropoff Location
    function setDropoff(lat, lng, name) {
        dropoffLatLng = L.latLng(lat, lng);
        dropoffInput.value = name;
        dropoffInput.parentNode.classList.add('filled');
        
        if (dropoffMarker) map.removeLayer(dropoffMarker);
        
        dropoffMarker = L.marker(dropoffLatLng, { icon: dropoffIcon }).addTo(map);
        
        mapHintOverlay.style.opacity = '0'; // Hide hint overlay once complete
        
        calculateRouteAndEstimates();
    }

    // Clear Pickup
    clearPickupBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        pickupLatLng = null;
        pickupInput.value = '';
        pickupInput.parentNode.classList.remove('filled');
        if (pickupMarker) {
            map.removeLayer(pickupMarker);
            pickupMarker = null;
        }
        clearRoute();
        mapHintOverlay.style.opacity = '1';
        hintText.innerHTML = "Click anywhere on the map to set your <strong>Pickup Location</strong>";
    });

    // Clear Dropoff
    clearDropoffBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        dropoffLatLng = null;
        dropoffInput.value = '';
        dropoffInput.parentNode.classList.remove('filled');
        if (dropoffMarker) {
            map.removeLayer(dropoffMarker);
            dropoffMarker = null;
        }
        clearRoute();
        mapHintOverlay.style.opacity = '1';
        hintText.innerHTML = "Click to set your <strong>Drop-off Location</strong>";
    });

    // Handle Quick Location buttons
    quickLocBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const lat = parseFloat(btn.dataset.lat);
            const lng = parseFloat(btn.dataset.lng);
            const name = btn.dataset.name;
            
            if (activeRide) return;

            if (!pickupLatLng) {
                setPickup(lat, lng, name);
                map.panTo([lat, lng]);
            } else if (!dropoffLatLng) {
                setDropoff(lat, lng, name);
                map.panTo([lat, lng]);
            }
        });
    });

    // Calculate L-Shaped Route Line and pricing
    function calculateRouteAndEstimates() {
        if (!pickupLatLng || !dropoffLatLng) {
            // Disable pricing and booking UI
            rideSelectionCard.style.opacity = '0.5';
            rideSelectionCard.style.pointerEvents = 'none';
            bookBtn.disabled = true;
            return;
        }

        // Draw L-Shaped Route to emulate driving street grids
        // City streets route: [pickup, corner_point, dropoff]
        const cornerLatLng = L.latLng(pickupLatLng.lat, dropoffLatLng.lng);
        const routePoints = [pickupLatLng, cornerLatLng, dropoffLatLng];
        
        if (routeLine) map.removeLayer(routeLine);
        
        routeLine = L.polyline(routePoints, {
            color: '#00f0ff',
            weight: 4,
            opacity: 0.8,
            dashArray: '8, 8',
            lineCap: 'round',
            lineJoin: 'round'
        }).addTo(map);

        // Fit map bounds to show full route
        map.fitBounds(routeLine.getBounds(), { padding: [50, 50] });

        // Calculate Distance
        const distMeters = pickupLatLng.distanceTo(dropoffLatLng);
        const distMiles = (distMeters * 0.000621371).toFixed(1);
        const estDuration = Math.round(distMiles * 2.5 + 2); // 2.5 min per mile + 2 min idle

        statDist.innerText = `${distMiles} mi`;
        statTime.innerText = `${estDuration} min`;

        // Calculate Fares
        const fareEconomy = Math.max(5.00, (2.50 + distMiles * 1.20)).toFixed(2);
        const fareComfort = Math.max(8.00, (4.00 + distMiles * 1.80)).toFixed(2);
        const farePremium = Math.max(12.00, (6.50 + distMiles * 2.75)).toFixed(2);

        priceEconomy.innerText = `$${fareEconomy}`;
        priceComfort.innerText = `$${fareComfort}`;
        pricePremium.innerText = `$${farePremium}`;

        // Enable Booking Panel UI
        rideSelectionCard.style.opacity = '1';
        rideSelectionCard.style.pointerEvents = 'auto';
        bookBtn.disabled = false;
    }

    function clearRoute() {
        if (routeLine) {
            map.removeLayer(routeLine);
            routeLine = null;
        }
        statDist.innerText = '0.0 mi';
        statTime.innerText = '0 min';
        priceEconomy.innerText = '$0.00';
        priceComfort.innerText = '$0.00';
        pricePremium.innerText = '$0.00';
        
        rideSelectionCard.style.opacity = '0.5';
        rideSelectionCard.style.pointerEvents = 'none';
        bookBtn.disabled = true;
    }

    // Select Ride category card
    rideCards.forEach(card => {
        card.addEventListener('click', () => {
            rideCards.forEach(c => c.classList.remove('active'));
            card.classList.add('active');
            selectedRideType = card.dataset.type;
        });
    });

    // Manage Sidebar Tabs
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.dataset.tab;
            switchTab(tabId);
        });
    });

    function switchTab(tabId) {
        tabBtns.forEach(b => b.classList.remove('active'));
        tabPanes.forEach(p => p.classList.remove('active'));
        
        const targetBtn = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
        const targetPane = document.getElementById(`tab-${tabId}`);
        
        if (targetBtn && targetPane) {
            targetBtn.classList.add('active');
            targetPane.classList.add('active');
        }
    }

    // Book Ride Action
    bookBtn.addEventListener('click', () => {
        if (!pickupLatLng || !dropoffLatLng) return;

        let selectedPrice = '0.00';
        if (selectedRideType === 'Economy') selectedPrice = priceEconomy.innerText;
        if (selectedRideType === 'Comfort') selectedPrice = priceComfort.innerText;
        if (selectedRideType === 'Premium') selectedPrice = pricePremium.innerText;
        
        const fareVal = parseFloat(selectedPrice.replace('$', ''));

        // Prepare Request Payload
        const payload = {
            pickup_name: pickupInput.value || 'Custom Pickup',
            pickup_lat: pickupLatLng.lat,
            pickup_lng: pickupLatLng.lng,
            dropoff_name: dropoffInput.value || 'Custom Destination',
            dropoff_lat: dropoffLatLng.lat,
            dropoff_lng: dropoffLatLng.lng,
            ride_type: selectedRideType,
            fare: fareVal
        };

        // Switch to Matching Screen UI
        summaryClass.innerText = selectedRideType;
        summaryFare.innerText = selectedPrice;
        
        statusTabBtn.disabled = false;
        switchTab('status');
        
        statusMatching.classList.add('active');
        statusActiveTrip.classList.remove('active');
        statusCompleted.classList.remove('active');

        // Post Booking
        fetch('/api/rides', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })
        .then(res => res.json())
        .then(ride => {
            if (ride.error) {
                alert(ride.error);
                switchTab('book');
                statusTabBtn.disabled = true;
                return;
            }
            
            activeRide = ride;
            // Remove idle drivers markers from map to focus on trip
            Object.values(staticDriverMarkers).forEach(m => map.removeLayer(m));
            staticDriverMarkers = {};
            
            // Wait 2.5 seconds to simulate "finding/matching" before active ride begins
            setTimeout(() => {
                startTripSimulation(ride);
            }, 2500);
        })
        .catch(err => {
            console.error("Booking Error:", err);
            alert("Booking request failed. Check server connection.");
            switchTab('book');
            statusTabBtn.disabled = true;
        });
    });

    // Helper: Calculate bearing angle between two locations for car orientation
    function getBearing(lat1, lon1, lat2, lon2) {
        const dLon = (lon2 - lon1) * Math.PI / 180;
        lat1 = lat1 * Math.PI / 180;
        lat2 = lat2 * Math.PI / 180;
        const y = Math.sin(dLon) * Math.cos(lat2);
        const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
        const brng = Math.atan2(y, x) * 180 / Math.PI;
        return (brng + 360) % 360;
    }

    // Animate marker along a path coordinate array
    function animateMarker(marker, pathPoints, speedMs, stepCallback, doneCallback) {
        let currentIdx = 0;
        
        function step() {
            if (currentIdx >= pathPoints.length - 1) {
                doneCallback();
                return;
            }

            const startPt = pathPoints[currentIdx];
            const endPt = pathPoints[currentIdx + 1];
            
            // Sub-interpolation between startPt and endPt (10 sub-steps per block)
            const subSteps = 15;
            let currentSubStep = 0;

            function subStep() {
                if (!activeRide) return; // Terminate if ride is cancelled mid-way

                if (currentSubStep > subSteps) {
                    currentIdx++;
                    setTimeout(step, 50);
                    return;
                }

                const ratio = currentSubStep / subSteps;
                const currentLat = startPt.lat + (endPt.lat - startPt.lat) * ratio;
                const currentLng = startPt.lng + (endPt.lng - startPt.lng) * ratio;
                
                const rotation = getBearing(startPt.lat, startPt.lng, endPt.lat, endPt.lng);
                
                // Update marker position and orientation SVG style
                marker.setLatLng([currentLat, currentLng]);
                const carElement = marker.getElement();
                if (carElement) {
                    const carIconDiv = carElement.querySelector('.car-marker');
                    if (carIconDiv) {
                        carIconDiv.style.transform = `rotate(${rotation}deg)`;
                    }
                }

                // Send live position updates back to Server-side DB
                stepCallback(currentLat, currentLng);

                currentSubStep++;
                simulationInterval = setTimeout(subStep, speedMs);
            }
            subStep();
        }
        step();
    }

    // Start Simulation Drive
    function startTripSimulation(ride) {
        statusMatching.classList.remove('active');
        statusActiveTrip.classList.add('active');

        // Populate Driver details card
        driverNameVal.innerText = ride.driver_name;
        driverCarVal.innerText = ride.vehicle_model;
        driverPlateVal.innerText = ride.vehicle_plate;
        driverRatingVal.innerText = ride.driver_rating.toFixed(2);
        
        tripPickupName.innerText = ride.pickup_name;
        tripDropoffName.innerText = ride.dropoff_name;
        
        tripBadge.innerText = "Driver En Route";
        tripBadge.style.background = 'rgba(0, 240, 255, 0.1)';
        tripBadge.style.color = 'var(--accent-cyan)';
        tripBadge.style.borderColor = 'rgba(0, 240, 255, 0.2)';
        
        etaLabel.innerText = "ETA";
        tripEta.innerText = "3 mins";
        tripProgress.style.width = "0%";

        // Fetch driver's starting location from ride details
        fetch(`/api/rides/${ride.id}`)
            .then(res => res.json())
            .then(details => {
                const driverStartLat = details.driver_lat;
                const driverStartLng = details.driver_lng;
                
                // Add active animated driver marker on map
                if (activeDriverMarker) map.removeLayer(activeDriverMarker);
                
                activeDriverMarker = L.marker([driverStartLat, driverStartLng], {
                    icon: L.divIcon({
                        className: 'map-marker-icon',
                        html: carIconHtml(0),
                        iconSize: [34, 34],
                        iconAnchor: [17, 17]
                    })
                }).addTo(map);

                // --- STAGE 1: Driver drives from Current Location to Rider Pickup Point ---
                // We'll generate an L-shaped corner between driver start and pickup
                const driverCorner = L.latLng(driverStartLat, pickupLatLng.lng);
                const toPickupPath = [L.latLng(driverStartLat, driverStartLng), driverCorner, pickupLatLng];
                
                animateMarker(activeDriverMarker, toPickupPath, 60, 
                    // Step callback
                    (lat, lng) => {
                        // Periodically sync driver position to DB
                        updateDbDriverLocation(ride.id, 'accepted', lat, lng);
                    },
                    // Done callback (Driver Arrived at Pickup)
                    () => {
                        tripBadge.innerText = "Driver Arrived";
                        tripBadge.style.background = 'rgba(112, 0, 255, 0.1)';
                        tripBadge.style.color = 'var(--accent-purple)';
                        tripBadge.style.borderColor = 'rgba(112, 0, 255, 0.2)';
                        
                        etaLabel.innerText = "Status";
                        tripEta.innerText = "Boarding";
                        tripProgress.style.width = "20%";

                        // Update Server ride status to 'arrived'
                        updateDbDriverLocation(ride.id, 'arrived', pickupLatLng.lat, pickupLatLng.lng);

                        // Boarding delay: Wait 2 seconds, then drive to dropoff
                        setTimeout(() => {
                            if (!activeRide) return; // Check if cancelled
                            
                            tripBadge.innerText = "Heading to Destination";
                            tripBadge.style.background = 'rgba(255, 0, 124, 0.1)';
                            tripBadge.style.color = 'var(--accent-pink)';
                            tripBadge.style.borderColor = 'rgba(255, 0, 124, 0.2)';
                            
                            etaLabel.innerText = "ETA";
                            tripEta.innerText = "5 mins";
                            tripProgress.style.width = "40%";

                            updateDbDriverLocation(ride.id, 'in_progress', pickupLatLng.lat, pickupLatLng.lng);

                            // --- STAGE 2: Drive from Pickup Point to Drop-off Point ---
                            const cornerLatLng = L.latLng(pickupLatLng.lat, dropoffLatLng.lng);
                            const toDestinationPath = [pickupLatLng, cornerLatLng, dropoffLatLng];
                            
                            animateMarker(activeDriverMarker, toDestinationPath, 100,
                                // Step callback
                                (lat, lng) => {
                                    // Update progress percentage
                                    const progressVal = calculateTripProgress(lat, lng);
                                    tripProgress.style.width = `${progressVal}%`;
                                    
                                    // Live countdown
                                    const minsLeft = Math.max(1, Math.round((100 - progressVal) / 15));
                                    tripEta.innerText = `${minsLeft} mins`;
                                    
                                    updateDbDriverLocation(ride.id, 'in_progress', lat, lng);
                                },
                                // Done callback (Trip Completed)
                                () => {
                                    tripProgress.style.width = "100%";
                                    tripEta.innerText = "0 mins";
                                    
                                    // Update DB status to 'completed'
                                    updateDbDriverLocation(ride.id, 'completed', dropoffLatLng.lat, dropoffLatLng.lng);
                                    
                                    // Display invoice/receipt screen
                                    showTripInvoice(ride);
                                }
                            );
                        }, 2000);
                    }
                );
            });
    }

    // Update Driver location and Ride Status on database
    function updateDbDriverLocation(rideId, status, lat, lng) {
        fetch(`/api/rides/${rideId}/status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                status: status,
                driver_lat: lat,
                driver_lng: lng
            })
        });
    }

    // Helper: Compute how far the driver has driven from pickup to dropoff
    function calculateTripProgress(curLat, curLng) {
        if (!pickupLatLng || !dropoffLatLng) return 0;
        
        const totalDist = pickupLatLng.distanceTo(dropoffLatLng);
        const curDistToDrop = L.latLng(curLat, curLng).distanceTo(dropoffLatLng);
        
        // Progress ratio inverted: progress increases as distance decreases
        const progress = ((totalDist - curDistToDrop) / totalDist) * 80 + 20; // range 20% to 100%
        return Math.min(100, Math.max(20, progress));
    }

    // Display Invoice pane
    function showTripInvoice(ride) {
        statusActiveTrip.classList.remove('active');
        statusCompleted.classList.add('active');

        receiptBase.innerText = `$${(ride.fare - 1.50).toFixed(2)}`;
        receiptTotal.innerText = `$${ride.fare.toFixed(2)}`;

        // Clean up current markers
        if (activeDriverMarker) {
            map.removeLayer(activeDriverMarker);
            activeDriverMarker = null;
        }
        
        // Reset Ride settings
        activeRide = null;
        loadHistory();
    }

    // Rating star interactions
    const stars = document.querySelectorAll('#star-rating .star');
    stars.forEach(star => {
        star.addEventListener('mouseover', () => {
            const rating = parseInt(star.dataset.rating);
            highlightStars(rating);
        });

        star.addEventListener('mouseout', () => {
            resetStars();
        });

        star.addEventListener('click', () => {
            const rating = parseInt(star.dataset.rating);
            setRating(rating);
        });
    });

    let chosenRating = 0;

    function highlightStars(rating) {
        stars.forEach(s => {
            if (parseInt(s.dataset.rating) <= rating) {
                s.classList.add('hover');
            } else {
                s.classList.remove('hover');
            }
        });
    }

    function resetStars() {
        stars.forEach(s => {
            s.classList.remove('hover');
            if (parseInt(s.dataset.rating) <= chosenRating) {
                s.classList.add('selected');
            } else {
                s.classList.remove('selected');
            }
        });
    }

    function setRating(rating) {
        chosenRating = rating;
        stars.forEach(s => {
            if (parseInt(s.dataset.rating) <= rating) {
                s.classList.add('selected');
            } else {
                s.classList.remove('selected');
            }
        });
        alert(`Thank you for giving your driver a ${rating}-star rating!`);
    }

    // Book another ride - resets workspace elements
    newRideBtn.addEventListener('click', () => {
        // Reset Map Markers
        if (pickupMarker) map.removeLayer(pickupMarker);
        if (dropoffMarker) map.removeLayer(dropoffMarker);
        pickupMarker = null;
        dropoffMarker = null;
        pickupLatLng = null;
        dropoffLatLng = null;
        
        clearRoute();
        
        // Reset Inputs
        pickupInput.value = '';
        pickupInput.parentNode.classList.remove('filled');
        dropoffInput.value = '';
        dropoffInput.parentNode.classList.remove('filled');
        
        // Reset Star Ratings
        chosenRating = 0;
        stars.forEach(s => s.classList.remove('selected', 'hover'));
        
        statusTabBtn.disabled = true;
        switchTab('book');
        mapHintOverlay.style.opacity = '1';
        hintText.innerHTML = "Click anywhere on the map to set your <strong>Pickup Location</strong>";
        
        fetchIdleDrivers();
    });

    // Cancel Request handlers
    cancelMatchingBtn.addEventListener('click', cancelCurrentRide);
    cancelActiveBtn.addEventListener('click', cancelCurrentRide);

    function cancelCurrentRide() {
        if (!activeRide) return;
        
        if (confirm("Are you sure you want to cancel your ride request?")) {
            // Cancel simulation
            if (simulationInterval) clearTimeout(simulationInterval);
            
            fetch(`/api/rides/${activeRide.id}/status`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'cancelled' })
            })
            .then(() => {
                alert("Your ride has been successfully cancelled.");
                
                // Clear active driver marker
                if (activeDriverMarker) {
                    map.removeLayer(activeDriverMarker);
                    activeDriverMarker = null;
                }
                
                activeRide = null;
                
                // Reset inputs and map
                if (pickupMarker) map.removeLayer(pickupMarker);
                if (dropoffMarker) map.removeLayer(dropoffMarker);
                pickupMarker = null;
                dropoffMarker = null;
                pickupLatLng = null;
                dropoffLatLng = null;
                clearRoute();
                
                pickupInput.value = '';
                pickupInput.parentNode.classList.remove('filled');
                dropoffInput.value = '';
                dropoffInput.parentNode.classList.remove('filled');
                
                statusTabBtn.disabled = true;
                switchTab('book');
                mapHintOverlay.style.opacity = '1';
                hintText.innerHTML = "Click anywhere on the map to set your <strong>Pickup Location</strong>";
                
                fetchIdleDrivers();
                loadHistory();
            });
        }
    }

    // Load History panel list
    function loadHistory() {
        const historyContainer = document.getElementById('history-container');
        
        fetch('/api/rides')
            .then(res => res.json())
            .then(rides => {
                if (rides.length === 0) {
                    historyContainer.innerHTML = `
                        <div class="empty-state">
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                <circle cx="12" cy="12" r="10"></circle>
                                <polyline points="12 6 12 12 16 14"></polyline>
                            </svg>
                            <p>No trips booked yet.</p>
                        </div>
                    `;
                    return;
                }

                let listHtml = '';
                rides.forEach(r => {
                    const statusClass = r.status === 'completed' ? 'completed' : 'cancelled';
                    const rideTypeClass = r.ride_type;
                    
                    listHtml += `
                        <div class="history-item">
                            <div class="history-header">
                                <span class="history-id">${r.id}</span>
                                <span class="history-type-pill ${rideTypeClass}">${r.ride_type}</span>
                            </div>
                            
                            <div class="history-locs">
                                <div class="history-loc-row">
                                    <span class="dot pickup-dot"></span>
                                    <span>${r.pickup_name}</span>
                                </div>
                                <div class="history-loc-row">
                                    <span class="dot dropoff-dot"></span>
                                    <span>${r.dropoff_name}</span>
                                </div>
                            </div>
                            
                            <div class="history-footer">
                                <span class="history-driver">Driver: ${r.driver_name || 'N/A'}</span>
                                <span class="history-fare">$${r.fare.toFixed(2)}</span>
                            </div>
                        </div>
                    `;
                });
                historyContainer.innerHTML = listHtml;
            })
            .catch(err => {
                console.error("Error loading history:", err);
            });
    }

    // Initialize Map and Load History on startup
    initMap();
    loadHistory();
});
