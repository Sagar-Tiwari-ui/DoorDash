import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  query,
  where,
  getDocs,
  doc,
  setDoc
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAcfUIEfXQinRokagk0a_e4h1uoz3qt3cQ",
  authDomain: "parchuna-wala.firebaseapp.com",
  projectId: "parchuna-wala",
  storageBucket: "parchuna-wala.firebasestorage.app",
  messagingSenderId: "55576084655",
  appId: "1:55576084655:web:93343d235f30963fbad45a",
  measurementId: "G-6EHGD82VM2"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const form = document.getElementById("customerForm");
const messageDiv = document.getElementById("message");

// Collect data
function collectFormData() {
  return {
    mobileNumber: document.getElementById("mobileNumber").value.trim(),
    name: document.getElementById("name").value.trim(),
    houseNumber: document.getElementById("houseNumber").value.trim(),
    region: document.getElementById("region").value.trim(),
    address: document.getElementById("address").value.trim(),
    latLng: document.getElementById("latLng").value.trim(),
  };
}

// Display search results
function displayResult(d) {
  document.getElementById("resultName").textContent = d.name || "N/A";
  document.getElementById("resultHouse").textContent = d.houseNumber || "N/A";
  document.getElementById("resultRegion").textContent = d.region || "N/A";
  document.getElementById("resultAddress").textContent = d.address || "N/A";
  document.getElementById("resultLatLng").textContent = d.latLng || "N/A";

  document.getElementById("searchResult").style.display = "block";
}

// Search Button
const searchBtn = document.getElementById("searchBtn");
searchBtn.addEventListener("click", async () => {
  const mobile = document.getElementById("searchMobile").value.trim();
  const resultBox = document.getElementById("searchResult");
  const msg = document.getElementById("searchMessage");

  if (mobile.length !== 10) {
    msg.textContent = "Enter valid 10-digit number.";
    msg.className = "message error";
    resultBox.style.display = "none";
    return;
  }

  msg.textContent = "Searching...";

  try {
    const q = query(
      collection(db, "Tanakpur", auth.currentUser.uid, "customers"),
      where("mobileNumber", "==", mobile)
    );

    const snap = await getDocs(q);

    if (snap.empty) {
      msg.textContent = "No matching record found.";
      msg.className = "message error";
      resultBox.style.display = "none";
      return;
    }

    displayResult(snap.docs[0].data());
    msg.textContent = "Customer found!";
    msg.className = "message success";

  } catch (err) {
    msg.textContent = "Error: " + err.message;
    msg.className = "message error";
  }
});

// Form Submit
// Form Submit
onAuthStateChanged(auth, (user) => {
  if (!user) {
    alert("Login required.");
    location.href = "admin.html";
    return;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const data = collectFormData();

    if (!data.mobileNumber) {
      messageDiv.textContent = "Mobile number required!";
      messageDiv.className = "message error";
      return;
    }

    try {
      // Use mobile number as document ID
      const docRef = doc(db, "Tanakpur", user.uid, "customers", data.mobileNumber);

      await setDoc(docRef, data, { merge: true }); // merge:true prevents overwriting existing data

      messageDiv.textContent = "Customer created/updated successfully!";
      messageDiv.className = "message success";
      form.reset();
      document.getElementById("searchResult").style.display = "none";

    } catch (err) {
      messageDiv.textContent = "Error: " + err.message;
      messageDiv.className = "message error";
    }
  });
});

