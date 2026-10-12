const loginForm = document.getElementById("loginForm");
const message = document.getElementById("message");
const submitBtn = document.getElementById("submitBtn");

// If already logged in, redirect to dashboard
if (localStorage.getItem("userId")) {
    window.location.href = "dashboard.html";
}

loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    if (!email || !password) {
        showMessage("Please enter both email and password.", "error");
        return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Signing In...";
    message.style.display = "none";

    try {
        const response = await fetch(`${API_BASE}/api/auth/login`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                email,
                password
            })
        });

        const data = await response.json();

        if (response.ok) {
            showMessage(data.message || "Login successful!", "success");

            // Store user details in localStorage
            localStorage.setItem("userId", data.userId);
            localStorage.setItem("userName", data.name);
            localStorage.setItem("userEmail", data.email);
            if (data.department) localStorage.setItem("userDepartment", data.department);
            if (data.year) localStorage.setItem("userYear", data.year);
            if (data.token) localStorage.setItem("token", data.token);

            setTimeout(() => {
                window.location.href = "dashboard.html";
            }, 600);
        } else {
            showMessage(data.message || "Invalid email or password", "error");
            submitBtn.disabled = false;
            submitBtn.textContent = "Sign In";
        }
    } catch (error) {
        console.error("Login fetch error:", error);
        showMessage("Unable to connect to the server. Please check your backend.", "error");
        submitBtn.disabled = false;
        submitBtn.textContent = "Sign In";
    }
});

function showMessage(text, type) {
    message.textContent = text;
    message.className = `alert alert-${type === 'success' ? 'success' : 'danger'}`;
    message.style.display = "block";
}