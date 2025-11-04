// Login form handler
document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('loginForm');
  const loginBtn = document.getElementById('loginBtn');
  const loginBtnText = document.getElementById('loginBtnText');
  const loginSpinner = document.getElementById('loginSpinner');
  const alertMessage = document.getElementById('alertMessage');
  const usernameInput = document.getElementById('username');
  const passwordInput = document.getElementById('password');

  // Check if already authenticated
  checkAuthStatus();

  // Handle form submission
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const username = usernameInput.value.trim();
    const password = passwordInput.value;

    if (!username || !password) {
      showAlert('Please enter both username and password', 'error');
      return;
    }

    // Disable form during login
    setLoading(true);
    hideAlert();

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        showAlert('Login successful! Redirecting...', 'success');

        // Redirect to dashboard after short delay
        setTimeout(() => {
          window.location.href = '/dashboard';
        }, 1000);
      } else {
        showAlert(data.error || 'Login failed', 'error');
        setLoading(false);

        // Clear password field on error
        passwordInput.value = '';
        passwordInput.focus();
      }
    } catch (error) {
      console.error('Login error:', error);
      showAlert('Connection error. Please try again.', 'error');
      setLoading(false);
    }
  });

  // Check authentication status
  async function checkAuthStatus() {
    try {
      const response = await fetch('/api/auth/status');
      const data = await response.json();

      // If already authenticated, redirect to dashboard
      if (data.authenticated) {
        window.location.href = '/dashboard';
      }
    } catch (error) {
      console.error('Auth check error:', error);
    }
  }

  // Show alert message
  function showAlert(message, type) {
    alertMessage.textContent = message;
    alertMessage.className = `alert alert-${type}`;
    alertMessage.classList.remove('hidden');
  }

  // Hide alert message
  function hideAlert() {
    alertMessage.classList.add('hidden');
  }

  // Set loading state
  function setLoading(loading) {
    loginBtn.disabled = loading;

    if (loading) {
      loginBtnText.classList.add('hidden');
      loginSpinner.classList.remove('hidden');
    } else {
      loginBtnText.classList.remove('hidden');
      loginSpinner.classList.add('hidden');
    }
  }

  // Focus username field on load
  usernameInput.focus();

  // Clear any previous error on input
  [usernameInput, passwordInput].forEach(input => {
    input.addEventListener('input', () => {
      if (!alertMessage.classList.contains('hidden')) {
        hideAlert();
      }
    });
  });
});
