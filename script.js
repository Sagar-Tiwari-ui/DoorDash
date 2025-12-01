/*
=========================================================
 script.js
 Geo Lookup + Orders + Live Routing + Dynamic Payment QR
=========================================================
*/

import { 
    getFirestore, collection, query, where, getDocs 
} from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js';

import { 
    getAuth, onAuthStateChanged 
} from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js';

const db = getFirestore();
const auth = getAuth();

let map;
let markers = [];
let routingControl = null;
let userLat = null;
let userLon = null;
let userMarker = null;

// Customer state
let customerWaypoints = [];
let currentCustomers = [];

// ---------- INITIAL SETUP ----------
document.addEventListener('DOMContentLoaded', () => {
    console.log("📘 Geo Lookup App Initialized");

    document.getElementById('enterBtn').addEventListener('click', handleUserInput);

    document.getElementById('phoneNumber').addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleUserInput();
        }
    });

    initMap();
    watchUserLocation();

    // Ensure user is logged in before queries
    onAuthStateChanged(auth, (user) => {
        if (!user) {
            alert("❗ Please login first to continue.");
        }
    });
});

// ---------- INIT MAP ----------
function initMap() {
    map = L.map('map').setView([29.0723, 80.1035], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19
    }).addTo(map);
}

// ---------- LIVE LOCATION ----------
function watchUserLocation() {
    if ("geolocation" in navigator) {
        navigator.geolocation.watchPosition(
            (pos) => {
                userLat = pos.coords.latitude;
                userLon = pos.coords.longitude;

                if (!userMarker) {
                    const blueDotIcon = L.divIcon({
                        className: 'user-location-marker',
                        html: '<div style="background:#4285F4;width:15px;height:15px;border-radius:50%;border:2px solid #fff;box-shadow:0 0 5px #0005;"></div>',
                        iconSize: [20, 20]
                    });

                    userMarker = L.marker([userLat, userLon], { icon: blueDotIcon }).addTo(map);
                    map.setView([userLat, userLon], 16);
                } else {
                    userMarker.setLatLng([userLat, userLon]);
                }

                if (customerWaypoints.length > 0) updateRoute();
            },
            (err) => console.warn("Location access denied.", err),
            { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 }
        );
    }
}

// ---------- HANDLE SEARCH ----------
async function handleUserInput() {
    const phoneInput = document.getElementById("phoneNumber").value.trim();
    const customerList = document.getElementById("customerList");
    const noResults = document.getElementById("noResults");

    customerList.innerHTML = "";
    noResults.style.display = "block";
    noResults.innerHTML = "Searching...";

    // Reset state
    currentCustomers = [];
    customerWaypoints = [];
    markers.forEach(m => map.removeLayer(m));
    markers = [];

    if (routingControl) {
        map.removeControl(routingControl);
        routingControl = null;
    }

    if (!phoneInput) {
        noResults.innerHTML = `<p style="color:red;">Please enter phone numbers.</p>`;
        return;
    }

    const phoneNumbers = phoneInput
        .split(",")
        .map(n => n.trim())
        .filter(n => /^\d{10}$/.test(n));

    if (phoneNumbers.length === 0) {
        noResults.innerHTML = `<p style="color:red;">Enter valid 10-digit phone numbers.</p>`;
        return;
    }

    if (!auth.currentUser) {
        noResults.innerHTML = `<p style="color:red;">User not logged in.</p>`;
        return;
    }

    try {
        const q = query(
            collection(db, 'Tanakpur', auth.currentUser.uid, 'customers'),
            where('mobileNumber', 'in', phoneNumbers.slice(0, 10)) // Firestore limit
        );

        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            noResults.innerHTML = `<p style="color:red;">No customer found.</p>`;
            return;
        }

        noResults.style.display = "none";

        querySnapshot.forEach(doc => {
            const data = doc.data();
            currentCustomers.push({
                id: doc.id,
                ...data,
                coords: data.latLng ? data.latLng.split(",").map(Number) : null
            });
        });

        renderCustomerList();
        updateMapMarkers();
        updateRoute();

    } catch (err) {
        console.error("❌ Error:", err);
        noResults.innerHTML = `<p style="color:red;">${err.message}</p>`;
    }
}

// ---------- CUSTOMER LIST ----------
function renderCustomerList() {
    const list = document.getElementById("customerList");
    list.innerHTML = "";

    if (currentCustomers.length === 0) {
        document.getElementById("noResults").style.display = "block";
        document.getElementById("noResults").innerText = "All deliveries completed!";
        return;
    }

    currentCustomers.forEach((c, index) => {
        const hasCoords = c.coords && c.coords.length === 2;
        
        const card = document.createElement("div");
        card.className = "customer-card";
        card.style.cssText = `
            border:1px solid #ddd;
            padding:15px;
            margin-bottom:15px;
            border-radius:8px;
            background:#f9f9f9;
        `;

        card.innerHTML = `
            <h3>${c.name || "Unknown"}</h3>
            <p>${c.mobileNumber}</p>
            <p>${c.address || "No address"}</p>

            <div style="background:#e3f2fd;padding:10px;border-radius:5px;margin:10px 0;">
                <p><b>Order:</b> ${c.orderList || "N/A"}</p>
                <p><b>Total: ₹${c.price || 0}</b></p>
            </div>

            <div style="text-align:center;margin-bottom:10px;">
                <canvas id="qr_${index}"></canvas>
            </div>

            <div style="display:flex;gap:10px;">
                <button style="flex:1;background:#4CAF50;color:#fff;padding:10px;border:none;border-radius:5px;"
                    onclick="markDeliveryDone('${c.id}')">Delivered</button>

                ${
                    hasCoords 
                    ? `<button style="flex:1;background:#2196F3;color:#fff;padding:10px;border:none;border-radius:5px;"
                        onclick="openGoogleMaps(${c.coords[0]}, ${c.coords[1]})">
                      Go to Map</button>`
                    : `<button disabled style="flex:1;background:#ccc;padding:10px;border:none;border-radius:5px;">No Coords</button>`
                }
            </div>
        `;

        list.appendChild(card);

        setTimeout(() => {
            generateUPIQR("9770123692@ptyes", c.price || 0, c.name, `qr_${index}`);
        }, 50);
    });
}

// ---------- MAP MARKERS ----------
function updateMapMarkers() {
    markers.forEach(m => map.removeLayer(m));
    markers = [];
    customerWaypoints = [];

    currentCustomers.forEach(c => {
        if (c.coords) {
            const [lat, lon] = c.coords;

            const marker = L.marker([lat, lon])
                .addTo(map)
                .bindPopup(`<b>${c.name}</b><br>${c.address}<br>₹${c.price}`);

            markers.push(marker);
            customerWaypoints.push(L.latLng(lat, lon));
        }
    });
}

// ---------- DELIVERY BUTTON ----------
window.markDeliveryDone = function(id) {
    currentCustomers = currentCustomers.filter(c => c.id !== id);
    renderCustomerList();
    updateMapMarkers();
    updateRoute();
};

// ---------- OPEN GOOGLE MAPS ----------
window.openGoogleMaps = function(lat, lon) {
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`, "_blank");
};

// ---------- ROUTING ----------
function updateRoute() {
    if (routingControl) {
        map.removeControl(routingControl);
        routingControl = null;
    }

    if (!userLat || customerWaypoints.length === 0) return;

    const waypoints = [
        L.latLng(userLat, userLon),
        ...customerWaypoints
    ];

    routingControl = L.Routing.control({
        waypoints,
        routeWhileDragging: false,
        showAlternatives: false,
        addWaypoints: false,
        lineOptions: {
            styles: [{ color: '#2196F3', weight: 6 }]
        },
        router: L.Routing.osrmv1({
            serviceUrl: "https://router.project-osrm.org/route/v1"
        }),
        createMarker: () => null
    }).addTo(map);

    const rc = document.querySelector('.leaflet-routing-container');
    if (rc) rc.style.display = "none";
}

// ---------- QR ----------
function generateUPIQR(upiId, amount, name, elementId) {
    try {
        const url = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(name)}&am=${amount}&cu=INR`;
        new QRious({
            element: document.getElementById(elementId),
            value: url,
            size: 100
        });
    } catch (err) {
        console.error("QR Error", err);
    }
}
