/*
=========================================================
 script.js
 Geo Lookup + Orders + Live Routing + Dynamic Payment QR
=========================================================
*/

let geoData = [];             // Customer geolocation data
let orderData = [];           // Customer order data
let map;
let markers = [];
let routingControl = null;

let userLat = null;
let userLon = null;
let userMarker = null;
let arrowIcon = null;

// Store customer waypoints and markers for easy management
let customerWaypoints = [];

// For smoothing location updates
let lastPositions = []; // Store last 3 positions for averaging
const MAX_POSITIONS = 3; // Number of positions to average
const ACCURACY_THRESHOLD = 10; // Max acceptable accuracy in meters

// ---------- INITIAL SETUP ----------
document.addEventListener('DOMContentLoaded', () => {
    console.log("📘 Geo Lookup App Initialized");

    // Load Excel files from root folder
    loadExcelData('geolocation data set for tanakpur.xlsx', 'geo');
    loadExcelData('Order List.xlsx', 'order');

    document.getElementById('enterBtn').addEventListener('click', handleUserInput);

    initMap();
    watchUserLocation(); // Start live tracking
    handleDeviceOrientation(); // Rotation handling for arrow marker
});

// ---------- LOAD EXCEL ----------
async function loadExcelData(filePath, type) {
    try {
        const response = await fetch(filePath);
        if (!response.ok) throw new Error("File not found or blocked by browser.");

        const arrayBuffer = await response.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];

        const data = XLSX.utils.sheet_to_json(sheet);

        if (type === 'geo') {
            geoData = data;
            console.log(`✅ Geo data loaded: ${geoData.length} rows`);
        } else if (type === 'order') {
            orderData = data;
            console.log(`✅ Order data loaded: ${orderData.length} rows`);
        }
    } catch (err) {
        console.error(`❌ Error loading ${type} Excel file:`, err);
        if (type === 'geo') {
            const resultBox = document.getElementById("resultBox");
            const noResults = document.getElementById("noResults");
            if (resultBox) {
                resultBox.innerHTML = `<p style="color:red;">Failed to load ${type} Excel file.</p>`;
            }
            if (noResults) {
                noResults.style.display = "block";
            }
        }
    }
}

// ---------- INIT MAP ----------
function initMap() {
    map = L.map('map').setView([29.0723, 80.1035], 13); // Default to Tanakpur

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);
}

// ---------- WATCH USER LOCATION ----------
function watchUserLocation() {
    if ("geolocation" in navigator) {
        navigator.geolocation.watchPosition(
            (pos) => {
                const accuracy = pos.coords.accuracy;
                console.log(`Location update: lat=${pos.coords.latitude}, lon=${pos.coords.longitude}, accuracy=${accuracy}m`);
                if (accuracy > ACCURACY_THRESHOLD) {
                    console.warn(`⚠️ Low accuracy (${accuracy}m), skipping update.`);
                    const resultBox = document.getElementById("resultBox");
                    if (resultBox && accuracy > 50) {
                        resultBox.innerHTML += `<p style="color:orange;">Please enable high-accuracy GPS in your device settings for better tracking.</p>`;
                    }
                    return;
                }

                const newLat = pos.coords.latitude;
                const newLon = pos.coords.longitude;

                // Smooth coordinates using simple moving average
                lastPositions.push({ lat: newLat, lon: newLon });
                if (lastPositions.length > MAX_POSITIONS) {
                    lastPositions.shift();
                }

                // Calculate average position
                const avg = lastPositions.reduce(
                    (acc, pos) => ({
                        lat: acc.lat + pos.lat / lastPositions.length,
                        lon: acc.lon + pos.lon / lastPositions.length
                    }),
                    { lat: 0, lon: 0 }
                );

                userLat = avg.lat;
                userLon = avg.lon;

                if (!userMarker) {
                    const arrowSvg = `
                        <svg width="30" height="30" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <polygon points="12,2 22,22 12,17 2,22" fill="#4285F4"/>
                        </svg>
                    `;
                    arrowIcon = L.divIcon({
                        html: arrowSvg,
                        className: 'arrow-icon',
                        iconSize: [30, 30],
                        iconAnchor: [15, 15]
                    });

                    userMarker = L.marker([userLat, userLon], {
                        title: "Your Location",
                        icon: arrowIcon
                    }).addTo(map);

                    map.setView([userLat, userLon], 16);
                } else {
                    userMarker.setLatLng([userLat, userLon]);
                }

                // Update route if route exists
                if (routingControl && customerWaypoints.length > 0) {
                    updateRoute();
                }
            },
            (err) => {
                console.warn("⚠️ Location access denied or unavailable.", err);
                const resultBox = document.getElementById("resultBox");
                if (resultBox) {
                    resultBox.innerHTML += `<p style="color:orange;">Location access denied. You can still search customers, but live tracking is unavailable.</p>`;
                }
            },
            {
                enableHighAccuracy: true,
                maximumAge: 1000,
                timeout: 3000
            }
        );
    } else {
        const resultBox = document.getElementById("resultBox");
        if (resultBox) {
            resultBox.innerHTML += `<p style="color:orange;">Geolocation not supported by your browser. You can still search customers.</p>`;
        }
    }
}

// ---------- HANDLE DEVICE ORIENTATION ----------
function handleDeviceOrientation() {
    let lastUpdate = 0;
    const throttleInterval = 100;

    const orientationEvent = window.DeviceOrientationAbsoluteEvent || window.DeviceOrientationEvent;

    if (orientationEvent) {
        window.addEventListener('deviceorientation', (event) => {
            const now = Date.now();
            if (now - lastUpdate < throttleInterval) return;
            lastUpdate = now;

            let alpha = event.alpha;
            if (alpha === null) {
                console.warn("⚠️ Device orientation data unavailable.");
                const resultBox = document.getElementById("resultBox");
                if (resultBox) {
                    resultBox.innerHTML += `<p style="color:orange;">Please calibrate your device's compass for accurate arrow rotation.</p>`;
                }
                return;
            }

            if (event.absolute === true || !event.webkitCompassHeading) {
                alpha = 360 - alpha;
            } else if (event.webkitCompassHeading) {
                alpha = event.webkitCompassHeading;
            }

            if (userMarker) {
                const iconElement = userMarker._icon;
                if (iconElement) {
                    iconElement.style.transform = `rotate(${alpha}deg)`;
                    iconElement.style.transformOrigin = 'center center';
                }
            }
        });
    } else {
        console.warn("⚠️ Device orientation not supported.");
        const resultBox = document.getElementById("resultBox");
        if (resultBox) {
            resultBox.innerHTML += `<p style="color:orange;">Device orientation not supported; arrow will not rotate.</p>`;
        }
    }
}

// ---------- HANDLE SEARCH ----------
function handleUserInput() {
    const phoneInput = document.getElementById("phoneNumber").value.trim();
    const customerList = document.getElementById("customerList");
    const noResults = document.getElementById("noResults");

    customerList.innerHTML = ""; // Clear previous results
    noResults.style.display = "block"; // Show default message

    if (!phoneInput) {
        noResults.innerHTML = `<p style="color:red;">Please enter phone numbers.</p>`;
        return;
    }
    if (geoData.length === 0) {
        noResults.innerHTML = `<p style="color:red;">Geo Excel data not loaded.</p>`;
        return;
    }

    const phoneNumbers = phoneInput.split(",").map(num => num.trim()).filter(Boolean);
    const matches = [];

    phoneNumbers.forEach(num => {
        const geoMatch = geoData.find(row => String(row["Mobile Number"] || "").trim() === num);
        const orderMatch = orderData.find(row => String(row["Mobile Number"] || "").trim() === num);
        if (geoMatch) matches.push({ geo: geoMatch, order: orderMatch || null });
    });

    // Clear existing markers and routes
    markers.forEach(m => map.removeLayer(m));
    markers = [];
    customerWaypoints = [];
    if (routingControl) {
        map.removeControl(routingControl);
        routingControl = null;
    }

    if (matches.length === 0) {
        noResults.innerHTML = `<p style="color:red;">No records found.</p>`;
        return;
    }

    noResults.style.display = "none"; // Hide default message
    noResults.innerHTML = "Enter phone numbers to search for customers..."; // Reset message

    matches.forEach((m, i) => {
        const coord = (m.geo["lattitude longitude"] || "").split(",");
        const lat = parseFloat(coord[0]);
        const lon = parseFloat(coord[1]);

        // Create customer card
        const card = document.createElement("div");
        card.className = "customer-card";
        card.id = `customer-${i}`; // Unique ID for each card
        card.innerHTML = `
            <h3>${m.geo.Name || "N/A"}</h3>
            <p><strong>Mobile:</strong> ${m.geo["Mobile Number"]}</p>
            <p><strong>Region:</strong> ${m.geo.Region || "N/A"}</p>
            <p><strong>Address:</strong> ${m.geo.Address || "N/A"}</p>
            ${m.order ? `
                <p><strong>Orders:</strong> ${m.order["Order List"] || "N/A"}</p>
                <p><strong>Total Price:</strong> ₹${m.order.Price || "N/A"}</p>
                <canvas id="qr_${i}" class="qr-code"></canvas>
            ` : ""}
            <button class="delivery-done-btn" data-customer-id="customer-${i}" data-marker-index="${i}" data-lat="${lat}" data-lon="${lon}" aria-label="Mark delivery as done for ${m.geo.Name || 'customer'}">Delivery Done</button>
            <button class="map-btn" onclick="showOnMap(${lat}, ${lon}, '${m.geo.Name || 'Customer'}')">View on Map</button>
        `;

        customerList.appendChild(card);

        // Generate QR code if order exists
        if (m.order) {
            const upiId = "9770123692@ptyes"; // Replace with your UPI ID
            setTimeout(() => {
                generateUPIQR(upiId, m.order.Price, m.geo.Name, `qr_${i}`);
            }, 100);
        }

        // Add marker to map
        if (!isNaN(lat) && !isNaN(lon)) {
            const marker = L.marker([lat, lon], { title: m.geo.Name })
                .addTo(map)
                .bindPopup(`<strong>${m.geo.Name}</strong><br>${m.geo.Address || ""}`);
            markers.push(marker);
            customerWaypoints.push(L.latLng(lat, lon));
        }
    });

    // Add event listeners for Delivery Done buttons
    document.querySelectorAll(".delivery-done-btn").forEach(button => {
        button.addEventListener("click", () => {
            const customerId = button.dataset.customerId;
            const markerIndex = parseInt(button.dataset.markerIndex);
            const card = document.getElementById(customerId);

            // Hide the card
            card.classList.add("hidden");

            // Remove marker and waypoint
            if (markers[markerIndex]) {
                map.removeLayer(markers[markerIndex]);
                markers.splice(markerIndex, 1); // Remove from markers array
                customerWaypoints.splice(markerIndex, 1); // Remove from waypoints
            }

            // Update route
            if (userLat !== null && userLon !== null) {
                updateRoute();
            }

            // Update map bounds
            if (markers.length > 0) {
                const allCoords = markers.map(m => m.getLatLng());
                if (userLat !== null && userLon !== null) {
                    allCoords.push(L.latLng(userLat, userLon));
                }
                map.fitBounds(L.latLngBounds(allCoords), { padding: [50, 50] });
            } else {
                map.setView([29.0723, 80.1035], 13); // Tanakpur center
                noResults.style.display = "block"; // Show default message
            }
        });
    });

    // Draw initial route if user location is available
    if (userLat !== null && userLon !== null) {
        updateRoute();
    }

    // Fit bounds to include all markers (and user if available)
    if (markers.length > 0) {
        const allCoords = markers.map(m => m.getLatLng());
        if (userLat !== null && userLon !== null) {
            allCoords.push(L.latLng(userLat, userLon));
        }
        map.fitBounds(L.latLngBounds(allCoords), { padding: [50, 50] });
    } else {
        map.setView([29.0723, 80.1035], 13); // Tanakpur center
    }
}

// ---------- UPDATE ROUTE ----------
function updateRoute() {
    if (customerWaypoints.length === 0 || userLat === null || userLon === null) {
        if (routingControl) {
            map.removeControl(routingControl);
            routingControl = null;
        }
        return;
    }

    if (!routingControl) {
        routingControl = L.Routing.control({
            waypoints: [L.latLng(userLat, userLon), ...customerWaypoints],
            routeWhileDragging: false,
            showAlternatives: false,
            lineOptions: { styles: [{ color: 'blue', opacity: 0.7, weight: 5 }] },
            router: L.Routing.osrmv1({ serviceUrl: 'https://router.project-osrm.org/route/v1' }),
            createMarker: function(i, wp) {
                if (i === 0) return userMarker;
                return null; // Use existing markers for customers
            }
        }).addTo(map);
    } else {
        routingControl.setWaypoints([L.latLng(userLat, userLon), ...customerWaypoints]);
    }
}

// ---------- SHOW ON MAP ----------
window.showOnMap = function(lat, lon, name) {
    map.setView([lat, lon], 16);
};

// ---------- GENERATE QR ----------
function generateUPIQR(upiId, amount, name, elementId) {
    try {
        const upiLink = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(name)}&am=${amount}&cu=INR`;
        const qr = new QRious({
            element: document.getElementById(elementId),
            value: upiLink,
            size: 120
        });
    } catch (err) {
        console.error("❌ QR generation failed:", err);
    }
}