function handleGoogleSignIn() {
    console.log('Attempting Google sign in...');
    chrome.identity.getAuthToken({ interactive: true }, function(token) {
        if (chrome.runtime.lastError) {
            console.error('Auth Error:', chrome.runtime.lastError);
            return;
        }
        console.log('Got token:', token);
    });
}

// Wait for DOM to load
window.addEventListener('DOMContentLoaded', function() {
    const googleBtn = document.getElementById('login-button');
    if (googleBtn) {
        googleBtn.onclick = handleGoogleSignIn;
    }
}); 