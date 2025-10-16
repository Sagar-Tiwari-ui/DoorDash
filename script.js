/*
=========================================================
 script.js
 Leaflet + Leaflet Routing Machine version
 Live user tracking + multi-customer routing
=========================================================
*/

let geoData = [];             // Excel data
let map;                      // Leaflet map
let markers = [];             // Customer markers
let routingControl = null;    // Routing machine instance

let userLat = null;           // live latitude from device
let userLon = null;           // live longitude from device
let userMarker = null;

// ---------- INITIAL SETUP ----------
document.addEventListener('DOMContentLoaded', () => {
    console.log("📘 Geo Lookup App Initialized");

    loadExcelData('geolocation data set for tanakpur.xlsx');
    document.getElementById('enterBtn').addEventListener('click', handleUserInput);

    initMap();
    getUserLocation(); // start live tracking
});

// ---------- LOAD EXCEL ----------
async function loadExcelData(filePath) {
    try {
        const response = await fetch(filePath);
        if (!response.ok) throw new Error("File not found or blocked by browser.");

        const arrayBuffer = await response.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];

        geoData = XLSX.utils.sheet_to_json(sheet);
        console.log(`✅ Excel data loaded: ${geoData.length} rows`);
    } catch (err) {
        console.error("❌ Error loading Excel file:", err);
        document.getElementById("resultBox").innerHTML = `<p style="color:red;">Failed to load Excel file.</p>`;
    }
}

// ---------- INIT MAP ----------
function initMap() {
    // Temporary default center, will update once GPS is retrieved
    map = L.map('mapContainer').setView([20.0, 78.0], 5);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);
}

// ---------- GET USER LOCATION (Live Tracking) ----------
function getUserLocation() {
    if ("geolocation" in navigator) {
        navigator.geolocation.watchPosition(
            (pos) => {
                userLat = pos.coords.latitude;
                userLon = pos.coords.longitude;
                document.getElementById("userLocation").value = `${userLat},${userLon}`;

                if (!userMarker) {
                    // First time: add marker
                    userMarker = L.marker([userLat, userLon], {
                        title: "Your Location",
                        icon: L.icon({
                            iconUrl: 'https://cdn-icons-png.flaticon.com/512/64/64113.png',
                            iconSize: [32,32]
                        })
                    }).addTo(map).bindPopup("Your Location").openPopup();
                    map.setView([userLat, userLon], 15);
                } else {
                    // Update marker position live
                    userMarker.setLatLng([userLat, userLon]);
                }

                // Update route starting point if route exists
                if (routingControl && routingControl.getPlan()) {
                    const currentWaypoints = routingControl.getWaypoints().slice(1); // keep customer waypoints
                    routingControl.getPlan().setWaypoints([L.latLng(userLat, userLon), ...currentWaypoints]);
                }
            },
            (err) => {
                console.warn("⚠️ Location access denied or unavailable.", err);
                alert("Cannot track location. Please allow location access.");
            },
            { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 }
        );
    } else {
        console.warn("⚠️ Geolocation not supported by this browser.");
        alert("Geolocation not supported by your browser.");
    }
}

// ---------- HANDLE SEARCH ----------
function handleUserInput() {
    if (userLat === null || userLon === null) {
        alert("Waiting for your device location. Please allow location access.");
        return;
    }

    const phoneInput = document.getElementById("phoneNumber").value.trim();
    const resultBox = document.getElementById("resultBox");

    resultBox.innerHTML = `<p>Searching...</p>`;
    if (!phoneInput) return resultBox.innerHTML = `<p style="color:red;">Please enter phone numbers.</p>`;
    if (geoData.length === 0) return resultBox.innerHTML = `<p style="color:red;">Excel data not loaded.</p>`;

    // Split phone numbers
    const phoneNumbers = phoneInput.split(",").map(num => num.trim()).filter(Boolean);
    const matches = [];

    phoneNumbers.forEach(num => {
        const match = geoData.find(row => (String(row["Mobile Number"] || "").trim() === num));
        if (match) matches.push({ ...match, phone: num });
    });

    // Clear previous markers and route
    markers.forEach(m => map.removeLayer(m));
    markers = [];
    if (routingControl) map.removeControl(routingControl);

    if (matches.length === 0) return resultBox.innerHTML = `<p style="color:red;">No records found.</p>`;

    // Prepare route waypoints: start with user location
    const waypoints = [L.latLng(userLat, userLon)];
    let html = `<h3>${matches.length} Match(es) Found:</h3>`;

    matches.forEach((m, i) => {
        const coord = (m["lattitude longitude"] || "").split(",");
        const lat = parseFloat(coord[0]);
        const lon = parseFloat(coord[1]);

        html += `
            <div class="customer-entry">
                <p><strong>${i + 1}. ${m.Name || "N/A"}</strong></p>
                <p><strong>Mobile:</strong> ${m["Mobile Number"]}</p>
                <p><strong>Region:</strong> ${m.Region || "N/A"}</p>
                <p><strong>Address:</strong> ${m.Address || "N/A"}</p>
                <p><strong>Coordinates:</strong> ${m["lattitude longitude"] || "N/A"}</p>
                ${lat && lon ? `<button class="map-btn" onclick="showOnMap(${lat}, ${lon}, '${m.Name}')">View on Map</button>` : ""}
                <hr>
            </div>
        `;

        if (!isNaN(lat) && !isNaN(lon)) {
            const marker = L.marker([lat, lon], { title: m.Name })
                            .addTo(map)
                            .bindPopup(`<strong>${m.Name}</strong><br>${m.Address || ""}`);
            markers.push(marker);
            waypoints.push(L.latLng(lat, lon));
        }
    });

    resultBox.innerHTML = html;

    // Add routing control (OSRM free service)
    routingControl = L.Routing.control({
        waypoints: waypoints,
        routeWhileDragging: false,
        showAlternatives: false,
        lineOptions: { styles: [{ color: 'blue', opacity: 0.7, weight: 5 }] },
        router: L.Routing.osrmv1({
            serviceUrl: 'https://router.project-osrm.org/route/v1'
        }),
        createMarker: function(i, wp) {
            if (i === 0) return userMarker; // Use existing user marker
            return null; // Don't create default markers for customers
        }
    }).addTo(map);

    // Fit map bounds
    const allCoords = [L.latLng(userLat, userLon), ...markers.map(m => m.getLatLng())];
    map.fitBounds(L.latLngBounds(allCoords), { padding: [50,50] });
}

// ---------- SHOW ON MAP ----------
window.showOnMap = function(lat, lon, name) {
    map.setView([lat, lon], 16);
};
