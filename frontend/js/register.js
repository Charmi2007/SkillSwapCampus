const registerForm = document.getElementById("registerForm");
const message = document.getElementById("message");
const submitBtn = document.getElementById("submitBtn");

registerForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const name = document.getElementById("name").value.trim();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const department = document.getElementById("department").value.trim();
    const year = document.getElementById("year").value;

    if (!name || !email || !password) {
        showMessage("Please fill in all required fields.", "error");
        return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Creating Account...";
    message.style.display = "none";

    try {
        const response = await fetch(`${API_BASE}/api/auth/register`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                name,
                email,
                password,
                department,
                year
            })
        });

        const data = await response.json();

        if (response.ok) {
            showMessage("Registration successful! Redirecting to login...", "success");
            registerForm.reset();
            setTimeout(() => {
                window.location.href = "login.html";
            }, 1200);
        } else {
            showMessage(data.message || "Registration failed", "error");
            submitBtn.disabled = false;
            submitBtn.textContent = "Create Account";
        }
    } catch (error) {
        console.error("Register fetch error:", error);
        showMessage("Unable to connect to the server.", "error");
        submitBtn.disabled = false;
        submitBtn.textContent = "Create Account";
    }
});

function showMessage(text, type) {
    message.textContent = text;
    message.className = `alert alert-${type === 'success' ? 'success' : 'danger'}`;
    message.style.display = "block";
}