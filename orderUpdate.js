// orderUpdate.js

let groceryData = [];
let cart = [];

// --------------------- Firebase Setup ---------------------
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc,
  collection, query, where
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

// --------------------- Auth Check ---------------------
onAuthStateChanged(auth, (user) => {
  if (!user) {
    alert("Please log in as admin first.");
    window.location.href = "Order update.html";
  } else {
    console.log("Logged in as:", user.email);
    window.podpiska = { db, auth, doc, getDoc, setDoc, collection, query, where };
    initApp();
  }
});

// --------------------- App Initialization ---------------------
function initApp() {
  loadGroceryList();
  document.getElementById('orderForm').addEventListener('submit', handleSubmitCart);
  document.getElementById('printReceiptBtn').addEventListener('click', handlePrintReceipt);

  const searchInput = document.getElementById("searchItem");
  if (searchInput) {
    searchInput.addEventListener("input", handleSearchFilter);
  }
}

// --------------------- Convert Postimg Page URL → Direct Image ---------------------
function getPostimgDirectLink(url) {
  if (!url) return "";

  if (url.includes("i.postimg.cc")) return url;

  if (url.includes("postimg.cc")) {
    const id = url.split("/").pop();
    return `https://i.postimg.cc/${id}/image.jpg`;
  }

  return url;
}

// --------------------- Load Grocery List ---------------------
async function loadGroceryList() {
  try {
    const response = await fetch('Inventory List with Price.xlsx');
    if (!response.ok) throw new Error('Inventory file not found.');

    const arrayBuffer = await response.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];

    groceryData = XLSX.utils.sheet_to_json(sheet, { raw: false });

    groceryData = groceryData.map(item => ({
      ...item,
      Image: getPostimgDirectLink(item.Image || ""),
      Category: item.Category || "Uncategorized"
    }));

    displayGroceryList(groceryData);

  } catch (error) {
    console.error("Error loading inventory:", error);
    alert("⚠️ Failed to load inventory file. Check file path and format.");
  }
}

// --------------------- Display Grocery List ---------------------
function displayGroceryList(data) {
  const tbody = document.getElementById('groceryTableBody');
  tbody.innerHTML = '';

  data.forEach((row) => {
    const price = parseFloat(row['Price']) || 0;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${row["Sr. No."] || "-"}</td>
      <td>${row["Inventory Item"] || "-"}</td>
      <td>₹${price.toFixed(2)}</td>

      <td>
        ${row["Image"] 
          ? `<img src="${row["Image"]}" style="width:55px;height:55px;object-fit:cover;border-radius:8px;" onerror="this.src='fallback.jpg'">`
          : "-"
        }
      </td>

      <td>${row["Category"] || "-"}</td>

      <td><input type="number" class="quantity-input" min="1" value="1"></td>
      <td><button class="add-to-cart">Add</button></td>
    `;
    tbody.appendChild(tr);

    tr.querySelector(".add-to-cart").addEventListener("click", () => {
      const qty = parseInt(tr.querySelector(".quantity-input").value) || 1;
      cart.push({
        name: row["Inventory Item"],
        price,
        quantity: qty
      });
      updateCartDisplay();
    });
  });
}

// --------------------- SEARCH FILTER (Name + Category) ---------------------
function handleSearchFilter(e) {
  const text = e.target.value.toLowerCase();

  const filtered = groceryData.filter(item =>
    (item["Inventory Item"]?.toLowerCase().includes(text)) ||
    (item["Category"]?.toLowerCase().includes(text))
  );

  displayGroceryList(filtered);
}

// --------------------- Update Cart Display ---------------------
function updateCartDisplay() {
  const tbody = document.getElementById("cartTableBody");
  tbody.innerHTML = "";

  let total = 0;

  cart.forEach(item => {
    const rowTotal = item.price * item.quantity;
    total += rowTotal;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${item.name}</td>
      <td>₹${item.price.toFixed(2)}</td>
      <td>${item.quantity}</td>
      <td>₹${rowTotal.toFixed(2)}</td>
    `;
    tbody.appendChild(tr);
  });

  document.getElementById("cartTotal").textContent = `₹${total.toFixed(2)}`;
}

// --------------------- Submit Cart to Firebase ---------------------
async function handleSubmitCart(event) {
  event.preventDefault();

  const mobile = document.getElementById("mobileNumber").value.trim();

  if (!/^\d{10}$/.test(mobile)) {
    alert("Enter valid 10-digit mobile number.");
    return;
  }
  if (cart.length === 0) {
    alert("Cart is empty.");
    return;
  }

  try {
    const orderList = cart.map(i => `${i.name} (Qty: ${i.quantity})`).join(", ");
    const totalPrice = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);

    const user = window.podpiska.auth.currentUser;
    const ref = window.podpiska.doc(window.podpiska.db, "Tanakpur", user.uid, "customers", mobile);
    const existing = await window.podpiska.getDoc(ref);

    await window.podpiska.setDoc(ref, {
      mobileNumber: mobile,
      name: existing.exists() ? existing.data().name || "" : "",
      region: existing.exists() ? existing.data().region || "" : "",
      address: existing.exists() ? existing.data().address || "" : "",
      latLng: existing.exists() ? existing.data().latLng || "" : "",
      orderList,
      price: totalPrice
    }, { merge: true });

    cart = [];
    updateCartDisplay();
    document.getElementById("orderForm").reset();

    alert(`✅ Order for ${mobile} saved successfully!`);

  } catch (err) {
    console.error("Error saving order:", err);
    alert("❌ Failed to save order. Check Firebase config.");
  }
}

// --------------------- Print PDF Receipt ---------------------
function handlePrintReceipt() {
  if (cart.length === 0) {
    alert("Cart is empty. Add items before printing receipt.");
    return;
  }

  const doc = new window.jspdf.jsPDF();

  const storeName = "Tanakpur Grocery Store";
  const date = new Date().toLocaleString();
  const mobile = document.getElementById("mobileNumber").value || "N/A";

  doc.setFontSize(18);
  doc.text(storeName, 105, 20, { align: "center" });

  doc.setFontSize(12);
  doc.text(`Date: ${date}`, 14, 30);
  doc.text(`Customer Mobile: ${mobile}`, 14, 36);

  const tableColumn = ["Item", "Qty", "Price", "Total"];
  const tableRows = [];

  let grandTotal = 0;
  cart.forEach(item => {
    const total = item.price * item.quantity;
    grandTotal += total;
    tableRows.push([item.name, String(item.quantity), `Rs${item.price}`, `Rs${total}`]);
  });

  doc.autoTable({
    startY: 45,
    head: [tableColumn],
    body: tableRows,
    theme: "grid",
    headStyles: { fillColor: [33, 150, 243], textColor: 255 },
    styles: { fontSize: 11 }
  });

  doc.setFontSize(14);
  doc.text(`Grand Total: Rs${grandTotal}`, 14, doc.lastAutoTable.finalY + 10);

  doc.setFontSize(10);
  doc.text("Thank you for shopping with us!", 105, doc.lastAutoTable.finalY + 20, { align: "center" });

  doc.save(`Receipt_${mobile}_${Date.now()}.pdf`);
}
