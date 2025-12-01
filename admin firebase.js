// Import the functions you need from the Firebase SDKs
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-analytics.js";

// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyAcfUIEfXQinRokagk0a_e4h1uoz3qt3cQ",
  authDomain: "parchuna-wala.firebaseapp.com",
  projectId: "parchuna-wala",
  storageBucket: "parchuna-wala.firebasestorage.app",
  messagingSenderId: "55576084655",
  appId: "1:55576084655:web:93343d235f30963fbad45a",
  measurementId: "G-6EHGD82VM2"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);

// Modified auth state observer - only monitor, don't redirect
onAuthStateChanged(auth, (user) => {
    // Only log the state, don't redirect
    console.log("Auth state changed:", user ? "User is signed in" : "No user signed in");
});

// Function to check user access and redirect
async function checkUserAccess(email) {
    try {
        const userDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
        if (userDoc.exists()) {
            const userData = userDoc.data();
            if (userData.assignedHomepage) {
                window.location.href = userData.assignedHomepage;
            } else {
                window.location.href = 'homepage.html';
            }
        } else {
            console.error("User document not found");
            window.location.href = 'homepage.html';
        }
    } catch (error) {
        console.error("Error checking user access:", error);
        window.location.href = 'homepage.html';
    }
}

// Function to display messages
function showMessage(message, divId) {
    const messageDiv = document.getElementById(divId);
    messageDiv.style.display = "block";
    messageDiv.innerHTML = message;
    setTimeout(() => {
        messageDiv.style.display = "none";
    }, 5000);
}

// Sign in users
const signInForm = document.getElementById('signinForm');
signInForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value.trim();

    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        showMessage('Login successful', 'signInMessage');
        checkUserAccess(email);
    } catch (error) {
        handleAuthError(error, 'signInMessage');
    }
});

// Sign up new users
const signUpForm = document.getElementById('signupForm');
signUpForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = document.getElementById('rEmail').value.trim();
    const password = document.getElementById('rPassword').value.trim();
    const userData = {
        email,
        firstName: document.getElementById('fName').value.trim(),
        lastName: document.getElementById('lName').value.trim(),
        CoachingSector: document.getElementById('Csector').value.trim(),
        MobileNumber: document.getElementById('MNumber').value.trim(),
    };

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await setDoc(doc(db, "users", userCredential.user.uid), userData);
        showMessage('Account Created Successfully', 'signUpMessage');
        window.location.href = 'institute-login.html';
    } catch (error) {
        handleAuthError(error, 'signUpMessage');
    }
});

// Handle authentication errors
function handleAuthError(error, messageDiv) {
    console.error("Auth error:", error);
    const errorMessages = {
        'auth/user-not-found': 'Account does not exist. Please register first.',
        'auth/wrong-password': 'Incorrect password. Please try again.',
        'auth/invalid-email': 'Invalid email address format.',
        'auth/email-already-in-use': 'Email Address Already Exists!',
        'auth/weak-password': 'Password should be at least 6 characters.',
        'auth/invalid-credential': 'Invalid credentials. Please check your email and password.',
    };
    
    const message = errorMessages[error.code] || 'An error occurred. Please try again.';
    showMessage(message, messageDiv);
}

// Logout functionality
export function logout() {
    auth.signOut().then(() => {
        window.location.href = 'institute-login.html';
    }).catch((error) => {
        console.error("Error signing out:", error);
    });
}

// Clear any existing auth state on page load
window.addEventListener('load', () => {
    auth.signOut().then(() => {
        console.log("Previous auth state cleared");
    }).catch((error) => {
        console.error("Error clearing auth state:", error);
    });
});

